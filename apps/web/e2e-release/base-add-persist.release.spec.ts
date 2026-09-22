import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const sourceSolutionPath = (process.env.DATAM8_RELEASE_SOLUTION_PATH || "").trim();

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function openSolution(page: import("@playwright/test").Page, dm8sPath: string) {
  return (async () => {
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
  })();
}

test.describe.serial("release suite (base add persists to disk)", () => {
  test.skip(!sourceSolutionPath, "Set DATAM8_RELEASE_SOLUTION_PATH to run release tests.");

  test("adding Base/DataProducts item writes a new item to JSON file", async ({ page }) => {
    const endpointHits = new Map<string, number>();
    const solutionFullUrls: string[] = [];
    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/solution/full")) {
        solutionFullUrls.push(url);
        endpointHits.set("/solution/full", (endpointHits.get("/solution/full") || 0) + 1);
      }
      if (url.includes("/entities/")) {
        endpointHits.set("/entities/", (endpointHits.get("/entities/") || 0) + 1);
      }
      if (url.includes("/model/save")) {
        endpointHits.set("/model/save", (endpointHits.get("/model/save") || 0) + 1);
      }
    });

    const dm8sPath = sourceSolutionPath;
    const solution = readJson(sourceSolutionPath);
    const solutionRoot = path.dirname(sourceSolutionPath);
    const baseDir = path.isAbsolute(solution.basePath) ? solution.basePath : path.join(solutionRoot, solution.basePath);
    const dataProductsPath = path.join(baseDir, "DataProducts.json");
    const originalDataProductsRaw = fs.readFileSync(dataProductsPath, "utf8");

    const before = readJson(dataProductsPath);
    const beforeItems = Array.isArray(before?.dataProducts) ? before.dataProducts : [];
    const beforeNames = new Set(beforeItems.map((item: any) => `${item?.name ?? ""}`.trim()).filter(Boolean));

    try {
      await openSolution(page, dm8sPath);
      await page.getByRole("tab", { name: "Base" }).click();
      await page.getByRole("button", { name: "Data Products", exact: true }).click();

      const addButton = page.locator(".base-list__header").getByRole("button", { name: "Add", exact: true });
      await expect(addButton).toBeVisible();
      await addButton.click();

      await expect
        .poll(() => endpointHits.get("/entities/") || 0, { timeout: 30_000 })
        .toBeGreaterThan(0);
      await expect
        .poll(() => endpointHits.get("/model/save") || 0, { timeout: 30_000 })
        .toBeGreaterThan(0);

      await expect
        .poll(() => {
          const next = readJson(dataProductsPath);
          const items = Array.isArray(next?.dataProducts) ? next.dataProducts : [];
          return items.length;
        }, { timeout: 30_000 })
        .toBe(beforeItems.length + 1);

      const after = readJson(dataProductsPath);
      const afterItems = Array.isArray(after?.dataProducts) ? after.dataProducts : [];
      const added = afterItems.find((item: any) => {
        const name = `${item?.name ?? ""}`.trim();
        return name && !beforeNames.has(name);
      });

      expect(added, "Expected exactly one newly added data product item").toBeTruthy();
      expect(Array.isArray(added?.dataModules) ? added.dataModules.length : 0).toBeGreaterThan(0);
    } finally {
      fs.writeFileSync(dataProductsPath, originalDataProductsRaw, "utf8");
    }
  });
});
