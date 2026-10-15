import { expect, test } from "@playwright/test";

type JsonRecord = Record<string, unknown>;

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
        name: "DataTypes",
        relPath: "Base/DataTypes.json",
        content: {
          dataTypes: [
            { name: "string", displayName: "string" },
            { name: "int", displayName: "int" },
          ],
        },
      },
      {
        name: "DataSourceTypes",
        relPath: "Base/DataSourceTypes.json",
        content: {
          dataSourceTypes: [
            {
              name: "Sql",
              displayName: "Sql",
              dataTypeMapping: [],
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
          dataSources: [
            { name: "MyDb", type: "Sql", extendedProperties: {} },
          ],
        },
      },
    ],
    modelEntities: [
      {
        locator: "1",
        name: "Customer",
        relPath: "Model/ZoneA/Customer.json",
        content: {
          id: 1001,
          name: "Customer",
          displayName: "Customer",
          attributes: [{ name: "id", dataType: "string" }],
          sources: [{ dataSource: "MyDb", sourceLocation: "dbo.Customer", mapping: [] }],
          relationships: [],
          transformations: [],
          properties: [],
        },
      },
    ],
  };
}

async function mockApi(page: import("@playwright/test").Page, options?: { failModelSave?: boolean }) {
  const payload = createMockSolutionPayload();
  const failModelSave = !!options?.failModelSave;
  const longError = "Backend validation failed: ".concat("x".repeat(240));
  const modelSaveBodies: JsonRecord[] = [];
  const modelMoveBodies: JsonRecord[] = [];

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
  await page.route("**/model/save", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/entities/**", async (route) => {
    const method = route.request().method();
    if (method !== "PATCH" && method !== "PUT") {
      await route.fulfill({ status: 405, json: { error: "method not allowed" } });
      return;
    }
    const body = JSON.parse(route.request().postData() || "{}");
    modelSaveBodies.push({
      ...body,
      _url: route.request().url(),
      _method: method,
    });
    if (failModelSave) {
      await route.fulfill({ status: 500, body: longError, contentType: "text/plain" });
      return;
    }
    await route.fulfill({ status: 200, json: { item: { ok: true } } });
  });
  await page.route("**/entities/move", async (route) => {
    const method = route.request().method();
    if (method !== "POST") {
      await route.fulfill({ status: 405, json: { error: "method not allowed" } });
      return;
    }
    const body = JSON.parse(route.request().postData() || "{}");
    modelMoveBodies.push(body);
    await route.fulfill({ status: 200, json: { items: [] } });
  });
  await page.route("**/entities/rename", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    modelMoveBodies.push(body);
    await route.fulfill({ status: 200, json: { item: {} } });
  });

  return { modelSaveBodies, modelMoveBodies };
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
}

async function clickBaseItem(page: import("@playwright/test").Page, name: string) {
  await page
    .getByRole("table")
    .getByRole("button")
    .filter({ hasText: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
    .first()
    .click();
}

test("shows transient save-failed pill without inline retry alert", async ({ page }) => {
  await mockApi(page, { failModelSave: true });
  await loadSolutionFromDialog(page);

  await page.getByRole("textbox", { name: "Filter model entities" }).fill("Customer");
  await page.getByRole("button", { name: "Customer" }).first().click();

  const displayNameInput = page.locator('label:has-text("Display Name") + input').first();
  await displayNameInput.fill("Customer v2");
  await displayNameInput.press("Tab");

  const saveFailedPill = page.locator(".sidebar__save-pill").filter({ hasText: "Save failed" });
  const saveFailedSurfaces = page.locator(".error-surface").filter({ hasText: "Save failed" });
  await expect(saveFailedPill).toBeVisible();
  await expect(saveFailedSurfaces).toHaveCount(0);

  await page.waitForTimeout(2500);
  await expect(saveFailedPill).toHaveCount(0);
});

test("deleting a base item updates the list without error/info surfaces", async ({ page }) => {
  await mockApi(page);
  await loadSolutionFromDialog(page);

  await page.getByRole("tab", { name: "Base" }).click();
  await page.getByRole("button", { name: "Data Types", exact: true }).click();
  await clickBaseItem(page, "string");
  await page
    .getByRole("table")
    .getByRole("button")
    .filter({ hasText: /string/i })
    .first()
    .hover();
  await page.getByLabel("Delete string").click();

  await expect(page.getByRole("table", { name: "Base items" }).getByRole("button").filter({ hasText: /^string\b/i })).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Base items" }).getByRole("button").filter({ hasText: /^int\b/i })).toBeVisible();
  await expect(page.locator(".info-surface")).toHaveCount(0);
  await expect(page.locator(".error-surface")).toHaveCount(0);
});

test("renaming an entity name renames the JSON file via /entities/rename", async ({ page }) => {
  const { modelSaveBodies, modelMoveBodies } = await mockApi(page);
  await loadSolutionFromDialog(page);

  const zoneToggle = page.getByRole("button", { name: /ZoneA/ }).first();
  if (await zoneToggle.count()) {
    await zoneToggle.click();
  }
  await page.getByRole("button", { name: "Customer" }).first().click();

  const nameInput = page.locator('label:has-text("Name") + input').first();
  await nameInput.fill("CustomerRenamed");
  await nameInput.press("Tab");
  await page.getByRole("tab", { name: "Base" }).click();

  await expect.poll(() => modelMoveBodies.length, { timeout: 10_000 }).toBe(1);
  expect(modelMoveBodies[0]).toMatchObject({
    from: "/modelEntities/ZoneA/Customer",
    to: "CustomerRenamed",
  });

  await page.getByRole("tab", { name: "Model" }).click();
  await expect(page.getByRole("button", { name: "CustomerRenamed" }).first()).toBeVisible();
});
