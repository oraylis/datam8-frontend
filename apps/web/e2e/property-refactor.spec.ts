import { expect, test } from "@playwright/test";

type JsonRecord = Record<string, unknown>;

function createMockSolutionPayload() {
  return {
    solution: {
      schemaVersion: "test",
      basePath: "Base",
      modelPath: "Model",
      pluginsPath: "plugins",
      generatorTargets: [{ name: "none", isDefault: true, sourcePath: "Generate", outputPath: "Output" }],
    },
    baseEntities: [
      {
        name: "Properties",
        relPath: "Base/Properties.json",
        content: {
          properties: [{ name: "domain", displayName: "Domain" }],
          propertyValues: [{ property: "domain", name: "sales", displayName: "Sales" }],
        },
      },
      {
        name: "DataTypes",
        relPath: "Base/DataTypes.json",
        content: { dataTypes: ["string"] },
      },
    ],
    modelEntities: [
      {
        locator: "/Model/Raw/ProductA/ModuleA/Customer",
        name: "Customer",
        relPath: "Model/Raw/ProductA/ModuleA/Customer.json",
        content: {
          id: 1,
          name: "Customer",
          properties: [{ property: "domain", value: "sales" }],
          attributes: [],
          sources: [],
          relationships: [],
          transformations: [],
        },
      },
    ],
  };
}

async function mockApi(page: import("@playwright/test").Page) {
  const payload = createMockSolutionPayload();
  const entityWrites: Array<{ method: string; url: string; body: JsonRecord }> = [];

  await page.route("**/config", async (route) => {
    await route.fulfill({ json: { mode: "server" } });
  });

  await page.route("**/solution/inspect**", async (route) => {
    await route.fulfill({ json: { version: "v2" } });
  });

  await page.route("**/solution/full**", async (route) => {
    await route.fulfill({ json: payload });
  });

  await page.route("**/fs/list**", async (route) => {
    await route.fulfill({ json: { entries: [] } });
  });

  await page.route("**/plugins/**", async (route) => {
    await route.fulfill({ json: { items: [] } });
  });

  await page.route("**/secrets/available", async (route) => {
    await route.fulfill({ json: { available: false } });
  });

  await page.route("**/secrets/runtime**", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/model/save", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/entities/**", async (route) => {
    const req = route.request();
    if (req.method() !== "PATCH" && req.method() !== "PUT" && req.method() !== "DELETE" && req.method() !== "POST") {
      await route.fulfill({ status: 405, json: { error: "method not allowed" } });
      return;
    }
    const body = req.method() === "DELETE" ? {} : JSON.parse(req.postData() || "{}");
    entityWrites.push({ method: req.method(), url: req.url(), body });
    await route.fulfill({ status: 200, json: { item: { ok: true } } });
  });

  return { entityWrites };
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
}

test("saving renamed property applies refactor flow without apply dialog", async ({ page }) => {
  const { entityWrites } = await mockApi(page);

  await loadSolutionFromDialog(page);

  await page.getByRole("tab", { name: "Base" }).click();
  await page.getByRole("button", { name: "Properties" }).click();
  const propertyNameInput = page.locator('label:has-text("Name *") + input').first();
  await propertyNameInput.fill("businessDomain");
  await propertyNameInput.press("Tab");

  await expect.poll(() => entityWrites.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  const baseWrite = entityWrites.find(
    (entry) =>
      entry.method === "POST" &&
      /\/entities\/rename$/i.test(entry.url) &&
      entry.body.from === "/properties/domain" &&
      entry.body.to === "/properties/businessDomain",
  );
  const propertyValueWrite = entityWrites.find(
    (entry) => /\/entities\/propertyValues\/businessDomain\/sales$/i.test(entry.url),
  );

  expect(baseWrite).toBeTruthy();
  expect(propertyValueWrite).toBeTruthy();
  await expect(page.getByText("Property refactor applied")).toBeVisible();
  await expect(page.getByText("No assignment updates were required for the selected scope targets.")).toBeVisible();
});
