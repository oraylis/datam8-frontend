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
});
