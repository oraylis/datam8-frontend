import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

const backend = path.resolve(
  import.meta.dirname,
  "../../../submodules/datam8-generator",
);
const python =
  process.env.DATAM8_TEST_PYTHON ||
  path.join(
    backend,
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
let root: string, base: string, server: ChildProcess;
const fixture = `
import json, sys
from pathlib import Path
from datam8 import solution
root = Path(sys.argv[1]); solution.init_solution(root / 'Quality.dm8s')
p = root / 'Quality.dm8s'; s=json.loads(p.read_text()); s['generatorTargets']=[{'name':'quality','sourcePath':'generate/quality','outputPath':'output/quality','isDefault':True}]; p.write_text(json.dumps(s))
(root/'base/Zones.json').write_text(json.dumps({'type':'zones','zones':[{'name':'Raw','targetName':'raw','displayName':'Raw'}]}))
folder=root/'model/Raw'; folder.mkdir(parents=True,exist_ok=True)
(folder/'Customer.json').write_text(json.dumps({'id':12,'name':'Customer','attributes':[{'name':'Id','ordinalNumber':1,'attributeType':'Regular','dataType':{'type':'int','nullable':True},'dateAdded':'2026-01-01T00:00:00Z'}],'sources':[],'relationships':[],'transformations':[]}))
(folder/'Other.json').write_text(json.dumps({'id':13,'name':'Other','attributes':[{'name':'Id','ordinalNumber':1,'attributeType':'Regular','dataType':{'type':'int','nullable':True},'dateAdded':'2026-01-01T00:00:00Z'}],'sources':[],'relationships':[],'transformations':[]}))
mods=root/'generate/quality/__modules'; mods.mkdir(parents=True)
(mods.parent/'quality.jinja2').write_text('{{ data }}')
(mods/'payload.py').write_text('from pathlib import Path\\nimport json\\nfrom datam8.generate import register_payload,BasePayload\\n@register_payload("quality.jinja2")\\ndef quality(model, cache):\\n return [BasePayload(data=json.dumps(w.entity.quality.model_dump(mode="json",exclude_none=True)),output_path=Path(w.entity.name+".json")) for w in model.modelEntities.values() if w.entity.quality]\\n')
`;
test.beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), "datam8-quality-ui-"));
  const env = { ...process.env, PYTHONPATH: path.join(backend, "src") };
  execFileSync(python, ["-c", fixture, root], { cwd: backend, env });
  server = spawn(
    python,
    [
      "-u",
      "-m",
      "datam8",
      "serve",
      "--host",
      "127.0.0.1",
      "--port",
      "0",
      "--solution",
      path.join(root, "Quality.dm8s"),
    ],
    { cwd: backend, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  base = await new Promise((resolve, reject) => {
    let output = "",
      errors = "";
    const timer = setTimeout(() => reject(new Error(errors)), 30000);
    server.stderr?.on("data", (d) => {
      errors += d;
    });
    server.stdout?.on("data", (d) => {
      output += d;
      for (const line of output.split("\n")) {
        try {
          const m = JSON.parse(line);
          if (m.type === "ready") {
            clearTimeout(timer);
            resolve(m.baseUrl);
          }
        } catch {
          /* Partial line. */
        }
      }
    });
    server.once("error", reject);
  });
});
test.afterAll(async () => {
  if (server?.exitCode === null) {
    await new Promise<void>((resolve) => {
      server.once("exit", () => resolve());
      if (process.platform === "win32") {
        execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
          windowsHide: true,
        });
      } else {
        server.kill();
      }
    });
  }
  if (root?.startsWith(path.join(tmpdir(), "datam8-quality-ui-")))
    rmSync(root, { recursive: true, force: true });
});
test("quality dialog persists across tabs and real backend generation", async ({
  page,
  request,
}) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      !/^\/(config|solution|model|entities|sources|plugins|version|health)(\/|\?|$)/.test(
        url.pathname,
      )
    )
      return route.continue();
    const response = await route.fetch({
      url: `${base}${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
  await page.goto("/");
  await page
    .getByPlaceholder("Absolute path to .dm8s")
    .fill(path.join(root, "Quality.dm8s"));
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
  await page.getByText("Customer", { exact: true }).first().dblclick();
  await page.getByRole("button", { name: "Quality", exact: true }).click();
  await page
    .getByRole("button", { name: "Add quality check", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Add quality check" });
  await dialog.getByLabel("Check ID").fill("customer_id_required");
  await dialog.getByLabel("Native DQX definition (JSON)").fill("{");
  await expect(
    dialog.getByRole("button", { name: "Save check", exact: true }),
  ).toBeDisabled();
  const nativeDefinition = {
    name: "Customer ID membership",
    criticality: "warn",
    filter: "Id > 0",
    check: {
      function: "is_in_list",
      arguments: { column: "Id", allowed: [1, 2, null] },
    },
    user_metadata: { owner: "test team" },
  };
  await dialog
    .getByLabel("Native DQX definition (JSON)")
    .fill(JSON.stringify(nativeDefinition));
  await dialog.getByRole("button", { name: "Save check", exact: true }).click();
  await expect
    .poll(
      () =>
        JSON.parse(
          readFileSync(path.join(root, "model/Raw/Customer.json"), "utf8"),
        ).quality?.checks?.[0]?.id,
    )
    .toBe("customer_id_required");
  await page.getByText("Other", { exact: true }).first().dblclick();
  await page.getByText("Customer", { exact: true }).first().dblclick();
  await page.getByRole("button", { name: "Quality", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit customer_id_required" }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(tmpdir(), path.basename(root) + "-editor.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Edit full Quality JSON", exact: true })
    .click();
  const fullQuality = page.getByRole("dialog", {
    name: "Edit Quality JSON",
    exact: true,
  });
  const persistedQuality = JSON.parse(
    readFileSync(path.join(root, "model/Raw/Customer.json"), "utf8"),
  ).quality;
  await fullQuality.getByRole("textbox").fill(
    JSON.stringify({
      ...persistedQuality,
      settings: { dependencies: ["python-dateutil==2.9.0.post0"] },
      referenceDatasets: { other: { entityId: 13, execution: "monitoring" } },
    }),
  );
  await fullQuality
    .getByRole("button", { name: "Save Quality", exact: true })
    .click();
  let generationRequests = 0;
  page.on("request", (r) => {
    if (
      r.method() === "POST" &&
      new URL(r.url()).pathname === "/model/generate"
    )
      generationRequests++;
  });
  await page
    .getByRole("button", { name: "Toggle generator", exact: true })
    .click();
  // Clicking Generate commits the focused field and refuses invalid drafts.
  await page.getByLabel("Maximum failure rate (%)").fill("-1");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByText("Resolve unsaved changes before generating."),
  ).toBeVisible();
  expect(generationRequests).toBe(0);
  await page.getByLabel("Maximum failure rate (%)").fill("5");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect
    .poll(() => {
      try {
        return JSON.parse(
          readFileSync(path.join(root, "output/quality/Customer.json"), "utf8"),
        ).settings?.maxFailureRatePct;
      } catch {
        return null;
      }
    })
    .toBe(5);
  const output = JSON.parse(
    readFileSync(path.join(root, "output/quality/Customer.json"), "utf8"),
  );
  expect(output.checks[0]).toMatchObject({
    id: "customer_id_required",
    type: "dqx",
    execution: "enforcement",
    definition: nativeDefinition,
  });
  expect(output.settings.dependencies).toEqual([
    "python-dateutil==2.9.0.post0",
  ]);
  expect(output.referenceDatasets).toEqual({
    other: { entityId: 13, execution: "monitoring" },
  });
  await page
    .getByRole("button", { name: "Edit customer_id_required", exact: true })
    .click();
  const edit = page.getByRole("dialog", { name: "Edit quality check" });
  await edit.getByRole("combobox").filter({ hasText: "enforcement" }).click();
  await page.getByRole("option", { name: "monitoring", exact: true }).click();
  const editedDefinition = {
    ...nativeDefinition,
    check: { function: "is_unique", arguments: { columns: ["Id"] } },
  };
  await edit
    .getByLabel("Native DQX definition (JSON)")
    .fill(JSON.stringify(editedDefinition));
  await edit.getByRole("button", { name: "Save check", exact: true }).click();
  await expect
    .poll(
      () =>
        JSON.parse(
          readFileSync(path.join(root, "model/Raw/Customer.json"), "utf8"),
        ).quality?.checks?.[0]?.execution,
    )
    .toBe("monitoring");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect
    .poll(() => {
      try {
        return JSON.parse(
          readFileSync(path.join(root, "output/quality/Customer.json"), "utf8"),
        ).checks[0].definition.check.function;
      } catch {
        return null;
      }
    })
    .toBe("is_unique");
  await page
    .getByRole("button", { name: "Delete customer_id_required", exact: true })
    .click();
  await expect
    .poll(
      () =>
        JSON.parse(
          readFileSync(path.join(root, "model/Raw/Customer.json"), "utf8"),
        ).quality?.checks?.length,
    )
    .toBe(0);
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect
    .poll(() => {
      try {
        return JSON.parse(
          readFileSync(path.join(root, "output/quality/Customer.json"), "utf8"),
        ).checks;
      } catch {
        return null;
      }
    })
    .toEqual([]);
  expect((await request.post(`${base}/model/reload`)).ok()).toBe(true);
});
