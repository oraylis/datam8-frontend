import { expect, test } from "@playwright/test";

type TestWindow = Window & {
  __createNewCalls: unknown[];
  __mockSolutionPayload: ReturnType<typeof createMockSolutionPayload>;
  desktop: {
    isElectron: boolean;
    apiBase: string;
    token: string;
    window: { setSolutionPath: () => Promise<boolean> };
    solution: {
      pickOpenPath: () => Promise<string>;
      pickDirectory: () => Promise<string>;
      onOpenPath: () => () => void;
      load: () => Promise<{ payload: ReturnType<typeof createMockSolutionPayload> | null }>;
      createNew: (payload: unknown) => Promise<{ solutionPath: string; payload: ReturnType<typeof createMockSolutionPayload> | null }>;
    };
    theme: {
      current: () => Promise<string>;
      onThemeChanged: () => () => void;
    };
  };
};

function createMockSolutionPayload() {
  return {
    solution: {
      schemaVersion: "2.0.0",
      basePath: "Base",
      modelPath: "Model",
      pluginsPath: "plugins",
      generatorTargets: [],
    },
    baseEntities: [],
    modelEntities: [],
    folderEntities: [],
  };
}

async function mockSharedApi(page: import("@playwright/test").Page) {
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
  await page.route("**/plugins/**", async (route) => {
    await route.fulfill({ json: { items: [] } });
  });
  await page.route("**/secrets/available", async (route) => {
    await route.fulfill({ json: { available: false } });
  });
}

async function initDesktopBridge(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const testWindow = window as TestWindow;
    testWindow.__createNewCalls = [];
    testWindow.desktop = {
      isElectron: true,
      apiBase: "http://localhost:4320",
      token: "desktop-test-token",
      window: { setSolutionPath: async () => true },
      solution: {
        pickOpenPath: async () => "/tmp/mock.dm8s",
        pickDirectory: async () => "/tmp/projects",
        onOpenPath: () => () => {},
        load: async () => ({ payload: testWindow.__mockSolutionPayload || null }),
        createNew: async (payload: unknown) => {
          testWindow.__createNewCalls.push(payload);
          return { solutionPath: "/tmp/projects/NewProject/NewProject.dm8s", payload: testWindow.__mockSolutionPayload || null };
        },
      },
      theme: {
        current: async () => "light",
        onThemeChanged: () => () => {},
      },
    };
    testWindow.__mockSolutionPayload = {
      solution: {
        schemaVersion: "2.0.0",
        basePath: "Base",
        modelPath: "Model",
        pluginsPath: "plugins",
        generatorTargets: [],
      },
      baseEntities: [],
      modelEntities: [],
      folderEntities: [],
    };
  });
}

async function loadSolutionFromDialogElectron(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const sidebar = page.getByRole("complementary").first();
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole("button", { name: "Open" }).first().click();
}

test("new project uses desktop createNew bridge with required fields only", async ({ page }) => {
  await initDesktopBridge(page);
  await mockSharedApi(page);
  await loadSolutionFromDialogElectron(page);

  await page.locator("button:has-text('New')").first().click();
  await page.getByLabel("Solution Name").fill("NewProject");
  await page.getByRole("button", { name: "Browse" }).click();
  await page.getByRole("button", { name: "Create Solution" }).click();

  const calls = await page.evaluate(() => (window as unknown as TestWindow).__createNewCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual({
    saveDir: "/tmp/projects",
    solutionName: "NewProject",
  });
});

test("new project wizard hides unsupported base/model/targets inputs", async ({ page }) => {
  await initDesktopBridge(page);
  await mockSharedApi(page);
  await loadSolutionFromDialogElectron(page);

  await page.locator("button:has-text('New')").first().click();

  await expect(page.getByLabel("Base Folder")).toHaveCount(0);
  await expect(page.getByLabel("Model Folder")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Target" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  await expect(page.getByLabel("Template ZIP (optional)")).toHaveCount(0);
});

test("dialogs ignore outside clicks and still close via cancel", async ({ page }) => {
  await initDesktopBridge(page);
  await mockSharedApi(page);
  await loadSolutionFromDialogElectron(page);

  await page.locator("button:has-text('New')").first().click();
  const dialog = page.getByRole("dialog", { name: "Create New Project" });
  await expect(dialog).toBeVisible();

  await page.mouse.click(10, 10);
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("new project keeps create button disabled until required fields are filled", async ({ page }) => {
  await initDesktopBridge(page);
  await mockSharedApi(page);
  await loadSolutionFromDialogElectron(page);

  await page.locator("button:has-text('New')").first().click();

  const createButton = page.getByRole("button", { name: "Create Solution" });
  await expect(createButton).toBeDisabled();

  await page.getByLabel("Solution Name").fill("StepFlow");
  await expect(createButton).toBeDisabled();

  await page.getByLabel("Save Path").fill("/tmp/projects");
  await expect(createButton).toBeEnabled();
});
