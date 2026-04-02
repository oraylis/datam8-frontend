import { expect, test } from "@playwright/test";

type SaveBodies = Record<string, unknown>;

function createMockSolutionPayload() {
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
              name: "MyDbType",
              displayName: "My DB Type",
              dataTypeMapping: [{ sourceType: "string", targetType: "string" }],
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
          dataSources: [{ name: "MyDb", type: "MyDbType", extendedProperties: { stale: "value" } }],
        },
      },
      {
        name: "DataTypes",
        relPath: "Base/DataTypes.json",
        content: { dataTypes: ["string"] },
      },
    ],
    modelEntities: [],
  };
}

async function mockApi(page: import("@playwright/test").Page) {
  const payload = createMockSolutionPayload();
  const saveBodies: SaveBodies = {};

  await page.route("**/config", async (route) => {
    await route.fulfill({ json: { mode: "server" } });
  });

  await page.route("**/solution/inspect**", async (route) => {
    await route.fulfill({ json: { version: "v2" } });
  });

  await page.route("**/solution/full**", async (route) => {
    await route.fulfill({ json: payload });
  });

  await page.route("**/fs/list**", async (route) => {
    await route.fulfill({ json: { entries: [] } });
  });

  await page.route("**/connectors", async (route) => {
    await route.fulfill({
      json: {
        connectors: [
          {
            id: "sqlserver",
            displayName: "SQL Server",
            version: "0.1.0",
            capabilities: { uiSchema: true, metadata: { getTableMetadata: true } },
            dataTypeMapping: [
              { sourceType: "nvarchar", targetType: "string" },
              { sourceType: "bit", targetType: "boolean" },
            ],
          },
        ],
      },
    });
  });

  await page.route("**/plugins/**", async (route) => {
    const method = route.request().method();
    if (method === "GET" || method === "POST") {
      const pluginItems = [{ id: "sqlserver", name: "SQL Server", displayName: "SQL Server", version: "0.1.0", enabled: true }];
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

  await page.route("**/secrets/available", async (route) => {
    await route.fulfill({ json: { available: false } });
  });

  await page.route("**/secrets/runtime**", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/model/save", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/entities/**", async (route) => {
    const req = route.request();
    if (req.method() !== "PATCH" && req.method() !== "PUT") {
      await route.fulfill({ status: 405, json: { error: "method not allowed" } });
      return;
    }
    const body = JSON.parse(req.postData() || "{}");
    const reqUrl = new URL(req.url());
    const relPath = decodeURIComponent(reqUrl.pathname.replace(/^.*\/entities\//, "")) + ".json";
    saveBodies[relPath] = body;
    await route.fulfill({ status: 200, json: { ok: true } });
  });

  return { saveBodies };
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

test("autosave persists dirty base tabs without manual save", async ({ page }) => {
  const { saveBodies } = await mockApi(page);

  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Data Source Types", exact: true }).click();
  await clickBaseItem(page, "My DB Type");

  await page.getByRole("button", { name: "Link Connector" }).click();
  await expect(page.getByRole("heading", { name: "Link Connector" })).toBeVisible();
  await page.locator("div").filter({ hasText: "sqlserver" }).getByRole("button", { name: /^Link$/ }).first().click();

  await expect(page.getByRole("button", { name: "Save All" })).toHaveCount(0);

  await expect
    .poll(() => Object.keys(saveBodies).length > 0, { timeout: 10_000 })
    .toBe(true);
});

