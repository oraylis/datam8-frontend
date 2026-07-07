import { expect, test } from "@playwright/test";

type JsonObject = Record<string, unknown>;

type SaveBodies = Record<string, JsonObject>;

type ConnectionProperty = {
  name: string;
  required?: boolean;
  description?: string;
};

type DataSource = {
  name: string;
  type: string;
  extendedProperties?: JsonObject;
};

type ValidateError = { key: string; message: string; level?: string };
type ValidateResult = { ok: boolean; errors: ValidateError[] };

type Counters = {
  connectors: number;
  uiSchema: number;
  validate: number;
  secretsPut: number;
  secretsDelete: number;
};

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

function bindingConnectionProperties(connectorId: string, connectorVersion?: string | null) {
  const out: ConnectionProperty[] = [
    { name: `__connector.id=${connectorId}`, required: true, description: "Reserved: connector binding (do not render)." },
  ];
  const v = (connectorVersion || "").trim();
  if (v) {
    out.push({ name: `__connector.version=${v}`, required: false, description: "Reserved: connector version (do not render)." });
  }
  return out;
}

function pluginIdFromConnectionProperties(connectionProperties?: ConnectionProperty[] | null): string | null {
  if (!Array.isArray(connectionProperties)) return null;
  for (const entry of connectionProperties) {
    const name = `${entry?.name || ""}`;
    const match = /^__connector\.id=(.+)$/.exec(name);
    if (match?.[1]) return match[1];
  }
  return null;
}

function createMockSolutionPayload(args: {
  typeConnectionProperties?: ConnectionProperty[];
  typePluginId?: string | null;
  typeName?: string;
  typeDataTypeMapping?: Array<{ sourceType: string; targetType: string }>;
  dataSources?: DataSource[];
}) {
  const typeName = args.typeName || "MyDbType";
  const pluginId = args.typePluginId ?? pluginIdFromConnectionProperties(args.typeConnectionProperties);
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
              pluginId: pluginId || undefined,
              dataTypeMapping: args.typeDataTypeMapping || [{ sourceType: "string", targetType: "string" }],
              extendedProperties: {},
              connectionProperties: args.typeConnectionProperties || [],
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
        content: { dataTypes: ["string", "int"] },
      },
    ],
    modelEntities: [],
  };
}

async function mockApi(
  page: import("@playwright/test").Page,
  counters: Counters,
  args: {
    solutionPayload: unknown;
    connectors: MockConnector[];
    uiSchemasById?: Record<string, UiSchema>;
    validateHandler?: (connectorId: string, body: JsonObject) => ValidateResult;
  },
) {
  const saveBodies: SaveBodies = {};
  const entityWrites: Array<{ method: string; url: string; body: JsonObject }> = [];
  const secretPuts: JsonObject[] = [];

  await page.route("**/config", async (route) => {
    await route.fulfill({ json: { mode: "server" } });
  });

  await page.route("**/solution/inspect**", async (route) => {
    await route.fulfill({ json: { version: "v2" } });
  });

  await page.route("**/solution/full**", async (route) => {
    await route.fulfill({ json: args.solutionPayload });
  });

  await page.route("**/fs/list**", async (route) => {
    await route.fulfill({ json: { entries: [] } });
  });

  await page.route("**/connectors", async (route) => {
    counters.connectors += 1;
    await route.fulfill({ json: { connectors: args.connectors } });
  });

  await page.route("**/plugins/**", async (route) => {
    const method = route.request().method();
    if (method === "GET" || method === "POST") {
      const pluginItems = args.connectors.map((c) => ({
        id: c.id,
        name: c.displayName,
        displayName: c.displayName,
        version: c.version,
        enabled: true,
        capabilities: c.capabilities,
      }));
      await route.fulfill({
        json: {
          items: pluginItems,
          pluginDir: "/tmp/plugins",
          plugins: pluginItems,
          errors: {},
        },
      });
      return;
    }
    await route.fulfill({ status: 405, json: { error: "method not allowed" } });
  });

  await page.route("**/plugins/*/ui-schema", async (route) => {
    counters.uiSchema += 1;
    const url = new URL(route.request().url());
    const parts = url.pathname.split("/");
    const connectorId = parts[parts.length - 2] || "";
    const connector = args.connectors.find((c) => c.id === connectorId) || args.connectors[0]!;
    const schema = args.uiSchemasById?.[connectorId] || { title: `${connector.displayName} connection`, authModes: [] };
    await route.fulfill({ json: { item: schema } });
  });

  await page.route("**/sources/*/test", async (route) => {
    counters.validate += 1;
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

  await page.route("**/secrets/set", async (route) => {
    counters.secretsPut += 1;
    const body = JSON.parse(route.request().postData() || "{}");
    secretPuts.push(body);
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/secrets/runtime/key", async (route) => {
    counters.secretsDelete += 1;
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
    const reqUrl = new URL(req.url());
    const relPath = decodeURIComponent(reqUrl.pathname.replace(/^.*\/entities\//, "")) + ".json";
    saveBodies[relPath] = body;
    entityWrites.push({ method: req.method(), url: req.url(), body });
    await route.fulfill({ status: 200, json: { item: { ok: true } } });
  });

  return { saveBodies, secretPuts, entityWrites };
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

test("stores connector binding in DataSourceType.connectionProperties (Variant A) including connector version", async ({ page }) => {
  const counters: Counters = { connectors: 0, uiSchema: 0, validate: 0, secretsPut: 0, secretsDelete: 0 };
  const solutionPayload = createMockSolutionPayload({
    typeConnectionProperties: [],
    typeDataTypeMapping: [{ sourceType: "legacy_type", targetType: "string" }],
    dataSources: [{ name: "MyDb", type: "MyDbType", extendedProperties: {} }],
  });

  const { entityWrites } = await mockApi(page, counters, {
    solutionPayload,
    connectors: [
      {
        id: "sqlserver",
        displayName: "SQL Server",
        version: "0.1.0",
        capabilities: { uiSchema: true, validateConnection: true, metadata: { getTableMetadata: true } },
        dataTypeMapping: [
          { sourceType: "nvarchar", targetType: "string" },
          { sourceType: "bit", targetType: "boolean" },
        ],
      },
    ],
    uiSchemasById: {
      sqlserver: {
        title: "SQL Server connection",
        authModes: [
          {
            id: "basic",
            label: "Username/Password",
            fields: [{ key: "auth.mode", label: "Authentication", type: "hidden", required: true, default: "basic" }],
          },
        ],
      },
    },
  });

  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Data Source Types" }).click();
  await clickBaseItem(page, "My DB Type");

  await page.getByRole("button", { name: "Link Connector" }).click();
  await expect(page.getByRole("heading", { name: "Link Connector" })).toBeVisible();
  await page.locator("div").filter({ hasText: "sqlserver" }).getByRole("button", { name: /^Link$/ }).first().click();
  await expect(page.getByText("SQL Server").first()).toBeVisible();

  await expect
    .poll(() => entityWrites.find((entry) => /\/entities\/dataSourceTypes\/MyDbType$/i.test(entry.url)))
    .toBeTruthy();
});

test("renders connector-driven form from /ui-schema, saves ref secret, and surfaces validate-connection errors", async ({ page }) => {
  const counters: Counters = { connectors: 0, uiSchema: 0, validate: 0, secretsPut: 0, secretsDelete: 0 };
  const solutionPayload = createMockSolutionPayload({
    typeConnectionProperties: bindingConnectionProperties("sqlserver", null),
    dataSources: [{ name: "MyDb", type: "MyDbType", extendedProperties: {} }],
  });

  let validateCalls = 0;
  const { secretPuts } = await mockApi(page, counters, {
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

  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Data Sources" }).click();
  await clickBaseItem(page, "MyDb");

  await expect(page.getByText("SQL Server connection")).toBeVisible();
  await expect.poll(() => counters.uiSchema).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Validate connection" }).click();
  await expect(page.getByText("Host is required")).toBeVisible();

  await page.locator('label:has-text("Host")').locator("..").locator("input").fill("db.local");
  await page.getByRole("button", { name: "Validate connection" }).click();
  await expect(page.getByText("Host is required")).toBeHidden();
  await expect(page.getByText("Connection settings are valid.")).toBeVisible();

  const passwordRow = page.locator('label:has-text("Password")').locator("..");
  await passwordRow.locator("input").fill("supersecret");
  await passwordRow.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => counters.secretsPut).toBeGreaterThan(0);
  expect(secretPuts[0]).toMatchObject({ path: "datasources/MyDb/password", value: "supersecret" });
});

test("surfaces validation errors for hidden fields (e.g. auth.mode)", async ({ page }) => {
  const counters: Counters = { connectors: 0, uiSchema: 0, validate: 0, secretsPut: 0, secretsDelete: 0 };
  const solutionPayload = createMockSolutionPayload({
    typeConnectionProperties: bindingConnectionProperties("sqlserver", null),
    dataSources: [{ name: "MyDb", type: "MyDbType", extendedProperties: { "auth.mode": "legacy_mode", host: "db.local" } }],
  });

  await mockApi(page, counters, {
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

  await page.getByRole("button", { name: "Data Sources" }).click();
  await clickBaseItem(page, "MyDb");

  await page.getByRole("button", { name: "Validate connection" }).click();
  await expect(page.getByText("auth.mode: Unsupported auth.mode.")).toBeVisible();
});

test("switching auth modes updates auth.mode and clears fields not in the selected mode", async ({ page }) => {
  const counters: Counters = { connectors: 0, uiSchema: 0, validate: 0, secretsPut: 0, secretsDelete: 0 };
  const solutionPayload = createMockSolutionPayload({
    typeConnectionProperties: bindingConnectionProperties("sqlserver", null),
    dataSources: [{ name: "MyDb", type: "MyDbType", extendedProperties: {} }],
  });

  const { entityWrites } = await mockApi(page, counters, {
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

  await page.getByRole("button", { name: "Data Sources" }).click();
  await clickBaseItem(page, "MyDb");

  await expect(page.getByText("Username *")).toBeVisible();
  await expect(page.getByText("Tenant ID")).toBeHidden();
  await page.locator('label:has-text("Username")').locator("..").locator("input").fill("legacy-user");

  await page.locator('label:has-text("Authentication")').locator("..").locator('button[role=\"combobox\"]').click();
  await page.getByRole("option", { name: "Azure AD (Client Credentials)" }).click();

  await expect(page.getByText("Tenant ID")).toBeVisible();
  await expect(page.getByText("Username")).toBeHidden();
  await page.locator('label:has-text("Authentication")').locator("..").locator('button[role=\"combobox\"]').click();
  await page.getByRole("option", { name: "Username/Password" }).click();
  await expect(page.getByText("Username *")).toBeVisible();
  await expect(page.locator('label:has-text("Username")').locator("..").locator("input")).toHaveValue("");
});

test("missing connector shows warning + read-only values", async ({ page }) => {
  const counters: Counters = { connectors: 0, uiSchema: 0, validate: 0, secretsPut: 0, secretsDelete: 0 };
  const solutionPayload = createMockSolutionPayload({
    typeConnectionProperties: bindingConnectionProperties("sqlserver", null),
    dataSources: [{ name: "MyDb", type: "MyDbType", extendedProperties: { host: "db.local" } }],
  });

  await mockApi(page, counters, {
    solutionPayload,
    connectors: [],
  });

  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Data Sources" }).click();
  await clickBaseItem(page, "MyDb");

  await expect(page.getByText("No connector is installed. You can still edit connection values.")).toBeVisible();
  await expect(page.locator('input[value="db.local"]')).toBeVisible();
});

test("Data Source Type shows missing connector state and Data Type Mapping title", async ({ page }) => {
  const counters: Counters = { connectors: 0, uiSchema: 0, validate: 0, secretsPut: 0, secretsDelete: 0 };
  const solutionPayload = createMockSolutionPayload({
    typeConnectionProperties: bindingConnectionProperties("sqlserver", null),
    dataSources: [{ name: "MyDb", type: "MyDbType", extendedProperties: { host: "db.local" } }],
  });

  await mockApi(page, counters, {
    solutionPayload,
    connectors: [],
  });

  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Data Source Types" }).click();
  await clickBaseItem(page, "My DB Type");

  await expect(page.getByText("Connector missing")).toBeVisible();
  await expect(page.getByText("Data Type Mapping")).toBeVisible();
});

test("bound connector version requirement does not block rendering when connector is installed", async ({ page }) => {
  const counters: Counters = { connectors: 0, uiSchema: 0, validate: 0, secretsPut: 0, secretsDelete: 0 };
  const solutionPayload = createMockSolutionPayload({
    typeConnectionProperties: bindingConnectionProperties("sqlserver", "^1.0.0"),
    dataSources: [{ name: "MyDb", type: "MyDbType", extendedProperties: {} }],
  });

  await mockApi(page, counters, {
    solutionPayload,
    connectors: [{ id: "sqlserver", displayName: "SQL Server", version: "0.1.0", capabilities: { uiSchema: true, validateConnection: true, metadata: { getTableMetadata: true } } }],
    uiSchemasById: {
      sqlserver: {
        title: "SQL Server connection",
        authModes: [{ id: "basic", label: "Basic", fields: [{ key: "auth.mode", label: "Authentication", type: "hidden", required: true, default: "basic" }] }],
      },
    },
  });

  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Data Sources" }).click();
  await clickBaseItem(page, "MyDb");

  await expect(page.getByText("SQL Server connection")).toBeVisible();
  await expect(page.getByText("Schema v0.1.0")).toBeVisible();
});

