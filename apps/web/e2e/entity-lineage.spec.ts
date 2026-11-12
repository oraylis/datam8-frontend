import { expect, test, type Page } from "@playwright/test";
import type { ModelEntity } from "../src/features/model/model-types";
import { createDenseLineage, createMixedLineage, lineageEntity } from "../src/features/model/lineage/testing/fixtures";

async function loadLineageFixture(page: Page, failSave = false, openLineage = true, fixture?: { entities: ModelEntity[]; focus: string }) {
  const entity = (id: number, name: string, sources: Record<string, unknown>[] = []) => ({
    locator: `/Model/Stage/${name}`, relPath: `Model/Stage/${name}.json`, name,
    content: { id, name, displayName: name, sources, attributes: [] },
  });
  const payload = {
    solution: { schemaVersion: "test", basePath: "Base", modelPath: "Model", pluginsPath: "plugins", generatorTargets: [] },
    baseEntities: [
      { name: "DataTypes", relPath: "Base/DataTypes.json", content: { dataTypes: [{ name: "string" }] } },
      { name: "DataSources", relPath: "Base/DataSources.json", content: { dataSources: [{ name: "ERP" }] } },
    ],
    modelEntities: [
      entity(1, "RawOrders", [{ dataSource: "ERP", sourceLocation: "dbo.Orders" }]),
      { ...entity(2, "Orders", [{ sourceLocation: 1, mapping: [{ sourceName: "Id", targetName: "OrderId" }] }]), content: {
        id: 2, name: "Orders", displayName: "Orders",
        properties: [{ property: "Domain", value: "Sales" }],
        sources: [{ sourceLocation: 1, mapping: [{ sourceName: "Id", targetName: "OrderId" }] }],
        attributes: [
          { name: "OrderId", dataType: { type: "int", nullable: false }, isBusinessKey: true, history: "SCD1" },
          { name: "CustomerId", dataType: { type: "int", nullable: true } },
          { name: "Comment", dataType: { type: "string", nullable: true } },
        ],
        relationships: [{ targetLocation: 5, attributes: [{ sourceName: "CustomerId", targetName: "Id" }] }],
      } },
      { ...entity(3, "OrderMart", [{ sourceLocation: 2 }]), content: {
        id: 3, name: "OrderMart", displayName: "OrderMart", sources: [{ sourceLocation: 2 }], attributes: [],
        relationships: [{ dataSource: null, targetLocation: 5, attributes: [{ sourceName: "CustomerId", targetName: "Id" }] }],
      } },
      entity(4, "Unrelated"),
      entity(5, "Customer"),
    ],
    folderEntities: [],
  };
  if (fixture) payload.modelEntities = fixture.entities as typeof payload.modelEntities;
  const focus = fixture?.focus ?? "Orders";
  const writes: unknown[] = [];
  await page.route("**/config", (route) => route.fulfill({ json: { mode: "server" } }));
  await page.route("**/solution/inspect**", (route) => route.fulfill({ json: { version: "v2" } }));
  await page.route("**/solution/full**", (route) => route.fulfill({ json: payload }));
  await page.route("**/model/save", async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill({ status: failSave ? 500 : 200, json: failSave ? { detail: "Fixture save failed" } : {} });
  });
  await page.route("**/entities/**", async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill({ status: failSave ? 500 : 200, json: failSave ? { detail: "Fixture save failed" } : {} });
  });
  await page.route("**/plugins{,/**}", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/secrets/available", (route) => route.fulfill({ json: { available: false } }));
  await page.route("**/secrets/runtime", (route) => route.fulfill({ status: 204 }));
  await page.goto("/");
  await page.getByPlaceholder("Absolute path to .dm8s").fill("C:/disposable/Lineage.dm8s");
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
  await page.getByRole("textbox", { name: "Filter model entities" }).fill(focus);
  await page.getByRole("button", { name: focus, exact: true }).first().click();
  if (openLineage) {
    await page.getByRole("button", { name: "Lineage", exact: true }).click();
    await expect(page.getByRole("region", { name: "Entity lineage" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Entity lineage" })).toHaveAttribute("aria-busy", "false");
  }
  return writes;
}

async function selectLineageOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("Lineage replaces the editor content with direction/depth filters and read-only controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.addInitScript(() => localStorage.setItem("datam8-ui-theme-v2", "light"));
  const writes = await loadLineageFixture(page);
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await expect(page.getByRole("button", { name: "Lineage", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByPlaceholder("Entity name", { exact: true })).toHaveCount(0);
  await expect(lineage.getByText("Model entity", { exact: true })).toHaveCount(0);
  await expect(lineage.getByText("Current entity", { exact: true })).toHaveCount(0);
  await expect(lineage.locator(".lineage-node--focus")).toHaveCSS("border-top-width", "3px");
  await lineage.getByRole("checkbox", { name: "Relationships", exact: true }).uncheck();
  await expect(lineage.getByRole("button", { name: "Open entity RawOrders", exact: true })).toBeVisible();
  await expect(lineage.getByRole("button", { name: "Open entity OrderMart", exact: true })).toBeVisible();
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toHaveCount(0);
  await expect(lineage.getByText("Unrelated", { exact: true })).toHaveCount(0);
  await lineage.screenshot({ path: "output/playwright/entity-lineage-light.png" });
  await lineage.getByRole("combobox", { name: "Lineage depth", exact: true }).click();
  await expect(page.getByRole("listbox")).toHaveClass(/codex-float-surface/);
  await expect(page.getByRole("option", { name: "1 level", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: "output/playwright/entity-lineage-depth-menu.png" });
  await page.getByRole("option", { name: "2 levels", exact: true }).click();
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
  await expect(lineage.getByText("External source", { exact: true })).toBeVisible();
  await selectLineageOption(page, "Lineage direction", "Upstream");
  await expect(lineage.getByRole("button", { name: "Open entity OrderMart" })).toHaveCount(0);
  await selectLineageOption(page, "Lineage direction", "Downstream");
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toHaveCount(0);
  await expect(lineage.getByRole("button", { name: "Open entity OrderMart" })).toBeVisible();
  await expect(lineage.locator(".react-flow__node")).toHaveCount(2);
  await lineage.locator(".react-flow__node").first().click();
  await page.keyboard.press("Delete");
  await expect(lineage.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: /switch to dark/i }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(lineage.locator(".react-flow")).toHaveClass(/dark/);
  await expect(lineage.locator(".lineage-node--focus")).toHaveCSS("background-color", "rgb(39, 39, 39)");
  const surroundingColor = await page.locator(".editor-panel").evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(lineage.locator(".entity-lineage__canvas")).toHaveCSS("background-color", surroundingColor);
  await expect(lineage.locator(".react-flow")).toHaveCSS("background-color", surroundingColor);
  await expect(lineage.getByRole("group", { name: "Lineage filters", exact: true })).toHaveCSS("background-color", surroundingColor);
  await expect(lineage.getByRole("group", { name: "Lineage legend", exact: true })).toHaveCSS("background-color", surroundingColor);
  await expect(lineage.getByRole("button", { name: "Open entity OrderMart" })).toBeVisible();
  await selectLineageOption(page, "Lineage direction", "Upstream & downstream");
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
  await lineage.screenshot({ path: "output/playwright/entity-lineage-dark.png" });
  await page.screenshot({ path: "output/playwright/entity-lineage-editor-dark.png" });
});

test("Opening a lineage entity saves overview edits and navigates through the existing editor", async ({ page }) => {
  const writes = await loadLineageFixture(page, false, false);
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await page.getByPlaceholder("Display name", { exact: true }).fill("Orders draft");
  await page.getByRole("button", { name: "Lineage", exact: true }).click();
  await lineage.getByRole("button", { name: "Open entity RawOrders", exact: true }).click();
  await expect(lineage.locator(".lineage-node--focus strong")).toHaveText("RawOrders");
  expect(writes.length).toBeGreaterThan(0);
  expect(JSON.stringify(writes)).toContain("Orders draft");
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lineage", exact: true }).click();
  await expect(page.getByPlaceholder("Entity name", { exact: true })).toHaveValue("RawOrders");
});

test("A failed save blocks the lineage view switch and preserves the draft", async ({ page }) => {
  const writes = await loadLineageFixture(page, true, false);
  await page.getByPlaceholder("Display name", { exact: true }).fill("Keep this draft");
  await page.getByRole("button", { name: "Lineage", exact: true }).click();
  await expect.poll(() => writes.length).toBeGreaterThan(0);
  await expect(page.getByText("Save failed", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Entity name", { exact: true })).toHaveValue("Orders");
  await expect(page.getByPlaceholder("Display name", { exact: true })).toHaveValue("Keep this draft");
  await expect(page.getByRole("region", { name: "Entity lineage" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Editor", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lineage", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("Lineage keeps the entity header, properties, sidebar and work tabs in place and returns to Attributes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const writes = await loadLineageFixture(page, false, false);
  await page.getByRole("button", { name: "Attributes", exact: true }).click();
  const header = page.locator(".panel__header").filter({ hasText: "Orders" }).last();
  await expect(header.getByText("Domain", { exact: false })).toBeVisible();
  const headerBox = await header.boundingBox();
  const navBox = await page.locator(".entity-section-nav-row .section-nav").boundingBox();
  const button = page.getByRole("button", { name: "Lineage", exact: true });
  const viewSwitch = header.locator(".entity-view-switch");
  await expect(viewSwitch.getByRole("button", { name: "Lineage", exact: true })).toBeVisible();
  await expect(viewSwitch.getByRole("button")).toHaveCount(1);
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(button).toHaveText("");
  await expect(button.locator("svg")).toHaveAttribute("width", "15");
  await expect(button.locator("svg")).toHaveAttribute("fill", "none");
  await expect(button).toHaveAttribute("title", "Show lineage");
  const inactiveColor = await button.evaluate((element) => getComputedStyle(element).color);
  const inactiveBackground = await button.evaluate((element) => getComputedStyle(element).backgroundColor);
  const titleBox = await header.locator(".panel__title-text--entity").boundingBox();
  const switchBox = await viewSwitch.boundingBox();
  expect(switchBox!.x - (titleBox!.x + titleBox!.width)).toBeLessThanOrEqual(20);
  expect(Math.abs((switchBox!.y + switchBox!.height / 2) - (titleBox!.y + titleBox!.height / 2))).toBeLessThan(8);
  const buttonBox = await button.boundingBox();
  expect(buttonBox!.y + buttonBox!.height).toBeLessThan(navBox!.y);
  await button.click();
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await expect(lineage).toBeVisible();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(button).toHaveAttribute("title", "Back to editor");
  await expect(button.locator("svg")).toHaveAttribute("fill", "none");
  await expect(button.locator("svg path")).toHaveCSS("fill", "none");
  await expect(button.locator("svg circle")).toHaveCount(2);
  await expect(button.locator("svg circle").first()).toHaveCSS("fill", await button.evaluate((element) => getComputedStyle(element).color));
  await button.screenshot({ path: "output/playwright/entity-lineage-icon-active.png" });
  expect(await button.evaluate((element) => getComputedStyle(element).color)).not.toBe(inactiveColor);
  expect(await button.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(inactiveBackground);
  await expect(page.locator(".entity-section-nav-row")).toHaveCount(0);
  for (const name of ["Overview", "Attributes", "Sources", "Relationships", "Transformations"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "Add Attribute", exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Filter model entities" })).toBeVisible();
  await expect(page.locator(".worktabs")).toBeVisible();
  expect(await header.boundingBox()).toEqual(headerBox);
  expect((await lineage.boundingBox())!.height).toBeGreaterThan(450);
  const expectFlowLayout = async () => {
    const canvas = await lineage.locator(".entity-lineage__canvas").boundingBox();
    const filters = await lineage.locator(".entity-lineage__filters").boundingBox();
    const legend = await lineage.getByRole("group", { name: "Lineage legend", exact: true }).boundingBox();
    const attribution = await lineage.locator(".react-flow__attribution").boundingBox();
    const controls = await lineage.locator(".react-flow__controls").boundingBox();
    expect(filters!.y).toBeGreaterThan(canvas!.y);
    expect(filters!.y).toBeLessThan(canvas!.y + 20);
    expect(filters!.x).toBeGreaterThan(canvas!.x);
    expect(canvas!.x + canvas!.width - (filters!.x + filters!.width)).toBeGreaterThan(0);
    expect(canvas!.x + canvas!.width - (filters!.x + filters!.width)).toBeLessThan(20);
    expect(legend!.x).toBeGreaterThan(canvas!.x + canvas!.width / 2);
    expect(legend!.y).toBeGreaterThan(canvas!.y + canvas!.height / 2);
    expect(legend!.x + legend!.width).toBeLessThan(canvas!.x + canvas!.width);
    expect(legend!.y + legend!.height).toBeLessThanOrEqual(attribution!.y);
    expect(legend!.x).toBeGreaterThan(controls!.x + controls!.width);
    await expect(lineage.locator(".react-flow").getByRole("group", { name: "Lineage legend", exact: true })).toBeVisible();
    await expect(lineage.locator(".react-flow").getByRole("group", { name: "Lineage filters", exact: true })).toBeVisible();
  };
  await expectFlowLayout();
  await page.screenshot({ path: "output/playwright/entity-lineage-editor-shell.png" });
  await page.setViewportSize({ width: 1000, height: 800 });
  await expectFlowLayout();
  await page.screenshot({ path: "output/playwright/entity-lineage-toolbar-narrow.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(button.locator("svg")).toHaveAttribute("fill", "none");
  await expect(button.locator("svg circle").first()).toHaveCSS("fill", "none");
  await expect(page.getByRole("button", { name: "Add Attribute", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attributes", exact: true })).toHaveClass(/active/);
  await button.click();
  await expect(page.locator(".entity-section-nav-row")).toHaveCount(0);
  await button.click();
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await expect(lineage).toHaveCount(0);
  await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(writes).toHaveLength(0);
});

test("Schema stays clean and attribute selection highlights explicit relationships and source mappings", async ({ page }) => {
  const writes = await loadLineageFixture(page);
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await expect(lineage.getByRole("button", { name: "Open entity Customer", exact: true })).toBeVisible();
  const relationship = lineage.locator(".lineage-edge--relationship");
  await expect(relationship).toHaveCount(1);
  await expect(relationship.locator(".react-flow__edge-path").first()).toHaveCSS("stroke-dasharray", "6px, 4px");
  await expect(relationship.locator(".react-flow__edge-path").first()).not.toHaveAttribute("marker-end");
  await expect(lineage.getByText("Missing data source", { exact: true })).toHaveCount(0);
  await expect(lineage.locator(".lineage-node--external")).toHaveCount(0);
  const schema = lineage.getByRole("button", { name: "Schema", exact: true });
  await expect(schema).toHaveAttribute("aria-expanded", "false");
  await schema.click();
  await expect(schema).toHaveText("Schema");
  await expect(lineage.getByRole("button", { name: "Inspect attribute CustomerId", exact: true })).toBeVisible();
  await lineage.getByRole("button", { name: "Inspect attribute CustomerId", exact: true }).click();
  await expect(relationship.locator(".react-flow__edge-path")).toHaveCSS("stroke-width", "3px");
  await expect(lineage.locator(".lineage-edge--source .react-flow__edge-path").first()).toHaveCSS("opacity", "0.15");
  const expectNoMappingArea = async () => {
    await expect(lineage.getByText(/No explicit mappings|\(Source mapping\)|\(Relationship\)/)).toHaveCount(0);
    const section = (await lineage.boundingBox())!;
    const canvas = (await lineage.locator(".entity-lineage__canvas").boundingBox())!;
    expect(Math.abs(section.y + section.height - canvas.y - canvas.height)).toBeLessThan(1);
  };
  await expectNoMappingArea();
  await page.screenshot({ path: "output/playwright/entity-lineage-schema-mapping.png" });
  await lineage.getByRole("button", { name: "Inspect attribute OrderId", exact: true }).click();
  await expect.poll(() => lineage.locator(".lineage-edge--source .react-flow__edge-path").evaluateAll((paths) => paths.filter((path) => (path as SVGElement).style.strokeWidth === "3").length)).toBe(1);
  await expect(relationship.locator(".react-flow__edge-path")).toHaveCSS("opacity", "0.15");
  await expectNoMappingArea();
  const unmapped = lineage.getByRole("button", { name: "Inspect attribute Comment", exact: true });
  await unmapped.click();
  await expect(unmapped).toHaveAttribute("aria-pressed", "true");
  await expectNoMappingArea();
  await unmapped.click();
  await expect(relationship.locator(".react-flow__edge-path")).toHaveCSS("opacity", "1");
  await lineage.getByRole("checkbox", { name: "Relationships", exact: true }).uncheck();
  await expect(lineage.getByRole("button", { name: "Open entity Customer", exact: true })).toHaveCount(0);
  await lineage.getByRole("checkbox", { name: "Sources", exact: true }).uncheck();
  await expect(lineage.locator(".react-flow__node")).toHaveCount(1);
  await expect(lineage.getByLabel("Lineage direction")).toBeDisabled();
  await lineage.getByRole("checkbox", { name: "Relationships", exact: true }).check();
  await expect(lineage.locator(".react-flow__node")).toHaveCount(2);
  await schema.click();
  await expect(lineage.getByRole("button", { name: "Inspect attribute CustomerId", exact: true })).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

test("Mixed lineage uses depth for scope, shows only current relationships and keeps orthogonal routing and highlighting", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const entities = createMixedLineage();
  const delivery = lineageEntity(9, "Delivery", "Consumer/Sales");
  delivery.content.sources = [{ sourceLocation: 8 }];
  entities.push(delivery);
  entities[3].content.attributes = Array.from({ length: 20 }, (_, index) => ({ name: `Column${index}`, dataType: { type: "int", nullable: true }, history: "SCD2" }));
  const writes = await loadLineageFixture(page, false, true, { entities, focus: "DimCustomer" });
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await expect(lineage.getByRole("button", { name: "Open entity Delivery", exact: true })).toHaveCount(0);
  await expect(lineage.getByRole("button", { name: /(?:Expand|Collapse) dependencies for/ })).toHaveCount(0);
  await expect(lineage.getByRole("button", { name: "Open entity SalesOrder", exact: true })).toHaveCount(0);
  await selectLineageOption(page, "Lineage depth", "3 levels");
  await expect(lineage.getByRole("button", { name: "Open entity Delivery", exact: true })).toBeVisible();
  await selectLineageOption(page, "Lineage depth", "2 levels");
  await expect(lineage.getByRole("button", { name: "Open entity Delivery", exact: true })).toHaveCount(0);
  await expect(lineage.getByRole("button", { name: "Open entity SalesOrder", exact: true })).toBeVisible();
  await expect(lineage.getByRole("button", { name: "Open entity DimDate", exact: true })).toHaveCount(0);
  await expect(lineage.locator(".lineage-edge--relationship")).toHaveCount(2);
  const focusId = `entity:${entities[3].relPath}`;
  expect(await lineage.locator(".lineage-edge--relationship").evaluateAll((edges, focus) => edges.every((edge) => {
    const [source, target] = JSON.parse(edge.getAttribute("data-id")!.slice("relationship:".length));
    return source === focus || target === focus;
  }), focusId)).toBe(true);
  // Layout completion must not detach an already-open menu.
  await selectLineageOption(page, "Lineage direction", "Upstream");
  await selectLineageOption(page, "Lineage direction", "Downstream");
  await selectLineageOption(page, "Lineage direction", "Upstream & downstream");
  await expect(lineage).toHaveAttribute("aria-busy", "false");
  await expect(lineage.locator(".react-flow__node")).toHaveCount(7);
  const assertRoutes = async () => {
    const geometry = await lineage.evaluate((root) => {
      const nodes = [...root.querySelectorAll<HTMLElement>(".react-flow__node")].map((node) => {
        const match = node.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)!;
        return { x: Number(match[1]), y: Number(match[2]), width: node.offsetWidth, height: node.offsetHeight,
          ports: [...node.querySelectorAll<HTMLElement>(".react-flow__handle")].map((port) => ({ x: Number(match[1]) + parseFloat(port.style.left), y: Number(match[2]) + parseFloat(port.style.top) })) };
      });
      const paths = [...root.querySelectorAll<SVGPathElement>(".react-flow__edge-path")].map((path) => [...path.getAttribute("d")!.matchAll(/[ML]([-\d.]+),([-\d.]+)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) })));
      return { nodes, paths };
    });
    expect(geometry.paths).toHaveLength(8);
    const ports = geometry.nodes.flatMap((node) => node.ports);
    for (const points of geometry.paths) {
      for (const endpoint of [points[0], points.at(-1)!]) expect(ports.some((port) => Math.hypot(endpoint.x - port.x, endpoint.y - port.y) < 0.1)).toBe(true);
      for (let index = 1; index < points.length; index++) {
        const a = points[index - 1]; const b = points[index];
        expect(a.x === b.x || a.y === b.y).toBe(true);
        for (const node of geometry.nodes) {
          const crosses = a.x === b.x
            ? a.x > node.x + 0.1 && a.x < node.x + node.width - 0.1 && Math.max(a.y, b.y) > node.y + 0.1 && Math.min(a.y, b.y) < node.y + node.height - 0.1
            : a.y > node.y + 0.1 && a.y < node.y + node.height - 0.1 && Math.max(a.x, b.x) > node.x + 0.1 && Math.min(a.x, b.x) < node.x + node.width - 0.1;
          expect(crosses).toBe(false);
        }
      }
    }
  };
  await assertRoutes();
  const canvas = lineage.locator(".entity-lineage__canvas");
  await expect.poll(async () => {
    const box = (await canvas.boundingBox())!;
    const cards = await lineage.locator(".react-flow__node").all();
    for (const card of cards) {
      const bounds = (await card.boundingBox())!;
      if (bounds.x < box.x || bounds.y < box.y || bounds.x + bounds.width > box.x + box.width || bounds.y + bounds.height > box.y + box.height) return false;
    }
    return true;
  }).toBe(true);
  await page.screenshot({ path: "output/playwright/entity-lineage-elk-mixed.png" });
  await lineage.getByRole("button", { name: "Highlight connections for Address", exact: true }).click();
  const paths = lineage.locator(".react-flow__edge-path");
  await expect.poll(async () => paths.evaluateAll((items) => items.filter((item) => (item as SVGElement).style.opacity === "0.15").length)).toBeGreaterThan(0);
  await expect.poll(async () => paths.evaluateAll((items) => items.filter((item) => (item as SVGElement).style.strokeWidth === "3").length)).toBe(1);
  await lineage.getByRole("button", { name: "Schema", exact: true }).click();
  await expect(lineage.getByRole("button", { name: "Inspect attribute Column0", exact: true })).toBeVisible();
  await assertRoutes();
  expect(await lineage.locator(".lineage-node__schema").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.screenshot({ path: "output/playwright/entity-lineage-elk-schema.png" });
  await selectLineageOption(page, "Lineage direction", "Downstream");
  await expect(lineage.getByRole("button", { name: "Highlight connections for Address", exact: true })).toHaveCount(0);
  await expect.poll(async () => paths.evaluateAll((items) => items.filter((item) => (item as SVGElement).style.opacity === "0.15").length)).toBe(0);
  expect(writes).toHaveLength(0);
});

test("Dense neighborhoods start grouped, expand in bounded pages and reset without writing metadata", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const writes = await loadLineageFixture(page, false, true, { entities: createDenseLineage(100), focus: "Entity99" });
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  const groups = lineage.locator(".lineage-node--group");
  const initialNodes = await lineage.locator(".react-flow__node").count();
  expect(initialNodes).toBeLessThan(20);
  await expect(groups.first()).toBeVisible();
  await groups.first().getByRole("button", { name: /Show entities in/ }).click();
  await expect(lineage).toHaveAttribute("aria-busy", "false", { timeout: 16_000 });
  await expect.poll(() => lineage.locator(".react-flow__node").count()).toBeGreaterThan(initialNodes);
  expect(await lineage.locator(".react-flow__node").count()).toBeLessThanOrEqual(80);
  expect(await lineage.locator(".react-flow__edge-path").count()).toBeLessThanOrEqual(160);
  console.log(`Dense browser layout: ${await lineage.getAttribute("data-layout-ms")} ms`);
  await page.screenshot({ path: "output/playwright/entity-lineage-elk-dense.png" });
  await lineage.getByRole("button", { name: "Reset groups", exact: true }).click();
  await expect(lineage.locator(".react-flow__node")).toHaveCount(initialNodes);
  expect(writes).toHaveLength(0);
});

test("A worker startup failure offers a retry and leaves the editor available", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const failures = { enabled: true };
    Object.assign(window, { lineageWorkerFailures: failures });
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (failures.enabled) throw new Error("Fixture worker startup failure");
        super(url, options);
      }
    };
  });
  const writes = await loadLineageFixture(page);
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await expect(lineage.getByRole("alert")).toContainText("Could not arrange lineage");
  await page.evaluate(() => { (window as unknown as { lineageWorkerFailures: { enabled: boolean } }).lineageWorkerFailures.enabled = false; });
  await lineage.getByRole("button", { name: "Retry layout", exact: true }).click();
  await expect(lineage.getByRole("button", { name: "Open entity RawOrders", exact: true })).toBeVisible();
  await expect(lineage.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Lineage", exact: true }).click();
  await expect(page.getByPlaceholder("Entity name", { exact: true })).toHaveValue("Orders");
  expect(writes).toHaveLength(0);
});

test("Returning to a failed filter clears the stale error while arranging the requested view", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const failures = { enabled: true };
    Object.assign(window, { lineageWorkerFailures: failures });
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (failures.enabled) throw new Error("Fixture worker startup failure");
        super(url, options);
      }
      postMessage(message: unknown) {
        if ((message as { cmd?: string }).cmd === "layout") setTimeout(() => super.postMessage(message), 1500);
        else super.postMessage(message);
      }
    };
  });
  const writes = await loadLineageFixture(page);
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  await expect(lineage.getByRole("alert")).toBeVisible();
  await page.evaluate(() => { (window as unknown as { lineageWorkerFailures: { enabled: boolean } }).lineageWorkerFailures.enabled = false; });
  await selectLineageOption(page, "Lineage direction", "Upstream");
  await expect(lineage).toHaveAttribute("aria-busy", "true");
  await selectLineageOption(page, "Lineage direction", "Upstream & downstream");
  await expect(lineage).toHaveAttribute("aria-busy", "true");
  await expect(lineage.getByRole("alert")).toHaveCount(0);
  await expect(lineage.getByRole("button", { name: "Open entity OrderMart", exact: true })).toBeVisible();
  await expect(lineage).toHaveAttribute("aria-busy", "false");
  expect(writes).toHaveLength(0);
});

test("Recalculation keeps the graph visible, reuses the warm worker and restores cached views immediately", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const runtime = { starts: 0, slow: false, emptyGraphObserved: false };
    Object.assign(window, { lineageTestRuntime: runtime });
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); runtime.starts++; }
      postMessage(message: unknown) {
        if (runtime.slow && (message as { cmd?: string }).cmd === "layout") setTimeout(() => super.postMessage(message), 500);
        else super.postMessage(message);
      }
    };
  });
  const writes = await loadLineageFixture(page);
  const lineage = page.getByRole("region", { name: "Entity lineage" });
  const initialCount = await lineage.locator(".react-flow__node").count();
  await page.evaluate(() => {
    const runtime = (window as unknown as { lineageTestRuntime: { slow: boolean; emptyGraphObserved: boolean } }).lineageTestRuntime;
    runtime.slow = true;
    const root = document.querySelector("#entity-lineage-view")!;
    new MutationObserver(() => {
      if (!root.querySelector(".react-flow__node")) runtime.emptyGraphObserved = true;
    }).observe(root, { childList: true, subtree: true });
  });
  await selectLineageOption(page, "Lineage depth", "2 levels");
  await expect(lineage).toHaveAttribute("aria-busy", "true");
  await expect(lineage.locator(".react-flow__node")).toHaveCount(initialCount);
  await expect(lineage.getByText("Updating lineage…", { exact: true })).toBeVisible();
  await expect(lineage.getByText("dbo.Orders", { exact: true })).toBeVisible();
  await expect(lineage).toHaveAttribute("aria-busy", "false");
  expect(await page.evaluate(() => (window as unknown as { lineageTestRuntime: { starts: number } }).lineageTestRuntime.starts)).toBe(1);
  // Superseded work must not replace the final filter selection.
  await selectLineageOption(page, "Lineage direction", "Upstream");
  await selectLineageOption(page, "Lineage direction", "Downstream");
  await expect(lineage).toHaveAttribute("aria-busy", "false");
  await expect(lineage.getByRole("button", { name: "Open entity OrderMart", exact: true })).toBeVisible();
  await expect(lineage.getByRole("button", { name: "Open entity RawOrders", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { lineageTestRuntime: { emptyGraphObserved: boolean } }).lineageTestRuntime.emptyGraphObserved)).toBe(false);
  await selectLineageOption(page, "Lineage direction", "Upstream & downstream");
  await selectLineageOption(page, "Lineage depth", "1 level");
  await expect(lineage).toHaveAttribute("aria-busy", "false");
  await expect(lineage.locator(".react-flow__node")).toHaveCount(initialCount);
  const starts = await page.evaluate(() => (window as unknown as { lineageTestRuntime: { starts: number } }).lineageTestRuntime.starts);
  await page.getByRole("button", { name: "Lineage", exact: true }).click();
  await page.getByRole("button", { name: "Lineage", exact: true }).click();
  await expect(lineage).toHaveAttribute("aria-busy", "false");
  await expect(lineage.getByText("Arranging lineage…", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { lineageTestRuntime: { starts: number } }).lineageTestRuntime.starts)).toBe(starts);
  expect(writes).toHaveLength(0);
});
