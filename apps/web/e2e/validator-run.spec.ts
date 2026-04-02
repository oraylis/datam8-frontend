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
  return mockApiWithOptions(page, {});
}

type MockApiOptions = {
  validateResponse?: (callCount: number) => Record<string, unknown>;
};

async function mockApiWithOptions(page: import("@playwright/test").Page, options: MockApiOptions) {
  const payload = createMockSolutionPayload();
  let validateCalls = 0;
  let lastValidateRequest: { method: string; path: string | null; logLevel: string | null } | null = null;

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

  const handleValidateRoute = async (route: import("@playwright/test").Route) => {
    validateCalls += 1;
    const request = route.request();
    const url = new URL(request.url());
    lastValidateRequest = {
      method: request.method(),
      path: url.searchParams.get("path"),
      logLevel: url.searchParams.get("logLevel"),
    };
    const responsePayload =
      options.validateResponse?.(validateCalls) ?? {
        status: "ok",
        solutionPath: "/tmp/mock.dm8s",
        messages: [
          "[INFO] datam8.parser | Parsed all files in solution",
          "[INFO] datam8.parser | Parsed model entities: 0",
        ],
      };
    await route.fulfill({
      json: responsePayload,
    });
  };

  await page.route("**/validate?*", handleValidateRoute);
  await page.route("**/validate", handleValidateRoute);

  return {
    getValidateCalls: () => validateCalls,
    getLastValidateRequest: () => lastValidateRequest,
  };
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
}

test("Validator Run calls /validate with solution path and generator log level", async ({ page }) => {
  const { getValidateCalls, getLastValidateRequest } = await mockApi(page);
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Validator" }).click();

  const validatorPanel = page.locator(".validator-drawer").first();
  const validatorRunButton = validatorPanel.getByRole("button", { name: /^Run$/ }).first();
  await expect(validatorRunButton).toBeVisible();
  await expect(validatorRunButton).toBeEnabled();

  await validatorRunButton.click();

  await expect.poll(getValidateCalls, { timeout: 5_000 }).toBe(1);
  await expect.poll(() => getLastValidateRequest()?.method).toBe("POST");
  await expect.poll(() => getLastValidateRequest()?.path).toBe("/tmp/mock.dm8s");
  await expect.poll(() => getLastValidateRequest()?.logLevel).toBe("info");

  await expect(page.getByText("[INFO] datam8.parser | Parsed all files in solution")).toBeVisible();
});

test("Validator Run shows backend message fallback when messages[] is absent", async ({ page }) => {
  await mockApiWithOptions(page, {
    validateResponse: () => ({
      status: "ok",
      solutionPath: "/tmp/mock.dm8s",
      message: "[INFO] datam8.validator | Validation completed successfully.",
    }),
  });
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Validator" }).click();
  const validatorPanel = page.locator(".validator-drawer").first();
  await validatorPanel.getByRole("button", { name: /^Run$/ }).first().click();

  await expect(page.getByText("[INFO] datam8.validator | Validation completed successfully.").first()).toBeVisible();
});
