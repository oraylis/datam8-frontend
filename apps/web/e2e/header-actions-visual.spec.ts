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
      {
        name: "DataSourceTypes",
        relPath: "Base/DataSourceTypes.json",
        content: {
          dataSourceTypes: [{ name: "SqlServer", pluginId: "builtin:SQLServer" }],
        },
      },
      {
        name: "DataSources",
        relPath: "Base/DataSources.json",
        content: {
          dataSources: [{ name: "CRM", type: "SqlServer", extendedProperties: {} }],
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
          sources: [{
            dataSource: "CRM",
            sourceLocation: "dbo.Customer",
            mapping: [{ sourceName: "CustomerId", targetName: "CustomerId", sourceDataType: { type: "string", nullable: false } }],
          }],
        },
      },
    ],
    folderEntities: [],
  };
}

function createSchemaReviewPayload() {
  const longEntityName = "contract_termination_lifecycle_periods_with_an_extremely_long_name";
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
        content: { dataTypes: [{ name: "string", displayName: "String", targets: { none: "string" } }] },
      },
      {
        name: "DataSourceTypes",
        relPath: "Base/DataSourceTypes.json",
        content: { dataSourceTypes: [{ name: "SqlServer", pluginId: "builtin:SQLServer" }] },
      },
      {
        name: "DataSources",
        relPath: "Base/DataSources.json",
        content: {
          dataSources: [
            { name: "CRM", type: "SqlServer", extendedProperties: {} },
            { name: "ERP", type: "SqlServer", extendedProperties: {} },
          ],
        },
      },
    ],
    modelEntities: [
      {
        locator: `/Model/020-Gold/${longEntityName}`,
        name: longEntityName,
        relPath: `Model/020-Gold/${longEntityName}.json`,
        content: {
          name: longEntityName,
          attributes: [],
          sources: [
            {
              dataSource: "CRM",
              sourceAlias: "Current contract",
              sourceLocation: "[dm_dom_termination].[contract_termination_lifecycle_periods_current_with_a_long_name]",
              mapping: [],
            },
            {
              dataSource: "CRM",
              sourceAlias: "Archive contract",
              sourceLocation: "[dm_dom_termination].[contract_termination_lifecycle_periods_archive_with_a_long_name]",
              mapping: [],
            },
          ],
        },
      },
      {
        locator: "/Model/020-Gold/Orders",
        name: "Orders",
        relPath: "Model/020-Gold/Orders.json",
        content: {
          name: "Orders",
          attributes: [],
          sources: [{ dataSource: "CRM", sourceLocation: "[dm_dom_termination].[orders]", mapping: [] }],
        },
      },
      {
        locator: "/Model/020-Gold/Product",
        name: "Product",
        relPath: "Model/020-Gold/Product.json",
        content: {
          name: "Product",
          attributes: [],
          sources: [{ dataSource: "ERP", sourceLocation: "[sales].[product]", mapping: [] }],
        },
      },
    ],
    folderEntities: [],
  };
}

async function mockApi(
  page: import("@playwright/test").Page,
  payload: ReturnType<typeof createMockSolutionPayload> | ReturnType<typeof createSchemaReviewPayload> = createMockSolutionPayload(),
) {

  await page.route("**/config", async (route) => {
    await route.fulfill({ json: { mode: "server" } });
  });
  await page.route("**/model/save", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
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
    await route.fulfill({ json: { items: [{
      id: "builtin:SQLServer",
      displayName: "SQL Server",
      version: "1",
      capabilities: { metadata: { listTables: true, getTableMetadata: true } },
      dataTypeMapping: [],
    }] } });
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

  await page.route("**/sources/CRM/schemas/dbo/tables/Customer", async (route) => {
    await route.fulfill({ json: { items: [
      { name: "CustomerId", ordinal: 1, dataType: "string", isNullable: false, isPrimaryKey: true },
      { name: "CustomerName", ordinal: 2, dataType: "string", isNullable: true },
    ] } });
  });

  await page.route("**/entities/**", async (route) => {
    await route.fulfill({ json: { item: {} } });
  });

  await page.route("**/validate**", async (route) => {
    await route.fulfill({ json: { messages: ["Validation successful"], solutionPath: "/tmp/mock.dm8s" } });
  });
}

async function mockSchemaReviewMetadata(page: import("@playwright/test").Page) {
  const fulfillMetadata = async (route: import("@playwright/test").Route) => {
    const tableName = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) || "table");
    await route.fulfill({ json: { items: [
      { name: `${tableName}_identifier_with_a_long_name`, ordinal: 1, dataType: "string", isNullable: false, isPrimaryKey: true },
      { name: `${tableName}_description_with_a_long_name`, ordinal: 2, dataType: "string", isNullable: true },
    ] } });
  };
  await page.route("**/sources/CRM/schemas/dm_dom_termination/tables/*", fulfillMetadata);
  await page.route("**/sources/ERP/schemas/sales/tables/*", fulfillMetadata);
}

async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
}

async function expectBackground(locator: import("@playwright/test").Locator, expected: string) {
  await expect(locator).toBeVisible();
  await expect.poll(() => locator.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(expected);
}

async function expectReviewInsideDialog(dialog: import("@playwright/test").Locator) {
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).toBeTruthy();
  const rightEdge = dialogBox!.x + dialogBox!.width;
  const elements = dialog.locator(
    ".schema-review__toolbar, [data-testid='schema-review-group'], [data-testid='schema-review-entity'], [data-testid='schema-review-footer']",
  );
  const count = await elements.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const box = await elements.nth(index).boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(dialogBox!.x - 1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(rightEdge + 1);
  }
}

test("workspace header run buttons stay vertically centered", async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await mockApi(page);
  await loadSolutionFromDialog(page);

  const header = page.locator(".workspace-header");
  const tabs = page.locator(".workspace-header__tabs");
  const editorCol = page.locator(".editor-col");
  const editorPanel = page.locator(".editor-panel");
  const runActions = page.locator(".workspace-header__run-actions");
  const generatorButton = page.locator('button[aria-label="Toggle generator"]');
  const refreshButton = page.locator('button[aria-label="Refresh schemas"]');

  await expect(header).toBeVisible();
  await expect(tabs).toBeVisible();
  await expect(editorCol).toBeVisible();
  await expect(editorPanel).toBeVisible();
  await expect(runActions).toBeVisible();
  await expect(generatorButton).toBeVisible();
  await expect(refreshButton).toBeVisible();
  await expect(page.locator('button[aria-label="Toggle validator"]')).toHaveCount(0);

  const headerBox = await header.boundingBox();
  const tabsBox = await tabs.boundingBox();
  const editorColBox = await editorCol.boundingBox();
  const editorPanelBox = await editorPanel.boundingBox();
  const runActionsBox = await runActions.boundingBox();
  const generatorBox = await generatorButton.boundingBox();
  const refreshBox = await refreshButton.boundingBox();

  expect(headerBox).toBeTruthy();
  expect(tabsBox).toBeTruthy();
  expect(editorColBox).toBeTruthy();
  expect(editorPanelBox).toBeTruthy();
  expect(runActionsBox).toBeTruthy();
  expect(generatorBox).toBeTruthy();
  expect(refreshBox).toBeTruthy();

  const headerCenterY = headerBox!.y + headerBox!.height / 2;
  const runActionsCenterY = runActionsBox!.y + runActionsBox!.height / 2;
  const generatorCenterY = generatorBox!.y + generatorBox!.height / 2;
  const refreshCenterY = refreshBox!.y + refreshBox!.height / 2;
  const tabsBottomY = tabsBox!.y + tabsBox!.height;
  const editorPanelBottomY = editorPanelBox!.y + editorPanelBox!.height;
  const editorColBottomY = editorColBox!.y + editorColBox!.height;

  expect(Math.abs(runActionsCenterY - headerCenterY)).toBeLessThanOrEqual(4);
  expect(Math.abs(generatorCenterY - headerCenterY)).toBeLessThanOrEqual(4);
  expect(Math.abs(refreshCenterY - headerCenterY)).toBeLessThanOrEqual(4);
  expect(refreshBox!.x).toBeLessThan(generatorBox!.x);
  expect(editorPanelBox!.y).toBeGreaterThanOrEqual(tabsBottomY - 1);
  expect(Math.abs(editorPanelBottomY - editorColBottomY)).toBeLessThanOrEqual(2);

  await page.screenshot({ path: "output/playwright/header-actions-visual.png" });
});

test("light editor surfaces are uniformly white while dark surfaces stay unchanged", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("datam8-ui-theme-v2", "light"));
  await mockApi(page);
  await loadSolutionFromDialog(page);

  await page.getByRole("textbox", { name: "Filter model entities" }).fill("Customer");
  await page.getByRole("button", { name: "Customer" }).first().click();

  const editorPanel = page.locator(".editor-panel");
  const overviewShell = page.locator(".entity-overview-shell");
  await expectBackground(editorPanel, "rgb(255, 255, 255)");
  await expectBackground(overviewShell, "rgb(255, 255, 255)");
  const overviewInput = overviewShell.locator("input").first();
  await expect(overviewInput).toBeVisible();
  await expect.poll(() => overviewInput.evaluate((element) => getComputedStyle(element).borderTopWidth)).not.toBe("0px");

  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await expectBackground(page.locator(".source-block").first(), "rgb(255, 255, 255)");

  await page.getByRole("textbox", { name: "Filter model entities" }).fill("");
  await page.getByRole("tab", { name: "Base" }).click();
  await page.getByRole("button", { name: "Data Types", exact: true }).click();
  await page
    .getByRole("table", { name: "Base items" })
    .getByRole("button")
    .filter({ hasText: /String|string/ })
    .first()
    .click();
  const baseFormSurface = page.locator(".base-editor .toggle-field").first();
  await expectBackground(baseFormSurface, "rgb(255, 255, 255)");

  await page.screenshot({ path: "output/playwright/editor-surfaces-light.png" });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expectBackground(baseFormSurface, "rgb(39, 39, 39)");
});

test("global schema refresh groups, scans, and applies external sources", async ({ page }) => {
  await mockApi(page);
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Refresh schemas" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Refresh schemas" })).toBeVisible();
  await expect(dialog.getByRole("cell").filter({ hasText: /^CRM/ })).toBeVisible();
  await expect(dialog.getByText("Customer", { exact: true })).toBeVisible();
  await expect(dialog.getByText("dbo.Customer", { exact: true })).toBeVisible();

  await expect(dialog.getByRole("button", { name: "Scan selected sources" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  await expect(dialog.getByText(/\d+ changes?/, { exact: true })).toBeVisible();
  await expect(dialog.getByText(/\d+\/\d+ selected/, { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText("CustomerName", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Apply selection/ })).toBeEnabled();
  await dialog.getByRole("button", { name: /Apply selection/ }).click();
  await expect(dialog.getByText(/Updated 1 entities/)).toBeVisible();
});

test("schema review groups changes without overflowing or repeating source details", async ({ page }) => {
  await page.setViewportSize({ width: 1236, height: 800 });
  await page.addInitScript(() => localStorage.setItem("datam8-ui-theme-v2", "light"));
  await mockApi(page, createSchemaReviewPayload());
  await mockSchemaReviewMetadata(page);
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Refresh schemas" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();

  const crmGroupToggle = dialog.getByRole("button", { name: /review group CRM, 3 sources/ });
  const erpGroupToggle = dialog.getByRole("button", { name: /review group ERP, 1 source/ });
  await expect(crmGroupToggle).toBeVisible();
  await expect(erpGroupToggle).toBeVisible();
  await expect(dialog.getByTestId("schema-review-entity")).toHaveCount(4);

  const reviewEntities = dialog.getByTestId("schema-review-entity");
  await expect(reviewEntities.getByText("CRM", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("Current contract", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Archive contract", { exact: true })).toBeVisible();
  await expect(dialog.getByText("[sales].[product]", { exact: true })).toHaveCount(0);

  const crmGroupCheckbox = dialog.getByRole("checkbox", { name: "Select all changes for CRM" });
  await expect(crmGroupCheckbox).toBeChecked();
  await crmGroupToggle.click();
  await expect(dialog.getByText("Current contract", { exact: true })).toBeHidden();
  await crmGroupToggle.click();
  await expect(crmGroupCheckbox).toBeChecked();

  const currentSourceRow = reviewEntities.filter({ hasText: "Current contract" });
  await currentSourceRow.getByRole("checkbox", { name: /Select all changes/ }).click();
  await expect(crmGroupCheckbox).toHaveAttribute("data-state", "indeterminate");
  await crmGroupCheckbox.click();
  await expect(crmGroupCheckbox).toBeChecked();

  await dialog.getByRole("button", { name: "Expand changes for Product" }).click();
  await expect(dialog.getByText("[sales].[product]", { exact: true })).toHaveCount(1);
  const productColumn = dialog.getByRole("row").filter({ hasText: "product_identifier_with_a_long_name" });
  await productColumn.getByRole("checkbox").click();
  await expect(dialog.getByRole("checkbox", { name: "Select all changes for Product" })).toHaveAttribute("data-state", "indeterminate");

  await expectReviewInsideDialog(dialog);
  await crmGroupToggle.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "output/playwright/schema-review-grouped-light.png" });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Refresh schemas" }).click();
  const darkDialog = page.getByRole("dialog");
  await darkDialog.getByRole("button", { name: "Scan selected sources" }).click();
  await expect(darkDialog.getByRole("button", { name: /review group CRM, 3 sources/ })).toBeVisible();
  await expectReviewInsideDialog(darkDialog);
  await page.screenshot({ path: "output/playwright/schema-review-grouped-dark.png" });

  await page.setViewportSize({ width: 900, height: 720 });
  await expectReviewInsideDialog(darkDialog);
});

test("generator exposes validate only from its split action", async ({ page }) => {
  await mockApi(page);
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Toggle generator" }).click();
  const panel = page.locator(".generator-panel");
  await expect(panel.getByText("Generator", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("Idle", { exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Generate" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Close generator panel" })).toBeVisible();
  const parameterControls = panel.getByRole("combobox");
  await expect(parameterControls).toHaveCount(2);
  await expect.poll(async () => {
    const targetBox = await parameterControls.nth(0).boundingBox();
    const logLevelBox = await parameterControls.nth(1).boundingBox();
    const generateBox = await panel.getByRole("button", { name: "Generate" }).boundingBox();
    if (!targetBox || !logLevelBox || !generateBox) return Number.POSITIVE_INFINITY;
    const generateCenterY = generateBox.y + generateBox.height / 2;
    return Math.max(
      Math.abs(targetBox.y + targetBox.height / 2 - generateCenterY),
      Math.abs(logLevelBox.y + logLevelBox.height / 2 - generateCenterY),
    );
  }).toBeLessThanOrEqual(3);
  await expect.poll(async () => {
    const actionsBox = await panel.getByTestId("generator-actions").boundingBox();
    const outputBox = await panel.getByTestId("generator-log-output").boundingBox();
    const closeBox = await panel.getByRole("button", { name: "Close generator panel" }).boundingBox();
    const logLevelBox = await parameterControls.nth(1).boundingBox();
    if (!actionsBox || !outputBox || !closeBox || !logLevelBox) return Number.POSITIVE_INFINITY;
    const alignedRightEdges = Math.abs(actionsBox.x + actionsBox.width - outputBox.x - outputBox.width);
    const closeGutter = closeBox.x - (outputBox.x + outputBox.width);
    const actionsAfterParameters = actionsBox.x - (logLevelBox.x + logLevelBox.width);
    if (closeGutter <= 0 || actionsAfterParameters <= 0 || closeBox.x <= actionsBox.x + actionsBox.width) {
      return Number.POSITIVE_INFINITY;
    }
    return alignedRightEdges;
  }).toBeLessThanOrEqual(2);
  await panel.screenshot({ path: "output/playwright/generator-toolbar-visual.png" });
  await panel.getByRole("button", { name: "More generator actions" }).click();
  await page.getByRole("menuitem", { name: "Validate only" }).click();
  await expect(panel.getByText("Validation successful", { exact: true })).toBeVisible();
});

