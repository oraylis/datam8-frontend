import { expect, test } from "@playwright/test";

function createMockSolutionPayload() {
  return {
    solution: {
      schemaVersion: "test",
      basePath: "Base",
      modelPath: "Model",
      pluginsPath: "plugins",
      generatorTargets: [{ name: "default", isDefault: true, sourcePath: "Generate", outputPath: "Output" }],
    },
    baseEntities: [],
    modelEntities: [],
  };
}

async function mockApi(page: import("@playwright/test").Page) {
  const payload = createMockSolutionPayload();
  let generateCalls = 0;
  let releaseGenerate: () => void = () => {};
  const generateGate = new Promise<void>((resolve) => {
    releaseGenerate = resolve;
  });

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
    const method = route.request().method();
    if (method === "GET" || method === "POST") {
      await route.fulfill({ json: { items: [] } });
      return;
    }
    await route.fulfill({ status: 405, json: { error: "method not allowed" } });
  });

  await page.route("**/secrets/available", async (route) => {
    await route.fulfill({ json: { available: false } });
  });

  await page.route("**/secrets/runtime**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { runtimeSecrets: null } });
      return;
    }
    await route.fulfill({ json: {} });
  });

  await page.route("**/*generate*", async (route) => {
    generateCalls += 1;
    await generateGate;
    await route.fulfill({
      json: {
        status: "ok",
        target: "default",
        outputPath: "/tmp/out",
        messages: [
          "[INFO] datam8.generate | Parsed all files in solution",
          "[INFO] datam8.generate | Generation finished",
        ],
      },
    });
  });

  return {
    getGenerateCalls: () => generateCalls,
    releaseGenerate,
  };
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
}

test("Run starts only one generate request even with immediate double click", async ({ page }) => {
  const { getGenerateCalls, releaseGenerate } = await mockApi(page);
  await loadSolutionFromDialog(page);

  const runButton = page.getByRole("button", { name: /^Run$/ }).first();
  await expect(runButton).toBeVisible();
  await expect(runButton).toBeEnabled();

  const element = await runButton.elementHandle();
  if (!element) {
    throw new Error("Run button element handle not available");
  }
  await element.evaluate((btn: HTMLElement) => {
    btn.click();
    btn.click();
  });

  await expect.poll(getGenerateCalls, { timeout: 5_000 }).toBe(1);

  releaseGenerate();
  await expect(page.getByText("OK", { exact: true })).toBeVisible();
  await expect(page.getByText("[INFO] datam8.generate | Generation finished", { exact: true })).toBeVisible();
});

