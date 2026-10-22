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
        content: { properties: [{ name: "data_layout", values: ["liquid_clustering"] }] },
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
          properties: [{ property: "data_layout", value: "liquid_clustering" }],
          attributes: [
            {
              name: "CustomerId",
              attributeType: "ID",
              dataType: { type: "int", nullable: false },
              ordinalNumber: 1,
              properties: [{ property: "data_layout", value: "liquid_clustering" }],
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

async function mockApi(page: import("@playwright/test").Page, attributeCount = 3) {
  const solutionPayload = createMockSolutionPayload();
  solutionPayload.modelEntities[0].content.attributes.push(
    ...Array.from({ length: Math.max(0, attributeCount - 3) }, (_, index) => ({
      name: `ExtraColumn${index + 1}`,
      attributeType: "Text",
      dataType: { type: "string", nullable: true },
      ordinalNumber: index + 4,
    })),
  );
  let entityWrites = 0;
  let modelSaves = 0;

  await page.route("**/config", async (route) => {
    await route.fulfill({ json: { mode: "server" } });
  });
  await page.route("**/model/save", async (route) => {
    modelSaves += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/entities/**", async (route) => {
    const method = route.request().method();
    if (method === "PATCH" || method === "PUT") {
      entityWrites += 1;
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fulfill({ status: 405, json: { message: "Method Not Allowed" } });
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

  await page.route(/\/plugins(?:[/?].*)?$/, async (route) => {
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

  return {
    getEntityWrites: () => entityWrites,
    getModelSaves: () => modelSaves,
  };
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
  await attributeRows.nth(2).click({ position: { x: 240, y: 12 } });
  await expect(page.getByRole("button", { name: "Add Attribute" })).toBeVisible();
  await expect(page.getByLabel("Clear selection")).toHaveCount(0);
  await attributeRows.nth(2).getByTitle("Click to select or drag to reorder").click();

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

test("renaming attributes preserves click, Tab and Enter focus in a long list", async ({ page }) => {
  const api = await mockApi(page, 50);
  await loadSolutionFromDialog(page);
  await page.getByRole("button", { name: "Customer", exact: true }).click();
  await page.getByRole("button", { name: "Attributes", exact: true }).click();

  const rows = page.locator(".entity-attributes-table > .value-row");
  await expect(rows).toHaveCount(51);
  await page.getByRole("textbox", { name: "Attribute name: CustomerId", exact: true }).fill("CustomerIdRenamed");
  const nextName = page.getByRole("textbox", { name: "Attribute name: CustomerName", exact: true });
  await nextName.click();
  await expect(nextName).toBeFocused();
  await expect.poll(api.getEntityWrites).toBeGreaterThan(0);
  await expect(nextName).toBeFocused();

  const writesBeforeTab = api.getEntityWrites();
  await nextName.fill("CustomerNameRenamed");
  await nextName.press("Tab");
  const nextDataType = rows.nth(2).getByRole("combobox").first();
  await expect(nextDataType).toBeFocused();
  await expect.poll(api.getEntityWrites).toBeGreaterThan(writesBeforeTab);
  await expect(nextDataType).toBeFocused();

  await page.getByRole("textbox", { name: "Attribute name: CustomerIdRenamed", exact: true }).fill("CustomerIdFinal");
  const writesBeforeEnter = api.getEntityWrites();
  await page.getByRole("textbox", { name: "Attribute name: CustomerIdRenamed", exact: true }).press("Enter");
  const renamedInput = page.getByRole("textbox", { name: "Attribute name: CustomerIdFinal", exact: true });
  await expect(renamedInput).toBeFocused();
  await expect.poll(api.getEntityWrites).toBeGreaterThan(writesBeforeEnter);
  await expect(renamedInput).toBeFocused();

  await page.getByRole("button", { name: "Add Attribute", exact: true }).click();
  const newName = page.getByRole("textbox", { name: "Attribute name: new_column", exact: true });
  await expect(newName).toBeFocused();
  await expect(newName).toHaveValue("new_column");
  await expect.poll(() => newName.evaluate((el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!)).toBe("new_column".length);
});

test("attribute details commit only when dialog save is clicked", async ({ page }) => {
  const api = await mockApi(page);
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Customer" }).click();
  await page.getByRole("button", { name: "Attributes" }).click();

  await page.getByTitle("Open details", { exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Attribute Details" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("CustomerId")).toBeVisible();

  await dialog.locator(".attribute-textarea--description").fill("Primary customer identifier");
  await dialog.locator(".attribute-textarea--expression").fill("CustomerId + '-key'");

  await expect.poll(api.getEntityWrites, { timeout: 1_000 }).toBe(0);
  await expect.poll(api.getModelSaves, { timeout: 1_000 }).toBe(0);

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(api.getEntityWrites, { timeout: 10_000 }).toBeGreaterThan(0);
  await expect.poll(api.getModelSaves, { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(dialog).toBeHidden();
});

for (const theme of ["light", "dark"]) {
  test(`compact attribute list stays editable and keyboard accessible in ${theme} mode`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((value) => localStorage.setItem("datam8-ui-theme-v2", value), theme);
    const api = await mockApi(page);
    await loadSolutionFromDialog(page);
    await page.getByRole("button", { name: "Customer", exact: true }).click();
    await page.getByRole("button", { name: "Attributes", exact: true }).click();

    const table = page.locator(".entity-attributes-table");
    const firstRow = table.locator(".value-row").nth(1);
    const name = page.getByRole("textbox", { name: "Attribute name: CustomerId", exact: true });
    await expect(name).toHaveValue("CustomerId");
    await expect(firstRow.locator(".chip:not(.chip--add)")).toHaveAttribute("title", "data_layout: liquid_clustering");
    // Properties use the same appearance in the entity header and compact rows.
    const headerChips = page.locator(".panel__chips");
    for (const selector of [".chip:not(.chip--add)", ".chip--add"]) {
      const appearance = await headerChips.locator(selector).evaluate((el) => {
        const style = getComputedStyle(el);
        return Object.fromEntries(["border-radius", "border-color", "border-style", "background-color", "font-size"].map((key) => [key, style.getPropertyValue(key)]));
      });
      for (const [property, value] of Object.entries(appearance)) {
        await expect(firstRow.locator(selector)).toHaveCSS(property, value);
      }
    }
    await expect.poll(() => firstRow.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(42);
    await expect(name).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(name).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await expect(firstRow).toHaveCSS("border-bottom-style", "solid");

    await name.focus();
    await expect(name).toBeFocused();
    await expect(name).not.toHaveCSS("box-shadow", "none");
    await name.press("Tab");
    const dataType = firstRow.getByRole("combobox").first();
    await expect(dataType).toBeFocused();
    await expect(dataType).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await dataType.press("Enter");
    await page.getByRole("option", { name: "string", exact: true }).click();
    await expect(dataType).toHaveText("string");
    await expect.poll(api.getEntityWrites).toBeGreaterThan(0);

    const nullable = firstRow.getByRole("checkbox").first();
    await expect(nullable).not.toBeChecked();
    const writesBeforeNullable = api.getEntityWrites();
    await nullable.click();
    await expect(nullable).toBeChecked();
    await expect.poll(api.getEntityWrites).toBeGreaterThan(writesBeforeNullable);

    await table.screenshot({ path: testInfo.outputPath(`attributes-compact-${theme}.png`) });
    await firstRow.getByTitle("Open details", { exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Attribute Details" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".attribute-textarea--description")).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(name).toHaveValue("CustomerId");
  });
}

