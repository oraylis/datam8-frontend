import { describe, expect, it } from "vitest";
import type { ModelEntity } from "../model-types";
import { buildLineageGraph } from "./buildLineageGraph";

function entity(id: number, name: string, sources: ModelEntity["content"]["sources"] = []): ModelEntity {
  return { locator: `/Model/Stage/${name}`, relPath: `Model/Stage/${name}.json`, name, content: { id, name, sources } };
}
const labels = (graph: ReturnType<typeof buildLineageGraph>) => graph.nodes.map((node) => node.data.label).sort();

describe("entity source lineage", () => {
  const stage = entity(0, "Stage", [{ dataSource: "ERP", sourceLocation: "dbo.Orders" }]);
  const core = entity(2, "Core", [{ sourceLocation: 0 }, { sourceLocation: "0" }]);
  const mart = entity(3, "Mart", [{ sourceLocation: 2 }]);
  const sibling = entity(4, "Sibling", [{ sourceLocation: 0 }]);
  const all = [stage, core, mart, sibling];

  it("places direct upstream and downstream sources around the current entity, deduplicating edges", () => {
    const graph = buildLineageGraph(all, core);
    expect(labels(graph)).toEqual(["Core", "Mart", "Stage"]);
    expect(graph.edges).toHaveLength(2);
    expect(graph.nodes.find((node) => node.data.label === "Core")?.position).toEqual({ x: 0, y: 0 });
    expect(graph.nodes.find((node) => node.data.label === "Stage")?.position.x).toBeLessThan(0);
    expect(graph.nodes.find((node) => node.data.label === "Mart")?.position.x).toBeGreaterThan(0);
  });

  it("walks each direction independently, excluding siblings and unrelated external sources", () => {
    expect(labels(buildLineageGraph(all, core, "upstream", 2))).toEqual(["Core", "Stage", "dbo.Orders"]);
    expect(labels(buildLineageGraph(all, core, "downstream", 3))).toEqual(["Core", "Mart"]);
    expect(labels(buildLineageGraph(all, core, "both", 2))).toEqual(["Core", "Mart", "Stage", "dbo.Orders"]);
  });

  it("keeps external numeric locations distinct from internal IDs and groups by data source and location", () => {
    const current = entity(7, "Import", [
      { dataSource: "ERP", sourceLocation: "0" },
      { dataSource: "ERP", sourceLocation: "0", sourceAlias: "second" },
      { dataSource: "CRM", sourceLocation: "0" },
    ]);
    const graph = buildLineageGraph([stage, current], current);
    expect(graph.nodes.filter((node) => node.data.kind === "external")).toHaveLength(2);
    expect(graph.nodes.every((node) => node.data.label !== "Stage")).toBe(true);
    expect(graph.edges).toHaveLength(2);
  });

  it("uses the current editor draft without mutating loaded metadata", () => {
    const draft = { ...core, content: { ...core.content, name: "Renamed", sources: [{ sourceLocation: 3 }] } };
    expect(labels(buildLineageGraph(all, draft, "upstream"))).toEqual(["Mart", "Renamed"]);
    expect(core.content.name).toBe("Core");
    expect(core.content.sources).toHaveLength(2);
  });

  it("terminates on cycles and self references with unique nodes and finite positions", () => {
    const a = entity(1, "A", [{ sourceLocation: 2 }, { sourceLocation: 1 }]);
    const b = entity(2, "B", [{ sourceLocation: 1 }]);
    const graph = buildLineageGraph([a, b], a, "both", 3);
    expect(labels(graph)).toEqual(["A", "B"]);
    expect(graph.edges).toHaveLength(3);
    expect(graph.nodes.every((node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true);
  });

  it("marks missing and ambiguous references instead of resolving them to an arbitrary entity", () => {
    const duplicate = entity(0, "Duplicate");
    const current = entity(5, "Broken", [{ sourceLocation: 404 }, { sourceLocation: 0 }, {}]);
    const graph = buildLineageGraph([stage, duplicate, current], current);
    expect(graph.nodes.filter((node) => node.data.kind === "missing").map((node) => node.data.context).sort())
      .toEqual(["Ambiguous entity ID", "Entity not found", "Entity not found"]);
    expect(graph.nodes.every((node) => !node.data.relPath || node.data.relPath === current.relPath)).toBe(true);
  });

  it("supports retained locator references and excludes relationships from data flow", () => {
    const current = entity(8, "Legacy", [{ sourceLocation: stage.locator }]);
    current.content.relationships = [{ targetLocation: mart.content.id }];
    expect(labels(buildLineageGraph([...all, current], current))).toEqual(["Legacy", "Stage"]);
  });

  it("caps visible nodes and reports truncation for a large neighborhood", () => {
    const upstream = Array.from({ length: 100 }, (_, index) => entity(index + 10, `Source${index}`));
    const current = entity(1, "Target", upstream.map((source) => ({ sourceLocation: source.content.id })));
    const graph = buildLineageGraph([...upstream, current], current);
    expect(graph.nodes).toHaveLength(80);
    expect(graph.truncated).toBe(true);
    expect(graph.edges).toHaveLength(79);
    expect(buildLineageGraph(all, core).truncated).toBe(false);
  });

  it("keeps an isolated entity visible", () => {
    const current = entity(1, "Alone");
    const graph = buildLineageGraph([current], current);
    expect(labels(graph)).toEqual(["Alone"]);
    expect(graph.edges).toEqual([]);
  });

  it("adds incoming and outgoing relationships without treating them as source dependencies", () => {
    const current = entity(10, "Order");
    current.content.relationships = [{ targetLocation: 11, attributes: [{ sourceName: "CustomerId", targetName: "Id" }] }];
    const customer = entity(11, "Customer", [{ sourceLocation: 12 }]);
    const hidden = entity(12, "CustomerSource");
    customer.content.relationships = [{ targetLocation: 12 }];
    const incoming = entity(13, "Invoice");
    incoming.content.relationships = [{ targetLocation: 10 }];
    const graph = buildLineageGraph([current, customer, hidden, incoming], current, "downstream", 3, 80, { includeRelationships: true });
    expect(labels(graph)).toEqual(["Customer", "Invoice", "Order"]);
    expect(graph.edges.every((edge) => edge.kind === "relationship")).toBe(true);
    expect(graph.edges.find((edge) => edge.source === `entity:${current.relPath}`)?.mappings).toEqual([{ sourceName: "CustomerId", targetName: "Id" }]);
  });

  it("supports draft relationship fields and external relationships independently of sources", () => {
    const current = entity(1, "Order", [{ sourceLocation: 2 }]);
    current.content.relationships = [
      { targetModelEntityId: 2, mappings: [{ source: "CustomerId", target: "Id" }] },
      { dataSource: "CRM", targetLocation: "dbo.Customer", alias: "Billing customer", attributes: [{ sourceName: "BillingId", targetName: "Id" }] },
    ];
    const graph = buildLineageGraph([current, entity(2, "Customer")], current, "both", 1, 80, { includeSources: false, includeRelationships: true });
    expect(labels(graph)).toEqual(["Customer", "Order", "dbo.Customer"]);
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges.every((edge) => edge.kind === "relationship")).toBe(true);
    expect(graph.edges.find((edge) => edge.label === "Billing customer")?.mappings).toEqual([{ sourceName: "BillingId", targetName: "Id" }]);
    expect(graph.edges.find((edge) => edge.label === "Relationship")?.mappings).toEqual([{ sourceName: "CustomerId", targetName: "Id" }]);
  });

  it("keeps source and relationship edges between the same entities distinct and merges source mappings", () => {
    const current = entity(1, "Order", [
      { sourceLocation: 2, mapping: [{ sourceName: "Id", targetName: "CustomerId" }] },
      { sourceLocation: 2, mapping: [{ sourceName: "Name", targetName: "CustomerName" }] },
    ]);
    current.content.relationships = [{ targetLocation: 2 }];
    const graph = buildLineageGraph([current, entity(2, "Customer")], current, "both", 1, 80, { includeRelationships: true });
    expect(graph.edges.map((edge) => edge.kind).sort()).toEqual(["relationship", "source"]);
    expect(graph.edges.find((edge) => edge.kind === "source")?.mappings).toHaveLength(2);
  });

  it("marks missing relationship targets and respects the shared rendering cap", () => {
    const current = entity(1, "Order");
    current.content.relationships = [{ targetLocation: 404 }, { targetLocation: 405 }];
    const graph = buildLineageGraph([current], current, "both", 1, 2, { includeRelationships: true });
    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes.find((node) => node.data.kind === "missing")?.data.context).toBe("Entity not found");
    expect(graph.truncated).toBe(true);
    expect(graph.edges).toHaveLength(1);
  });

  it.each([null, undefined, "", "   "])("resolves internal relationships when dataSource is %s", (dataSource) => {
    const current = entity(10, "DimCustomer");
    const consumer = entity(20, "Customer", [{ sourceLocation: 10 }]);
    consumer.content.relationships = [{ dataSource, targetLocation: 3000 }];
    const target = entity(3000, "RelatedCustomer");
    const graph = buildLineageGraph([current, consumer, target], consumer, "both", 1, 80, { includeRelationships: true });
    expect(labels(graph)).toEqual(["Customer", "DimCustomer", "RelatedCustomer"]);
    expect(graph.nodes.every((node) => node.data.kind === "entity")).toBe(true);
    const relationship = graph.edges.find((edge) => edge.kind === "relationship");
    expect(relationship?.target).toBe(`entity:${target.relPath}`);
  });

  it("keeps real external numeric targets external even if an entity has that ID", () => {
    const current = entity(1, "Order");
    current.content.relationships = [{ dataSource: "CRM", targetLocation: "3000" }];
    const graph = buildLineageGraph([current, entity(3000, "Customer")], current, "both", 1, 80, { includeRelationships: true });
    expect(graph.nodes.find((node) => node.data.kind === "external")?.data).toMatchObject({ label: "3000", context: "CRM" });
    expect(labels(graph)).not.toContain("Customer");
  });

  it("resolves numeric sources with an empty dataSource and preserves explicit incomplete external sources", () => {
    const current = entity(1, "Order", [
      { dataSource: null, sourceLocation: 2 },
      { type: "external", dataSource: "", sourceLocation: "dbo.Order" },
    ]);
    const graph = buildLineageGraph([current, entity(2, "RawOrder")], current);
    expect(labels(graph)).toEqual(["Order", "RawOrder", "dbo.Order"]);
    expect(graph.nodes.find((node) => node.data.label === "RawOrder")?.data.kind).toBe("entity");
    expect(graph.nodes.find((node) => node.data.label === "dbo.Order")?.data.context).toBe("Missing data source");
  });
});
