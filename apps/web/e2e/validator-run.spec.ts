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
  let validateCalls = 0;

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

  await page.route("**/validate**", async (route) => {
    validateCalls += 1;
    await route.fulfill({ status: 404, json: { detail: "Not Found" } });
  });

  return {
    getValidateCalls: () => validateCalls,
  };
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
}

test("Validator Run reports the pinned Generator API gap without a /validate request", async ({ page }) => {
  const { getValidateCalls } = await mockApi(page);
  await loadSolutionFromDialog(page);

  const validatorPanel = page.locator(".generator-drawer").first();
  const validatorRunButton = validatorPanel.getByRole("button", { name: "More generator actions" }).first();
  await expect(validatorRunButton).toBeVisible();
  await expect(validatorRunButton).toBeEnabled();

  await validatorRunButton.evaluate((element) => (element as HTMLButtonElement).click());
  await page.getByRole("menuitem", { name: "Validate only" }).click();

  await expect.poll(getValidateCalls, { timeout: 5_000 }).toBe(0);
  await expect(page.getByText("Validate is not available in the pinned Generator API.")).toBeVisible();
});
