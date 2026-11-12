# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: entity-lineage.spec.ts >> Overview embeds source lineage with direction/depth filters and read-only controls
- Location: apps\web\e2e\entity-lineage.spec.ts:47:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /switch to dark/i })

```

# Page snapshot

```yaml
- generic:
  - generic:
    - generic:
      - generic:
        - complementary:
          - generic:
            - generic:
              - generic:
                - generic:
                  - img
                - button:
                  - img
              - generic:
                - button:
                  - img
                  - generic: New
                - button:
                  - img
                  - generic: Open
                - button:
                  - img
                  - generic: Reload
                - button:
                  - img
                  - generic: Add Entity
              - generic:
                - generic:
                  - img
                  - generic: Filter model...
                - textbox: Orders
              - tablist:
                - tab [selected]: Model
                - tab: Base
            - generic:
              - generic:
                - generic:
                  - generic:
                    - button:
                      - generic:
                        - img
                      - text: Stage
                    - generic:
                      - generic:
                        - button: Orders
                      - generic:
                        - button: RawOrders
            - generic:
              - button:
                - img
        - generic:
          - generic:
            - generic:
              - generic:
                - generic:
                  - generic:
                    - generic:
                      - button:
                        - generic: ▾
                        - generic: Stage
                      - generic:
                        - button:
                          - generic: Orders
                          - button: ×
            - generic:
              - button: ×
              - generic:
                - button:
                  - img
                - button:
                  - img
          - generic:
            - generic:
              - generic:
                - generic:
                  - generic:
                    - generic: Model/Stage/Orders.json
                    - generic:
                      - generic:
                        - generic: Orders
                    - generic:
                      - button:
                        - img
                        - text: +
                - generic:
                  - generic:
                    - generic:
                      - button: Overview
                      - button: Attributes
                      - button: Sources
                      - button: Relationships
                      - button: Transformations
                  - generic:
                    - generic:
                      - generic:
                        - generic:
                          - generic: Name
                          - textbox:
                            - /placeholder: Entity name
                            - text: Orders
                        - generic:
                          - generic: Display Name
                          - textbox:
                            - /placeholder: Display name
                            - text: Orders
                        - generic:
                          - generic: Description
                          - textbox:
                            - /placeholder: Describe this entity
                  - region "Entity lineage":
                    - generic:
                      - generic:
                        - heading [level=3]: Entity lineage
                        - paragraph: Modelled sources · current entity includes editor changes.
                      - generic:
                        - generic:
                          - text: Direction
                          - combobox
                        - generic:
                          - text: Depth
                          - combobox
                    - generic "Entity source dependency graph":
                      - application:
                        - generic:
                          - generic:
                            - generic:
                              - img
                              - img
                              - generic:
                                - group [ref=e1] [cursor=pointer]:
                                  - generic [ref=e2]:
                                    - generic [ref=e3]: Stage
                                    - strong [ref=e4]: Orders
                                    - generic [ref=e6]: Current entity
                                - group [ref=e7] [cursor=pointer]:
                                  - generic [ref=e8]:
                                    - generic [ref=e9]: Stage
                                    - strong [ref=e10]: OrderMart
                                    - generic [ref=e11]:
                                      - generic [ref=e12]: Model entity
                                      - button [ref=e13]:
                                        - text: Open
                                        - img [ref=e14]
                        - img
                        - generic:
                          - button:
                            - img
                          - button:
                            - img
                          - button:
                            - img
                        - generic:
                          - link:
                            - /url: https://reactflow.dev/attribution
                            - text: React Flow
                    - status:
                      - generic: 2 nodes · 1 connections · Arrows show data flow.
                      - generic: Open a model entity to explore its lineage.
          - generic:
            - generic:
              - generic:
                - generic:
                  - generic:
                    - combobox [disabled]:
                      - generic: Select target
                      - img
                    - combobox:
                      - generic: info
                      - img
                    - generic:
                      - button [disabled]:
                        - img
                        - text: Generate
                  - button:
                    - img
              - generic:
                - generic:
                  - generic: No logs yet.
    - list
  - dialog "Delete 1 entities?" [ref=e18]:
    - generic [ref=e19]:
      - heading "Delete 1 entities?" [level=2] [ref=e20]
      - paragraph [ref=e21]: "This action cannot be undone. The following references will be automatically removed: Orders is used by: OrderMart"
    - generic [ref=e22]:
      - button "Cancel" [active] [ref=e23]
      - button "Delete" [ref=e24]
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | 
  3  | async function loadLineageFixture(page: Page, failSave = false) {
  4  |   const entity = (id: number, name: string, sources: Record<string, unknown>[] = []) => ({
  5  |     locator: `/Model/Stage/${name}`, relPath: `Model/Stage/${name}.json`, name,
  6  |     content: { id, name, displayName: name, sources, attributes: [] },
  7  |   });
  8  |   const payload = {
  9  |     solution: { schemaVersion: "test", basePath: "Base", modelPath: "Model", pluginsPath: "plugins", generatorTargets: [] },
  10 |     baseEntities: [
  11 |       { name: "DataTypes", relPath: "Base/DataTypes.json", content: { dataTypes: [{ name: "string" }] } },
  12 |       { name: "DataSources", relPath: "Base/DataSources.json", content: { dataSources: [{ name: "ERP" }] } },
  13 |     ],
  14 |     modelEntities: [
  15 |       entity(1, "RawOrders", [{ dataSource: "ERP", sourceLocation: "dbo.Orders" }]),
  16 |       entity(2, "Orders", [{ sourceLocation: 1 }]),
  17 |       entity(3, "OrderMart", [{ sourceLocation: 2 }]),
  18 |       entity(4, "Unrelated"),
  19 |     ],
  20 |     folderEntities: [],
  21 |   };
  22 |   const writes: unknown[] = [];
  23 |   await page.route("**/config", (route) => route.fulfill({ json: { mode: "server" } }));
  24 |   await page.route("**/solution/inspect**", (route) => route.fulfill({ json: { version: "v2" } }));
  25 |   await page.route("**/solution/full**", (route) => route.fulfill({ json: payload }));
  26 |   await page.route("**/model/save", async (route) => {
  27 |     writes.push(route.request().postDataJSON());
  28 |     await route.fulfill({ status: failSave ? 500 : 200, json: failSave ? { detail: "Fixture save failed" } : {} });
  29 |   });
  30 |   await page.route("**/entities/**", async (route) => {
  31 |     writes.push(route.request().postDataJSON());
  32 |     await route.fulfill({ status: failSave ? 500 : 200, json: failSave ? { detail: "Fixture save failed" } : {} });
  33 |   });
  34 |   await page.route("**/plugins{,/**}", (route) => route.fulfill({ json: { items: [] } }));
  35 |   await page.route("**/secrets/available", (route) => route.fulfill({ json: { available: false } }));
  36 |   await page.route("**/secrets/runtime", (route) => route.fulfill({ status: 204 }));
  37 |   await page.goto("/");
  38 |   await page.getByPlaceholder("Absolute path to .dm8s").fill("C:/disposable/Lineage.dm8s");
  39 |   await page.getByRole("button", { name: "Load", exact: true }).click();
  40 |   await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
  41 |   await page.getByRole("textbox", { name: "Filter model entities" }).fill("Orders");
  42 |   await page.getByRole("button", { name: "Orders", exact: true }).first().click();
  43 |   await expect(page.getByRole("heading", { name: "Entity lineage" })).toBeVisible();
  44 |   return writes;
  45 | }
  46 | 
  47 | test("Overview embeds source lineage with direction/depth filters and read-only controls", async ({ page }) => {
  48 |   await page.setViewportSize({ width: 1440, height: 1080 });
  49 |   await page.addInitScript(() => localStorage.setItem("datam8-ui-theme-v2", "light"));
  50 |   const writes = await loadLineageFixture(page);
  51 |   const lineage = page.getByRole("region", { name: "Entity lineage" });
  52 |   await expect(page.getByRole("button", { name: "Overview", exact: true })).toHaveClass(/active/);
  53 |   await expect(lineage.getByRole("button", { name: "Open entity RawOrders", exact: true })).toBeVisible();
  54 |   await expect(lineage.getByRole("button", { name: "Open entity OrderMart", exact: true })).toBeVisible();
  55 |   await expect(lineage.getByText("dbo.Orders", { exact: true })).toHaveCount(0);
  56 |   await expect(lineage.getByText("Unrelated", { exact: true })).toHaveCount(0);
  57 |   await lineage.screenshot({ path: "output/playwright/entity-lineage-light.png" });
  58 |   await lineage.getByLabel("Lineage depth").selectOption("2");
  59 |   await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
  60 |   await lineage.getByLabel("Lineage direction").selectOption("upstream");
  61 |   await expect(lineage.getByRole("button", { name: "Open entity OrderMart" })).toHaveCount(0);
  62 |   await lineage.getByLabel("Lineage direction").selectOption("downstream");
  63 |   await expect(lineage.getByText("dbo.Orders", { exact: true })).toHaveCount(0);
  64 |   await expect(lineage.getByRole("button", { name: "Open entity OrderMart" })).toBeVisible();
  65 |   await expect(lineage.locator(".react-flow__node")).toHaveCount(2);
  66 |   await lineage.locator(".react-flow__node").first().click();
  67 |   await page.keyboard.press("Delete");
> 68 |   await expect(lineage.locator(".react-flow__node")).toHaveCount(2);
     |                                                               ^ Error: locator.click: Test timeout of 60000ms exceeded.
  69 |   expect(writes).toHaveLength(0);
  70 |   await page.getByRole("button", { name: /switch to dark/i }).click();
  71 |   await expect(page.locator("html")).toHaveClass(/dark/);
  72 |   await expect(lineage.getByRole("button", { name: "Open entity OrderMart" })).toBeVisible();
  73 |   await lineage.getByLabel("Lineage direction").selectOption("both");
  74 |   await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
  75 |   await lineage.screenshot({ path: "output/playwright/entity-lineage-dark.png" });
  76 | });
  77 | 
  78 | test("Opening a lineage entity saves overview edits and navigates through the existing editor", async ({ page }) => {
  79 |   const writes = await loadLineageFixture(page);
  80 |   const lineage = page.getByRole("region", { name: "Entity lineage" });
  81 |   await page.getByPlaceholder("Display name", { exact: true }).fill("Orders draft");
  82 |   await lineage.getByRole("button", { name: "Open entity RawOrders", exact: true }).click();
  83 |   await expect(page.getByPlaceholder("Entity name", { exact: true })).toHaveValue("RawOrders");
  84 |   expect(writes.length).toBeGreaterThan(0);
  85 |   expect(JSON.stringify(writes)).toContain("Orders draft");
  86 |   await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
  87 | });
  88 | 
  89 | test("A failed save blocks lineage navigation and preserves the draft", async ({ page }) => {
  90 |   const writes = await loadLineageFixture(page, true);
  91 |   await page.getByPlaceholder("Display name", { exact: true }).fill("Keep this draft");
  92 |   await page.getByRole("button", { name: "Open entity RawOrders", exact: true }).click();
  93 |   await expect.poll(() => writes.length).toBeGreaterThan(0);
  94 |   await expect(page.getByPlaceholder("Entity name", { exact: true })).toHaveValue("Orders");
  95 |   await expect(page.getByPlaceholder("Display name", { exact: true })).toHaveValue("Keep this draft");
  96 | });
  97 | 
```