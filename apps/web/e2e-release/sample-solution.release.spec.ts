import { expect, test } from "@playwright/test";

const solutionPath = (process.env.DATAM8_RELEASE_SOLUTION_PATH || "").trim();

type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  serverErrors: string[];
  endpointHits: Map<string, number>;
};

const endpointKeys = ["/solution/full", "/entities/", "/entities/move", "/model/reload", "/validate", "/generate"];

function endpointKeyFor(url: string): string | null {
  for (const key of endpointKeys) {
    if (url.includes(key)) return key;
  }
  return null;
}

function attachDiagnostics(page: import("@playwright/test").Page): Diagnostics {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    serverErrors: [],
    endpointHits: new Map<string, number>(),
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") diagnostics.consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => diagnostics.pageErrors.push(err.message));
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    const url = response.url();
    const key = endpointKeyFor(url);
    if (key) {
      diagnostics.endpointHits.set(key, (diagnostics.endpointHits.get(key) || 0) + 1);
    }
    if (response.status() >= 500) {
      diagnostics.serverErrors.push(`${response.status()} ${response.request().method()} ${url}`);
    }
  });

  return diagnostics;
}

async function openSolution(page: import("@playwright/test").Page, dm8sPath: string) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const pathInput = page.getByPlaceholder("Absolute path to .dm8s");
  if (!(await pathInput.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Open" }).first().click();
    await expect(pathInput).toBeVisible();
  }

  await pathInput.fill(dm8sPath);
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Filter model entities" })).toBeVisible();
}

test.describe.serial("release suite (real sample, no API mocks)", () => {
  test.skip(!solutionPath, "Set DATAM8_RELEASE_SOLUTION_PATH to run release tests.");

  test("open, rename, move, reload, validate, generate", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await openSolution(page, solutionPath);

    await expect(page.getByRole("button", { name: "010-Stage" }).first()).toBeVisible();

    await page.getByRole("textbox", { name: "Filter model entities" }).fill("DIMTIME");
    await page.getByRole("button", { name: "DIMTIME" }).first().click();

    const renamed = `DIMTIME_E2E_${Date.now().toString().slice(-4)}`;
    const nameInput = page.locator('label:has-text("Name") + input').first();
    await nameInput.fill(renamed);
    await nameInput.press("Tab");
    await expect.poll(() => diagnostics.endpointHits.get("/entities/") || 0, { timeout: 20_000 }).toBeGreaterThan(0);
    await expect(page.getByRole("textbox", { name: "Filter model entities" })).toBeVisible();

    await page.getByRole("textbox", { name: "Filter model entities" }).fill(renamed);
    const entityHitsBeforeMove = diagnostics.endpointHits.get("/entities/") || 0;
    await page.getByRole("button", { name: renamed }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: /Move to/ }).click();
    await expect(page.getByRole("heading", { name: "Move entity" })).toBeVisible();
    await page.getByRole("button", { name: "Browse" }).click();

    const picker = page.locator(".move-entities-dialog .codex-popup-section").first();
    await picker.getByRole("button", { name: "Model" }).click();
    await picker.getByRole("button", { name: /020-Core/ }).first().click();
    await picker.getByRole("button", { name: /Sales/ }).first().click();
    await picker.getByRole("button", { name: "Select" }).first().click();
    await page.getByRole("button", { name: "Move" }).click();
    await expect.poll(() => diagnostics.endpointHits.get("/entities/") || 0, { timeout: 20_000 }).toBeGreaterThan(entityHitsBeforeMove);

    await page.getByRole("button", { name: "Reload" }).first().click();
    await expect.poll(() => diagnostics.endpointHits.get("/model/reload") || 0, { timeout: 20_000 }).toBeGreaterThan(0);

    const validatorPanel = page.locator(".panel").filter({ hasText: "Validator" }).first();
    await validatorPanel.getByRole("button", { name: "Run" }).click();
    await expect.poll(() => diagnostics.endpointHits.get("/validate") || 0, { timeout: 30_000 }).toBeGreaterThan(0);

    const generatorPanel = page.locator(".panel").filter({ hasText: "Generator" }).first();
    await generatorPanel.getByRole("button", { name: "Run" }).click();
    await expect(generatorPanel.getByText("OK", { exact: true })).toBeVisible({ timeout: 120_000 });

    expect.soft(diagnostics.consoleErrors, `DevTools console.error entries found:\n${diagnostics.consoleErrors.join("\n")}`).toEqual([]);
    expect.soft(diagnostics.pageErrors, `DevTools page errors found:\n${diagnostics.pageErrors.join("\n")}`).toEqual([]);
    expect.soft(diagnostics.failedRequests, `Failed requests found:\n${diagnostics.failedRequests.join("\n")}`).toEqual([]);
    expect.soft(diagnostics.serverErrors, `5xx backend responses found:\n${diagnostics.serverErrors.join("\n")}`).toEqual([]);
  });
});
