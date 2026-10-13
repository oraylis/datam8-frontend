import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Uses the actual generator and a disposable solution; no source or import responses are mocked.
const backend = path.resolve(import.meta.dirname, "../../../submodules/datam8-generator");
const python = process.env.DATAM8_TEST_PYTHON || path.join(
  backend, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const fixtureScript = `
import json, sys, shutil
from pathlib import Path
from builtin_plugins.solution import create_solution
from datam8.plugins.builtins.odcs import OdcsFile
from datam8.plugins.builtins.file import CsvFile
from builtin_plugins.navigation_plugin import GenericProvider
import builtin_plugins.navigation_plugin as provider_module
root = Path(sys.argv[1])
create_solution(root, [
    (OdcsFile, "Contracts", {"path": "contracts"}),
    (CsvFile, "Csv", {"path": str(root / "csv"), "protocol": "file"}),
    (GenericProvider, "Provider", {"path": str(root / "csv"), "described": True}),
])
(root / "Model/Stage/Imported").mkdir(parents=True)
(root / "csv").mkdir()
(root / "csv/customers.csv").write_text("id,name\\n1,Alice\\n", encoding="utf-8")
shutil.copyfile(provider_module.__file__, root / "Plugins/navigation_plugin.py")
manifest = GenericProvider.manifest().model_dump(mode="json")
(root / "Plugins/provider.json").write_text(json.dumps(manifest), encoding="utf-8")
manifest["id"] = "renamed-provider"
(root / "Plugins/renamed.json").write_text(json.dumps(manifest), encoding="utf-8")
types_file = root / "Base/DataSourceTypes.json"
types = json.loads(types_file.read_text())
renamed = dict(types["dataSourceTypes"][-1], name="RenamedProvider", pluginId="renamed-provider")
types["dataSourceTypes"].append(renamed)
types_file.write_text(json.dumps(types), encoding="utf-8")
sources_file = root / "Base/DataSources.json"
sources = json.loads(sources_file.read_text())
sources["dataSources"][0]["dataTypeMapping"] = [{"sourceType": "VendorInteger", "targetType": "long"}]
for name, properties in [("Legacy", {}), ("NoListing", {"listed": False}), ("Renamed", {"described": True, "preview": True})]:
    sources["dataSources"].append({"name": name, "type": "RenamedProvider" if name == "Renamed" else "GenericProvider", "extendedProperties": {"path": str(root / "csv"), **properties}, "dataTypeMapping": [{"sourceType": " bigint ", "targetType": "string"}] if name == "Legacy" else []})
sources_file.write_text(json.dumps(sources), encoding="utf-8")
attribute_file = root / "Base/AttributeTypes.json"
attribute_types = json.loads(attribute_file.read_text())
attribute_types["attributeTypes"].append({"name": "Regular", "displayName": "Regular", "defaultType": "string", "isDefaultProperty": False})
attribute_file.write_text(json.dumps(attribute_types), encoding="utf-8")
(root / "Model/Stage/Imported/Reference.json").write_text(json.dumps({
    "name": "Reference", "id": 123, "attributes": [{"name": "id", "ordinalNumber": 1, "attributeType": "Regular", "dataType": {"type": "long", "nullable": False}, "dateAdded": "2026-01-01T00:00:00Z"}],
    "sources": [], "relationships": [], "transformations": [],
}), encoding="utf-8")
contract = {
    "apiVersion": "v3.2.0", "kind": "DataContract", "id": "test", "version": "1.0.0",
    "schema": [
        {"name": "customer / ü", "physicalName": "crm_customers", "businessName": "Kunden",
         "description": "Customer master", "properties": [
             {"name": "id", "physicalName": "customer_id", "logicalType": "integer",
              "physicalType": "VendorInteger", "businessName": "Kundennummer",
              "required": True, "primaryKey": True},
             {"name": "amount", "logicalType": "number", "physicalType": "DECIMAL(10,0)"},
             {"name": "preferences", "logicalType": "array", "items": {"logicalType": "string"}},
         ]},
        {"name": "plain", "properties": [{"name": "label", "logicalType": "string"}]},
    ],
}
file = root / "contracts/nested/deeper/orders #1.yaml"
file.parent.mkdir(parents=True)
# JSON is also valid YAML; exercises the .yaml navigation and offline validator.
file.write_text(json.dumps(contract), encoding="utf-8")
`;

let root: string;
let server: ChildProcess;
let baseUrl: string;

test.beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), "datam8-odcs-ui-"));
  const env = {
    ...process.env,
    PYTHONPATH: [path.join(backend, "src"), path.join(backend, "tests")].join(path.delimiter),
    PYTHONUTF8: "1",
  };
  execFileSync(python, ["-c", fixtureScript, root], { cwd: backend, env, windowsHide: true });
  server = spawn(python, [
    "-m", "datam8", "serve", "--host", "127.0.0.1", "--port", "0",
    "--solution", path.join(root, "Builtin.dm8s"),
  ], { cwd: backend, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  baseUrl = await new Promise<string>((resolve, reject) => {
    let output = "";
    let errors = "";
    const timeout = setTimeout(() => reject(new Error(`Backend readiness timeout: ${errors}`)), 30_000);
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
        } catch { /* Incomplete readiness line. */ }
      }
    });
    server.once("error", (error) => { clearTimeout(timeout); reject(error); });
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Backend exited ${code}: ${errors}`));
    });
  });
});

test.afterAll(async () => {
  if (server && server.exitCode === null) {
    await new Promise<void>((resolve) => {
      server.once("exit", () => resolve());
      if (process.platform === "win32") {
        // The Windows venv launcher starts a second Python process; stop the test-owned tree.
        execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true });
      } else {
        server.kill();
      }
    });
  }
  if (root) {
    if (path.dirname(root) !== path.resolve(tmpdir()) || !path.basename(root).startsWith("datam8-odcs-ui-")) {
      throw new Error(`Unexpected test directory: ${root}`);
    }
    rmSync(root, { recursive: true, force: true });
  }
});

test("generic imports preserve provider descriptions and legacy mappings with a real backend", async ({ page, request }) => {
  const serverErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!/^\/(config|solution|model|entities|sources|plugins|fs|version|health)(\/|\?|$)/.test(url.pathname)) {
      await route.continue();
      return;
    }
    // Transparent transport to the real backend bound above, with no fabricated payloads.
    const response = await route.fetch({ url: `${baseUrl}${url.pathname}${url.search}` });
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${url.pathname}`);
    await route.fulfill({ response });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill(path.join(root, "Builtin.dm8s"));
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();

  const openImport = async (source: string, listed = true) => {
    await page.getByRole("button", { name: "Add Entity", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create Model Entity" });
    await dialog.getByRole("tab", { name: "Import from Source" }).click();
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: source, exact: true }).click();
    await expect(dialog.getByPlaceholder("Enter a source location")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Add Object", exact: true })).toHaveCount(0);
    if (listed) {
      await expect(dialog.getByRole("button", { name: "Load Tables" })).toBeEnabled();
      await dialog.getByRole("button", { name: "Load Tables" }).click();
    }
    return dialog;
  };

  const dialog = await openImport("Contracts");
  await expect(dialog.getByRole("checkbox")).toHaveCount(2);
  await expect(dialog.getByRole("button", { name: "Preview", exact: true }).first()).toBeDisabled();
  const customer = dialog.locator("div").filter({ has: page.getByText(/orders%20%231\.yaml\.crm_customers$/) })
    .filter({ has: page.getByRole("checkbox") }).last();
  await customer.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog.getByPlaceholder("No folder selected").fill("Stage/Imported");
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByRole("textbox").first()).toHaveValue("crm_customers");
  await dialog.getByRole("textbox").first().fill("Customers");
  await dialog.getByRole("button", { name: "Import Entities", exact: true }).click();
  await expect(dialog).toBeHidden();

  const saved = JSON.parse(readFileSync(path.join(root, "Model/Stage/Imported/Customers.json"), "utf8"));
  expect(saved.name).toBe("Customers");
  expect(saved.displayName).toBe("Kunden");
  expect(saved.description).toBe("Customer master");
  expect(saved.attributes[0]).toMatchObject({
    name: "customer_id", displayName: "Kundennummer", isBusinessKey: true,
    dataType: { type: "long", nullable: false },
  });
  expect(saved.attributes[1].dataType).toMatchObject({ type: "decimal", precision: 10, scale: 0 });
  expect(saved.attributes[2].dataType.type).toBe("string");
  expect(saved.attributes[2].displayName ?? null).toBeNull();
  const handle = "nested/deeper/orders%20%231.yaml#customer%20%2F%20%C3%BC";
  expect(saved.sources[0].sourceLocation).toBe(handle);
  expect(saved.sources[0].metadataLocation).toBe(handle);
  expect(saved.sources[0].mapping[0].sourceDataType.type).toBe("VendorInteger");
  const reloaded = await request.post(`${baseUrl}/model/reload?force=true`);
  expect(reloaded.ok()).toBe(true);
  const compared = await request.get(`${baseUrl}/sources/compare`, {
    params: { locator: "modelEntities/Stage/Imported/Customers" },
  });
  expect(compared.ok()).toBe(true);
  expect((await compared.json()).has_changes).toBe(false);

  const csvDialog = await openImport("Csv");
  await expect(csvDialog.getByRole("checkbox")).toHaveCount(1);
  const csvDescription = await request.get(`${baseUrl}/sources/Csv/locations/import-description`, {
    params: { source_location: "customers.csv" },
  });
  expect(csvDescription.ok()).toBe(true);
  expect(await csvDescription.json()).toEqual({ entity: null });
  const completeImport = async (dialog: ReturnType<typeof page.getByRole>, target: string) => {
    await dialog.getByRole("checkbox").first().check();
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.getByPlaceholder("No folder selected").fill("Stage/Imported");
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.getByRole("textbox").first().fill(target);
    await dialog.getByRole("button", { name: "Import Entities", exact: true }).click();
    await expect(dialog).toBeHidden();
    return JSON.parse(readFileSync(path.join(root, `Model/Stage/Imported/${target}.json`), "utf8"));
  };
  const savedCsv = await completeImport(csvDialog, "CsvCustomers");
  expect(savedCsv.sources[0].sourceLocation).toBe("customers.csv");
  expect(savedCsv.attributes.map((attribute: any) => attribute.dataType.type)).toEqual(["decimal", "string"]);

  for (const source of ["Provider", "Renamed"]) {
    const providerDialog = await openImport(source);
    await expect(providerDialog.getByRole("checkbox")).toHaveCount(1);
    if (source === "Provider") {
      await expect(providerDialog.getByRole("button", { name: "Preview", exact: true })).toBeDisabled();
    } else {
      await expect(providerDialog.getByRole("button", { name: "Preview", exact: true })).toBeEnabled();
      await providerDialog.getByRole("button", { name: "Preview", exact: true }).click();
      const preview = page.getByRole("dialog", { name: /^Preview:/ });
      await expect(preview.getByRole("cell", { name: "1", exact: true })).toBeVisible();
      await preview.getByRole("button", { name: "Close", exact: true }).click();
    }
    const entity = await completeImport(providerDialog, `${source}Customers`);
    expect(entity.displayName).toBe("Provider business name");
    expect(entity.description).toBe("Provider metadata description");
    expect(entity.attributes[0]).toMatchObject({ displayName: "Provider column name", dataType: { type: "long" } });
    expect(entity.relationships[0].targetLocation).toBe(123);
    expect(entity.transformations[0].name).toBe("Provided transformation");
    expect(entity.sources[0]).toMatchObject({ sourceLocation: "read?object#42", metadataLocation: "object?schema#42" });
  }

  const legacyDialog = await openImport("Legacy");
  const savedLegacy = await completeImport(legacyDialog, "LegacyCustomers");
  expect(savedLegacy.attributes[0].dataType.type).toBe("string");
  expect(savedLegacy.sources[0].mapping[0].sourceDataType.type).toBe("BIGINT");
  expect(savedLegacy.sources[0]).toMatchObject({ sourceLocation: "read?object#42", metadataLocation: "object?schema#42" });

  const noListingDialog = await openImport("NoListing", false);
  await expect(noListingDialog.getByRole("button", { name: "Load Tables" })).toBeDisabled();
  await noListingDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(noListingDialog).toBeHidden();

  expect((await request.post(`${baseUrl}/model/reload?force=true`)).ok()).toBe(true);
  const persisted = await request.get(`${baseUrl}/entities/modelEntities/Stage/Imported/RenamedCustomers`);
  expect(persisted.ok()).toBe(true);
  expect((await persisted.json()).items[0].entity.displayName).toBe("Provider business name");
  expect(serverErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
