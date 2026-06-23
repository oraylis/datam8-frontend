import fs from "node:fs";
import path from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";

export type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  serverErrors: string[];
  endpointHits: Map<string, number>;
};

const endpointKeys = [
  "/solution/full",
  "/entities/",
  "/entities/move",
  "/model/reload",
  "/model/save",
  "/validate",
  "/generate",
];

function endpointKeyFor(url: string): string | null {
  for (const key of endpointKeys) {
    if (url.includes(key)) return key;
  }
  return null;
}

export function attachDiagnostics(page: Page): Diagnostics {
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

export async function openSolution(page: Page, dm8sPath: string) {
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

export function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function solutionPaths(dm8sPath: string) {
  const solution = readJson(dm8sPath);
  const solutionRoot = path.dirname(dm8sPath);
  const basePath = typeof solution.basePath === "string" && solution.basePath.trim() ? solution.basePath : "Base";
  const modelPath = typeof solution.modelPath === "string" && solution.modelPath.trim() ? solution.modelPath : "Model";
  return {
    solution,
    solutionRoot,
    baseDir: path.isAbsolute(basePath) ? basePath : path.join(solutionRoot, basePath),
    modelDir: path.isAbsolute(modelPath) ? modelPath : path.join(solutionRoot, modelPath),
  };
}

export async function recordTiming<T>(
  testInfo: TestInfo,
  timings: Record<string, number>,
  label: string,
  action: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await action();
  } finally {
    timings[label] = Math.round(performance.now() - start);
    testInfo.annotations.push({ type: "timing", description: `${label}: ${timings[label]}ms` });
  }
}

export function expectCleanDiagnostics(diagnostics: Diagnostics) {
  expect.soft(diagnostics.consoleErrors, `DevTools console.error entries found:\n${diagnostics.consoleErrors.join("\n")}`).toEqual([]);
  expect.soft(diagnostics.pageErrors, `DevTools page errors found:\n${diagnostics.pageErrors.join("\n")}`).toEqual([]);
  expect.soft(diagnostics.failedRequests, `Failed requests found:\n${diagnostics.failedRequests.join("\n")}`).toEqual([]);
  expect.soft(diagnostics.serverErrors, `5xx backend responses found:\n${diagnostics.serverErrors.join("\n")}`).toEqual([]);
}
