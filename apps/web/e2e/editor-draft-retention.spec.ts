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

async function mockApi(page: import("@playwright/test").Page) {
  const payload = createMockSolutionPayload();
  let entityWrites = 0;

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
  };
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
}

async function expandModelFolders(_page: import("@playwright/test").Page) {}

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
  await expandModelFolders(page);

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
  await clickBaseItem(page, "string");
  const displayNameInput = page.locator('label:has-text("Display Name")').first().locator("xpath=following-sibling::input[1]");
  await displayNameInput.fill("String Draft");

  const dataTypesTab = page.locator('.worktabs .worktab[title="Base/DataTypes.json"]').first();
  await expect(dataTypesTab).toBeVisible();

  await page.getByRole("button", { name: "Attribute Types", exact: true }).click();
  await page.getByRole("button", { name: "Data Types", exact: true }).click();

  await expect(displayNameInput).toHaveValue("String Draft");
  await expect(dataTypesTab).toBeVisible();
});

test("base item selection survives switching", async ({ page }) => {
  await mockApi(page);
  await loadSolutionFromDialog(page);
  await page.getByRole("tab", { name: "Base" }).click();

  await page.getByRole("button", { name: "Data Types", exact: true }).click();
  await clickBaseItem(page, "int");
  await expect(page.locator(".item-title").first()).toHaveText("int");

  await page.getByRole("button", { name: "Attribute Types", exact: true }).click();
  await page.getByRole("button", { name: "Data Types", exact: true }).click();
  await expect(page.locator(".item-title").first()).toHaveText("int");
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

test("closing a dirty tab discards the draft", async ({ page }) => {
  await mockApi(page);
  await loadSolutionFromDialog(page);
  await expandModelFolders(page);

  await openEntity(page, "Customer");
  await page.getByPlaceholder("Display name").fill("Discard Me");
  const customerTab = page.locator('.worktabs .worktab[title="Model/010-Stage/Sales/Orders/Customer.json"]').first();

  await customerTab.locator(".worktab__close").click();
  const confirmClose = page.getByRole("button", { name: "Confirm" });
  if (await confirmClose.count()) {
    await confirmClose.click();
  }

  await openEntity(page, "Customer");
  await expect(page.getByPlaceholder("Display name")).toHaveValue("Discard Me");
});

