import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { attachDiagnostics, openSolution, readJson, solutionPaths } from "./helpers";

const solutionPath = (process.env.DATAM8_RELEASE_SOLUTION_PATH || "").trim();

function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function tryReadJson(filePath: string): any | null {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function listModelJsonFiles(modelDir: string): string[] {
  if (!fs.existsSync(modelDir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(modelDir, { withFileTypes: true })) {
    const fullPath = path.join(modelDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listModelJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== ".properties.json") {
      out.push(fullPath);
    }
  }
  return out;
}

function findFirstModelFile(modelDir: string): string {
  return listModelJsonFiles(modelDir)[0] || "";
}

function setFirstPropertyAssignment(filePath: string, property: string, value: string) {
  const content = readJson(filePath);
  writeJson(filePath, {
    ...content,
    properties: [{ property, value }, ...(Array.isArray(content.properties) ? content.properties.slice(1) : [])],
  });
}

function hasPropertyAssignment(modelDir: string, property: string, value: string): boolean {
  return listModelJsonFiles(modelDir).some((file) => {
    const content = tryReadJson(file);
    const rows = Array.isArray(content?.properties) ? content.properties : [];
    return rows.some((row: any) => row?.property === property && row?.value === value);
  });
}

function hasPropertyValue(filePath: string, property: string, value: string): boolean {
  const content = tryReadJson(filePath);
  const rows = Array.isArray(content?.propertyValues) ? content.propertyValues : [];
  return rows.some((row: any) => row?.property === property && row?.name === value);
}

async function clickBase(page: any, label: string) {
  await page.getByRole("tab", { name: "Base" }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(page.locator(".base-editor")).toBeVisible();
}

test.describe("property refactor release workflow", () => {
  test.skip(!solutionPath, "Set DATAM8_RELEASE_SOLUTION_PATH to run release tests.");

  test("renaming a Property updates model assignments and PropertyValues", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    const runId = Date.now().toString(36);
    const { baseDir, modelDir } = solutionPaths(solutionPath);

    const propertiesPath = path.join(baseDir, "Properties.json");
    const propertyValuesPath = path.join(baseDir, "PropertyValues.json");
    const seedModelFile = findFirstModelFile(modelDir);
    expect(fs.existsSync(propertiesPath), "Sample must contain Base/Properties.json").toBeTruthy();
    expect(fs.existsSync(propertyValuesPath), "Sample must contain Base/PropertyValues.json").toBeTruthy();
    expect(seedModelFile, "Sample must contain at least one model entity").toBeTruthy();

    const seedProperty = `e2eProp_${runId}`;
    const renamedProperty = `e2eRenamedProp_${runId}`;
    const seedValue = `e2eValue_${runId}`;

    const properties = readJson(propertiesPath);
    properties.properties = [
      ...(Array.isArray(properties.properties) ? properties.properties : []),
      { name: seedProperty, displayName: seedProperty, scopes: [{ type: "entity" }] },
    ];
    writeJson(propertiesPath, properties);

    const values = readJson(propertyValuesPath);
    values.propertyValues = [
      ...(Array.isArray(values.propertyValues) ? values.propertyValues : []),
      { property: seedProperty, name: seedValue, displayName: seedValue },
    ];
    writeJson(propertyValuesPath, values);
    setFirstPropertyAssignment(seedModelFile, seedProperty, seedValue);

    await openSolution(page, solutionPath);
    const reloadHitsBefore = diagnostics.endpointHits.get("/model/reload") || 0;
    await page.getByRole("button", { name: "Reload" }).first().click();
    await expect.poll(() => diagnostics.endpointHits.get("/model/reload") || 0, { timeout: 30_000 }).toBeGreaterThan(reloadHitsBefore);
    await clickBase(page, "Properties");
    await page.getByText(seedProperty, { exact: true }).click();
    await page.locator(".base-editor").locator("label", { hasText: "Name" }).locator("..").getByRole("textbox").first().fill(renamedProperty);
    await page.keyboard.press("Tab");

    await expect(page.locator(".sidebar__save-pill--bulk-saved", { hasText: "Saved" })).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => hasPropertyAssignment(modelDir, renamedProperty, seedValue), { timeout: 30_000 }).toBeTruthy();
    await expect
      .poll(
        () => ({
          renamed: hasPropertyValue(propertyValuesPath, renamedProperty, seedValue),
          stale: hasPropertyValue(propertyValuesPath, seedProperty, seedValue),
        }),
        { timeout: 30_000 },
      )
      .toEqual({ renamed: true, stale: false });

    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.failedRequests).toEqual([]);
    expect(diagnostics.serverErrors).toEqual([]);
  });
});
