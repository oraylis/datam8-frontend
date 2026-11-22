import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/config", (route) => route.fulfill({ json: { mode: "server" } }));
  await page.route("**/plugins", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/solution/full", (route) => route.fulfill({
    json: {
      solution: { schemaVersion: "test", basePath: "Base", modelPath: "Model", pluginsPath: "plugins" },
      baseEntities: [{
        name: "DataTypes",
        relPath: "Base/DataTypes.json",
        content: { dataTypes: [{ name: "string", targets: { test: "string" } }, { name: "int", targets: { test: "int" } }] },
      }],
      modelEntities: [{
        name: "Customer",
        relPath: "Model/ZoneA/Customer.json",
        content: {
          id: 1001,
          name: "Customer",
          displayName: "Customer",
          attributes: [{ name: "id", dataType: "string" }],
        },
      }],
    },
  }));
  await page.route("**/model/save", (route) => route.fulfill({ json: {} }));

  await page.goto("/");
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
});

function entityButton(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true }).first();
}

test("failed entity autosave shows a transient status without an inline error", async ({ page }) => {
  await page.route("**/entities/modelEntities/ZoneA/Customer", (route) =>
    route.fulfill({ status: 500, json: { detail: "Could not save Customer" } }),
  );
  await entityButton(page, "Customer").click();

  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  const displayName = page.locator('label:has-text("Display Name") + input');
  await displayName.fill("Customer v2");
  await displayName.press("Tab");

  const status = page.getByRole("status").filter({ hasText: /^Save failed$/ });
  await expect(status).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Save failed" })).toHaveCount(0);

  await page.clock.runFor(2500);
  await expect(status).toHaveCount(0);
});

test("deleting a Base item saves the removal without opening a notification panel", async ({ page }) => {
  await page.route("**/entities/dataTypes/string", (route) => route.fulfill({ json: {} }));
  await page.getByRole("tab", { name: "Base" }).click();
  await page.getByRole("button", { name: "Data Types", exact: true }).click();

  const items = page.getByRole("table", { name: "Base items" });
  const removedItem = items.getByRole("button", { name: /^string\b/i });
  await removedItem.click();
  await removedItem.hover();
  const [deleted, saved] = await Promise.all([
    page.waitForResponse("**/entities/dataTypes/string", { timeout: 8000 }),
    page.waitForResponse("**/model/save", { timeout: 8000 }),
    page.getByLabel("Delete string").click(),
  ]);
  expect(deleted.request().method()).toBe("DELETE");
  expect(deleted.ok()).toBe(true);
  expect(saved.ok()).toBe(true);

  await expect(removedItem).toHaveCount(0);
  await expect(items.getByRole("button", { name: /^int\b/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Close (info|error)/ })).toHaveCount(0);
});

test("renaming a model entity sends its original locator and updates the tree", async ({ page }) => {
  await page.route("**/entities/rename", (route) => route.fulfill({ json: { item: {} } }));
  await page.route("**/entities/modelEntities/ZoneA/CustomerRenamed", (route) => route.fulfill({ json: {} }));
  await entityButton(page, "Customer").click();

  const renamed = page.waitForRequest((request) =>
    new URL(request.url()).pathname === "/entities/rename" && request.method() === "POST",
  );
  const name = page.locator('label:has-text("Name") + input').first();
  await name.fill("CustomerRenamed");
  await name.press("Tab");
  await page.getByRole("tab", { name: "Base" }).click();

  expect((await renamed).postDataJSON()).toEqual({
    from: "/modelEntities/ZoneA/Customer",
    to: "CustomerRenamed",
  });
  await page.getByRole("tab", { name: "Model" }).click();
  await expect(entityButton(page, "CustomerRenamed")).toBeVisible();
});
