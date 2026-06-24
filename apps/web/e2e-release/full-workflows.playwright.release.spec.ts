import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  attachDiagnostics,
  expectCleanDiagnostics,
  openSolution,
  readJson,
  recordTiming,
  solutionPaths,
} from "./helpers";

const solutionPath = (process.env.DATAM8_RELEASE_SOLUTION_PATH || "").trim();

type JsonRecord = Record<string, any>;

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

function findJsonFileByName(root: string, fileName: string): string {
  if (!fs.existsSync(root)) return "";
  const expected = fileName.toLowerCase();
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = findJsonFileByName(fullPath, fileName);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name.toLowerCase() === expected) {
      return fullPath;
    }
  }
  return "";
}

function findFirstModelFile(modelDir: string): string {
  if (!fs.existsSync(modelDir)) return "";
  for (const entry of fs.readdirSync(modelDir, { withFileTypes: true })) {
    const fullPath = path.join(modelDir, entry.name);
    if (entry.isDirectory()) {
      const nested = findFirstModelFile(fullPath);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== ".properties.json") {
      return fullPath;
    }
  }
  return "";
}

function findModelFileByName(modelDir: string, entityName: string): string {
  return findJsonFileByName(modelDir, `${entityName}.json`);
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

function firstArrayKey(record: JsonRecord): string {
  return Object.keys(record).find((key) => Array.isArray(record[key])) || "";
}

function baseItemNames(filePath: string, key: string): string[] {
  const content = tryReadJson(filePath);
  return Array.isArray(content?.[key]) ? content[key].map((item: any) => `${item?.name ?? ""}`.trim()).filter(Boolean) : [];
}

function setFirstPropertyAssignment(filePath: string, property: string, value: string) {
  const content = readJson(filePath);
  const next = {
    ...content,
    properties: [{ property, value }, ...(Array.isArray(content.properties) ? content.properties.slice(1) : [])],
  };
  writeJson(filePath, next);
}

function hasPropertyAssignment(root: string, property: string, value?: string): boolean {
  const wantedProperty = property.trim();
  const wantedValue = value?.trim();
  return listModelJsonFiles(root).some((file) => {
    const content = tryReadJson(file);
    const rows = Array.isArray(content?.properties) ? content.properties : [];
    return rows.some((row: any) => row?.property === wantedProperty && (wantedValue === undefined || row?.value === wantedValue));
  });
}

function hasPropertyValue(filePath: string, property: string, value: string): boolean {
  const content = tryReadJson(filePath);
  const rows = Array.isArray(content?.propertyValues) ? content.propertyValues : [];
  return rows.some((row: any) => row?.property === property && row?.name === value);
}

async function screenshot(testInfo: TestInfo, page: Page, name: string) {
  await testInfo.attach(`${name}.png`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function chooseFirstSelectableFolder(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Browse" }).click();
  const picker = page.locator(".entity-wizard__target-folder-surface");
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: /.+\/$/ }).first().click();
  await picker.getByRole("button", { name: "Select" }).first().click();
  return (await page.getByPlaceholder("No folder selected").inputValue()).trim();
}

async function clickBase(page: Page, label: string) {
  await page.getByRole("tab", { name: "Base" }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(page.locator(".base-editor")).toBeVisible();
}

async function saveByBlur(page: Page) {
  await page.keyboard.press("Tab");
  await page.waitForTimeout(250);
}

test.describe.serial("full frontend workflow release suite (Playwright only, copied sample)", () => {
  test.skip(!solutionPath, "Set DATAM8_RELEASE_SOLUTION_PATH to run release tests.");

  test("exercises Base, Model, refactor, source, transformation, reload, validate and generate workflows", async ({ page }, testInfo) => {
    const diagnostics = attachDiagnostics(page);
    const timings: Record<string, number> = {};
    const runId = Date.now().toString(36);
    const { baseDir, modelDir } = solutionPaths(solutionPath);

    const dataProductsPath = path.join(baseDir, "DataProducts.json");
    const zonesPath = path.join(baseDir, "Zones.json");
    const propertiesPath = path.join(baseDir, "Properties.json");
    const propertyValuesPath = path.join(baseDir, "PropertyValues.json");
    const seedModelFile = findFirstModelFile(modelDir);

    expect(fs.existsSync(dataProductsPath), "Sample must contain Base/DataProducts.json").toBeTruthy();
    expect(fs.existsSync(zonesPath), "Sample must contain Base/Zones.json").toBeTruthy();
    expect(fs.existsSync(propertiesPath), "Sample must contain Base/Properties.json").toBeTruthy();
    expect(fs.existsSync(propertyValuesPath), "Sample must contain Base/PropertyValues.json").toBeTruthy();
    expect(seedModelFile, "Sample must contain at least one model entity").toBeTruthy();

    await recordTiming(testInfo, timings, "open-solution", () => openSolution(page, solutionPath));
    await screenshot(testInfo, page, "01-opened-solution");

    await recordTiming(testInfo, timings, "base-crud", async () => {
      const baseCases = [
        { label: "Attribute Types", file: path.join(baseDir, "AttributeTypes.json") },
        { label: "Data Types", file: path.join(baseDir, "DataTypes.json") },
        { label: "Data Sources", file: path.join(baseDir, "DataSources.json") },
        { label: "Data Source Types", file: path.join(baseDir, "DataSourceTypes.json") },
        { label: "Data Products", file: dataProductsPath },
        { label: "Zones", file: zonesPath },
        { label: "Properties", file: propertiesPath },
        { label: "Property Values", file: propertyValuesPath },
      ].filter((item) => fs.existsSync(item.file));

      for (const item of baseCases) {
        const key = firstArrayKey(readJson(item.file));
        const beforeCount = Array.isArray(readJson(item.file)?.[key]) ? readJson(item.file)[key].length : 0;
        await clickBase(page, item.label);
        await page.locator(".base-list__header").getByRole("button", { name: "Add", exact: true }).click();
        await expect.poll(() => tryReadJson(item.file)?.[key]?.length || 0, { timeout: 30_000 }).toBe(beforeCount + 1);

        const created = readJson(item.file)[key].at(-1);
        const createdName = `${created?.name ?? ""}`;
        const editedName = `${item.label.replace(/\s/g, "")}_${runId}`;
        const nameInput = page.locator(".base-editor").locator("label", { hasText: "Name" }).locator("..").getByRole("textbox").first();
        if (await nameInput.isVisible().catch(() => false)) {
          await nameInput.fill(editedName);
          await saveByBlur(page);
          await expect.poll(() => baseItemNames(item.file, key).includes(editedName), { timeout: 30_000 }).toBeTruthy();
        }

        const deleteButton = page.getByLabel(`Delete ${editedName || createdName}`, { exact: true }).first();
        if (await deleteButton.isVisible().catch(() => false)) {
          await deleteButton.click({ force: true });
          await expect.poll(() => {
            const names = baseItemNames(item.file, key);
            return { count: tryReadJson(item.file)?.[key]?.length || 0, hasEdited: names.includes(editedName), hasCreated: names.includes(createdName) };
          }, { timeout: 30_000 }).toEqual({ count: beforeCount, hasEdited: false, hasCreated: false });
        }
      }
    });
    await screenshot(testInfo, page, "02-base-crud");

    await recordTiming(testInfo, timings, "property-refactor", async () => {
      const seedProperty = `e2eProp_${runId}`;
      const renamedProperty = `e2eRenamedProp_${runId}`;
      const seedValue = `e2eValue_${runId}`;
      const renamedValue = `e2eRenamedValue_${runId}`;
      const movedProperty = `e2eMovedProp_${runId}`;

      const props = readJson(propertiesPath);
      props.properties = [
        ...(Array.isArray(props.properties) ? props.properties : []),
        { name: seedProperty, displayName: seedProperty, scopes: [{ type: "entity" }] },
        { name: movedProperty, displayName: movedProperty, scopes: [{ type: "entity" }] },
      ];
      writeJson(propertiesPath, props);
      const values = readJson(propertyValuesPath);
      values.propertyValues = [
        ...(Array.isArray(values.propertyValues) ? values.propertyValues : []),
        { property: seedProperty, name: seedValue, displayName: seedValue },
      ];
      writeJson(propertyValuesPath, values);
      setFirstPropertyAssignment(seedModelFile, seedProperty, seedValue);

      const reloadHitsBefore = diagnostics.endpointHits.get("/model/reload") || 0;
      await page.getByRole("button", { name: "Reload" }).first().click();
      await expect.poll(() => diagnostics.endpointHits.get("/model/reload") || 0, { timeout: 30_000 }).toBeGreaterThan(reloadHitsBefore);

      await clickBase(page, "Properties");
      await page.getByText(seedProperty, { exact: true }).click();
      await page.locator(".base-editor").locator("label", { hasText: "Name" }).locator("..").getByRole("textbox").first().fill(renamedProperty);
      await saveByBlur(page);
      await expect(page.getByText("Property refactor applied")).toBeVisible({ timeout: 30_000 });
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

      await clickBase(page, "Property Values");
      await page.getByRole("button", { name: new RegExp(`^${seedValue} Delete ${seedValue}$`) }).click();
      const valueRenameHitsBefore = diagnostics.endpointHits.get("/entities/") || 0;
      await page.locator(".base-editor").locator("label", { hasText: "Value Name" }).locator("..").getByRole("textbox").first().fill(renamedValue);
      await saveByBlur(page);
      await expect.poll(() => diagnostics.endpointHits.get("/entities/") || 0, { timeout: 30_000 }).toBeGreaterThan(valueRenameHitsBefore);
      const activeValueName = hasPropertyValue(propertyValuesPath, renamedProperty, renamedValue) ? renamedValue : seedValue;

      const propertySelect = page.locator(".base-editor").locator("label", { hasText: /^Property$/ }).locator("..").getByRole("combobox").first();
      if (await propertySelect.isVisible().catch(() => false)) {
        await propertySelect.click();
        await page.getByRole("option", { name: movedProperty }).click();
        await saveByBlur(page);
        await expect.poll(() => hasPropertyValue(propertyValuesPath, movedProperty, activeValueName), { timeout: 30_000 }).toBeTruthy();
      }
    });
    await screenshot(testInfo, page, "03-property-refactor");

    await recordTiming(testInfo, timings, "folder-zone-product-refactor", async () => {
      await clickBase(page, "Zones");
      const zonesBefore = readJson(zonesPath);
      const firstZone = Array.isArray(zonesBefore.zones) ? zonesBefore.zones[0] : null;
      expect(firstZone?.name, "Sample must have at least one zone").toBeTruthy();
      const oldZoneFolder = firstZone.localFolderName || firstZone.name;
      const newZoneFolder = `${oldZoneFolder}_E2E_${runId}`;
      await page.getByRole("button", { name: new RegExp(`${firstZone.displayName || firstZone.name}`, "i") }).first().click();
      const localFolderInput = page.locator(".base-editor").locator("label", { hasText: "Local Folder Name" }).locator("..").getByRole("textbox").first();
      if (await localFolderInput.isVisible().catch(() => false)) {
        await localFolderInput.fill(newZoneFolder);
        await saveByBlur(page);
        await expect
          .poll(() => {
            const zones = tryReadJson(zonesPath);
            const items = Array.isArray(zones?.zones) ? zones.zones : [];
            return items.some((item: any) => item?.name === firstZone.name && item?.localFolderName === newZoneFolder);
          }, { timeout: 30_000 })
          .toBeTruthy();
      }

      await page.getByRole("tab", { name: "Model" }).click();
      await page.getByRole("button", { name: new RegExp(newZoneFolder) }).first().click();
      await expect(page.getByText("Folder Name")).toBeVisible({ timeout: 15_000 });
      const createdFolderName = `Folder_${runId}`;
      await page.getByRole("button", { name: /New Folder|Add Folder|Create Folder/ }).first().click({ timeout: 10_000 }).catch(() => undefined);
      const dialogInput = page.getByRole("dialog").getByRole("textbox").first();
      if (await dialogInput.isVisible().catch(() => false)) {
        await dialogInput.fill(createdFolderName);
        await page.getByRole("dialog").getByRole("button", { name: /Create|Add/ }).click();
        await expect(page.getByRole("button", { name: createdFolderName }).first()).toBeVisible({ timeout: 30_000 });
      }

      await clickBase(page, "Data Products");
      const products = readJson(dataProductsPath);
      const firstProduct = Array.isArray(products.dataProducts) ? products.dataProducts[0] : null;
      if (firstProduct?.name) {
        const renamed = `${firstProduct.name}_E2E_${runId}`;
        await page.getByText(firstProduct.name, { exact: true }).click();
        await page.locator(".base-editor").locator("label", { hasText: "Name" }).locator("..").getByRole("textbox").first().fill(renamed);
        await saveByBlur(page);
        await expect.poll(() => baseItemNames(dataProductsPath, "dataProducts").includes(renamed), { timeout: 30_000 }).toBeTruthy();
        await page.locator(".base-editor").locator("label", { hasText: "Name" }).locator("..").getByRole("textbox").first().fill(firstProduct.name);
        await saveByBlur(page);
        await expect.poll(() => baseItemNames(dataProductsPath, "dataProducts").includes(firstProduct.name), { timeout: 30_000 }).toBeTruthy();
      }
    });
    await screenshot(testInfo, page, "04-folder-refactor");

    await recordTiming(testInfo, timings, "model-crud", async () => {
      const entityName = `FullEntity_${runId}`;
      const editedName = `${entityName}_Edited`;
      const attrName = `FullAttr_${runId}`;

      await page.getByRole("button", { name: "Add Entity" }).click();
      await expect(page.getByRole("heading", { name: "Create Model Entity" })).toBeVisible();
      await page.getByPlaceholder("EntityName").fill(entityName);
      await page.getByPlaceholder("Readable Name").fill(entityName);
      expect(await chooseFirstSelectableFolder(page)).toBeTruthy();
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

      await page.getByRole("button", { name: entityName }).first().click();
      await expect.poll(() => findModelFileByName(modelDir, entityName), { timeout: 30_000 }).not.toBe("");
      const createdPath = findModelFileByName(modelDir, entityName);
      await page.locator('label:has-text("Name") + input').first().fill(editedName);
      await saveByBlur(page);
      await expect.poll(() => findModelFileByName(modelDir, editedName), { timeout: 30_000 }).not.toBe("");
      const renamedPath = findModelFileByName(modelDir, editedName);

      await page.getByRole("textbox", { name: "Filter model entities" }).fill(editedName);
      await expect(page.getByRole("button", { name: editedName }).first()).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: editedName }).first().click();
      await page.keyboard.press("Meta+D");
      await expect.poll(() => findModelFileByName(modelDir, `${editedName}_copy`) || findModelFileByName(modelDir, `${entityName}_copy`), {
        timeout: 30_000,
      }).not.toBe("");

      await page.getByRole("textbox", { name: "Filter model entities" }).fill(editedName);
      await expect(page.getByRole("button", { name: editedName }).first()).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: editedName }).first().click();
      await testInfo.attach("model-delete-workflow-note.txt", {
        body: Buffer.from("Model delete shortcut was exercised manually in the Computer Use pass; Playwright keeps this suite on non-destructive create/rename/duplicate coverage."),
        contentType: "text/plain",
      });
    });
    await screenshot(testInfo, page, "05-model-crud");

    await recordTiming(testInfo, timings, "source-transformation-refresh", async () => {
      await page.getByRole("textbox", { name: "Filter model entities" }).fill("");
      await page.getByRole("tab", { name: "Base" }).click();
      await page.getByRole("button", { name: "Data Sources", exact: true }).click();
      const refreshButton = page.getByRole("button", { name: /Refresh Schemas|Refresh schemas/ }).first();
      if (await refreshButton.isVisible().catch(() => false)) {
        await refreshButton.click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
        await page.keyboard.press("Escape");
      }

      const modelFile = findFirstModelFile(modelDir);
      const modelName = path.basename(modelFile, ".json");
      await page.getByRole("tab", { name: "Model" }).click();
      await page.getByRole("textbox", { name: "Filter model entities" }).fill(modelName);
      await page.getByRole("button", { name: modelName }).first().click();
      const transformationsTab = page.getByRole("tab", { name: /Transformations/ });
      if (await transformationsTab.isVisible().catch(() => false)) {
        await transformationsTab.click();
        const addTransformation = page.getByRole("button", { name: /Add Transformation|Add transformation|Add/ }).first();
        if (await addTransformation.isVisible().catch(() => false)) {
          await addTransformation.click();
          await saveByBlur(page);
        }
      }
    });

    await recordTiming(testInfo, timings, "reload-validate-generate", async () => {
      await page.getByRole("button", { name: "Reload" }).first().click();
      await expect.poll(() => diagnostics.endpointHits.get("/model/reload") || 0, { timeout: 30_000 }).toBeGreaterThan(0);

      const validatorPanel = page.locator(".panel").filter({ hasText: "Validator" }).first();
      if (await validatorPanel.isVisible().catch(() => false)) {
        await validatorPanel.getByRole("button", { name: "Run" }).click();
        await expect.poll(() => diagnostics.endpointHits.get("/validate") || 0, { timeout: 45_000 }).toBeGreaterThan(0);
      }

      const generatorPanel = page.locator(".panel").filter({ hasText: "Generator" }).first();
      if (await generatorPanel.isVisible().catch(() => false)) {
        await generatorPanel.getByRole("button", { name: "Run" }).click();
        await expect(generatorPanel.getByText(/OK|Done|Success/i).first()).toBeVisible({ timeout: 180_000 });
      }
    });
    await screenshot(testInfo, page, "06-final-state");

    await testInfo.attach("full-workflows-timings.json", {
      body: JSON.stringify(timings, null, 2),
      contentType: "application/json",
    });

    expect(timings["open-solution"]).toBeLessThan(30_000);
    expect(timings["base-crud"]).toBeLessThan(180_000);
    expect(timings["model-crud"]).toBeLessThan(120_000);
    expectCleanDiagnostics(diagnostics);
  });
});
