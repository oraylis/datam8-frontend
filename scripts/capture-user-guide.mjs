import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/web/package.json"));
const { chromium } = require("@playwright/test");
const sampleRef = "1e1855e59e2734b3a393f9128193504626ab9380";
const python = process.env.DATAM8_PYTHON_PATH || path.join(root, "submodules/datam8-generator/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const webPort = Number(process.env.DATAM8_DOCS_WEB_PORT || 4325);
const staging = path.join(root, "output/playwright/user-guide");
const { values } = parseArgs({ options: { "publish-dir": { type: "string" }, help: { type: "boolean" } } });
if (values.help) {
  console.log("Usage: npm run docs:capture -- [--publish-dir <assets-directory>]\nDefault: output/playwright/user-guide/publish. Export images + manifest; review before copying to the central handbook.");
  process.exit(0);
}
const sampleRepo = process.env.DATAM8_SAMPLE_REPO;
if (!sampleRepo) throw new Error("Set DATAM8_SAMPLE_REPO to the separate sample Git repository.");
const assets = path.resolve(root, values["publish-dir"] || "output/playwright/user-guide/publish");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "datam8-guide-"));
const copy = path.join(temp, "sample");
fs.mkdirSync(copy);
fs.mkdirSync(staging, { recursive: true });
fs.mkdirSync(assets, { recursive: true });
const git = (repo, ...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
execFileSync("git", ["-C", sampleRepo, "archive", "--format=tar", "--output", path.join(temp, "sample.tar"), sampleRef]);
execFileSync("tar", ["-xf", path.join(temp, "sample.tar"), "-C", copy]);
const solutionPath = path.join(copy, "ORAYLISDatabricksSample.dm8s");
const sourceFile = path.join(copy, "Base/DataSources.json");
const sources = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
sources.dataSources[0].extendedProperties.host = "localhost";
sources.dataSources[0].extendedProperties.username = "demo_user";
fs.writeFileSync(sourceFile, JSON.stringify(sources, null, 2));
const manifest = {
  capturedAt: new Date().toISOString(),
  frontendCommit: git(root, "rev-parse", "HEAD"),
  frontendWorkingTree: git(root, "status", "--porcelain", "--", "apps", "packages"),
  backendCommit: git(path.join(root, "submodules/datam8-generator"), "rev-parse", "HEAD"),
  backendDirty: Boolean(git(path.join(root, "submodules/datam8-generator"), "status", "--porcelain")),
  schemaCommit: git(path.join(root, "submodules/datam8-generator/datam8-model"), "rev-parse", "HEAD"),
  sampleCommit: sampleRef,
  mode: "browser, real local backend; no response mocks",
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  nodeVersion: process.version,
  theme: "light",
  sourceSanitization: "host=localhost, username=demo_user; secret remains a ref:// reference",
  checks: [], screenshots: [], limitations: [],
};
const children = [];
let browser;
function start(command, args, options = {}) {
  const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], ...options });
  children.push(child);
  return child;
}
function stop(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try { execFileSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); } catch { /* process already stopped */ }
  } else child.kill("SIGTERM");
}
async function poll(fn, timeout = 30000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try { if (await fn()) return; } catch { /* startup/in-flight operation */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("Timed out waiting for expected state");
}
async function main() {
  const backend = start(python, ["-m", "datam8", "serve", "--host", "127.0.0.1", "--port", "0", "--solution", solutionPath, "--openapi"]);
  let stdout = "";
  let apiBase;
  const log = fs.createWriteStream(path.join(staging, "backend.log"));
  backend.stdout.on("data", chunk => {
    stdout += chunk;
    for (const line of stdout.split(/\r?\n/)) {
      try { const data = JSON.parse(line); if (data.type === "ready") apiBase = data.baseUrl; } catch { /* non-readiness line */ }
    }
    log.write(chunk);
  });
  backend.stderr.on("data", chunk => log.write(chunk));
  backend.on("error", error => { console.error(error.message); });
  await poll(() => Boolean(apiBase), 60000);
  const openapi = await (await fetch(`${apiBase}/openapi.json`)).json();
  manifest.routes = Object.keys(openapi.paths);
  const vite = start(process.execPath, [path.join(path.dirname(require.resolve("vite/package.json")), "bin/vite.js"), "--host", "127.0.0.1", "--port", String(webPort), "--strictPort"], {
    cwd: path.join(root, "apps/web"), env: { ...process.env, VITE_API_URL: apiBase },
  });
  vite.stderr.on("data", chunk => process.stderr.write(chunk));
  const webBase = `http://127.0.0.1:${webPort}`;
  await poll(async () => (await fetch(webBase)).ok);
  await new Promise(resolve => setTimeout(resolve, 500));
  if (vite.exitCode !== null) throw new Error("Vite exited; choose an unused DATAM8_DOCS_WEB_PORT.");
  browser = await chromium.launch({ headless: process.env.DATAM8_DOCS_HEADED !== "1" });
  const context = await browser.newContext({ viewport: manifest.viewport, deviceScaleFactor: 1, colorScheme: "light", locale: "en-US" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const hits = [];
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.origin === new URL(apiBase).origin && (url.pathname.startsWith("/model/") || url.pathname.startsWith("/entities/"))) {
      hits.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() });
    }
  });
  async function shot(name, description) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300); // allow visual transitions to settle, not a correctness assertion
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(staging, file), animations: "disabled", scale: "css" });
    fs.copyFileSync(path.join(staging, file), path.join(assets, file));
    fs.writeFileSync(path.join(staging, `${name}.yml`), await page.locator("body").ariaSnapshot());
    manifest.screenshots.push({ file, description, status: "captured" });
    console.log(`Captured ${file}`);
  }
  const button = name => page.getByRole("button", { name, exact: true });
  async function base(name) {
    if (await button("Close all tabs").isEnabled()) await button("Close all tabs").click();
    await page.getByRole("tab", { name: "Base", exact: true }).click();
    await button(name).click();
    await page.getByRole("table", { name: "Base items" }).waitFor();
  }
  async function customer(index = 0) {
    await page.getByRole("tab", { name: "Model", exact: true }).click();
    await page.getByRole("textbox", { name: "Filter model entities" }).fill("Customer");
    // Both the Customer folder and entity are buttons; select the entity after its folder.
    await page.getByRole("complementary").getByRole("button", { name: "Customer", exact: true }).nth([1, 3, 5][index]).click();
    await button("Overview").click();
    await page.getByPlaceholder("Describe this entity").waitFor();
  }
  await page.goto(webBase);
  await page.getByPlaceholder("Absolute path to .dm8s").fill("C:/DataM8/sample/ORAYLISDatabricksSample.dm8s");
  await shot("01-open-solution", "Browser Load reads the startup-bound workspace; the displayed path is illustrative.");
  await button("Load").click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await shot("02-workspace", "Loaded sample with Stage, Core, Curated and Consumer zones.");
  manifest.checks.push({ name: "real backend solution load", result: "PASS" });
  await base("Zones");
  await page.getByRole("table", { name: "Base items" }).getByRole("button", { name: /^Staging Data Layer Delete/ }).click();
  await shot("03-zones", "Stage zone, target and local folder name.");
  for (const [name, file] of [["Data Types", "04-data-types"], ["Attribute Types", "05-attribute-types"], ["Data Products", "06-data-products"], ["Properties", "07-properties"], ["Property Values", "08-property-values"], ["Data Source Types", "09-data-source-types"], ["Data Sources", "10-data-sources"]]) {
    await base(name);
    await shot(file, `${name} editor using the sample metadata.`);
  }
  await button("Close all tabs").click();
  await customer();
  await shot("11-customer-overview", "Stage Customer with inherited and direct properties.");
  for (const [name, file] of [["Attributes", "12-customer-attributes"], ["Sources", "13-customer-sources"], ["Relationships", "14-customer-relationships"]]) {
    await button(name).click();
    await shot(file, `Stage Customer ${name.toLowerCase()}.`);
  }
  await button("Overview").click();
  const description = page.getByPlaceholder("Describe this entity");
  const before = await description.inputValue();
  const edited = `${before} - user guide exercise`;
  const customerFile = path.join(copy, "Model/010-Stage/Sales/Customer/Customer.json");
  async function editDescription(value) {
    const saved = page.waitForResponse(response => response.url().endsWith("/model/save") && response.request().method() === "POST");
    await description.fill(value);
    await button("Overview").click();
    const response = await saved;
    assert.equal(response.ok(), true);
    await response.finished();
    await poll(() => JSON.parse(fs.readFileSync(customerFile, "utf8")).description === value);
    await page.waitForTimeout(250); // settle the editor's acknowledgement before the next edit
  }
  await editDescription(edited);
  await shot("15-autosave", "Edited Customer description persisted by the real backend.");
  const reloadResponse = page.waitForResponse(response => response.url().endsWith("/model/reload") && response.request().method() === "POST");
  const reloadedSolution = page.waitForResponse(response => response.url().includes("/solution/full"));
  await button("Reload").click();
  assert.equal((await reloadResponse).ok(), true);
  await (await reloadedSolution).finished();
  await customer();
  await poll(async () => (await page.getByPlaceholder("Describe this entity").inputValue()) === edited);
  manifest.checks.push({ name: "UI edit → backend save → file assertion → reload", result: "PASS" });
  await editDescription(before);
  await context.setOffline(true);
  await description.fill(`${before} - retry exercise`);
  await button("Overview").click();
  await page.getByRole("status").filter({ hasText: "Save failed" }).waitFor();
  await shot("22-save-retry", "Controlled offline transport failure showing the real transient Save failed status. Recovery uses a context-switch persist attempt; no Retry button is present.");
  await context.setOffline(false);
  const retried = page.waitForResponse(response => response.url().endsWith("/model/save") && response.request().method() === "POST");
  await customer(1);
  assert.equal((await retried).ok(), true);
  await poll(() => JSON.parse(fs.readFileSync(customerFile, "utf8")).description === `${before} - retry exercise`);
  await customer();
  await editDescription(before);
  const closeError = page.getByRole("button", { name: "Close error", exact: true });
  if (await closeError.count()) await closeError.click();
  manifest.checks.push({ name: "controlled offline save failure → online context-switch retry → real file persisted", result: "PASS" });
  await page.getByRole("complementary").getByRole("button", { name: "Customer", exact: true }).nth(0).click();
  await page.getByPlaceholder("Folder name").waitFor();
  await shot("21-folder-metadata", "Customer folder metadata and inherited context.");
  await customer(1);
  await button("Transformations").click();
  await shot("16-transformations", "Core Customer transformation steps.");
  await button("Add Entity").click();
  await shot("17-create-entity", "Entity creation wizard before submitting mutations.");
  await button("Cancel").click();
  await button("Refresh data sources").click();
  await shot("18-refresh-sources", "Refresh selection before scanning; requires a reachable source to continue.");
  const dialog = page.getByRole("dialog");
  if (await dialog.count()) {
    const cancel = dialog.getByRole("button", { name: /Cancel|Close/, exact: false });
    if (await cancel.count()) await cancel.first().click(); else await page.keyboard.press("Escape");
  }
  await button("Toggle generator").click();
  await page.getByRole("combobox").filter({ hasText: "databricks" }).click();
  await page.getByRole("option", { name: "docs", exact: true }).click();
  await shot("19-generator-target", "Documentation target selected; Generate writes into Output/docs.");
  const generatedIndex = path.join(copy, "Output/docs/index.md");
  if (fs.existsSync(generatedIndex)) fs.unlinkSync(generatedIndex);
  assert.equal(fs.existsSync(generatedIndex), false);
  const generationResponse = page.waitForResponse(response => response.url().endsWith("/model/generate") && response.request().method() === "POST", { timeout: 120000 });
  await button("Generate").click();
  const response = await generationResponse;
  const result = await response.json();
  assert.equal(response.ok(), true, JSON.stringify(result));
  await poll(() => fs.existsSync(path.join(copy, "Output/docs/index.md")));
  const output = fs.readFileSync(path.join(copy, "Output/docs/index.md"), "utf8");
  assert.ok(output.includes("Customer"), "Generated index must contain Customer");
  await page.getByTestId("generator-log-output").getByText(/Generation succeeded/).waitFor();
  // The output path is a real temporary path. Mask only that path for publication.
  const outputLocator = page.getByTestId("generator-log-output");
  await shot("20-generator-success", "Real docs generation succeeded. Local output path masked for publication.");
  await outputLocator.evaluate(el => {
    for (const node of el.querySelectorAll("div")) {
      if (node.children.length === 0 && node.textContent.startsWith("Output:")) node.textContent = "Output: <working-copy>/Output/docs";
    }
  });
  await page.screenshot({ path: path.join(assets, "20-generator-success.png"), animations: "disabled", scale: "css" });
  manifest.checks.push({ name: "UI Generate → real /model/generate completion → Output/docs/index.md contains Customer", result: "PASS" });
  manifest.checks.push({ name: "uncaught browser errors", result: pageErrors.length ? "FAIL" : "PASS", details: pageErrors });
  manifest.requests = hits;
  manifest.limitations.push("No Docker executable available in the authoring environment; live SQL import/refresh and preview review were not exercised.", "Browser screenshots do not verify native Electron dialogs or function create/delete.", "Other targets are documented from metadata/templates; only docs generation is verified by this capture.");
  fs.copyFileSync(path.join(copy, "Output/docs/index.md"), path.join(staging, "generated-index.md"));
  if (pageErrors.length) throw new Error("Capture contains uncaught browser errors; do not publish it.");
}
try {
  await main();
} catch (error) {
  manifest.checks.push({ name: "capture completion", result: "FAIL", details: error.message });
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  await browser?.close();
  children.reverse().forEach(stop);
  fs.writeFileSync(path.join(assets, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Capture workspace retained: ${temp}`);
  console.log(`Manifest: ${path.join(assets, "manifest.json")}`);
}
