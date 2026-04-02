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
        name: "AttributeTypes",
        relPath: "Base/AttributeTypes.json",
        content: {
          attributeTypes: [{ name: "ID" }, { name: "Text" }],
        },
      },
      {
        name: "DataTypes",
        relPath: "Base/DataTypes.json",
        content: {
          dataTypes: [{ name: "int" }, { name: "string" }, { name: "decimal", hasPrecision: true, hasScale: true }],
        },
      },
      {
        name: "DataProducts",
        relPath: "Base/DataProducts.json",
        content: {
          dataProducts: [{ name: "ProductA", dataModules: [{ name: "ModuleA" }] }],
        },
      },
      {
        name: "Properties",
        relPath: "Base/Properties.json",
        content: { properties: [] },
      },
      {
        name: "DataSources",
        relPath: "Base/DataSources.json",
        content: { dataSources: [] },
      },
    ],
    modelEntities: [
      {
        locator: "1",
        name: "Customer",
        relPath: "Model/Customer.json",
        content: {
          id: 1001,
          name: "Customer",
          attributes: [
            {
              name: "CustomerId",
              attributeType: "ID",
              dataType: { type: "int", nullable: false },
              ordinalNumber: 1,
            },
            {
              name: "CustomerName",
              attributeType: "Text",
              dataType: { type: "string", nullable: true },
              ordinalNumber: 2,
            },
            {
              name: "Revenue",
              attributeType: "Text",
              dataType: { type: "decimal", nullable: true, precision: 12, scale: 2 },
              ordinalNumber: 3,
            },
          ],
        },
      },
    ],
  };
}

async function mockApi(page: import("@playwright/test").Page) {
  const solutionPayload = createMockSolutionPayload();

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
    await route.fulfill({ json: solutionPayload });
  });

  await page.route("**/fs/list**", async (route) => {
    await route.fulfill({ json: { entries: [] } });
  });

  await page.route("**/plugins/**", async (route) => {
    await route.fulfill({ json: { items: [] } });
  });

  await page.route("**/secrets/available", async (route) => {
    await route.fulfill({ json: { available: false } });
  });

  await page.route("**/secrets/runtime**", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ json: { runtimeSecrets: null } });
      return;
    }
    await route.fulfill({ json: {} });
  });
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
}

test("attribute selection mode replaces drag handles and restores them on clear", async ({ page }) => {
  await mockApi(page);
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Customer" }).click();
  await page.getByRole("button", { name: "Attributes" }).click();

  await expect(page.getByRole("button", { name: "Add Attribute" })).toBeVisible();
  await expect(page.getByTitle("Click to select or drag to reorder")).toHaveCount(3);
  await expect(page.getByLabel("Select all attributes")).toBeVisible();

  const attributeRows = page.locator(".entity-attributes-table .value-row");
  await expect(attributeRows).toHaveCount(4);
  await attributeRows.nth(2).click({ position: { x: 12, y: 12 } });

  await expect(page.getByRole("button", { name: "Bulk Edit" })).toBeVisible();
  await expect(page.getByLabel("Clear selection")).toBeVisible();
  await expect(page.getByLabel("Select all attributes")).toBeVisible();
  await expect(page.getByTitle("Click to select or drag to reorder")).toHaveCount(0);
  await expect(page.getByTitle(/^Select attribute$/)).toHaveCount(2);
  await expect(page.getByTitle(/^Deselect attribute$/)).toHaveCount(1);

  await page.getByLabel("Select all attributes").click();

  await expect(page.getByLabel("Clear all selected attributes")).toBeVisible();
  await expect(page.getByTitle(/^Deselect attribute$/)).toHaveCount(3);

  await page.getByLabel("Clear selection").click();

  await expect(page.getByRole("button", { name: "Add Attribute" })).toBeVisible();
  await expect(page.getByLabel("Clear selection")).toHaveCount(0);
  await expect(page.getByLabel("Select all attributes")).toBeVisible();
  await expect(page.getByTitle("Click to select or drag to reorder")).toHaveCount(3);
});

