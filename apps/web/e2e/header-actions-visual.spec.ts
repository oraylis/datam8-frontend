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
        name: "DataTypes",
        relPath: "Base/DataTypes.json",
        content: {
          dataTypes: [{ name: "string", displayName: "String", targets: { none: "string" } }],
        },
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
    await route.fulfill({ json: { items: [] } });
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

test("workspace header run buttons stay vertically centered", async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await mockApi(page);
  await loadSolutionFromDialog(page);

  const header = page.locator(".workspace-header");
  const tabs = page.locator(".workspace-header__tabs");
  const editorCol = page.locator(".editor-col");
  const editorPanel = page.locator(".editor-panel");
  const runActions = page.locator(".workspace-header__run-actions");
  const generatorButton = page.locator('button[aria-label="Toggle generator"]');
  const validatorButton = page.locator('button[aria-label="Toggle validator"]');

  await expect(header).toBeVisible();
  await expect(tabs).toBeVisible();
  await expect(editorCol).toBeVisible();
  await expect(editorPanel).toBeVisible();
  await expect(runActions).toBeVisible();
  await expect(generatorButton).toBeVisible();
  await expect(validatorButton).toBeVisible();

  const headerBox = await header.boundingBox();
  const tabsBox = await tabs.boundingBox();
  const editorColBox = await editorCol.boundingBox();
  const editorPanelBox = await editorPanel.boundingBox();
  const runActionsBox = await runActions.boundingBox();
  const generatorBox = await generatorButton.boundingBox();
  const validatorBox = await validatorButton.boundingBox();

  expect(headerBox).toBeTruthy();
  expect(tabsBox).toBeTruthy();
  expect(editorColBox).toBeTruthy();
  expect(editorPanelBox).toBeTruthy();
  expect(runActionsBox).toBeTruthy();
  expect(generatorBox).toBeTruthy();
  expect(validatorBox).toBeTruthy();

  const headerCenterY = headerBox!.y + headerBox!.height / 2;
  const runActionsCenterY = runActionsBox!.y + runActionsBox!.height / 2;
  const generatorCenterY = generatorBox!.y + generatorBox!.height / 2;
  const validatorCenterY = validatorBox!.y + validatorBox!.height / 2;
  const tabsBottomY = tabsBox!.y + tabsBox!.height;
  const editorPanelBottomY = editorPanelBox!.y + editorPanelBox!.height;
  const editorColBottomY = editorColBox!.y + editorColBox!.height;

  expect(Math.abs(runActionsCenterY - headerCenterY)).toBeLessThanOrEqual(4);
  expect(Math.abs(generatorCenterY - headerCenterY)).toBeLessThanOrEqual(4);
  expect(Math.abs(validatorCenterY - headerCenterY)).toBeLessThanOrEqual(4);
  expect(editorPanelBox!.y).toBeGreaterThanOrEqual(tabsBottomY - 1);
  expect(Math.abs(editorPanelBottomY - editorColBottomY)).toBeLessThanOrEqual(2);

  await page.screenshot({ path: "output/playwright/header-actions-visual.png" });
});

