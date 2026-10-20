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
          dataSources: [{ name: "MyDb", type: "Sql", extendedProperties: {} }],
        },
      },
      {
        name: "Zones",
        relPath: "Base/Zones.json",
        content: {
          zones: [
            { name: "Zone A", localFolderName: "ZoneA" },
            { name: "Zone X", localFolderName: "ZoneX" },
          ],
        },
      },
      {
        name: "DataProducts",
        relPath: "Base/DataProducts.json",
        content: {
          dataProducts: [
            { name: "ProductA", dataModules: [{ name: "ModuleA" }] },
            { name: "ProductX", dataModules: [{ name: "ModuleX" }] },
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
      {
        locator: "2",
        name: "Dummy",
        relPath: "Model/ZoneX/ProductX/Dummy.json",
        content: {
          id: 1002,
          name: "Dummy",
          displayName: "Dummy",
          attributes: [],
          sources: [],
          relationships: [],
          transformations: [],
          properties: [],
        },
      },
    ],
  };
}

async function mockApi(page: import("@playwright/test").Page) {
  const solutionPayload = createMockSolutionPayload();
  const moveBodies: JsonRecord[] = [];
  const folderWrites: JsonRecord[] = [];
  const deletes: string[] = [];
  const solutionReads: string[] = [];

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
    solutionReads.push(route.request().url());
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

  await page.route("**/entities/**", async (route) => {
    if (route.request().method() === "DELETE") {
      deletes.push(route.request().url());
    } else {
      folderWrites.push(JSON.parse(route.request().postData() || "{}"));
    }
    await route.fulfill({ json: {} });
  });

  await page.route("**/entities/move", async (route) => {
    const req = route.request();
    if (req.method() !== "POST") {
      await route.fulfill({ status: 405, json: { error: "method not allowed" } });
      return;
    }
    const body = JSON.parse(req.postData() || "{}");
    moveBodies.push(body);
    await route.fulfill({ status: 200, json: { ok: true } });
  });

  return { solutionPayload, moveBodies, folderWrites, deletes, solutionReads };
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByPlaceholder("Absolute path to .dm8s").press("Enter");
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
}

test("Move to… moves model entity to new Zone/Product/Module", async ({ page }) => {
  const { solutionPayload, moveBodies } = await mockApi(page);
  const entity = solutionPayload.modelEntities[0];

  await loadSolutionFromDialog(page);

  await page.getByRole("textbox", { name: "Filter model entities" }).fill("Customer");
  await page.getByRole("button", { name: "Customer" }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: /Move to/ }).click();

  await expect(page.getByRole("heading", { name: "Move entity" })).toBeVisible();
  await page.getByRole("button", { name: "Browse" }).click();
  const folderPicker = page.locator(".move-entities-dialog .codex-popup-section").first();
  await folderPicker.getByPlaceholder("Search folders…").fill("ProductX");
  await folderPicker.getByPlaceholder("Search folders…").press("Enter");
  await expect(page.getByRole("heading", { name: "Move entity" })).toBeVisible();
  expect(moveBodies).toHaveLength(0);
  await folderPicker.getByPlaceholder("Search folders…").fill("");
  await folderPicker.getByRole("button", { name: "Model" }).click();
  await folderPicker.getByRole("button", { name: "ZoneX" }).first().click();
  const productRow = folderPicker.locator("div", { hasText: "ProductX" }).first();
  await productRow.getByRole("button", { name: "Select" }).press("Enter");
  const moveButton = page.getByRole("button", { name: "Move" });
  await expect(moveButton).toBeEnabled();
  const targetFolder = page.getByPlaceholder("No folder selected");
  await targetFolder.press("Shift+Enter");
  await targetFolder.dispatchEvent("keydown", { key: "Enter", repeat: true });
  await targetFolder.dispatchEvent("keydown", { key: "Enter", isComposing: true });
  expect(moveBodies).toHaveLength(0);
  await targetFolder.press("Enter");

  await expect.poll(() => moveBodies.length, { timeout: 10_000 }).toBe(1);
  expect(moveBodies[0]).toMatchObject({
    from: "/modelEntities/ZoneA/Customer",
    to: "/modelEntities/ZoneX/ProductX/Customer",
  });

  await expect(page.getByRole("button", { name: "ZoneX" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "ProductX" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Customer" }).first()).toBeVisible();
});

test("solution Enter respects disabled Load and loads exactly once", async ({ page }) => {
  const { solutionReads } = await mockApi(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const path = page.getByPlaceholder("Absolute path to .dm8s");
  await expect(page.getByRole("button", { name: "Load", exact: true })).toBeDisabled();
  await path.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(solutionReads).toHaveLength(0);
  await path.fill("/tmp/mock.dm8s");
  await path.press("Enter");
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(solutionReads).toHaveLength(1);
});

test("folder Enter creates once; confirmation Enter, Cancel and Escape follow focus", async ({ page }) => {
  const { folderWrites, deletes } = await mockApi(page);
  await loadSolutionFromDialog(page);
  await page.getByRole("button", { name: "ZoneX", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "New Folder...", exact: true }).click();
  const name = page.getByPlaceholder("New folder");
  await expect(name).toBeFocused();
  await name.fill("KeyboardFolder");
  await name.press("Enter");
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(folderWrites).toHaveLength(1);
  expect(folderWrites[0]).toMatchObject({ name: "KeyboardFolder", path: "ZoneX/KeyboardFolder" });

  for (const action of ["cancel", "escape", "confirm"]) {
    await page.getByRole("button", { name: "KeyboardFolder", exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete Folder", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeFocused();
    if (action === "cancel") {
      await page.keyboard.press("Shift+Tab");
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    }
    await page.keyboard.press(action === "escape" ? "Escape" : "Enter");
    await expect(dialog).toBeHidden();
    await expect.poll(() => deletes.length).toBe(action === "confirm" ? 1 : 0);
  }
  await expect(page.getByRole("button", { name: "KeyboardFolder", exact: true })).toHaveCount(0);
});
