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

  await page.route("**/plugins", async (route) => {
    await route.fulfill({ json: { items: [{ id: "builtin:SQLServer", displayName: "SQL Server", version: "1", capabilities: { metadata: { listTables: true, getTableMetadata: true } }, dataTypeMapping: [] }] } });
  });

  await page.route("**/secrets/available", async (route) => {
    await route.fulfill({ json: { available: false } });
  });

  await page.route("**/secrets/runtime", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/sources/CRM/locations/metadata**", async (route) => {
    await route.fulfill({ json: { items: [
      { name: "CustomerId", ordinal: 1, dataType: "string", isNullable: false, isPrimaryKey: true },
      { name: "CustomerName", ordinal: 2, dataType: "string", isNullable: true },
    ] } });
  });

  await page.route("**/sources/compare**", async (route) => {
    await route.fulfill({ json: {
      has_changes: true,
      diff: {
        values_changed: {
          "root['sources'][0]['sourceLocation']": {
            old_value: "dbo.Customer",
            new_value: "dbo.Customer_v2",
          },
        },
        iterable_item_added: {
          "root['sources'][0]['mapping'][0]": {
            sourceName: "CustomerId",
            targetName: "CustomerId",
          },
        },
      },
      wrapper: { entity: {
        attributes: [],
        properties: [],
        sources: [{
          dataSource: "CRM",
          sourceLocation: "dbo.Customer_v2",
          mapping: [{ sourceName: "CustomerId", targetName: "CustomerId" }],
        }],
      } },
    } });
  });

  await page.route("**/entities/**", async (route) => {
    await route.fulfill({ json: { item: {} } });
  });

}

async function mockSchemaReviewMetadata(page: import("@playwright/test").Page) {
  const fulfillMetadata = async (route: import("@playwright/test").Route) => {
    const sourceLocation = new URL(route.request().url()).searchParams.get("source_location") || "table";
    const tableName = decodeURIComponent(sourceLocation).split(".").at(-1)?.replace(/[\[\]]/g, "") || "table";
    const normalizedName = tableName.toLowerCase();
    await route.fulfill({ json: { items: [
      { name: `${normalizedName}_identifier_with_a_long_name`, ordinal: 1, dataType: "string", isNullable: false, isPrimaryKey: true },
      { name: `${normalizedName}_description_with_a_long_name`, ordinal: 2, dataType: "string", isNullable: true },
    ] } });
  };
  await page.route("**/sources/*/locations/metadata**", fulfillMetadata);
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
  const refreshButton = page.locator('button[aria-label="Refresh data sources"]');

  await expect(header).toBeVisible();
  await expect(tabs).toBeVisible();
  await expect(editorCol).toBeVisible();
  await expect(editorPanel).toBeVisible();
  await expect(runActions).toBeVisible();
  await expect(generatorButton).toBeVisible();
  await expect(refreshButton).toBeVisible();
  await expect(page.getByRole("button", { name: "More generator actions" })).toHaveCount(0);

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

test("light editor surfaces are uniformly white while dark surfaces stay unchanged", async ({ page }, testInfo) => {
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

  await page.screenshot({ path: testInfo.outputPath("editor-surfaces-light.png") });
  await page.getByRole("button", { name: /switch to dark/i }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expectBackground(baseFormSurface, "rgb(39, 39, 39)");
});

test("global schema refresh groups, scans, and applies external sources", async ({ page }) => {
  await mockApi(page);
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Refresh data sources" })).toBeVisible();
  const refreshMode = dialog.getByRole("combobox", { name: "Refresh mode" });
  await expect(refreshMode).toHaveText("Complete refresh");
  await expect(refreshMode).toHaveAttribute("id", "refresh-mode");
  const modeLabel = dialog.getByText("Refresh mode", { exact: true });
  const helperText = dialog.getByText(
    "Select the external sources to scan. Sources are grouped by Data Source; exclusions apply only to this run.",
    { exact: true },
  );
  const [labelBox, helperBox, modeBox] = await Promise.all([
    modeLabel.boundingBox(),
    helperText.boundingBox(),
    refreshMode.boundingBox(),
  ]);
  expect(labelBox).not.toBeNull();
  expect(helperBox).not.toBeNull();
  expect(modeBox).not.toBeNull();
  expect(Math.abs((labelBox!.y + labelBox!.height / 2) - (modeBox!.y + modeBox!.height / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs((helperBox!.y + helperBox!.height / 2) - (modeBox!.y + modeBox!.height / 2))).toBeLessThanOrEqual(1);
  await refreshMode.click();
  await expect(page.getByRole("option", { name: "Complete refresh" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Source-only refresh" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("cell").filter({ hasText: /^CRM/ })).toBeVisible();
  await expect(dialog.getByText("Customer", { exact: true })).toBeVisible();
  await expect(dialog.getByText("All external sources", { exact: true })).toBeVisible();

  await expect(dialog.getByRole("button", { name: "Scan selected sources" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  await expect(dialog.getByText(/\d+ changes?/, { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText(/\d+\/\d+ selected/, { exact: true }).first()).toBeVisible();
  await expect(dialog.getByTestId("schema-review-entity")
    .getByRole("button", { name: /Expand changes for Customer/ })).toHaveAttribute("aria-expanded", "false");
  await expect(dialog.getByRole("button", { name: /Apply selection/ })).toBeEnabled();
  await dialog.getByRole("button", { name: /Apply selection/ }).click();
  await expect(dialog.getByText(/Updated 1 entities/)).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const sourceOnlyDialog = page.getByRole("dialog");
  await sourceOnlyDialog.getByRole("combobox", { name: "Refresh mode" }).click();
  await page.getByRole("option", { name: "Source-only refresh" }).click();
  await expect(sourceOnlyDialog.getByText(/entity attributes remain unchanged/)).toBeVisible();
  await sourceOnlyDialog.getByRole("button", { name: "Scan selected sources" }).click();
  await expect(sourceOnlyDialog.getByRole("button", { name: /Apply selection/ })).toBeEnabled();
  await sourceOnlyDialog.getByRole("button", { name: /Apply selection/ }).click();
  await expect(sourceOnlyDialog.getByText(/Updated 1 entities/)).toBeVisible();
  await sourceOnlyDialog.getByRole("button", { name: "Close" }).click();
});

test("schema refresh review shows API failure messages without entity context and keeps successes", async ({ page }) => {
  const payload = createMockSolutionPayload();
  const customer = payload.modelEntities[0];
  const failedEntities = [
    { name: "BrokenCustomer", sourceLocation: "dbo.BrokenCustomer" },
    { name: "AnotherBrokenCustomer", sourceLocation: "dbo.AnotherBrokenCustomer" },
  ];
  failedEntities.forEach(({ name, sourceLocation }) => payload.modelEntities.push({
    ...customer,
    locator: `/Model/010-Stage/Sales/Orders/${name}`,
    name,
    relPath: `Model/010-Stage/Sales/Orders/${name}.json`,
    content: {
      ...(customer.content as any),
      name,
      sources: [{
        dataSource: "CRM",
        sourceLocation,
        mapping: [{ sourceName: "CustomerId", targetName: "CustomerId" }],
      }],
    },
  } as any));
  await mockApi(page, payload);
  const apiMessages = [
    "Unexpected error - No target data type mapping found for 'datetime'",
    "Unexpected error - No target data type mapping found for 'decimalx'",
  ];
  await page.route("**/sources/compare**", async (route) => {
    const locator = new URL(route.request().url()).searchParams.get("locator") || "";
    const failureIndex = failedEntities.findIndex(({ name }) => locator.split("/").at(-1) === name);
    if (failureIndex >= 0) {
      await route.fulfill({
        status: 500,
        json: { code: "unexpected", message: apiMessages[failureIndex], traceId: "trace-123" },
      });
      return;
    }
    await route.fallback();
  });
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();

  const failureAlert = dialog.getByRole("alert");
  await expect(failureAlert).toContainText("2 entity refresh requests failed");
  for (const message of apiMessages) await expect(failureAlert).toContainText(message);
  await expect(failureAlert).not.toContainText("BrokenCustomer");
  await expect(failureAlert).not.toContainText("dbo.");
  await expect(failureAlert).not.toContainText("trace-123");
  await expect(dialog.getByTestId("schema-review-entity")).toHaveCount(1);
  await expect(dialog.getByTestId("schema-review-entity").getByText("Customer", { exact: true }))
    .toBeVisible();
});

test("schema review lists only entities with generator changes and starts collapsed", async ({ page }) => {
  const payload = createMockSolutionPayload();
  const customer = payload.modelEntities[0];
  payload.modelEntities.push({
    ...customer,
    locator: "/Model/Gold/Unchanged",
    name: "Unchanged",
    relPath: "Model/Gold/Unchanged.json",
    content: { ...(customer.content as any), name: "Unchanged" },
  } as any);
  await mockApi(page, payload);
  await page.route("**/sources/compare**", async (route) => {
    const locator = new URL(route.request().url()).searchParams.get("locator") || "";
    if (locator.includes("Unchanged")) {
      await route.fulfill({ json: {
        has_changes: false,
        diff: {},
        wrapper: { entity: { attributes: [], sources: [] } },
      } });
      return;
    }
    await route.fallback();
  });
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  const entities = dialog.getByTestId("schema-review-entity");
  await expect(entities).toHaveCount(1);
  await expect(entities.getByText("Customer", { exact: true })).toBeVisible();
  await expect(entities.getByText("Unchanged", { exact: true })).toHaveCount(0);
  await expect(entities.getByRole("button", { name: "Expand changes for Customer" }))
    .toHaveAttribute("aria-expanded", "false");
});

test("contract refresh selects one entity and applies sources only or complete", async ({ page }) => {
  const payload = createMockSolutionPayload();
  const entity = payload.modelEntities[0].content as any;
  entity.properties = [{ property: "write_mode", value: "merge" }];
  entity.sources = [
    { dataSource: "CRM", sourceLocation: "physical_a", metadataLocation: "contract_a", mapping: [] },
    { dataSource: "CRM", sourceLocation: "physical_b", metadataLocation: "contract_b", mapping: [] },
  ];
  await mockApi(page, payload);
  const modes: string[] = [];
  const saved: any[] = [];
  await page.route("**/sources/compare**", async (route) => {
    modes.push(new URL(route.request().url()).searchParams.get("mode") || "complete");
    await route.fulfill({ json: {
      has_changes: true,
      wrapper: { entity: {
        attributes: [{ name: "CustomerId" }, { name: "NewAttribute" }],
        properties: [{ property: "write_mode", value: "partition_replace" }],
        sources: [
          { dataSource: "CRM", sourceLocation: "new_a", metadataLocation: "contract_a", mapping: [] },
          { dataSource: "CRM", sourceLocation: "new_b", metadataLocation: "contract_b", mapping: [] },
        ],
      } },
    } });
  });
  await page.route("**/entities/**", async (route) => {
    if (route.request().method() === "PATCH") saved.push(route.request().postDataJSON());
    await route.fulfill({ json: { item: {} } });
  });
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Refresh data sources" }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("row").filter({ hasText: "Customer" })).toHaveCount(1);
  await dialog.getByRole("combobox", { name: "Refresh mode" }).click();
  await page.getByRole("option", { name: "Source-only refresh" }).click();
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  await dialog.getByRole("button", { name: /Apply selection/ }).click();
  await expect(dialog.getByText(/Updated 1 entities/)).toBeVisible();
  expect(modes).toEqual(["sources-only"]);
  expect(saved[0].sources.map((source: any) => source.metadataLocation)).toEqual(["contract_a", "contract_b"]);
  expect(saved[0].attributes).toEqual(entity.attributes);
  expect(saved[0].properties).toEqual(entity.properties);
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Refresh data sources" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: "Refresh mode" })).toHaveText("Complete refresh");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  await dialog.getByRole("button", { name: /Apply selection/ }).click();
  await expect(dialog.getByText(/Updated 1 entities/)).toBeVisible();
  expect(modes).toEqual(["sources-only", "complete"]);
  expect(saved[1].attributes.map((attribute: any) => attribute.name)).toEqual(["CustomerId", "NewAttribute"]);
  expect(saved[1].properties[0].value).toBe("partition_replace");
});

test("complete refresh uses sourceLocation when metadataLocation is absent", async ({ page }) => {
  const payload = createMockSolutionPayload();
  const entity = payload.modelEntities[0].content as any;
  entity.properties = [{ property: "write_mode", value: "merge" }];
  entity.sources = [{
    dataSource: "CRM",
    sourceLocation: "contract/customer",
    mapping: [{ sourceName: "CustomerId", targetName: "CustomerId" }],
  }];
  await mockApi(page, payload);
  let requestedMode = "";
  const saved: any[] = [];
  await page.route("**/sources/compare**", async (route) => {
    requestedMode = new URL(route.request().url()).searchParams.get("mode") || "complete";
    await route.fulfill({ json: {
      has_changes: true,
      wrapper: { entity: {
        attributes: [{ name: "CustomerId" }, { name: "NewAttribute" }],
        properties: [{ property: "write_mode", value: "partition_replace" }],
        sources: [{
          dataSource: "CRM",
          sourceLocation: "contract/customer",
          mapping: [{ sourceName: "CustomerId", targetName: "CustomerId" }],
        }],
      } },
    } });
  });
  await page.route("**/entities/**", async (route) => {
    if (route.request().method() === "PATCH") saved.push(route.request().postDataJSON());
    await route.fulfill({ json: { item: {} } });
  });
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  await dialog.getByRole("button", { name: /Apply selection/ }).click();
  await expect(dialog.getByText(/Updated 1 entities/)).toBeVisible();
  expect(requestedMode).toBe("complete");
  expect(saved[0].attributes.map((attribute: any) => attribute.name)).toEqual([
    "CustomerId",
    "NewAttribute",
  ]);
  expect(saved[0].properties[0].value).toBe("partition_replace");
});

test("external source metadata location can be edited", async ({ page }) => {
  const payload = createMockSolutionPayload();
  await mockApi(page, payload);
  const saved: any[] = [];
  await page.route("**/entities/**", async (route) => {
    if (route.request().method() === "PATCH") {
      const content = route.request().postDataJSON();
      saved.push(content);
      payload.modelEntities[0].content = content;
    }
    await route.fulfill({ json: { item: {} } });
  });
  await loadSolutionFromDialog(page);
  await page.getByRole("textbox", { name: "Filter model entities" }).fill("Customer");
  await page.getByRole("button", { name: "Customer" }).first().click();
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await page.getByRole("button", { name: "Open details" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit External Source" });
  await dialog.getByPlaceholder("Contract or metadata object").fill("contracts/customer");
  await dialog.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Open details" }).click();
  await expect(page.getByRole("dialog", { name: "Edit External Source" })
    .getByPlaceholder("Contract or metadata object")).toHaveValue("contracts/customer");
  await page.getByRole("dialog", { name: "Edit External Source" }).getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Attributes", exact: true }).click();
  await expect.poll(() => saved.at(-1)?.sources?.[0]?.metadataLocation).toBe("contracts/customer");
  await page.reload();
  await loadSolutionFromDialog(page);
  await page.getByRole("textbox", { name: "Filter model entities" }).fill("Customer");
  await page.getByRole("button", { name: "Customer" }).first().click();
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await page.getByRole("button", { name: "Open details" }).click();
  await expect(page.getByRole("dialog", { name: "Edit External Source" })
    .getByPlaceholder("Contract or metadata object")).toHaveValue("contracts/customer");
});

test("schema review groups changes without overflowing or repeating source details", async ({ page }) => {
  await page.setViewportSize({ width: 1236, height: 800 });
  await page.addInitScript(() => localStorage.setItem("datam8-ui-theme-v2", "light"));
  await mockApi(page, createSchemaReviewPayload());
  await mockSchemaReviewMetadata(page);
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();

  const crmGroupToggle = dialog.getByRole("button", { name: /review group CRM, 2 entities/ });
  const erpGroupToggle = dialog.getByRole("button", { name: /review group ERP, 1 entity/ });
  await expect(crmGroupToggle).toBeVisible();
  await expect(erpGroupToggle).toBeVisible();
  await expect(dialog.getByTestId("schema-review-entity")).toHaveCount(3);

  const reviewEntities = dialog.getByTestId("schema-review-entity");
  await expect(reviewEntities.getByText("CRM", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("Current contract", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("Archive contract", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("[sales].[product]", { exact: true })).toHaveCount(0);

  const crmGroupCheckbox = dialog.getByRole("checkbox", { name: "Select all changes for CRM" });
  await expect(crmGroupCheckbox).toBeChecked();
  await crmGroupToggle.click();
  await expect(dialog.getByText("Current contract", { exact: true })).toBeHidden();
  await crmGroupToggle.click();
  await expect(crmGroupCheckbox).toBeChecked();

  const contractEntity = reviewEntities.filter({ hasText: "contract_termination_lifecycle" });
  await contractEntity.getByRole("checkbox", { name: /for refresh/ }).click();
  await expect(crmGroupCheckbox).toHaveAttribute("data-state", "indeterminate");
  await crmGroupCheckbox.click();
  await expect(crmGroupCheckbox).toBeChecked();

  const productEntity = reviewEntities.filter({ hasText: "Product" });
  const productToggle = productEntity.getByRole("button", { name: "Expand changes for Product" });
  await expect(productToggle).toHaveAttribute("aria-expanded", "false");
  await productToggle.click();
  const externalSources = productEntity.getByTestId("external-source-change-section");
  await expect(externalSources).toBeVisible();
  await expect(externalSources).not.toHaveAttribute("open");
  await externalSources.locator(":scope > summary").click();
  const externalSource = externalSources.getByTestId("external-source-details");
  await expect(externalSource.locator(":scope > summary")).toContainText("dbo.Customer_v2");
  await externalSource.locator(":scope > summary").click();
  await expect(externalSources.getByText("Mappings", { exact: true })).toBeVisible();
  await expect(externalSources.getByTestId("diff-entry").filter({ hasText: "dbo.Customer_v2" })).toBeVisible();

  await expectReviewInsideDialog(dialog);
  await crmGroupToggle.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "output/playwright/schema-review-grouped-light.png" });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: /switch to dark/i }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const darkDialog = page.getByRole("dialog");
  await darkDialog.getByRole("button", { name: "Scan selected sources" }).click();
  await expect(darkDialog.getByRole("button", { name: /review group CRM, 2 entities/ })).toBeVisible();
  await expectReviewInsideDialog(darkDialog);
  await page.screenshot({ path: "output/playwright/schema-review-grouped-dark.png" });

  await page.setViewportSize({ width: 900, height: 720 });
  await expectReviewInsideDialog(darkDialog);
});

test("schema review shows attribute and entity property diffs from the generator", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const payload = createMockSolutionPayload();
  const entity = payload.modelEntities[0].content as any;
  entity.attributes = [
    { name: "CustomerId", dataType: { type: "int", nullable: false } },
    { name: "LegacyCode", dataType: { type: "string", nullable: true } },
  ];
  entity.properties = [{ property: "write_mode", value: "merge" }];
  await mockApi(page, payload);
  await page.route("**/sources/compare**", async (route) => {
    await route.fulfill({ json: {
      has_changes: true,
      diff: {
        values_changed: {
          "root['attributes'][0]['dataType']['type']": { old_value: "int", new_value: "long" },
          "root['properties'][0]['value']": { old_value: "merge", new_value: "partition_replace" },
        },
        iterable_item_added: {
          "root['attributes'][2]": {
            name: "CreatedAt",
            attributeType: "Generic Datetime",
            properties: [{ property: "classification", value: "internal" }],
            dataType: { type: "datetime", nullable: false },
          },
        },
        iterable_item_removed: {
          "root['attributes'][1]": entity.attributes[1],
        },
      },
      wrapper: { entity: {
        ...entity,
        attributes: [
          { name: "CustomerId", dataType: { type: "long", nullable: false } },
          entity.attributes[1],
          {
            name: "CreatedAt",
            attributeType: "Generic Datetime",
            properties: [{ property: "classification", value: "internal" }],
            dataType: { type: "datetime", nullable: false },
          },
        ],
        properties: [{ property: "write_mode", value: "partition_replace" }],
      } },
    } });
  });
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  const entityRow = dialog.getByTestId("schema-review-entity");
  const entityToggle = entityRow.getByRole("button", { name: "Expand changes for Customer" });
  await expect(entityToggle).toHaveAttribute("aria-expanded", "false");
  await entityToggle.click();
  await expect(entityRow.getByRole("tablist")).toHaveCount(0);
  const modelEntitySection = dialog.getByTestId("model-entity-change-section");
  await expect(modelEntitySection).toBeVisible();
  await expect(dialog.getByTestId("external-source-change-section")).toHaveCount(0);
  await expect(modelEntitySection.getByText("Object changes", { exact: true })).toHaveCount(0);
  await expect(modelEntitySection.getByText("Columns", { exact: true })).toBeVisible();
  await expect(modelEntitySection.getByText("Properties › write_mode", { exact: true })).toBeVisible();
  const columnsSection = modelEntitySection.getByTestId("column-changes");
  await expect(columnsSection).not.toHaveAttribute("open");
  await columnsSection.locator(":scope > summary").click();
  const globalOperations = dialog.getByTestId("global-operation-summary");
  await expect(globalOperations.getByTestId("change-count-added")).toHaveText("+1 added");
  await expect(globalOperations.getByTestId("change-count-changed")).toHaveText("2 modified");
  await expect(globalOperations.getByTestId("change-count-removed")).toHaveText("−1 removed");
  await expect(globalOperations.getByTestId("change-count-added")).toHaveClass(/text-emerald-800/);
  await expect(globalOperations.getByTestId("change-count-changed")).toHaveClass(/text-amber-800/);
  await expect(globalOperations.getByTestId("change-count-removed")).toHaveClass(/text-destructive/);
  await dialog.screenshot({ path: "output/playwright/refresh-diff-attributes-properties.png" });
  const changedColumn = modelEntitySection.getByTestId("diff-column-group").filter({ hasText: "CustomerId" });
  await expect(changedColumn.getByLabel("Changed", { exact: true })).toHaveText("~");
  const addedColumn = modelEntitySection.getByTestId("diff-column-group").filter({ hasText: "CreatedAt" });
  await expect(addedColumn.getByLabel("New", { exact: true })).toHaveText("+");
  const removedColumn = modelEntitySection.getByTestId("diff-column-group").filter({ hasText: "LegacyCode" });
  await expect(removedColumn.getByLabel("Removed", { exact: true })).toHaveText("−");
  await expect(addedColumn.getByTestId("diff-entry").first()).toBeHidden();
  await addedColumn.locator("summary").first().click();
  await expect(addedColumn.getByText("Generic Datetime", { exact: true })).toBeVisible();
  await expect(addedColumn.getByText("Nullable", { exact: true })).toBeVisible();
  await expect(addedColumn.getByText("Properties › classification", { exact: true })).toBeVisible();
  await expect(addedColumn.locator("pre")).toHaveCount(0);
  await modelEntitySection.getByText("Properties › write_mode", { exact: true }).scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: "output/playwright/refresh-diff-entity-properties.png" });
});

test("schema review shows source-only and mapping diffs from the generator", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const payload = createMockSolutionPayload();
  const entity = payload.modelEntities[0].content as any;
  entity.sources[0].properties = [{ property: "extract_mode", value: "full" }];
  entity.sources[0].mapping = [
    {
      sourceName: "CustomerId",
      targetName: "CustomerId",
      sourceDataType: { type: "int", nullable: false },
      properties: [],
    },
    { sourceName: "LegacyCode", targetName: "LegacyCode" },
  ];
  const refreshedSources = [{
    ...entity.sources[0],
    sourceLocation: "dbo.Customer_v2",
    properties: [{ property: "extract_mode", value: "delta_replace" }],
    mapping: [
      {
        sourceName: "CustomerId",
        targetName: "CustomerId",
        sourceDataType: { type: "long", nullable: false },
        properties: [{ property: "attribute_type", value: "bk" }],
      },
      { sourceName: "CreatedAt", targetName: "CreatedAt" },
    ],
  }];
  await mockApi(page, payload);
  await page.route("**/sources/compare**", async (route) => {
    await route.fulfill({ json: {
      has_changes: true,
      diff: {
        values_changed: {
          "root['sources'][0]['sourceLocation']": {
            old_value: "dbo.Customer",
            new_value: "dbo.Customer_v2",
          },
          "root['sources'][0]['properties'][0]['value']": {
            old_value: "full",
            new_value: "delta_replace",
          },
          "root['sources'][0]['mapping'][0]['sourceDataType']['type']": {
            old_value: "int",
            new_value: "long",
          },
        },
        iterable_item_added: {
          "root['sources'][0]['mapping'][0]['properties'][0]": {
            property: "attribute_type",
            value: "bk",
          },
          "root['sources'][0]['mapping'][1]": refreshedSources[0].mapping[1],
        },
        iterable_item_removed: {
          "root['sources'][0]['mapping'][1]": entity.sources[0].mapping[1],
        },
      },
      wrapper: { entity: { ...entity, sources: refreshedSources } },
    } });
  });
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Refresh mode" }).click();
  await page.getByRole("option", { name: "Source-only refresh" }).click();
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  const entityRow = dialog.getByTestId("schema-review-entity");
  await entityRow.getByRole("button", { name: "Expand changes for Customer" }).click();
  await expect(entityRow.getByRole("tablist")).toHaveCount(0);
  const externalSourcesSection = dialog.getByTestId("external-source-change-section");
  await expect(externalSourcesSection).toBeVisible();
  await expect(dialog.getByTestId("model-entity-change-section")).toHaveCount(0);
  await expect(externalSourcesSection).not.toHaveAttribute("open");
  await externalSourcesSection.locator(":scope > summary").click();
  const singleSource = externalSourcesSection.getByTestId("external-source-details");
  await singleSource.locator(":scope > summary").click();
  await expect(singleSource.getByText("Properties › extract_mode", { exact: true })).toBeVisible();
  await expect(externalSourcesSection.getByText("Object changes", { exact: true })).toHaveCount(0);
  const mappingsSection = externalSourcesSection.getByTestId("mapping-changes");
  await expect(mappingsSection).not.toHaveAttribute("open");
  await mappingsSection.locator(":scope > summary").click();
  await expect(singleSource.locator(":scope > summary")).toContainText("6 changes");
  const removedColumn = externalSourcesSection.getByTestId("diff-column-group")
    .filter({ hasText: "LegacyCode → LegacyCode" });
  await expect(removedColumn.getByLabel("Removed", { exact: true })).toHaveText("−");
  const addedColumn = externalSourcesSection.getByTestId("diff-column-group")
    .filter({ hasText: "CreatedAt → CreatedAt" });
  await expect(addedColumn.getByLabel("New", { exact: true })).toHaveText("+");
  const changedMappingGroup = externalSourcesSection.getByTestId("diff-column-group")
    .filter({ hasText: "CustomerId → CustomerId" });
  await expect(changedMappingGroup.getByLabel("Changed", { exact: true })).toHaveText("~");
  const changedMapping = changedMappingGroup.getByTestId("diff-entry").filter({ hasText: "Data type" });
  await expect(changedMapping).toBeHidden();
  await changedMappingGroup.locator("summary").first().click();
  await expect(changedMappingGroup.getByText("Properties › attribute_type", { exact: true })).toBeVisible();
  await expect(changedMapping.getByLabel(
    "changed; values_changed; root['sources'][0]['mapping'][0]['sourceDataType']['type']",
  )).toBeVisible();
  await expect(changedMapping.locator("[aria-label]").first()).toHaveAttribute(
    "aria-label",
    "changed; values_changed; root['sources'][0]['mapping'][0]['sourceDataType']['type']",
  );
  await dialog.screenshot({ path: "output/playwright/refresh-diff-sources-only.png" });
  await removedColumn.scrollIntoViewIfNeeded();
  await removedColumn.locator("summary").first().click();
  await expect(removedColumn.getByTestId("diff-entry")).toHaveCount(2);
  await expect(removedColumn.getByText("Source column", { exact: true })).toBeVisible();
  await expect(removedColumn.getByText("Target column", { exact: true })).toBeVisible();
  await expect(externalSourcesSection.getByText("View value", { exact: true })).toHaveCount(0);
  await expect(externalSourcesSection.locator("pre")).toHaveCount(0);
  await dialog.screenshot({ path: "output/playwright/refresh-diff-mapping-removals.png" });
});

test("schema review combines entity and source changes and preserves expansion while filtering", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => localStorage.setItem("datam8-ui-theme-v2", "light"));
  const payload = createMockSolutionPayload();
  const entity = payload.modelEntities[0].content as any;
  await mockApi(page, payload);
  await page.route("**/sources/compare**", async (route) => {
    await route.fulfill({ json: {
      has_changes: true,
      diff: {
        values_changed: {
          "root['attributes'][0]['dataType']['type']": { old_value: "string", new_value: "long" },
          "root['sources'][0]['sourceLocation']": {
            old_value: "dbo.Customer",
            new_value: "dbo.Customer_v2",
          },
        },
        iterable_item_added: {
          "root['sources'][1]['mapping'][0]": {
            sourceName: "root_subscriber_id",
            targetName: "subscriber_id",
          },
        },
      },
      wrapper: { entity: {
        ...entity,
        attributes: [{ ...entity.attributes[0], dataType: { type: "long", nullable: false } }],
        sources: [
          { ...entity.sources[0], sourceLocation: "dbo.Customer_v2" },
          {
            dataSource: "CRM",
            sourceAlias: "History",
            sourceLocation: "dbo.CustomerHistory",
            mapping: [{ sourceName: "root_subscriber_id", targetName: "subscriber_id" }],
          },
        ],
      } },
    } });
  });
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();

  const entityRow = dialog.getByTestId("schema-review-entity");
  const entityToggle = entityRow.getByRole("button", { name: "Expand changes for Customer" });
  await expect(entityToggle).toHaveAttribute("aria-expanded", "false");
  await entityToggle.click();
  await expect(entityRow.getByRole("tablist")).toHaveCount(0);
  const modelEntitySection = entityRow.getByTestId("model-entity-change-section");
  const externalSourcesSection = entityRow.getByTestId("external-source-change-section");
  const columnsSection = modelEntitySection.getByTestId("column-changes");
  await expect(externalSourcesSection).not.toHaveAttribute("open");
  await expect(columnsSection).not.toHaveAttribute("open");
  await externalSourcesSection.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(externalSourcesSection).toHaveAttribute("open", "");
  const changedSource = externalSourcesSection.getByTestId("external-source-details").filter({ hasText: "Location" });
  await expect(changedSource).not.toHaveAttribute("open");
  await changedSource.locator(":scope > summary").click();
  await expect(changedSource.getByText("Location", { exact: true })).toBeVisible();
  const historySource = externalSourcesSection.getByTestId("external-source-details").filter({ hasText: "History" });
  await historySource.locator(":scope > summary").click();
  await historySource.getByTestId("mapping-changes").locator(":scope > summary").click();
  await columnsSection.locator(":scope > summary").click();
  await expect(modelEntitySection.getByTestId("diff-column-group").getByText("CustomerId", { exact: true })).toBeVisible();
  const filter = dialog.getByPlaceholder("Filter tables / columns...");
  await filter.fill("does-not-exist");
  await expect(entityRow).toHaveCount(0);
  await filter.fill("");
  await expect(changedSource).toHaveAttribute("open", "");
  await expect(historySource).toHaveAttribute("open", "");
  await expect(columnsSection).toHaveAttribute("open", "");
  await expect(entityRow.getByRole("checkbox", { name: "Select Customer for refresh" })).toBeChecked();
  await dialog.getByRole("button", { name: "Collapse all", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /Expand review group CRM/ })).toHaveAttribute("aria-expanded", "false");
  await dialog.getByRole("button", { name: "Expand all", exact: true }).click();
  await expect(dialog.locator("details:not([open])")).toHaveCount(0);
  await expect(historySource.getByText("Source column", { exact: true })).toBeVisible();
  await expect(historySource.getByText("Target column", { exact: true })).toBeVisible();
  await expect(dialog.locator("pre")).toHaveCount(0);
  await expect(dialog.getByTestId("global-operation-summary").getByTestId("change-count-changed")).toHaveText("2 modified");
  await expect(dialog.getByTestId("global-operation-summary").getByTestId("change-count-added")).toHaveText("+1 added");
  await expectReviewInsideDialog(dialog);
  await dialog.screenshot({ path: "output/playwright/refresh-diff-mixed-entity-sources.png" });
  await page.setViewportSize({ width: 900, height: 720 });
  await expectReviewInsideDialog(dialog);
  await dialog.screenshot({ path: "output/playwright/refresh-diff-mixed-narrow.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /switch to dark/i }).click();
  await page.getByRole("button", { name: "Refresh data sources" }).click();
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  await dialog.getByRole("button", { name: "Expand all", exact: true }).click();
  await expectReviewInsideDialog(dialog);
  await dialog.screenshot({ path: "output/playwright/refresh-diff-mixed-narrow-dark.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog.screenshot({ path: "output/playwright/refresh-diff-mixed-dark.png", animations: "disabled" });
  await expectReviewInsideDialog(dialog);

});

test("schema review shows dictionary and type changes in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => localStorage.setItem("datam8-ui-theme-v2", "dark"));
  const payload = createMockSolutionPayload();
  const entity = payload.modelEntities[0].content as any;
  entity.description = "Legacy customer contract";
  entity.properties = [{ property: "retention_days", value: 30 }];
  await mockApi(page, payload);
  await page.route("**/sources/compare**", async (route) => {
    const refreshedEntity = {
      ...entity,
      displayName: "Customer contract",
      properties: [{ property: "retention_days", value: "30" }],
    };
    delete refreshedEntity.description;
    await route.fulfill({ json: {
      has_changes: true,
      diff: {
        type_changes: {
          "root['properties'][0]['value']": {
            old_type: "int",
            new_type: "str",
            old_value: 30,
            new_value: "30",
          },
        },
        dictionary_item_added: {
          "root['displayName']": "Customer contract",
        },
        dictionary_item_removed: {
          "root['description']": "Legacy customer contract",
        },
      },
      wrapper: { entity: refreshedEntity },
    } });
  });
  await loadSolutionFromDialog(page);

  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  const entityRow = dialog.getByTestId("schema-review-entity");
  await entityRow.getByRole("button", { name: "Expand changes for Customer" }).click();
  const modelEntitySection = dialog.getByTestId("model-entity-change-section");
  await expect(modelEntitySection.getByText("Object changes", { exact: true })).toHaveCount(0);
  const globalOperations = dialog.getByTestId("global-operation-summary");
  await expect(globalOperations.getByTestId("change-count-added")).toHaveText("+1 added");
  await expect(globalOperations.getByTestId("change-count-changed")).toHaveText("1 modified");
  await expect(globalOperations.getByTestId("change-count-removed")).toHaveText("−1 removed");
  await expect(globalOperations.getByTestId("change-count-added")).toHaveClass(/dark:text-emerald-300/);
  await dialog.screenshot({ path: "output/playwright/refresh-diff-dictionary-dark.png" });
});

test("schema review extracts whole sources and mapping lists with long names without JSON", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 720 });
  await page.addInitScript(() => localStorage.setItem("datam8-ui-theme-v2", "light"));
  const payload = createMockSolutionPayload();
  const entity = payload.modelEntities[0].content as any;
  const longName = "customer_contract_metadata_".repeat(5);
  const legacy = { dataSource: "CRM", sourceAlias: "Legacy", sourceLocation: "dbo.Legacy", mapping: [{ sourceName: "id", targetName: "id" }] };
  entity.sources = [{ ...entity.sources[0], sourceAlias: "Current", mapping: [{ sourceName: "amount", targetName: "amount", sourceDataType: { type: "decimal", precision: 12, scale: 2 } }] }, legacy];
  const archive = { dataSource: "CRM", sourceAlias: "Archive", sourceLocation: longName, mapping: [{ sourceName: longName, targetName: "archive_id" }] };
  const refreshed = [{ ...entity.sources[0], mapping: [
    { sourceName: "amount", targetName: "total", sourceDataType: { type: "decimal", precision: 18, scale: 4 }, properties: [{ property: "format", value: { unit: "EUR", round: false } }] },
    { sourceName: "code", targetName: "code" },
  ] }, archive];
  await mockApi(page, payload);
  await page.route("**/sources/compare**", async (route) => route.fulfill({ json: {
    has_changes: true,
    diff: {
      values_changed: { "root['sources'][0]['mapping']": { old_value: entity.sources[0].mapping, new_value: refreshed[0].mapping } },
      iterable_item_added: { "root['sources'][1]": archive },
      iterable_item_removed: { "root['sources'][1]": legacy },
    },
    wrapper: { entity: { ...entity, sources: refreshed } },
  } }));
  await loadSolutionFromDialog(page);
  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  await dialog.getByRole("button", { name: "Expand all", exact: true }).click();
  const sources = dialog.getByTestId("external-source-details");
  await expect(sources).toHaveCount(3);
  const current = sources.filter({ hasText: "Current" });
  const amountMapping = current.getByTestId("diff-column-group").filter({ hasText: "amount → total" });
  await expect(amountMapping.locator(":scope > summary")).toHaveText(/~amount → total1 change/);
  await expect(amountMapping.getByText("Precision", { exact: true })).toBeVisible();
  await expect(amountMapping.getByText("Scale", { exact: true })).toBeVisible();
  await expect(current.getByText("Properties › format › unit", { exact: true })).toBeVisible();
  await expect(current.getByText("Properties › format › round", { exact: true })).toBeVisible();
  await expect(current.getByTestId("diff-column-group").filter({ hasText: "code → code" }).getByLabel("New", { exact: true })).toHaveText("+");
  const archived = sources.filter({ hasText: "Archive" });
  await expect(archived.getByText("Target column", { exact: true })).toBeVisible();
  await expect(sources.filter({ hasText: "Legacy" }).getByText("Target column", { exact: true })).toBeVisible();
  await expect(dialog.getByTestId("external-source-change-section").locator(":scope > summary")).toContainText("3 changes");
  await expect(dialog.getByText("View value", { exact: true })).toHaveCount(0);
  await expect(dialog.locator("pre")).toHaveCount(0);
  const fields = dialog.getByTestId("diff-entry");
  expect(await fields.evaluateAll((rows) => rows.every((row) => row.scrollWidth <= row.clientWidth + 1))).toBe(true);
  await dialog.screenshot({ path: "output/playwright/refresh-diff-whole-sources.png", animations: "disabled" });
  await expectReviewInsideDialog(dialog);
});

test("schema review counts affected objects and hides mapping and column previews", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => localStorage.setItem("datam8-ui-theme-v2", "light"));
  const payload = createMockSolutionPayload();
  const entity = payload.modelEntities[0].content as any;
  entity.attributes = ["campaign_desc", "campaign_name_desc", "campaign_type_desc", "dm_load_job_id"].map((name, index) => ({ name, dataType: { type: "string", ...(index ? { charLen: 12 } : {}) } }));
  entity.sources[0].mapping = Array.from({ length: 11 }, (_, index) => ({ sourceName: `column_${index}`, targetName: `column_${index}`, sourceDataType: { type: "string" }, properties: [] }));
  const refreshed = structuredClone(entity);
  const values_changed: Record<string, unknown> = {};
  const iterable_item_added: Record<string, unknown> = {};
  const dictionary_item_added: Record<string, unknown> = {};
  refreshed.attributes.forEach((attribute: any, index: number) => {
    attribute.dataType.charLen = index ? 24 : 510;
    if (index) values_changed[`root['attributes'][${index}]['dataType']['charLen']`] = { old_value: 12, new_value: 24 };
    else dictionary_item_added[`root['attributes'][${index}]['dataType']['charLen']`] = 510;
  });
  refreshed.sources[0].mapping.forEach((mapping: any, index: number) => {
    if (index < 6) {
      mapping.sourceDataType.type = "nvarchar";
      values_changed[`root['sources'][0]['mapping'][${index}]['sourceDataType']['type']`] = { old_value: "string", new_value: "nvarchar" };
    }
    if (index < 10) {
      const property = { property: "classification", value: "public" };
      mapping.properties.push(property);
      iterable_item_added[`root['sources'][0]['mapping'][${index}]['properties'][0]`] = property;
    }
  });
  await mockApi(page, payload);
  await page.route("**/sources/compare**", async (route) => route.fulfill({ json: {
    has_changes: true, diff: { values_changed, iterable_item_added, dictionary_item_added }, wrapper: { entity: refreshed },
  } }));
  await loadSolutionFromDialog(page);
  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  await expect(dialog.getByTestId("global-change-count")).toHaveText("5 changes");
  await expect(dialog.getByTestId("global-operation-summary").getByTestId("change-count-changed")).toHaveText("5 modified");
  await expect(dialog.getByTestId("global-operation-summary").getByTestId("change-count-added")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Expand changes for Customer" }).click();
  await expect(dialog.getByTestId("entity-change-count")).toHaveText("5 changes");
  const columns = dialog.getByTestId("column-changes");
  await columns.locator(":scope > summary").click();
  const firstColumn = columns.getByTestId("diff-column-group").filter({ hasText: "campaign_desc" });
  await expect(firstColumn.locator(":scope > summary")).toHaveText(/~campaign_desc1 change/);
  await expect(firstColumn.getByText("Length", { exact: true })).toBeHidden();
  await expect(columns.getByText("Changed", { exact: true })).toHaveCount(0);
  await dialog.screenshot({ path: "output/playwright/refresh-diff-affected-counts.png" });
  await firstColumn.locator(":scope > summary").getByTestId("review-expand-icon").click();
  await expect(firstColumn.getByText("Length", { exact: true })).toBeVisible();
  const lengthRow = firstColumn.getByTestId("diff-entry");
  await expect(lengthRow.getByTestId("diff-before")).toHaveCount(0);
  await expect(lengthRow.getByTestId("diff-after")).toHaveText("510");
  const labelBox = await lengthRow.getByTestId("diff-field-label").boundingBox();
  const valueBox = await lengthRow.getByTestId("diff-values").boundingBox();
  const afterBox = await lengthRow.getByTestId("diff-after").boundingBox();
  expect(labelBox!.width).toBeLessThanOrEqual(160);
  expect(valueBox!.x - labelBox!.x - labelBox!.width).toBeLessThanOrEqual(12);
  expect(Math.abs(afterBox!.x - valueBox!.x)).toBeLessThanOrEqual(1);
  const sources = dialog.getByTestId("external-source-change-section");
  await sources.locator(":scope > summary").click();
  const source = sources.getByTestId("external-source-details");
  await source.locator(":scope > summary").click();
  await source.getByTestId("mapping-changes").locator(":scope > summary").click();
  const mapping = source.getByTestId("diff-column-group").first();
  await expect(mapping.locator(":scope > summary")).toHaveText(/~column_0 → column_02 changes/);
  await expect(mapping.getByText("Properties › classification", { exact: true })).toBeHidden();
  await expect(mapping.getByText("Data type", { exact: true })).toBeHidden();
  await expect(source.getByText("Changed", { exact: true })).toHaveCount(0);
  await dialog.screenshot({ path: "output/playwright/refresh-diff-mappings-compact.png" });
  await mapping.locator(":scope > summary").click();
  await expect(mapping.getByText("Properties › classification", { exact: true })).toBeVisible();
  await expect(mapping.getByText("Data type", { exact: true })).toBeVisible();
  const dataTypeRow = mapping.getByTestId("diff-entry").filter({ hasText: "Data type" });
  const beforeBox = await dataTypeRow.getByTestId("diff-before").boundingBox();
  const newTypeBox = await dataTypeRow.getByTestId("diff-after").boundingBox();
  expect(newTypeBox!.x - beforeBox!.x - beforeBox!.width).toBeLessThanOrEqual(32);
  expect(await dialog.locator("summary:visible").filter({ has: page.getByTestId("review-expand-icon") }).evaluateAll((summaries) => summaries.every((summary) => {
    const icon = summary.querySelector('[data-testid="review-expand-icon"]')!;
    return icon.getBoundingClientRect().right < summary.getBoundingClientRect().left;
  }))).toBe(true);
  await dialog.screenshot({ path: "output/playwright/refresh-diff-compact-values.png", animations: "disabled" });
});

test("schema refresh keeps failed apply results available for retry", async ({ page }) => {
  await mockApi(page);
  let fail = true;
  const writes: any[] = [];
  await page.route("**/entities/**", async (route) => {
    if (["PATCH", "PUT"].includes(route.request().method())) {
      writes.push(route.request().postDataJSON());
      await route.fulfill({ status: fail ? 503 : 200, json: fail ? { message: "Temporary save failure" } : { item: {} } });
    } else await route.fulfill({ json: { item: {} } });
  });
  await loadSolutionFromDialog(page);
  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  await dialog.getByRole("button", { name: "Apply selection (1)" }).click();
  await expect(dialog.getByText(/Updated 0 entities\. 1 entities failed and can be retried\./)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Retry failed" })).toBeEnabled();
  fail = false;
  await dialog.getByRole("button", { name: "Retry failed" }).click();
  await expect(dialog.getByText(/Updated 1 entities/)).toBeVisible();
  expect(writes.at(-1).sources[0].sourceLocation).toBe("dbo.Customer_v2");
  expect(writes.at(-1).sources[0].mapping).toEqual([{ sourceName: "CustomerId", targetName: "CustomerId" }]);
});

test("schema refresh blocks applying an entity with an unsaved editor draft", async ({ page }) => {
  await mockApi(page);
  await page.route("**/entities/**", async (route) => route.fulfill({ status: 503, json: { message: "Save unavailable" } }));
  await loadSolutionFromDialog(page);
  await page.getByRole("textbox", { name: "Filter model entities" }).fill("Customer");
  await page.getByRole("button", { name: "Customer", exact: true }).first().click();
  await page.getByPlaceholder("Display name").fill("Unsaved Customer");
  await page.getByPlaceholder("Display name").press("Tab");
  await page.getByRole("button", { name: "Refresh data sources" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Scan selected sources" }).click();
  await dialog.getByRole("button", { name: "Apply selection (1)" }).click();
  await expect(dialog.getByText("1 selected entity(s) have unsaved changes. Save them or exclude them before applying.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByPlaceholder("Display name")).toHaveValue("Unsaved Customer");
});

test("generator exposes only the generate action", async ({ page }) => {
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
  await expect(panel.getByRole("button", { name: "More generator actions" })).toHaveCount(0);
});

