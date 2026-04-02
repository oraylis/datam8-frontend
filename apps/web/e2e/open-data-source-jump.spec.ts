import { expect, test } from "@playwright/test";

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
              name: "SqlType",
              displayName: "SQL",
              dataTypeMapping: [{ sourceType: "string", targetType: "string" }],
            },
          ],
        },
      },
      {
        name: "DataSources",
        relPath: "Base/DataSources.json",
        content: {
          dataSources: [
            { name: "OtherDs", type: "SqlType", extendedProperties: {} },
            { name: "SalesDwh", type: "SqlType", extendedProperties: {} },
          ],
        },
      },
      {
        name: "DataTypes",
        relPath: "Base/DataTypes.json",
        content: { dataTypes: ["string"] },
      },
    ],
    modelEntities: [
      {
        locator: "/Model/010-Stage/Sales/Orders/Customer",
        name: "Customer",
        relPath: "Model/010-Stage/Sales/Orders/Customer.json",
        content: {
          id: 1001,
          name: "Customer",
          sources: [
            {
              dataSource: "SalesDwh",
              sourceLocation: "dbo.Customer",
              sourceAlias: "srcCustomer",
            },
          ],
        },
      },
    ],
    folderEntities: [],
  };
}

async function mockApi(page: import("@playwright/test").Page) {
  const payload = createMockSolutionPayload();

  await page.route("**/config", async (route) => {
    await route.fulfill({ json: { mode: "server" } });
  });
  await page.route("**/model/save", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
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

  await page.route("**/plugins/**", async (route) => {
    await route.fulfill({ json: { items: [] } });
  });

  await page.route("**/connectors", async (route) => {
    await route.fulfill({ json: { connectors: [] } });
  });

  await page.route("**/secrets/available", async (route) => {
    await route.fulfill({ json: { available: false } });
  });

  await page.route("**/secrets/runtime", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
}

test("Open data source jumps to Data Sources and selects the referenced source", async ({ page }) => {
  await mockApi(page);
  await loadSolutionFromDialog(page);

  await page.getByRole("textbox", { name: "Filter model entities" }).fill("Customer");
  await page.getByRole("button", { name: "Customer" }).first().click();
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await page.getByRole("button", { name: "Open data source" }).click();

  const activeDataSourceItem = page.getByRole("table", { name: "Base items" }).getByRole("button").filter({ hasText: "SalesDwh" }).first();
  await expect(activeDataSourceItem).toBeVisible();
  await expect(page.locator(".item-title").first()).toHaveText("SalesDwh");
});

