import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

type JsonRecord = Record<string, unknown>;

function decodeBoundConnectorId(connectionProperties: unknown): string | null {
  const list = Array.isArray(connectionProperties) ? connectionProperties : [];
  const prefix = "__connector.id=";
  for (const p of list) {
    const item = p && typeof p === "object" ? (p as JsonRecord) : null;
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    if (name.startsWith(prefix)) {
      const id = name.slice(prefix.length).trim();
      return id || null;
    }
  }
  return null;
}

function loadSampleSolutionPayload(sampleDm8sPath: string) {
  const rawSolution = JSON.parse(fs.readFileSync(sampleDm8sPath, "utf8"));
  const rootDir = path.dirname(sampleDm8sPath);

  const baseDir = path.isAbsolute(rawSolution.basePath) ? rawSolution.basePath : path.join(rootDir, rawSolution.basePath);
  const baseFiles = fs
    .readdirSync(baseDir)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const baseEntities = baseFiles.map((fileName) => {
    const absPath = path.join(baseDir, fileName);
    const content = JSON.parse(fs.readFileSync(absPath, "utf8"));
    const relPath = path.posix.join("Base", fileName);
    return { name: fileName.replace(/\.json$/i, ""), relPath, content };
  });

  return {
    solution: rawSolution,
    baseEntities,
    modelEntities: [],
  };
}

test.describe("local sample solution", () => {
  const samplePath = process.env.DATAM8_SAMPLE_SOLUTION_PATH;

  test.skip(!samplePath || !fs.existsSync(samplePath), "Set DATAM8_SAMPLE_SOLUTION_PATH to a local .dm8s file to run.");

  test("autosave does not corrupt Base/DataSources.json (real sample payload)", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    const serverErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 500) {
        serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });

    const payload = loadSampleSolutionPayload(samplePath!);
    const typesEntry = payload.baseEntities.find((b) => b.relPath === "Base/DataSourceTypes.json");
    const firstType = Array.isArray(typesEntry?.content?.dataSourceTypes) ? typesEntry.content.dataSourceTypes[0] : null;
    const firstTypeRecord = firstType && typeof firstType === "object" ? (firstType as JsonRecord) : null;
    const currentConnectorId = decodeBoundConnectorId(firstTypeRecord?.connectionProperties) || null;
    const targetConnectorId = currentConnectorId === "sqlserver" ? "http-api" : "sqlserver";
    const entityMutations: Array<{ method: string; url: string; body: JsonRecord }> = [];
    let saveModelCalls = 0;

    await page.route("**/config", async (route) => {
      await route.fulfill({ json: { mode: "server" } });
    });
    await page.route("**/model/save", async (route) => {
      if (route.request().method() === "POST") saveModelCalls += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.route("**/solution/inspect**", async (route) => {
      await route.fulfill({ json: { version: "v2" } });
    });

    await page.route("**/solution/full**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const requestedPath = requestUrl.searchParams.get("path") || "";
      if (requestedPath && requestedPath !== samplePath) {
        await route.fulfill({ status: 400, body: `Unexpected solution path: ${requestedPath}` });
        return;
      }
      await route.fulfill({ json: payload });
    });

    await page.route("**/fs/list**", async (route) => {
      await route.fulfill({ json: { entries: [] } });
    });

    await page.route("**/connectors", async (route) => {
      await route.fulfill({
        json: {
          connectors: [
            {
              id: "sqlserver",
              displayName: "SQL Server",
              version: "0.1.0",
              capabilities: { uiSchema: true, metadata: { getTableMetadata: true } },
            },
            {
              id: "http-api",
              displayName: "HTTP API",
              version: "0.1.0",
              capabilities: { uiSchema: true, metadata: { getTableMetadata: true } },
            },
          ],
        },
      });
    });

    await page.route("**/plugins/**", async (route) => {
      const method = route.request().method();
      if (method === "GET" || method === "POST") {
        const pluginItems = [
          { id: "sqlserver", name: "SQL Server", displayName: "SQL Server", version: "0.1.0", enabled: true },
          { id: "http-api", name: "HTTP API", displayName: "HTTP API", version: "0.1.0", enabled: true },
        ];
        await route.fulfill({
          json: {
            items: pluginItems,
            pluginDir: "/tmp/plugins",
            plugins: pluginItems,
            errors: {},
          },
        });
        return;
      }
      await route.fulfill({ status: 405, json: { error: "method not allowed" } });
    });

    await page.route("**/entities/**", async (route) => {
      const req = route.request();
      const method = req.method();
      if (method === "GET") {
        await route.fulfill({ status: 200, json: { items: [] } });
        return;
      }
      if (!["PATCH", "PUT", "DELETE"].includes(method)) {
        await route.fulfill({ status: 405, json: { error: "method not allowed" } });
        return;
      }
      const body = req.postData() ? JSON.parse(req.postData() || "{}") : null;
      entityMutations.push({ method, url: req.url(), body });
      await route.fulfill({ status: 200, json: { item: body ?? {} } });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("Absolute path to .dm8s").fill(samplePath!);
    await page.getByRole("button", { name: "Load" }).click();
    await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();

    await page.getByRole("tab", { name: "Base" }).click();
    await page.getByRole("button", { name: "Data Source Types" }).click();
    await page.getByRole("table", { name: "Base items" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Link Connector" }).click();
    await page
      .locator("div")
      .filter({ hasText: targetConnectorId })
      .getByRole("button", { name: /^Link$/ })
      .first()
      .click();

    await expect(page.getByRole("button", { name: "Save All" })).toHaveCount(0);

    await expect.poll(() => entityMutations.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(() => saveModelCalls, { timeout: 10_000 }).toBeGreaterThan(0);

    expect.soft(consoleErrors, `DevTools console.error entries found:\n${consoleErrors.join("\n")}`).toEqual([]);
    expect.soft(pageErrors, `DevTools page errors found:\n${pageErrors.join("\n")}`).toEqual([]);
    expect.soft(failedRequests, `Failed requests found:\n${failedRequests.join("\n")}`).toEqual([]);
    expect.soft(serverErrors, `5xx backend responses found:\n${serverErrors.join("\n")}`).toEqual([]);
  });
});
