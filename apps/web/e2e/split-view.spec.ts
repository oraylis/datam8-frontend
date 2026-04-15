import { expect, test } from "@playwright/test";

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
        name: "DataTypes",
        relPath: "Base/DataTypes.json",
        content: {
          dataTypes: [{ name: "string", displayName: "String", targets: { none: "string" } }],
        },
      },
    ],
    modelEntities: [
      {
        locator: "/Model/010-Stage/Sales/Orders/Customer",
        name: "Customer",
        relPath: "Model/010-Stage/Sales/Orders/Customer.json",
        content: {
          id: 1001,
          name: "Customer",
          displayName: "Customer",
          attributes: [{ name: "CustomerId", dataType: { type: "string", nullable: false } }],
        },
      },
      {
        locator: "/Model/010-Stage/Sales/Orders/Order",
        name: "Order",
        relPath: "Model/010-Stage/Sales/Orders/Order.json",
        content: {
          id: 1002,
          name: "Order",
          displayName: "Order",
          attributes: [{ name: "OrderId", dataType: { type: "string", nullable: false } }],
        },
      },
    ],
    folderEntities: [],
  };
}

async function mockApi(page: import("@playwright/test").Page) {
  const payload = createMockSolutionPayload();

  await page.route("**/config", async (route) => {
    await route.fulfill({ json: { mode: "server" } });
  });

  await page.route("**/solution/inspect**", async (route) => {
    await route.fulfill({ json: { version: "v2" } });
  });

  await page.route("**/solution/full**", async (route) => {
    await route.fulfill({ json: payload });
  });

  await page.route("**/model/save", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/entities/**", async (route) => {
    const method = route.request().method();
    if (method === "PATCH" || method === "PUT") {
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fulfill({ status: 405, json: { message: "Method Not Allowed" } });
  });

  await page.route("**/fs/list**", async (route) => {
    await route.fulfill({ json: { entries: [] } });
  });

  await page.route("**/plugins/**", async (route) => {
    await route.fulfill({ json: { items: [] } });
  });

  await page.route("**/connectors", async (route) => {
    await route.fulfill({ json: { connectors: [] } });
  });

  await page.route("**/secrets/available", async (route) => {
    await route.fulfill({ json: { available: false } });
  });

  await page.route("**/secrets/runtime", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
}

async function openEntity(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("textbox", { name: "Filter model entities" }).fill(name);
  await page.getByRole("tab", { name: "Model" }).click();
  const sidebar = page.getByRole("complementary").first();
  await sidebar.getByRole("button", { name, exact: true }).first().click();
}

test("split view can be toggled and accepts tab drag-and-drop", async ({ page }) => {
  await mockApi(page);
  await loadSolutionFromDialog(page);

  await openEntity(page, "Customer");
  await openEntity(page, "Order");

  const splitButton = page.locator('button[aria-label="Toggle split view"]');
  await expect(splitButton).toBeVisible();
  await splitButton.click();

  const secondaryPane = page.locator('[aria-label="Split secondary pane"]');
  await expect(secondaryPane).toBeVisible();
  await expect(secondaryPane).toHaveAttribute("data-pane-worktab", "entity:Model/010-Stage/Sales/Orders/Order.json");

  const customerTab = page.locator('.worktabs .worktab[title="Model/010-Stage/Sales/Orders/Customer.json"]').first();
  await customerTab.dragTo(secondaryPane);
  await expect(secondaryPane).toHaveAttribute("data-pane-worktab", "entity:Model/010-Stage/Sales/Orders/Customer.json");

  await page.keyboard.press("Control+Alt+U");
  await expect(page.locator('[aria-label="Split secondary pane"]')).toHaveCount(0);
});
