import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const python = process.env.DATAM8_TEST_PYTHON || path.join(
  repoRoot, "submodules/datam8-generator/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
let root: string;
let server: ChildProcess;
let baseUrl: string;

const readJson = (relativePath: string) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));

test.beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), "datam8-base-rename-"));
  cpSync(path.join(repoRoot, "scripts/fixtures/job_solution"), root, { recursive: true });
  const writeJson = (relativePath: string, content: unknown) => {
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(content), "utf8");
  };
  writeJson("Base/Zones.json", { type: "zones", zones: [{ name: "Core", targetName: "core", displayName: "Core" }] });
  writeJson("Base/DataTypes.json", { type: "dataTypes", dataTypes: [{ name: "int", targets: {} }] });
  writeJson("Base/AttributeTypes.json", {
    type: "attributeTypes", attributeTypes: [{ name: "ID", displayName: "Identifier", defaultType: "int" }],
  });
  writeJson("Base/Properties.json", {
    type: "properties",
    properties: ["write_mode", "status", "destination"].map((name) => ({ name, displayName: name, scopes: [{ type: "entity" }] })),
  });
  writeJson("Base/PropertyValues.json", {
    type: "propertyValues",
    propertyValues: [{ property: "write_mode", name: "merge" }, { property: "status", name: "merge" }],
  });
  writeJson("Model/Core/Customer.json", {
    id: 1, name: "Customer",
    attributes: [{ ordinalNumber: 1, name: "Id", attributeType: "ID", dataType: { type: "int", nullable: false }, dateAdded: "2026-01-01T00:00:00Z" }],
    sources: [], relationships: [], transformations: [],
    properties: [{ property: "write_mode", value: "merge" }, { property: "status", value: "merge" }],
  });
  writeJson("Base/DataProducts.json", {
    type: "dataProducts", dataProducts: [{ name: "Product", dataModules: [{ name: "Module" }] }],
  });
  const folderMeta = {
    id: 201, name: "Before", path: "Core/Before", displayName: "Folder label",
    description: "Original description", dataProduct: "Product", dataModule: "Module",
    properties: [{ property: "write_mode", value: "merge" }],
  };
  writeJson("Model/Core/Before/.properties.json", { type: "folders", folders: [folderMeta] });
  writeJson("Model/Core/Before/Details/.properties.json", {
    type: "folders", folders: [{ ...folderMeta, id: 202, name: "Details", path: "Core/Before/Details" }],
  });
  writeJson("Model/Core/BeforeArchive/.properties.json", {
    type: "folders", folders: [{ ...folderMeta, id: 203, name: "BeforeArchive", path: "Core/BeforeArchive" }],
  });
  writeJson("Model/Core/Before/Customer.json", { ...readJson("Model/Core/Customer.json"), id: 2 });
  writeJson("Model/Core/Before/Details/Customer.json", { ...readJson("Model/Core/Customer.json"), id: 3 });
  for (const [id, name, source] of [[10, "FunctionEntity", "clean.py"], [11, "LegacyEntity", "legacy.py"]] as const) {
    writeJson(`Model/Core/${name}.json`, {
      ...readJson("Model/Core/Customer.json"), id, name,
      properties: [],
      transformations: [{ stepNo: 1, name: "Clean", kind: "function", function: { source } }],
    });
    const file = path.join(root, "Model/Core", id === 11 ? `${name}/${source}` : source);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `# ${name}\ndef transform(df):\n    return df\n`, "utf8");
  }
  writeJson("Model/Core/CreationEntity.json", {
    ...readJson("Model/Core/Customer.json"), id: 12, name: "CreationEntity",
    properties: [],
    transformations: [{ stepNo: 1, name: "existing", kind: "builtin" }],
  });
  writeFileSync(path.join(root, "Model/Core/existing.py"), "# keep existing content", "utf8");
  server = spawn(python, [
    "-u", "-m", "datam8", "serve", "--host", "127.0.0.1", "--port", "0", "--solution", path.join(root, "TestSolution.dm8s"),
  ], { cwd: repoRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  baseUrl = await new Promise<string>((resolve, reject) => {
    let output = "";
    let errors = "";
    const timeout = setTimeout(() => reject(new Error(`Backend readiness timed out: ${errors}`)), 30_000);
    server.stderr?.on("data", (data) => { errors += data.toString(); });
    server.stdout?.on("data", (data) => {
      output += data.toString();
      for (const line of output.split(/\r?\n/)) {
        try {
          const message = JSON.parse(line);
          if (message.type === "ready") {
            clearTimeout(timeout);
            resolve(message.baseUrl);
          }
        } catch { /* Wait for a complete readiness line. */ }
      }
    });
    server.once("error", (error) => { clearTimeout(timeout); reject(error); });
    server.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Backend exited ${code}: ${errors}`)); });
  });
});

test.afterAll(async () => {
  if (server && server.exitCode === null) {
    await new Promise<void>((resolve) => {
      server.once("exit", () => resolve());
      if (process.platform === "win32") {
        execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true });
      } else server.kill();
    });
  }
  if (root) {
    const resolvedRoot = path.resolve(root);
    if (path.dirname(resolvedRoot) !== path.resolve(tmpdir()) || !path.basename(resolvedRoot).startsWith("datam8-base-rename-")) {
      throw new Error(`Unexpected test directory: ${resolvedRoot}`);
    }
    rmSync(resolvedRoot, { recursive: true, force: true });
  }
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});

async function openFixture(page: Page) {
  const serverErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!/^\/(config|solution|model|entities|functions|plugins|secrets|version|health)(\/|$)/.test(url.pathname)) {
      await route.continue();
      return;
    }
    const response = await route.fetch({ url: `${baseUrl}${url.pathname}${url.search}` });
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${url.pathname}`);
    await route.fulfill({ response });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill(path.join(root, "TestSolution.dm8s"));
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
  return { serverErrors, pageErrors };
}

test("changing a Property Value name or property saves the original file and references with a real backend", async ({ page, request }) => {
  const { serverErrors, pageErrors } = await openFixture(page);
  await page.getByRole("tab", { name: "Base", exact: true }).click();
  await page.getByRole("button", { name: "Property Values", exact: true }).click();
  const group = page.locator(".base-list-table__group").filter({ hasText: "write_mode" });
  await group.getByText("merge", { exact: true }).click();

  const originalFiles = readdirSync(path.join(root, "Base"), { recursive: true }).sort();
  const nameInput = page.locator(".base-editor label").filter({ hasText: "Value Name *" }).locator("..").getByRole("textbox");
  for (const newName of ["append", "merge"]) {
    const saved = page.waitForResponse((response) => response.url().endsWith("/model/save") && response.ok());
    await nameInput.fill(newName);
    await nameInput.press("Tab");
    await saved;
    await expect.poll(() => readJson("Base/PropertyValues.json").propertyValues).toEqual([
      { property: "write_mode", name: newName }, { property: "status", name: "merge" },
    ]);
    await expect.poll(() => readJson("Model/Core/Customer.json").properties).toEqual([
      { property: "write_mode", value: newName }, { property: "status", value: "merge" },
    ]);
    expect(readdirSync(path.join(root, "Base"), { recursive: true }).sort()).toEqual(originalFiles);
    await expect(page.locator(".sidebar__save-pill--bulk-saved")).toBeVisible();
  }

  const propertyInput = page.locator(".base-editor label").filter({ hasText: /^Property \*$/ }).locator("..").getByRole("combobox");
  for (const newProperty of ["destination", "write_mode"]) {
    const saved = page.waitForResponse((response) => response.url().endsWith("/model/save") && response.ok());
    await propertyInput.click();
    await page.getByRole("option", { name: newProperty, exact: true }).click();
    await saved;
    await expect.poll(() => readJson("Base/PropertyValues.json").propertyValues).toEqual([
      { property: newProperty, name: "merge" }, { property: "status", name: "merge" },
    ]);
    await expect.poll(() => readJson("Model/Core/Customer.json").properties).toEqual([
      { property: newProperty, value: "merge" }, { property: "status", value: "merge" },
    ]);
    expect(readdirSync(path.join(root, "Base"), { recursive: true }).sort()).toEqual(originalFiles);
    await expect(page.locator(".sidebar__save-pill--bulk-saved")).toBeVisible();
  }

  await expect.poll(async () => (await request.get(`${baseUrl}/model/unsaved`)).json()).toMatchObject({ count: 0 });
  expect((await request.post(`${baseUrl}/model/reload`)).ok()).toBe(true);
  const persisted = await request.get(`${baseUrl}/entities/propertyValues/write_mode/merge`);
  expect(persisted.ok()).toBe(true);
  expect((await persisted.json()).items[0].entity).toMatchObject({ property: "write_mode", name: "merge" });
  await expect.poll(async () => (await request.get(`${baseUrl}/model/unsaved`)).json()).toMatchObject({ count: 0 });
  expect(serverErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("renaming a folder moves its own metadata and descendants with a real backend", async ({ page, request }) => {
  const { serverErrors, pageErrors } = await openFixture(page);
  const originalMeta = readJson("Model/Core/Before/.properties.json").folders[0];
  const childMeta = readJson("Model/Core/Before/Details/.properties.json").folders[0];
  const neighbourBytes = readFileSync(path.join(root, "Model/Core/BeforeArchive/.properties.json"), "utf8");
  const metadataWrites: Array<Record<string, unknown>> = [];
  page.on("request", (req) => {
    if (req.method() === "PATCH" && new URL(req.url()).pathname === "/entities/folders/Core/Before") {
      metadataWrites.push(req.postDataJSON());
    }
  });
  await page.getByRole("button", { name: "Before", exact: true }).click();
  const description = page.getByPlaceholder("Optional description", { exact: true });
  await description.fill("Edited before renaming");
  await description.press("Tab");
  await expect.poll(() => readJson("Model/Core/Before/.properties.json").folders[0].description).toBe("Edited before renaming");
  const folderName = page.getByPlaceholder("Folder name", { exact: true });
  await folderName.fill("After");
  await folderName.press("Tab");

  await expect.poll(() => existsSync(path.join(root, "Model/Core/After/.properties.json"))).toBe(true);
  await expect.poll(() => existsSync(path.join(root, "Model/Core/Before"))).toBe(false);
  expect(readJson("Model/Core/After/.properties.json").folders).toEqual([
    { ...originalMeta, name: "After", path: "Core/After", description: "Edited before renaming" },
  ]);
  expect(readJson("Model/Core/After/Details/.properties.json").folders).toEqual([
    { ...childMeta, path: "Core/After/Details" },
  ]);
  expect(readJson("Model/Core/After/Customer.json").id).toBe(2);
  expect(readJson("Model/Core/After/Details/Customer.json").id).toBe(3);
  expect(readFileSync(path.join(root, "Model/Core/BeforeArchive/.properties.json"), "utf8")).toBe(neighbourBytes);
  expect(metadataWrites.at(-1)).toMatchObject({ name: "Before", path: "Core/Before", description: "Edited before renaming" });
  await expect(folderName).toHaveValue("After");
  await expect(page.locator(".tree__node-label.tree__child--active")).toHaveText("After");

  const reloaded = page.waitForResponse((response) => new URL(response.url()).pathname === "/solution/full" && response.ok());
  await page.getByRole("button", { name: "Reload", exact: true }).first().click();
  await reloaded;
  await expect(folderName).toHaveCount(0);
  await expect(page.getByRole("button", { name: "After", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Before", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "After", exact: true }).click();
  await expect(folderName).toHaveValue("After");
  await expect(description).toHaveValue("Edited before renaming");
  const response = await request.get(`${baseUrl}/entities/folders/Core/After`);
  expect(response.ok()).toBe(true);
  expect((await response.json()).items[0].entity).toMatchObject({
    id: 201, name: "After", path: "Core/After", dataProduct: "Product", dataModule: "Module",
  });
  expect(await (await request.get(`${baseUrl}/model/unsaved`)).json()).toMatchObject({ count: 0 });
  expect(serverErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("entity rename retains functions and entity deletion removes them with a real backend", async ({ page, request }) => {
  const { serverErrors, pageErrors } = await openFixture(page);
  for (const [id, name, source] of [[10, "FunctionEntity", "clean.py"], [11, "LegacyEntity", "LegacyEntity/legacy.py"]] as const) {
    const functionFile = path.join(root, "Model/Core", source);
    const original = readFileSync(functionFile, "utf8");
    await page.getByRole("button", { name, exact: true }).click();
    const renamed = `${name}Renamed`;
    await page.getByPlaceholder("Entity name", { exact: true }).fill(renamed);
    await page.getByPlaceholder("Entity name", { exact: true }).press("Tab");
    await expect.poll(() => existsSync(path.join(root, `Model/Core/${renamed}.json`))).toBe(true);
    await expect.poll(() => existsSync(path.join(root, `Model/Core/${name}.json`))).toBe(false);
    await expect(page.locator(".tree__child--entity.tree__child--active")).toHaveText(renamed);
    expect(readFileSync(functionFile, "utf8")).toBe(original);
    expect(readJson(`Model/Core/${renamed}.json`).transformations[0].function.source).toBe(source);
    await page.getByPlaceholder("Describe this entity").fill("Edited after function rename");
    await page.getByPlaceholder("Describe this entity").press("Tab");
    await expect.poll(() => readJson(`Model/Core/${renamed}.json`).description).toBe("Edited after function rename");
    expect(readJson(`Model/Core/${renamed}.json`).transformations[0].function.source).toBe(source);
    const reloaded = page.waitForResponse((response) => new URL(response.url()).pathname === "/solution/full" && response.ok());
    await page.getByRole("button", { name: "Reload", exact: true }).first().click();
    await reloaded;
    await expect(page.getByRole("button", { name: renamed, exact: true })).toBeVisible();
    const loaded = await request.get(`${baseUrl}/functions/${id}/1`);
    expect(loaded.ok()).toBe(true);
    expect((await loaded.json()).item.source_code).toBe(original);
    await page.getByRole("button", { name: renamed, exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: /^Delete/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect.poll(() => existsSync(path.join(root, `Model/Core/${renamed}.json`))).toBe(false);
    await expect.poll(() => existsSync(functionFile)).toBe(false);
    if (id === 11) expect(existsSync(path.dirname(functionFile))).toBe(false);
    const reloadedAfterDelete = page.waitForResponse((response) => new URL(response.url()).pathname === "/solution/full" && response.ok());
    await page.getByRole("button", { name: "Reload", exact: true }).first().click();
    await reloadedAfterDelete;
    await expect(page.getByRole("button", { name: renamed, exact: true })).toHaveCount(0);
  }
  expect(await (await request.get(`${baseUrl}/model/unsaved`)).json()).toMatchObject({ count: 0 });
  expect(serverErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("failed function creation leaves the transformation and existing file unchanged", async ({ page }) => {
  const { serverErrors, pageErrors } = await openFixture(page);
  const entityFile = path.join(root, "Model/Core/CreationEntity.json");
  const original = readFileSync(entityFile, "utf8");
  let attempts = 0;
  // Exercise the renderer's IPC rejection handling; the Desktop test covers real disk IPC.
  await page.exposeFunction("testFunctionCreate", () => {
    attempts += 1;
    throw new Error("Function source already exists. Choose another name.");
  });
  await page.evaluate(() => {
    Object.defineProperty(window, "desktop", {
      value: { isElectron: true, solution: { saveFunctionSource: (window as unknown as { testFunctionCreate: () => Promise<void> }).testFunctionCreate } },
      configurable: true,
    });
  });
  await page.getByRole("button", { name: "CreationEntity", exact: true }).click();
  await page.getByRole("button", { name: "Transformations", exact: true }).click();
  const kind = page.locator(".value-row").getByRole("combobox");
  await kind.click();
  await page.getByRole("option", { name: "function", exact: true }).click();
  await expect.poll(() => attempts).toBe(1);
  await expect(page.getByRole("alert")).toContainText("Function source already exists. Choose another name.");
  await expect(kind).toHaveText("builtin");
  await page.getByRole("button", { name: "Customer", exact: true }).first().click();
  expect(readFileSync(entityFile, "utf8")).toBe(original);
  expect(readFileSync(path.join(root, "Model/Core/existing.py"), "utf8")).toBe("# keep existing content");
  expect(serverErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
