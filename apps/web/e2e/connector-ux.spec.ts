import { expect, test } from "@playwright/test";

type JsonObject = Record<string, unknown>;

type DataSource = {
  name: string;
  type: string;
  extendedProperties?: JsonObject;
};

type ValidateError = { key: string; message: string; level?: string };
type ValidateResult = { ok: boolean; errors: ValidateError[] };

type MockConnector = {
  id: string;
  displayName: string;
  version: string;
  capabilities: {
    uiSchema?: boolean;
    validateConnection?: boolean;
    metadata?: { listTables?: boolean; getTableMetadata?: boolean };
  };
  dataTypeMapping?: Array<{ sourceType: string; targetType: string }>;
};

type UiSchema = {
  title?: string;
  authModes: Array<{
    id: string;
    label: string;
    fields: Array<{
      key: string;
      label: string;
      type: "string" | "number" | "boolean" | "enum" | "secret" | "textarea" | "hidden";
      required: boolean;
      default?: string;
      placeholder?: string;
      enum?: string[];
    }>;
  }>;
};

function createMockSolutionPayload(args: {
  pluginId?: string;
  typeName?: string;
  typeDataTypeMapping?: Array<{ sourceType: string; targetType: string }>;
  dataSources?: DataSource[];
}) {
  const typeName = args.typeName || "MyDbType";
  return {
    solution: {
      schemaVersion: "test",
      basePath: "Base",
      modelPath: "Model",
      pluginsPath: "plugins",
      generatorTargets: [{ name: "none", isDefault: true, sourcePath: "Generate", outputPath: "Output" }],
    },
    baseEntities: [
      {
        name: "DataSourceTypes",
        relPath: "Base/DataSourceTypes.json",
        content: {
          dataSourceTypes: [
            {
              name: typeName,
              displayName: "My DB Type",
              description: "Test type",
              pluginId: args.pluginId,
              dataTypeMapping: args.typeDataTypeMapping || [{ sourceType: "string", targetType: "string" }],
              extendedProperties: {},
              connectionProperties: [],
            },
          ],
        },
      },
      {
        name: "DataSources",
        relPath: "Base/DataSources.json",
        content: {
          dataSources:
            args.dataSources ||
            [
              {
                name: "MyDb",
                type: typeName,
                extendedProperties: {},
              },
            ],
        },
      },
      {
        name: "DataTypes",
        relPath: "Base/DataTypes.json",
        content: { dataTypes: [{ name: "string" }, { name: "int" }] },
      },
    ],
    modelEntities: [],
  };
}

async function mockApi(
  page: import("@playwright/test").Page,
  args: {
    solutionPayload: unknown;
    connectors: MockConnector[];
    uiSchemasById?: Record<string, UiSchema>;
    uiSchemaWaitById?: Record<string, Promise<void>>;
    onUiSchemaCompleted?: (connectorId: string) => void;
    validateHandler?: (connectorId: string, body: JsonObject) => ValidateResult;
  },
) {
  const entityWrites: Array<{ method: string; url: string; body: JsonObject }> = [];
  const secretPuts: JsonObject[] = [];

  await page.route("**/config", async (route) => {
    await route.fulfill({ json: { mode: "server" } });
  });

  await page.route("**/solution/full**", async (route) => {
    await route.fulfill({ json: args.solutionPayload });
  });

  await page.route("**/plugins", async (route) => {
    await route.fulfill({ json: { items: args.connectors } });
  });

  await page.route("**/plugins/*/ui-schema", async (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split("/");
    const connectorId = parts[parts.length - 2] || "";
    const connector = args.connectors.find((c) => c.id === connectorId) || args.connectors[0]!;
    const schema = args.uiSchemasById?.[connectorId] || { title: `${connector.displayName} connection`, authModes: [] };
    await args.uiSchemaWaitById?.[connectorId];
    try { await route.fulfill({ json: { item: schema } }); }
    finally { args.onUiSchemaCompleted?.(connectorId); }
  });

  await page.route("**/sources/*/test", async (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split("/");
    const connectorId = parts[parts.length - 2] || "";
    const body = JSON.parse(route.request().postData() || "{}") as JsonObject;
    const out =
      args.validateHandler?.(connectorId, body) || { ok: true, errors: [] };
    if (out.ok) {
      await route.fulfill({ status: 200, json: {} });
      return;
    }
    const firstError = out.errors[0];
    const lines = out.errors.map((entry) => `${entry.key}: ${entry.message}`);
    await route.fulfill({ status: 500, json: { message: lines.join("\n") || firstError?.message || "Validation failed" } });
  });

  await page.route("**/secrets/set**", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    secretPuts.push(body);
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/model/save", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/entities/**", async (route) => {
    const req = route.request();
    if (req.method() !== "PATCH" && req.method() !== "PUT" && req.method() !== "DELETE") {
      await route.fulfill({ status: 405, json: { error: "method not allowed" } });
      return;
    }
    const raw = req.postData() || "{}";
    const body = (req.method() === "DELETE" ? {} : JSON.parse(raw)) as JsonObject;
    entityWrites.push({ method: req.method(), url: req.url(), body });
    await route.fulfill({ status: 200, json: { item: { ok: true } } });
  });

  return { secretPuts, entityWrites };
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
  await page.getByRole("tab", { name: "Base" }).click();
}

async function clickBaseItem(page: import("@playwright/test").Page, name: string) {
  await page
    .getByRole("table")
    .getByRole("button")
    .filter({ hasText: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
    .first()
    .click();
}

test("linking a connector persists its plugin ID and suggested mapping", async ({ page }) => {
  const mapping = [{ sourceType: "nvarchar", targetType: "string" }];
  const { entityWrites } = await mockApi(page, {
    solutionPayload: createMockSolutionPayload({
      typeDataTypeMapping: [{ sourceType: "old_type", targetType: "string" }],
    }),
    connectors: [{ id: "sqlserver", displayName: "SQL Server", version: "0.1.0", capabilities: { uiSchema: true } }],
  });
  await page.route("**/plugins/sqlserver/connection-properties", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/plugins/sqlserver/data-type-mappings", (route) =>
    route.fulfill({ json: { items: mapping } }),
  );

  await loadSolutionFromDialog(page);
  await page.getByRole("button", { name: "Data Source Types" }).click();
  await clickBaseItem(page, "My DB Type");
  await page.getByRole("button", { name: "Link Connector" }).click();

  const saved = page.waitForResponse("**/model/save", { timeout: 8000 });
  await page.getByRole("dialog", { name: "Link Connector" }).getByRole("button", { name: "Link", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  expect(entityWrites).toContainEqual(expect.objectContaining({
    method: "PATCH",
    url: expect.stringMatching(/\/entities\/dataSourceTypes\/MyDbType$/i),
    body: expect.objectContaining({ pluginId: "sqlserver", dataTypeMapping: mapping }),
  }));
});

test("renders connector-driven form from /ui-schema, saves ref secret, and surfaces validate-connection errors", async ({ page }) => {
  const solutionPayload = createMockSolutionPayload({
    pluginId: "sqlserver",
    dataSources: [{ name: "MyDb", type: "MyDbType", extendedProperties: {} }],
  });

  let validateCalls = 0;
  const { entityWrites, secretPuts } = await mockApi(page, {
    solutionPayload,
    connectors: [{ id: "sqlserver", displayName: "SQL Server", version: "0.1.0", capabilities: { uiSchema: true, validateConnection: true, metadata: { getTableMetadata: true } } }],
    uiSchemasById: {
      sqlserver: {
        title: "SQL Server connection",
        authModes: [
          {
            id: "basic",
            label: "Username/Password",
            fields: [
              { key: "auth.mode", label: "Authentication", type: "hidden", required: true, default: "basic" },
              { key: "host", label: "Host", type: "string", required: true, placeholder: "db.local" },
              { key: "username", label: "Username", type: "string", required: true },
              { key: "password", label: "Password", type: "secret", required: true },
            ],
          },
          {
            id: "aad_client_credentials",
            label: "Azure AD (Client Credentials)",
            fields: [
              { key: "auth.mode", label: "Authentication", type: "hidden", required: true, default: "aad_client_credentials" },
              { key: "host", label: "Host", type: "string", required: true },
              { key: "tenantId", label: "Tenant ID", type: "string", required: true },
              { key: "clientId", label: "Client ID", type: "string", required: true },
              { key: "clientSecret", label: "Client Secret", type: "secret", required: true },
            ],
          },
        ],
      },
    },
    validateHandler: () => {
      validateCalls += 1;
      if (validateCalls === 1) {
        return { ok: false, errors: [{ key: "host", message: "Host is required", level: "error" }] };
      }
      return { ok: true, errors: [] };
    },
  });
  await page.route("**/secrets/check", (route) => route.fulfill({ status: 204, body: "" }));

  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Data Sources", exact: true }).click();
  await clickBaseItem(page, "MyDb");

  await expect(page.getByText("SQL Server connection")).toBeVisible();
  await expect(page.getByText("Schema v0.1.0")).toBeVisible();

  await page.getByRole("button", { name: "Validate connection" }).click();
  await expect(page.getByText("Host is required")).toBeVisible();
  expect(entityWrites).toHaveLength(0);

  await page.locator('label:has-text("Host")').locator("..").locator("input").fill("db.local");
  await page.getByRole("button", { name: "Validate connection" }).click();
  await expect(page.getByText("Host is required")).toBeHidden();
  await expect(page.getByText("Connection settings are valid.")).toBeVisible();

  const passwordRow = page.locator('label:has-text("Password")').locator("..");
  await passwordRow.locator("input").fill("supersecret");
  await passwordRow.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => secretPuts).toEqual([{ path: "datasources/MyDb/password", value: "supersecret" }]);
  await expect.poll(() => entityWrites.at(-1)?.body.extendedProperties).toMatchObject({
    password: "ref://datasources/MyDb/password",
  });
  await expect(passwordRow.getByText("Secret available", { exact: true })).toBeVisible();
});

test("typing connection values keeps secret availability stable without rechecking", async ({ page }) => {
  const secretPath = "datasources/MyDb/password";
  const solutionPayload = createMockSolutionPayload({
    pluginId: "sqlserver",
    dataSources: [{
      name: "MyDb",
      type: "MyDbType",
      extendedProperties: { authMode: "basic", host: "db", password: `ref://${secretPath}` },
    }],
  });

  await mockApi(page, {
    solutionPayload,
    connectors: [{ id: "sqlserver", displayName: "SQL Server", version: "0.1.0", capabilities: { uiSchema: true } }],
    uiSchemasById: {
      sqlserver: {
        title: "SQL Server connection",
        authModes: [{
          id: "basic",
          label: "Username/Password",
          fields: [
            { key: "host", label: "Host", type: "string", required: true },
            { key: "password", label: "Password", type: "secret", required: true },
          ],
        }],
      },
    },
  });

  const secretChecks: unknown[] = [];
  await page.route("**/secrets/check", async (route) => {
    secretChecks.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: null });
  });

  let releaseFirstWrite!: () => void;
  const firstWriteWait = new Promise<void>((resolve) => { releaseFirstWrite = resolve; });
  const savedHosts: string[] = [];
  await page.route("**/entities/dataSources/MyDb", async (route) => {
    savedHosts.push(route.request().postDataJSON().extendedProperties.host);
    if (savedHosts.length === 1) await firstWriteWait;
    await route.fulfill({ status: 200, json: { item: { ok: true } } });
  });

  await loadSolutionFromDialog(page);
  await page.getByRole("button", { name: "Data Sources", exact: true }).click();
  await clickBaseItem(page, "MyDb");
  const availableBadge = page.getByText("Secret available", { exact: true });
  await expect(availableBadge).toBeVisible();
  expect(secretChecks).toEqual([{ path: secretPath }]);

  const hostInput = page.locator('label:has-text("Host")').locator("..").locator("input");
  await hostInput.focus();
  await hostInput.press("End");
  let expectedHost = "db";
  for (const character of ".example.invalid") {
    await hostInput.press(character);
    expectedHost += character;
    await expect(hostInput).toHaveValue(expectedHost);
    await expect(hostInput).toBeFocused();
    await expect(availableBadge).toBeVisible();
    expect(secretChecks).toEqual([{ path: secretPath }]);
    if (expectedHost === "db.") {
      await expect.poll(() => savedHosts).toEqual([expectedHost]);
    } else if (expectedHost === "db.e") {
      // Complete an older save only after a newer character has reached the draft.
      releaseFirstWrite();
      await expect.poll(() => savedHosts.at(-1)).toBe(expectedHost);
      await expect(hostInput).toHaveValue(expectedHost);
    }
  }
  await expect.poll(() => savedHosts.at(-1)).toBe(expectedHost);
  await expect(hostInput).toHaveValue(expectedHost);
  await expect(hostInput).toBeFocused();
  expect(secretChecks).toEqual([{ path: secretPath }]);
});

test("surfaces validation errors for hidden fields (e.g. auth.mode)", async ({ page }) => {
  const solutionPayload = createMockSolutionPayload({
    pluginId: "sqlserver",
    dataSources: [{ name: "MyDb", type: "MyDbType", extendedProperties: { "auth.mode": "legacy_mode", host: "db.local" } }],
  });

  await mockApi(page, {
    solutionPayload,
    connectors: [{ id: "sqlserver", displayName: "SQL Server", version: "0.1.0", capabilities: { uiSchema: true, validateConnection: true, metadata: { getTableMetadata: true } } }],
    uiSchemasById: {
      sqlserver: {
        title: "SQL Server connection",
        authModes: [
          {
            id: "sql_user",
            label: "Username/Password",
            fields: [
              { key: "auth.mode", label: "Authentication", type: "hidden", required: true, default: "sql_user" },
              { key: "host", label: "Host", type: "string", required: true },
            ],
          },
        ],
      },
    },
    validateHandler: () => ({
      ok: false,
      errors: [{ key: "auth.mode", message: "Unsupported auth.mode.", level: "error" }],
    }),
  });

  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Data Sources", exact: true }).click();
  await clickBaseItem(page, "MyDb");

  await page.getByRole("button", { name: "Validate connection" }).click();
  await expect(page.getByText("auth.mode: Unsupported auth.mode.")).toBeVisible();
});

test("switching auth modes persists the mode and clears fields not in the selected mode", async ({ page }) => {
  const solutionPayload = createMockSolutionPayload({
    pluginId: "sqlserver",
    dataSources: [{ name: "MyDb", type: "MyDbType", extendedProperties: {} }],
  });

  const { entityWrites } = await mockApi(page, {
    solutionPayload,
    connectors: [{ id: "sqlserver", displayName: "SQL Server", version: "0.1.0", capabilities: { uiSchema: true, validateConnection: true, metadata: { getTableMetadata: true } } }],
    uiSchemasById: {
      sqlserver: {
        title: "SQL Server connection",
        authModes: [
          {
            id: "basic",
            label: "Username/Password",
            fields: [
              { key: "auth.mode", label: "Authentication", type: "hidden", required: true, default: "basic" },
              { key: "username", label: "Username", type: "string", required: true },
              { key: "password", label: "Password", type: "secret", required: true },
            ],
          },
          {
            id: "aad_client_credentials",
            label: "Azure AD (Client Credentials)",
            fields: [
              { key: "auth.mode", label: "Authentication", type: "hidden", required: true, default: "aad_client_credentials" },
              { key: "tenantId", label: "Tenant ID", type: "string", required: true },
              { key: "clientId", label: "Client ID", type: "string", required: true },
              { key: "clientSecret", label: "Client Secret", type: "secret", required: true },
            ],
          },
        ],
      },
    },
  });

  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Data Sources", exact: true }).click();
  await clickBaseItem(page, "MyDb");

  await expect(page.getByText("Username *")).toBeVisible();
  await expect(page.getByText("Tenant ID")).toBeHidden();
  await page.locator('label:has-text("Username")').locator("..").locator("input").fill("legacy-user");

  await page.locator('label:has-text("Authentication")').locator("..").locator('button[role=\"combobox\"]').click();
  await page.getByRole("option", { name: "Azure AD (Client Credentials)" }).click();

  await expect(page.getByText("Tenant ID")).toBeVisible();
  await expect(page.getByText("Username")).toBeHidden();
  await expect.poll(() => entityWrites.at(-1)?.body.extendedProperties).toEqual({
    authMode: "aad_client_credentials",
  });
  await page.locator('label:has-text("Authentication")').locator("..").locator('button[role=\"combobox\"]').click();
  await page.getByRole("option", { name: "Username/Password" }).click();
  await expect(page.getByText("Username *")).toBeVisible();
  await expect(page.locator('label:has-text("Username")').locator("..").locator("input")).toHaveValue("");
});

test("switching data sources with the same auth mode does not rewrite connector-specific fields", async ({ page }) => {
  const solutionPayload = createMockSolutionPayload({
    dataSources: [
      {
        name: "UnityDb",
        type: "UnityType",
        extendedProperties: { authMode: "bitbucket_server_bearer_token", uc_name: "dbr-mobilfunk-ingest" },
      },
      {
        name: "SqlDb",
        type: "SqlType",
        extendedProperties: {
          authMode: "bitbucket_server_bearer_token",
          uc_connection_name: "dbr-mobilfunk-ingest",
          database: "mavenir",
        },
      },
    ],
  }) as any;
  solutionPayload.baseEntities[0].content.dataSourceTypes = [
    {
      name: "UnityType",
      displayName: "Unity Catalog",
      pluginId: "unity_catalog",
      dataTypeMapping: [],
    },
    {
      name: "SqlType",
      displayName: "SQL Server",
      pluginId: "sqlserver",
      dataTypeMapping: [],
    },
  ];

  const { entityWrites } = await mockApi(page, {
    solutionPayload,
    connectors: [
      { id: "unity_catalog", displayName: "Unity Catalog", version: "0.1.0", capabilities: { uiSchema: true, validateConnection: true } },
      { id: "sqlserver", displayName: "SQL Server", version: "0.1.0", capabilities: { uiSchema: true, validateConnection: true } },
    ],
    uiSchemasById: {
      unity_catalog: {
        title: "Unity Catalog connection",
        authModes: [
          {
            id: "bitbucket_server_bearer_token",
            label: "Bitbucket Server Bearer Token",
            fields: [
              { key: "auth.mode", label: "Authentication", type: "hidden", required: true, default: "bitbucket_server_bearer_token" },
              { key: "uc_name", label: "UC Name", type: "string", required: true },
            ],
          },
        ],
      },
      sqlserver: {
        title: "SQL Server connection",
        authModes: [
          {
            id: "bitbucket_server_bearer_token",
            label: "Bitbucket Server Bearer Token",
            fields: [
              { key: "auth.mode", label: "Authentication", type: "hidden", required: true, default: "bitbucket_server_bearer_token" },
              { key: "uc_connection_name", label: "UC Connection Name", type: "string", required: true },
              { key: "database", label: "Database", type: "string", required: true },
            ],
          },
        ],
      },
    },
  });

  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Data Sources", exact: true }).click();
  await clickBaseItem(page, "UnityDb");
  await expect(page.getByText("UC Name *")).toBeVisible();
  await expect(page.locator('label:has-text("UC Name")').locator("..").locator("input")).toHaveValue("dbr-mobilfunk-ingest");

  await clickBaseItem(page, "SqlDb");
  await expect(page.getByText("UC Connection Name *")).toBeVisible();
  await expect(page.locator('label:has-text("UC Connection Name")').locator("..").locator("input")).toHaveValue("dbr-mobilfunk-ingest");
  await expect(page.locator('label:has-text("Database")').locator("..").locator("input")).toHaveValue("mavenir");

  await clickBaseItem(page, "UnityDb");
  await expect(page.getByText("UC Name *")).toBeVisible();
  await expect(page.locator('label:has-text("UC Name")').locator("..").locator("input")).toHaveValue("dbr-mobilfunk-ingest");
  await page.getByRole("button", { name: "Close Data Sources", exact: true }).click();

  expect(entityWrites).toHaveLength(0);
});

test("late connector ui schema responses are ignored after selecting another data source", async ({ page }) => {
  let completeSchema!: () => void;
  const schemaCompleted = new Promise<void>(resolve => { completeSchema = resolve; });
  let releaseSchema!: () => void;
  const schemaWait = new Promise<void>(resolve => { releaseSchema = resolve; });
  const solutionPayload = createMockSolutionPayload({
    dataSources: [
      {
        name: "SqlDb",
        type: "SqlType",
        extendedProperties: { authMode: "bitbucket_server_bearer_token", uc_connection_name: "sql-old" },
      },
      {
        name: "UnityDb",
        type: "UnityType",
        extendedProperties: { authMode: "bitbucket_server_bearer_token", uc_name: "unity-current" },
      },
    ],
  }) as any;
  solutionPayload.baseEntities[0].content.dataSourceTypes = [
    {
      name: "SqlType",
      displayName: "SQL Server",
      pluginId: "sqlserver",
      dataTypeMapping: [],
    },
    {
      name: "UnityType",
      displayName: "Unity Catalog",
      pluginId: "unity_catalog",
      dataTypeMapping: [],
    },
  ];

  const { entityWrites } = await mockApi(page, {
    solutionPayload,
    connectors: [
      { id: "sqlserver", displayName: "SQL Server", version: "0.1.0", capabilities: { uiSchema: true, validateConnection: true } },
      { id: "unity_catalog", displayName: "Unity Catalog", version: "0.1.0", capabilities: { uiSchema: true, validateConnection: true } },
    ],
    uiSchemaWaitById: { sqlserver: schemaWait },
    onUiSchemaCompleted: id => { if (id === "sqlserver") completeSchema(); },
    uiSchemasById: {
      sqlserver: {
        title: "SQL Server connection",
        authModes: [
          {
            id: "bitbucket_server_bearer_token",
            label: "Bitbucket Server Bearer Token",
            fields: [
              { key: "auth.mode", label: "Authentication", type: "hidden", required: true, default: "bitbucket_server_bearer_token" },
              { key: "uc_connection_name", label: "UC Connection Name", type: "string", required: true },
            ],
          },
        ],
      },
      unity_catalog: {
        title: "Unity Catalog connection",
        authModes: [
          {
            id: "bitbucket_server_bearer_token",
            label: "Bitbucket Server Bearer Token",
            fields: [
              { key: "auth.mode", label: "Authentication", type: "hidden", required: true, default: "bitbucket_server_bearer_token" },
              { key: "uc_name", label: "UC Name", type: "string", required: true },
            ],
          },
        ],
      },
    },
  });

  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Data Sources", exact: true }).click();
  await clickBaseItem(page, "SqlDb");
  await expect(page.getByText("Loading connector schema...")).toBeVisible();
  await clickBaseItem(page, "UnityDb");

  await expect(page.getByText("UC Name *")).toBeVisible();
  await expect(page.getByText("UC Connection Name")).toBeHidden();
  await expect(page.locator('label:has-text("UC Name")').locator("..").locator("input")).toHaveValue("unity-current");
  releaseSchema();
  await schemaCompleted;

  await expect(page.getByText("UC Name *")).toBeVisible();
  await expect(page.getByText("UC Connection Name")).toBeHidden();
  expect(entityWrites).toHaveLength(0);
});

test("missing connector leaves connection values editable and identifies the missing plugin", async ({ page }) => {
  await mockApi(page, {
    solutionPayload: createMockSolutionPayload({
      pluginId: "sqlserver",
      dataSources: [{ name: "MyDb", type: "MyDbType", extendedProperties: { host: "db.local" } }],
    }),
    connectors: [],
  });

  await loadSolutionFromDialog(page);
  await page.getByRole("button", { name: "Data Sources", exact: true }).click();
  await clickBaseItem(page, "MyDb");
  await expect(page.getByText("No connector is installed. You can still edit connection values.")).toBeVisible();
  await expect(page.locator('input[value="db.local"]')).toBeEditable();

  await page.getByRole("button", { name: "Data Source Types" }).click();
  await clickBaseItem(page, "My DB Type");
  await expect(page.getByText("Connector missing")).toBeVisible();
  await expect(page.getByText("Data Type Mapping")).toBeVisible();
});
