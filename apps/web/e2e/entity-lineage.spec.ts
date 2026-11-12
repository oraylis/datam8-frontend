import { expect, test, type Page } from "@playwright/test";

async function loadLineageFixture(page: Page, failSave = false) {
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
      entity(2, "Orders", [{ sourceLocation: 1 }]),
      entity(3, "OrderMart", [{ sourceLocation: 2 }]),
      entity(4, "Unrelated"),
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
  await expect(page.getByRole("heading", { name: "Entity lineage" })).toBeVisible();
  return writes;
}

test("Overview embeds source lineage with direction/depth filters and read-only controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.addInitScript(() => localStorage.setItem("datam8-ui-theme-v2", "light"));
  const writes = await loadLineageFixture(page);
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await expect(page.getByRole("button", { name: "Overview", exact: true })).toHaveClass(/active/);
  await expect(lineage.getByRole("button", { name: "Open entity RawOrders", exact: true })).toBeVisible();
  await expect(lineage.getByRole("button", { name: "Open entity OrderMart", exact: true })).toBeVisible();
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toHaveCount(0);
  await expect(lineage.getByText("Unrelated", { exact: true })).toHaveCount(0);
  await lineage.screenshot({ path: "output/playwright/entity-lineage-light.png" });
  await lineage.getByLabel("Lineage depth").selectOption("2");
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
  await lineage.getByLabel("Lineage direction").selectOption("upstream");
  await expect(lineage.getByRole("button", { name: "Open entity OrderMart" })).toHaveCount(0);
  await lineage.getByLabel("Lineage direction").selectOption("downstream");
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
  await lineage.getByLabel("Lineage direction").selectOption("both");
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
  await lineage.screenshot({ path: "output/playwright/entity-lineage-dark.png" });
});

test("Opening a lineage entity saves overview edits and navigates through the existing editor", async ({ page }) => {
  const writes = await loadLineageFixture(page);
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await page.getByPlaceholder("Display name", { exact: true }).fill("Orders draft");
  await lineage.getByRole("button", { name: "Open entity RawOrders", exact: true }).click();
  await expect(page.getByPlaceholder("Entity name", { exact: true })).toHaveValue("RawOrders");
  expect(writes.length).toBeGreaterThan(0);
  expect(JSON.stringify(writes)).toContain("Orders draft");
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
});

test("A failed save blocks lineage navigation and preserves the draft", async ({ page }) => {
  const writes = await loadLineageFixture(page, true);
  await page.getByPlaceholder("Display name", { exact: true }).fill("Keep this draft");
  await page.getByRole("button", { name: "Open entity RawOrders", exact: true }).click();
  await expect.poll(() => writes.length).toBeGreaterThan(0);
  await expect(page.getByText("Save failed", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Entity name", { exact: true })).toHaveValue("Orders");
  await expect(page.getByPlaceholder("Display name", { exact: true })).toHaveValue("Keep this draft");
});
