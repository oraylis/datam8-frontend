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
          attributeTypes: [{ name: "Business", displayName: "Business" }],
        },
      },
      {
        name: "DataTypes",
        relPath: "Base/DataTypes.json",
        content: {
          dataTypes: [
            { name: "string", displayName: "String", targets: { none: "string" } },
            { name: "int", displayName: "Integer", targets: { none: "int" } },
          ],
        },
      },
      {
        name: "DataSources",
        relPath: "Base/DataSources.json",
        content: { dataSources: [] },
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
          displayName: "Customer",
          attributes: [{ name: "CustomerId", dataType: { type: "string", nullable: false } }],
        },
      },
      {
        locator: "/Model/010-Stage/Sales/Orders/Order",
        name: "Order",
        relPath: "Model/010-Stage/Sales/Orders/Order.json",
        content: {
          id: 1002,
          name: "Order",
          displayName: "Order",
          attributes: [{ name: "OrderId", dataType: { type: "string", nullable: false } }],
        },
      },
    ],
    folderEntities: [],
  };
}

async function mockApi(page: import("@playwright/test").Page, options: { failEntitySaves?: boolean } = {}) {
  const payload = createMockSolutionPayload();
  let entityWrites = 0;
  let failedEntityWrites = 0;

  await page.route("**/config", async (route) => {
    await route.fulfill({ json: { mode: "server" } });
  });

  await page.route("**/solution/inspect**", async (route) => {
    await route.fulfill({ json: { version: "v2" } });
  });

  await page.route("**/solution/full**", async (route) => {
    await route.fulfill({ json: payload });
  });

  await page.route("**/model/save", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/entities/**", async (route) => {
    const method = route.request().method();
    if (method === "PATCH" || method === "PUT") {
      entityWrites += 1;
      if (options.failEntitySaves) {
        failedEntityWrites += 1;
        await route.fulfill({ status: 500, json: { message: "Save unavailable" } });
        return;
      }
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fulfill({ status: 405, json: { message: "Method Not Allowed" } });
  });

  await page.route("**/fs/list**", async (route) => {
    await route.fulfill({ json: { entries: [] } });
  });

  await page.route("**/plugins/**", async (route) => {
    await route.fulfill({ json: { items: [] } });
  });

  await page.route("**/plugins", async (route) => {
    await route.fulfill({ json: { items: [] } });
  });

  await page.route("**/secrets/available", async (route) => {
    await route.fulfill({ json: { available: false } });
  });

  await page.route("**/secrets/runtime", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  return {
    getEntityWrites: () => entityWrites,
    getFailedEntityWrites: () => failedEntityWrites,
  };
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
}

async function openEntity(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("textbox", { name: "Filter model entities" }).fill(name);
  await page.getByRole("tab", { name: "Model" }).click();
  const sidebar = page.getByRole("complementary").first();
  await sidebar.getByRole("button", { name, exact: true }).first().click();
  await expect(page.getByPlaceholder("Entity name")).toHaveValue(name);
}

async function clickBaseItem(page: import("@playwright/test").Page, name: string) {
  await page
    .getByRole("table")
    .getByRole("button")
    .filter({ hasText: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
    .first()
    .click();
}

test("entity draft survives switching", async ({ page }) => {
  await mockApi(page);
  await loadSolutionFromDialog(page);

  await openEntity(page, "Customer");
  await page.getByPlaceholder("Display name").fill("Customer Draft");

  await openEntity(page, "Order");
  await expect(page.getByPlaceholder("Entity name")).toHaveValue("Order");
  await openEntity(page, "Customer");
  await expect(page.getByPlaceholder("Entity name")).toHaveValue("Customer");

  await expect(page.getByPlaceholder("Display name")).toHaveValue("Customer Draft");
});

test("saved attribute survives switching without reload", async ({ page }) => {
  const api = await mockApi(page);
  await loadSolutionFromDialog(page);

  await openEntity(page, "Customer");
  await page.getByRole("button", { name: "Attributes", exact: true }).click();
  await page.getByRole("button", { name: "Add Attribute", exact: true }).click();
  await expect.poll(api.getEntityWrites).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Overview", exact: true }).click();

  await openEntity(page, "Order");
  await openEntity(page, "Customer");
  await page.getByRole("button", { name: "Attributes", exact: true }).click();

  const rows = page.locator(".entity-attributes-table .value-row");
  await expect(rows).toHaveCount(3);
  await expect
    .poll(() => rows.locator("input").evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)))
    .toContain("new_column");
});

test("base draft survives switching", async ({ page }) => {
  await mockApi(page);
  await loadSolutionFromDialog(page);
  await page.getByRole("tab", { name: "Base" }).click();

  await page.getByRole("button", { name: "Data Types", exact: true }).click();
  await clickBaseItem(page, "int");
  const displayNameInput = page.locator('label:has-text("Display Name")').first().locator("xpath=following-sibling::input[1]");
  await displayNameInput.fill("Integer Draft");

  const dataTypesTab = page.locator('.worktabs .worktab[title="Base/DataTypes.json"]').first();
  await expect(dataTypesTab).toBeVisible();
  await page.getByRole("button", { name: "Attribute Types", exact: true }).click();
  await expect(page.locator(".tree__child--active")).toHaveText("Attribute Types");
  await page.getByRole("button", { name: "Data Types", exact: true }).click();
  await expect(page.locator(".tree__child--active")).toHaveText("Data Types");

  await expect(displayNameInput).toHaveValue("Integer Draft");
  await expect(page.locator(".item-title").first()).toHaveText("int");
  await expect(dataTypesTab).toBeVisible();
});

test("base tab title stays humanized after autosave", async ({ page }) => {
  const api = await mockApi(page);
  await loadSolutionFromDialog(page);
  await page.getByRole("tab", { name: "Base" }).click();
  await page.getByRole("button", { name: "Data Types", exact: true }).click();

  const dataTypesTab = page.locator('.worktabs .worktab[title="Base/DataTypes.json"]').first();
  await expect(dataTypesTab.locator(".worktab__title")).toHaveText("Data Types");

  await clickBaseItem(page, "string");
  const displayNameInput = page.locator('label:has-text("Display Name")').first().locator("xpath=following-sibling::input[1]");
  await displayNameInput.fill("String Updated");
  await displayNameInput.press("Tab");
  await expect(page.getByRole("button", { name: "Save All", exact: true })).toHaveCount(0);
  await expect.poll(api.getEntityWrites, { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(dataTypesTab.locator(".worktab__title")).toHaveText("Data Types");
});

test("closing a tab after a failed save can keep or discard its draft", async ({ page }) => {
  const api = await mockApi(page, { failEntitySaves: true });
  await loadSolutionFromDialog(page);

  await openEntity(page, "Customer");
  await page.getByPlaceholder("Display name").fill("Discard Me");
  await page.getByPlaceholder("Display name").press("Tab");
  const customerTab = page.locator('.worktabs .worktab[title="Model/010-Stage/Sales/Orders/Customer.json"]').first();
  await expect.poll(api.getFailedEntityWrites).toBeGreaterThan(0);

  await customerTab.locator(".worktab__close").click();
  const pendingSync = page.getByRole("dialog", { name: "Pending Sync" });
  await expect(pendingSync).toBeVisible();
  await pendingSync.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByPlaceholder("Display name")).toHaveValue("Discard Me");

  await customerTab.locator(".worktab__close").click();
  await expect(pendingSync).toBeVisible();
  await pendingSync.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(customerTab).toHaveCount(0);

  await openEntity(page, "Customer");
  await expect(page.getByPlaceholder("Display name")).toHaveValue("Customer");
});

