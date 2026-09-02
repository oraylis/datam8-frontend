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
              pluginId: "builtin:SQLServer",
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
      {
        locator: "/Model/010-Stage/Sales/Orders/Product",
        name: "Product",
        relPath: "Model/010-Stage/Sales/Orders/Product.json",
        content: {
          id: 1002,
          name: "Product",
          sources: [
            {
              dataSource: "SalesDwh",
              sourceLocation: "dbo.Product",
              sourceAlias: "srcProduct",
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
    await route.fulfill({ json: { items: [{
      id: "builtin:SQLServer",
      displayName: "SQL Server",
      version: "1",
      capabilities: { metadata: { listTables: true, getTableMetadata: true } },
      dataTypeMapping: [],
    }] } });
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

test("External source refresh opens the shared dialog with only the clicked source selected", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("datam8-ui-theme-v2", "light"));
  await mockApi(page);
  await loadSolutionFromDialog(page);

  await page.getByRole("textbox", { name: "Filter model entities" }).fill("Customer");
  await page.getByRole("button", { name: "Customer" }).first().click();
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open data source" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Adopt Schema" })).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh schema", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Refresh schemas" })).toBeVisible();
  const customerRow = dialog.getByRole("row").filter({ hasText: "Customer" });
  const productRow = dialog.getByRole("row").filter({ hasText: "Product" });
  await expect(customerRow).toBeVisible();
  await expect(productRow).toBeVisible();
  await expect(customerRow.getByRole("checkbox")).toBeChecked();
  await expect(productRow.getByRole("checkbox")).not.toBeChecked();

  const groupToggle = dialog.getByRole("button", { name: /Collapse data source SalesDwh/ });
  await expect(groupToggle).toHaveAttribute("aria-expanded", "true");
  await dialog.screenshot({ path: "output/playwright/external-schema-grouping-light.png" });
  await groupToggle.click();
  await expect(customerRow).toBeHidden();
  await expect(productRow).toBeHidden();
  await dialog.getByRole("button", { name: /Expand data source SalesDwh/ }).click();
  await expect(customerRow.getByRole("checkbox")).toBeChecked();
  await expect(productRow.getByRole("checkbox")).not.toBeChecked();

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Refresh schema", exact: true }).click();
  await dialog.screenshot({ path: "output/playwright/external-schema-grouping-dark.png" });
});

