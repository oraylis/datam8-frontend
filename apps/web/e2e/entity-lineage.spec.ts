import { expect, test, type Page } from "@playwright/test";

async function loadLineageFixture(page: Page, failSave = false, openLineage = true) {
  const entity = (id: number, name: string, sources: Record<string, unknown>[] = []) => ({
    locator: `/Model/Stage/${name}`, relPath: `Model/Stage/${name}.json`, name,
    content: { id, name, displayName: name, sources, attributes: [] },
  });
  const payload = {
    solution: { schemaVersion: "test", basePath: "Base", modelPath: "Model", pluginsPath: "plugins", generatorTargets: [] },
    baseEntities: [
      { name: "DataTypes", relPath: "Base/DataTypes.json", content: { dataTypes: [{ name: "string" }] } },
      { name: "DataSources", relPath: "Base/DataSources.json", content: { dataSources: [{ name: "ERP" }] } },
    ],
    modelEntities: [
      entity(1, "RawOrders", [{ dataSource: "ERP", sourceLocation: "dbo.Orders" }]),
      { ...entity(2, "Orders", [{ sourceLocation: 1, mapping: [{ sourceName: "Id", targetName: "OrderId" }] }]), content: {
        id: 2, name: "Orders", displayName: "Orders",
        properties: [{ property: "Domain", value: "Sales" }],
        sources: [{ sourceLocation: 1, mapping: [{ sourceName: "Id", targetName: "OrderId" }] }],
        attributes: [
          { name: "OrderId", dataType: { type: "int", nullable: false }, isBusinessKey: true, history: "SCD1" },
          { name: "CustomerId", dataType: { type: "int", nullable: true } },
        ],
        relationships: [{ targetLocation: 5, attributes: [{ sourceName: "CustomerId", targetName: "Id" }] }],
      } },
      { ...entity(3, "OrderMart", [{ sourceLocation: 2 }]), content: {
        id: 3, name: "OrderMart", displayName: "OrderMart", sources: [{ sourceLocation: 2 }], attributes: [],
        relationships: [{ dataSource: null, targetLocation: 5, attributes: [{ sourceName: "CustomerId", targetName: "Id" }] }],
      } },
      entity(4, "Unrelated"),
      entity(5, "Customer"),
    ],
    folderEntities: [],
  };
  const writes: unknown[] = [];
  await page.route("**/config", (route) => route.fulfill({ json: { mode: "server" } }));
  await page.route("**/solution/inspect**", (route) => route.fulfill({ json: { version: "v2" } }));
  await page.route("**/solution/full**", (route) => route.fulfill({ json: payload }));
  await page.route("**/model/save", async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill({ status: failSave ? 500 : 200, json: failSave ? { detail: "Fixture save failed" } : {} });
  });
  await page.route("**/entities/**", async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill({ status: failSave ? 500 : 200, json: failSave ? { detail: "Fixture save failed" } : {} });
  });
  await page.route("**/plugins{,/**}", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/secrets/available", (route) => route.fulfill({ json: { available: false } }));
  await page.route("**/secrets/runtime", (route) => route.fulfill({ status: 204 }));
  await page.goto("/");
  await page.getByPlaceholder("Absolute path to .dm8s").fill("C:/disposable/Lineage.dm8s");
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
  await page.getByRole("textbox", { name: "Filter model entities" }).fill("Orders");
  await page.getByRole("button", { name: "Orders", exact: true }).first().click();
  if (openLineage) {
    await page.getByRole("button", { name: "Lineage", exact: true }).click();
    await expect(page.getByRole("region", { name: "Entity lineage" })).toBeVisible();
  }
  return writes;
}

async function selectLineageOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("Lineage replaces the editor content with direction/depth filters and read-only controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.addInitScript(() => localStorage.setItem("datam8-ui-theme-v2", "light"));
  const writes = await loadLineageFixture(page);
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await expect(page.getByRole("button", { name: "Lineage", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByPlaceholder("Entity name", { exact: true })).toHaveCount(0);
  await lineage.getByRole("checkbox", { name: "Relationships", exact: true }).uncheck();
  await expect(lineage.getByRole("button", { name: "Open entity RawOrders", exact: true })).toBeVisible();
  await expect(lineage.getByRole("button", { name: "Open entity OrderMart", exact: true })).toBeVisible();
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toHaveCount(0);
  await expect(lineage.getByText("Unrelated", { exact: true })).toHaveCount(0);
  await lineage.screenshot({ path: "output/playwright/entity-lineage-light.png" });
  await lineage.getByRole("combobox", { name: "Lineage depth", exact: true }).click();
  await expect(page.getByRole("listbox")).toHaveClass(/codex-float-surface/);
  await expect(page.getByRole("option", { name: "1 level", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: "output/playwright/entity-lineage-depth-menu.png" });
  await page.getByRole("option", { name: "2 levels", exact: true }).click();
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
  await selectLineageOption(page, "Lineage direction", "Upstream");
  await expect(lineage.getByRole("button", { name: "Open entity OrderMart" })).toHaveCount(0);
  await selectLineageOption(page, "Lineage direction", "Downstream");
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toHaveCount(0);
  await expect(lineage.getByRole("button", { name: "Open entity OrderMart" })).toBeVisible();
  await expect(lineage.locator(".react-flow__node")).toHaveCount(2);
  await lineage.locator(".react-flow__node").first().click();
  await page.keyboard.press("Delete");
  await expect(lineage.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: /switch to dark/i }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(lineage.locator(".react-flow")).toHaveClass(/dark/);
  await expect(lineage.locator(".lineage-node--focus")).toHaveCSS("background-color", "rgb(39, 39, 39)");
  await expect(lineage.getByRole("button", { name: "Open entity OrderMart" })).toBeVisible();
  await selectLineageOption(page, "Lineage direction", "Upstream & downstream");
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
  await lineage.screenshot({ path: "output/playwright/entity-lineage-dark.png" });
  await page.screenshot({ path: "output/playwright/entity-lineage-editor-dark.png" });
});

test("Opening a lineage entity saves overview edits and navigates through the existing editor", async ({ page }) => {
  const writes = await loadLineageFixture(page, false, false);
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await page.getByPlaceholder("Display name", { exact: true }).fill("Orders draft");
  await page.getByRole("button", { name: "Lineage", exact: true }).click();
  await lineage.getByRole("button", { name: "Open entity RawOrders", exact: true }).click();
  await expect(lineage.locator(".lineage-node--focus strong")).toHaveText("RawOrders");
  expect(writes.length).toBeGreaterThan(0);
  expect(JSON.stringify(writes)).toContain("Orders draft");
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lineage", exact: true }).click();
  await expect(page.getByPlaceholder("Entity name", { exact: true })).toHaveValue("RawOrders");
});

test("A failed save blocks the lineage view switch and preserves the draft", async ({ page }) => {
  const writes = await loadLineageFixture(page, true, false);
  await page.getByPlaceholder("Display name", { exact: true }).fill("Keep this draft");
  await page.getByRole("button", { name: "Lineage", exact: true }).click();
  await expect.poll(() => writes.length).toBeGreaterThan(0);
  await expect(page.getByText("Save failed", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Entity name", { exact: true })).toHaveValue("Orders");
  await expect(page.getByPlaceholder("Display name", { exact: true })).toHaveValue("Keep this draft");
  await expect(page.getByRole("region", { name: "Entity lineage" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Editor", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lineage", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("Lineage keeps the entity header, properties, sidebar and work tabs in place and returns to Attributes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const writes = await loadLineageFixture(page, false, false);
  await page.getByRole("button", { name: "Attributes", exact: true }).click();
  const header = page.locator(".panel__header").filter({ hasText: "Orders" }).last();
  await expect(header.getByText("Domain", { exact: false })).toBeVisible();
  const headerBox = await header.boundingBox();
  const navBox = await page.locator(".entity-section-nav-row .section-nav").boundingBox();
  const button = page.getByRole("button", { name: "Lineage", exact: true });
  const viewSwitch = header.locator(".entity-view-switch");
  await expect(viewSwitch.getByRole("button", { name: "Lineage", exact: true })).toBeVisible();
  await expect(viewSwitch.getByRole("button")).toHaveCount(1);
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(button).toHaveText("");
  await expect(button.locator("svg")).toHaveAttribute("width", "15");
  await expect(button.locator("svg")).toHaveAttribute("fill", "none");
  await expect(button).toHaveAttribute("title", "Show lineage");
  const inactiveColor = await button.evaluate((element) => getComputedStyle(element).color);
  const inactiveBackground = await button.evaluate((element) => getComputedStyle(element).backgroundColor);
  const titleBox = await header.locator(".panel__title-text--entity").boundingBox();
  const switchBox = await viewSwitch.boundingBox();
  expect(switchBox!.x - (titleBox!.x + titleBox!.width)).toBeLessThanOrEqual(20);
  expect(Math.abs((switchBox!.y + switchBox!.height / 2) - (titleBox!.y + titleBox!.height / 2))).toBeLessThan(8);
  const buttonBox = await button.boundingBox();
  expect(buttonBox!.y + buttonBox!.height).toBeLessThan(navBox!.y);
  await button.click();
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await expect(lineage).toBeVisible();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(button).toHaveAttribute("title", "Back to editor");
  await expect(button.locator("svg")).toHaveAttribute("fill", "currentColor");
  expect(await button.evaluate((element) => getComputedStyle(element).color)).not.toBe(inactiveColor);
  expect(await button.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(inactiveBackground);
  await expect(page.locator(".entity-section-nav-row")).toHaveCount(0);
  for (const name of ["Overview", "Attributes", "Sources", "Relationships", "Transformations"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "Add Attribute", exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Filter model entities" })).toBeVisible();
  await expect(page.locator(".worktabs")).toBeVisible();
  expect(await header.boundingBox()).toEqual(headerBox);
  expect((await lineage.boundingBox())!.height).toBeGreaterThan(450);
  const expectFlowLayout = async () => {
    const canvas = await lineage.locator(".entity-lineage__canvas").boundingBox();
    const filters = await lineage.locator(".entity-lineage__filters").boundingBox();
    const legend = await lineage.getByRole("group", { name: "Lineage legend", exact: true }).boundingBox();
    const attribution = await lineage.locator(".react-flow__attribution").boundingBox();
    const controls = await lineage.locator(".react-flow__controls").boundingBox();
    expect(filters!.y).toBeGreaterThan(canvas!.y);
    expect(filters!.y).toBeLessThan(canvas!.y + 20);
    expect(filters!.x).toBeGreaterThan(canvas!.x);
    expect(canvas!.x + canvas!.width - (filters!.x + filters!.width)).toBeGreaterThan(0);
    expect(canvas!.x + canvas!.width - (filters!.x + filters!.width)).toBeLessThan(20);
    expect(legend!.x).toBeGreaterThan(canvas!.x + canvas!.width / 2);
    expect(legend!.y).toBeGreaterThan(canvas!.y + canvas!.height / 2);
    expect(legend!.x + legend!.width).toBeLessThan(canvas!.x + canvas!.width);
    expect(legend!.y + legend!.height).toBeLessThanOrEqual(attribution!.y);
    expect(legend!.x).toBeGreaterThan(controls!.x + controls!.width);
    await expect(lineage.locator(".react-flow").getByRole("group", { name: "Lineage legend", exact: true })).toBeVisible();
    await expect(lineage.locator(".react-flow").getByRole("group", { name: "Lineage filters", exact: true })).toBeVisible();
  };
  await expectFlowLayout();
  await page.screenshot({ path: "output/playwright/entity-lineage-editor-shell.png" });
  await page.setViewportSize({ width: 1000, height: 800 });
  await expectFlowLayout();
  await page.screenshot({ path: "output/playwright/entity-lineage-toolbar-narrow.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(button.locator("svg")).toHaveAttribute("fill", "none");
  await expect(page.getByRole("button", { name: "Add Attribute", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attributes", exact: true })).toHaveClass(/active/);
  await button.click();
  await expect(page.locator(".entity-section-nav-row")).toHaveCount(0);
  await button.click();
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await expect(lineage).toHaveCount(0);
  await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(writes).toHaveLength(0);
});

test("Schema stays clean and attribute selection highlights explicit relationships and source mappings", async ({ page }) => {
  const writes = await loadLineageFixture(page);
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await expect(lineage.getByRole("button", { name: "Open entity Customer", exact: true })).toBeVisible();
  const relationship = lineage.locator(".lineage-edge--relationship");
  await expect(relationship).toHaveCount(2);
  await expect(relationship.locator(".react-flow__edge-path").first()).toHaveCSS("stroke-dasharray", "6px, 4px");
  await expect(relationship.locator(".react-flow__edge-path").first()).not.toHaveAttribute("marker-end");
  await expect(lineage.getByText("Missing data source", { exact: true })).toHaveCount(0);
  await expect(lineage.locator(".lineage-node--external")).toHaveCount(0);
  const schema = lineage.getByRole("button", { name: "Schema", exact: true });
  await expect(schema).toHaveAttribute("aria-expanded", "false");
  await schema.click();
  await expect(schema).toHaveText("Schema");
  await expect(lineage.getByRole("button", { name: "Inspect attribute CustomerId", exact: true })).toBeVisible();
  await lineage.getByRole("button", { name: "Inspect attribute CustomerId", exact: true }).click();
  await expect(lineage.getByText("Orders.CustomerId → Customer.Id (Relationship)", { exact: true })).toBeVisible();
  await page.screenshot({ path: "output/playwright/entity-lineage-schema-mapping.png" });
  await lineage.getByRole("button", { name: "Inspect attribute OrderId", exact: true }).click();
  await expect(lineage.getByText("RawOrders.Id → Orders.OrderId (Source mapping)", { exact: true })).toBeVisible();
  await lineage.getByRole("checkbox", { name: "Relationships", exact: true }).uncheck();
  await expect(lineage.getByRole("button", { name: "Open entity Customer", exact: true })).toHaveCount(0);
  await lineage.getByRole("checkbox", { name: "Sources", exact: true }).uncheck();
  await expect(lineage.locator(".react-flow__node")).toHaveCount(1);
  await expect(lineage.getByLabel("Lineage direction")).toBeDisabled();
  await lineage.getByRole("checkbox", { name: "Relationships", exact: true }).check();
  await expect(lineage.locator(".react-flow__node")).toHaveCount(2);
  await schema.click();
  await expect(lineage.getByRole("button", { name: "Inspect attribute CustomerId", exact: true })).toHaveCount(0);
  expect(writes).toHaveLength(0);
});
