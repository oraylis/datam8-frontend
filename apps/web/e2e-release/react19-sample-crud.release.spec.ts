import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  attachDiagnostics,
  expectCleanDiagnostics,
  openSolution,
  readJson,
  recordTiming,
  solutionPaths,
} from "./helpers";

const solutionPath = (process.env.DATAM8_RELEASE_SOLUTION_PATH || "").trim();

function firstJsonFile(dir: string): string {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = firstJsonFile(fullPath);
      if (nested) return nested;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json") && entry.name !== ".properties.json") {
      return fullPath;
    }
  }
  return "";
}

function findModelFileByName(modelDir: string, entityName: string): string {
  const expected = `${entityName}.json`.toLowerCase();
  const entries = fs.readdirSync(modelDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(modelDir, entry.name);
    if (entry.isDirectory()) {
      const nested = findModelFileByName(fullPath, entityName);
      if (nested) return nested;
    }
    if (entry.isFile() && entry.name.toLowerCase() === expected) return fullPath;
  }
  return "";
}

async function chooseFirstSelectableFolder(page: import("@playwright/test").Page): Promise<string> {
  await page.getByRole("button", { name: "Browse" }).click();
  const picker = page.locator(".entity-wizard__target-folder-surface");
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: /.+\/$/ }).first().click();
  await picker.getByRole("button", { name: "Select" }).first().click();
  return (await page.getByPlaceholder("No folder selected").inputValue()).trim();
}

test.describe.serial("React 19 release regression suite (copied sample)", () => {
  test.skip(!solutionPath, "Set DATAM8_RELEASE_SOLUTION_PATH to run release tests.");

  test("Base and Model add, edit, delete persist and Radix Select stays stable", async ({ page }, testInfo) => {
    const diagnostics = attachDiagnostics(page);
    const timings: Record<string, number> = {};
    const runId = Date.now().toString(36);
    const { baseDir, modelDir } = solutionPaths(solutionPath);
    const dataProductsPath = path.join(baseDir, "DataProducts.json");
    const modelSeedFile = firstJsonFile(modelDir);

    expect(fs.existsSync(dataProductsPath), "Sample solution must contain Base/DataProducts.json").toBeTruthy();
    expect(modelSeedFile, "Sample solution must contain at least one model JSON file").toBeTruthy();

    await recordTiming(testInfo, timings, "open-solution", () => openSolution(page, solutionPath));

    await recordTiming(testInfo, timings, "base-add-edit-delete", async () => {
      const before = readJson(dataProductsPath);
      const beforeItems = Array.isArray(before?.dataProducts) ? before.dataProducts : [];

      await page.getByRole("tab", { name: "Base" }).click();
      await page.getByRole("button", { name: "Data Products", exact: true }).click();

      const addButton = page.locator(".base-list__header").getByRole("button", { name: "Add", exact: true });
      await addButton.click();
      await expect.poll(() => {
        const next = readJson(dataProductsPath);
        const items = Array.isArray(next?.dataProducts) ? next.dataProducts : [];
        return items.length;
      }, { timeout: 30_000 }).toBe(beforeItems.length + 1);

      const added = readJson(dataProductsPath).dataProducts.at(-1);
      const generatedName = `${added?.name || ""}`;
      const editedName = `React19Product_${runId}`;
      await page.locator(".base-editor").locator("label", { hasText: "Name" }).locator("..").getByRole("textbox").fill(editedName);
      await page.keyboard.press("Tab");
      await expect.poll(() => {
        const next = readJson(dataProductsPath);
        return (next.dataProducts || []).some((item: any) => item?.name === editedName);
      }, { timeout: 30_000 }).toBeTruthy();

      await page.getByRole("button", { name: `Delete ${editedName}` }).click();
      await expect.poll(() => {
        const next = readJson(dataProductsPath);
        const items = Array.isArray(next?.dataProducts) ? next.dataProducts : [];
        return {
          length: items.length,
          hasEdited: items.some((item: any) => item?.name === editedName),
          hasGenerated: items.some((item: any) => item?.name === generatedName),
        };
      }, { timeout: 30_000 }).toEqual({ length: beforeItems.length, hasEdited: false, hasGenerated: false });
    });

    await recordTiming(testInfo, timings, "model-add-edit-delete", async () => {
      const entityName = `React19Entity_${runId}`;
      const editedName = `${entityName}_Edited`;
      const attrName = `React19Attr_${runId}`;

      await page.getByRole("button", { name: "Add Entity" }).click();
      await expect(page.getByRole("heading", { name: "Create Model Entity" })).toBeVisible();
      await page.getByPlaceholder("EntityName").fill(entityName);
      await page.getByPlaceholder("Readable Name").fill(entityName);
      const selectedFolder = await chooseFirstSelectableFolder(page);
      expect(selectedFolder, "A selectable model folder must be chosen").toBeTruthy();
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Add Attribute" }).click();
      await page.locator(".entity-wizard__attribute-card").getByRole("textbox").first().fill(attrName);

      const attributeCard = page.locator(".entity-wizard__attribute-card").first();
      await attributeCard.getByRole("combobox").first().click();
      await page.getByRole("option").first().click();
      await attributeCard.getByRole("combobox").nth(1).click();
      await page.getByRole("option").first().click();

      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Create Entity" }).click();
      await expect(page.getByRole("heading", { name: "Create Model Entity" })).toBeHidden({ timeout: 30_000 });

      await expect(page.getByRole("button", { name: entityName }).first()).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: entityName }).first().click();
      await expect.poll(() => findModelFileByName(modelDir, entityName), { timeout: 30_000 }).not.toBe("");
      const createdPath = findModelFileByName(modelDir, entityName);

      const nameInput = page.locator('label:has-text("Name") + input').first();
      await nameInput.fill(editedName);
      await nameInput.press("Tab");
      await expect.poll(() => readJson(createdPath).name, { timeout: 30_000 }).toBe(editedName);

      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: entityName }).first().click({ button: "right" });
      await page.getByRole("menuitem", { name: /^Delete$/ }).click();
      await expect.poll(() => fs.existsSync(createdPath), { timeout: 30_000 }).toBeFalsy();
    });

    await testInfo.attach("react19-release-timings.json", {
      body: JSON.stringify(timings, null, 2),
      contentType: "application/json",
    });
    expectCleanDiagnostics(diagnostics);
  });
});
