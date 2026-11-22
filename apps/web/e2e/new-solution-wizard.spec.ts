import { expect, test } from "@playwright/test";

type TestWindow = Window & {
  __createNewCalls: unknown[];
  __openSolutionSettings: (() => void) | null;
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
      onOpenSettings: (callback: () => void) => () => void;
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
      generatorTargets: [{ name: "default", isDefault: true, sourcePath: "generate", outputPath: "output" }],
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
  await page.route("**/solution", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({ json: { ...payload.solution, ...route.request().postDataJSON() } });
      return;
    }
    await route.continue();
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
    testWindow.__openSolutionSettings = null;
    testWindow.desktop = {
      isElectron: true,
      apiBase: "http://localhost:4320",
      token: "desktop-test-token",
      window: { setSolutionPath: async () => true },
      solution: {
        pickOpenPath: async () => "/tmp/mock.dm8s",
        pickDirectory: async () => "/tmp/projects",
        onOpenPath: () => () => {},
        onOpenSettings: (callback: () => void) => {
          testWindow.__openSolutionSettings = callback;
          return () => { testWindow.__openSolutionSettings = null; };
        },
        load: async () => ({ payload: testWindow.__mockSolutionPayload || null }),
        createNew: async (payload: unknown) => {
          testWindow.__createNewCalls.push(payload);
          return { solutionPath: "/tmp/projects/NewSolution.dm8s", payload: testWindow.__mockSolutionPayload || null };
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
        generatorTargets: [{ name: "default", isDefault: true, sourcePath: "generate", outputPath: "output" }],
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

test("new solution sends initial settings to the backend create bridge", async ({ page }) => {
  await initDesktopBridge(page);
  await mockSharedApi(page);
  await loadSolutionFromDialogElectron(page);

  await page.locator("button:has-text('New')").first().click();
  await page.getByLabel("Solution name").fill("NewSolution");
  await page.getByRole("button", { name: "Browse" }).click();
  await expect(page.getByText("Creates /tmp/projects/NewSolution.dm8s.")).toBeVisible();
  await page.getByRole("button", { name: "Create Solution" }).click();

  const calls = await page.evaluate(() => (window as unknown as TestWindow).__createNewCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual({
    saveDir: "/tmp/projects",
    solutionName: "NewSolution",
    settings: {
      basePath: "base",
      modelPath: "model",
      pluginsPath: "plugins",
      diagramPath: null,
      generatorTargets: [{ name: "default", isDefault: true, sourcePath: "generate", outputPath: "output" }],
    },
  });
});

test("new solution wizard exposes editable solution settings", async ({ page }) => {
  await initDesktopBridge(page);
  await mockSharedApi(page);
  await loadSolutionFromDialogElectron(page);

  await page.locator("button:has-text('New')").first().click();

  await expect(page.getByLabel("Base path")).toHaveValue("base");
  await expect(page.getByLabel("Model path")).toHaveValue("model");
  await expect(page.getByLabel("Plugins path")).toHaveValue("plugins");
  await expect(page.getByLabel("Source path")).toHaveValue("generate");
  await expect(page.getByLabel("Output path")).toHaveValue("output");
  await expect(page.getByRole("button", { name: "Add target" })).toBeVisible();
});

test("Edit menu settings save through PATCH /solution", async ({ page }) => {
  await initDesktopBridge(page);
  await mockSharedApi(page);
  await loadSolutionFromDialogElectron(page);
  await page.evaluate(() => (window as unknown as TestWindow).__openSolutionSettings?.());

  await expect(page.getByRole("heading", { name: "Solution settings" })).toBeVisible();
  await page.getByLabel("Base path").fill("metadata");
  const response = page.waitForResponse((item) => new URL(item.url()).pathname === "/solution" && item.request().method() === "PATCH");
  await page.getByRole("button", { name: "Save settings" }).click();
  const patchResponse = await response;
  expect(patchResponse.ok()).toBe(true);
  expect(patchResponse.request().postDataJSON()).toMatchObject({ basePath: "metadata" });
});

test("dialogs ignore outside clicks and still close via cancel", async ({ page }) => {
  await initDesktopBridge(page);
  await mockSharedApi(page);
  await loadSolutionFromDialogElectron(page);

  await page.locator("button:has-text('New')").first().click();
  const dialog = page.getByRole("dialog", { name: "Create New Solution" });
  await expect(dialog).toBeVisible();

  await page.mouse.click(10, 10);
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("new solution keeps create button disabled until required fields are filled", async ({ page }) => {
  await initDesktopBridge(page);
  await mockSharedApi(page);
  await loadSolutionFromDialogElectron(page);

  await page.locator("button:has-text('New')").first().click();

  const createButton = page.getByRole("button", { name: "Create Solution" });
  await expect(createButton).toBeDisabled();

  await page.getByLabel("Solution name").fill("StepFlow");
  await expect(createButton).toBeDisabled();

  await page.getByLabel("Solution directory").fill("/tmp/projects");
  await expect(createButton).toBeEnabled();
});
