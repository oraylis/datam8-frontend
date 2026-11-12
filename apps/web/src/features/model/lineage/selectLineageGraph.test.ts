import { describe, expect, it } from "vitest";
import { createLineageIndex, selectLineageGraph } from "./buildLineageGraph";
import { createDenseLineage, createLargeLineage, lineageEntity } from "./testing/fixtures";

describe("bounded lineage scope", () => {
  it("controls source traversal exclusively through direction and depth", () => {
    const entities = createLargeLineage(8);
    const index = createLineageIndex(entities, entities[3]);
    const id = (number: number) => `entity:${entities[number].relPath}`;
    const initial = selectLineageGraph(index);
    expect(initial.nodes.map((node) => node.id).sort()).toEqual([id(2), id(3), id(4)].sort());
    expect(selectLineageGraph(index, "both", 2).nodes.map((node) => node.id).sort()).toEqual([id(1), id(2), id(3), id(4), id(5)].sort());
    expect(selectLineageGraph(index, "downstream", 3).nodes.map((node) => node.id).sort()).toEqual([id(3), id(4), id(5), id(6)].sort());
    expect(selectLineageGraph(index)).toEqual(initial);
  });

  it("keeps only relationships incident to the focus, including when both other endpoints are visible", () => {
    const entities = createLargeLineage(6);
    entities[2].content.relationships = [{ targetLocation: 5 }];
    entities[1].content.relationships = [{ targetLocation: 2 }, { targetLocation: 3 }, { targetLocation: 4 }];
    entities[5].content.relationships = [{ targetLocation: 4 }];
    const index = createLineageIndex(entities, entities[2]);
    for (const depth of [1, 2, 3]) {
      const graph = selectLineageGraph(index, "both", depth, 80, { includeRelationships: true });
      const relationships = graph.edges.filter((edge) => edge.kind === "relationship");
      expect(relationships).toHaveLength(2);
      expect(relationships.every((edge) => edge.source === index.focus || edge.target === index.focus)).toBe(true);
    }
    const relationshipsOnly = selectLineageGraph(index, "both", 3, 80, { includeSources: false, includeRelationships: true });
    expect(relationshipsOnly.nodes.map((node) => node.data.label).sort()).toEqual(["Entity1", "Entity2", "Entity5"]);
    expect(selectLineageGraph(index, "both", 3, 80, { includeRelationships: false }).edges.every((edge) => edge.kind === "source")).toBe(true);
  });

  it("summarizes folders, reveals members in pages, and keeps real mappings behind grouped edges", () => {
    const sources = Array.from({ length: 60 }, (_, number) => lineageEntity(number, `Source${String(number).padStart(2, "0")}`, "Stage/CRM"));
    const current = lineageEntity(100, "Customer", "Core/MasterData");
    current.content.sources = sources.map((source) => ({ sourceLocation: source.content.id, mapping: [{ sourceName: "Id", targetName: "CustomerId" }] }));
    const entities = [...sources, current];
    const snapshot = JSON.stringify(entities);
    const index = createLineageIndex(entities, current);
    const graph = selectLineageGraph(index, "both", 1, 80, { autoGroup: true });
    expect(graph.nodes).toHaveLength(2);
    const group = graph.nodes.find((node) => node.data.kind === "group")!;
    expect(group.data).toMatchObject({ memberCount: 60, context: "Stage / CRM" });
    expect(graph.edges[0].members).toHaveLength(60);
    expect(graph.edges[0].mappings).toEqual([]);
    expect(graph.edges[0].members?.[0].mappings).toEqual([{ sourceName: "Id", targetName: "CustomerId" }]);
    expect(graph.truncated).toBe(false);
    const page = selectLineageGraph(index, "both", 1, 80, { autoGroup: true, groupExpansion: { [group.id]: 12 } });
    expect(page.nodes).toHaveLength(14);
    expect(page.nodes.find((node) => node.id === group.id)?.data.memberCount).toBe(48);
    const all = selectLineageGraph(index, "both", 1, 80, { autoGroup: true, groupExpansion: { [group.id]: 60 } });
    expect(all.nodes).toHaveLength(61);
    expect(all.nodes.some((node) => node.data.kind === "group")).toBe(false);
    expect(JSON.stringify(entities)).toBe(snapshot);
    expect(selectLineageGraph(index, "both", 1, 80, { autoGroup: true })).toEqual(graph);
  });

  it("caps dense views by nodes and edges, preserves focus connectivity and deterministic ordering", () => {
    const entities = createDenseLineage(100);
    const index = createLineageIndex(entities, entities[99]);
    const graph = selectLineageGraph(index, "both", 3, 80, { includeRelationships: true, maxEdges: 160 });
    expect(graph.nodes.length).toBeLessThanOrEqual(80);
    expect(graph.edges).toHaveLength(160);
    expect(graph.truncated).toBe(true);
    const reachable = new Set([index.focus]);
    for (let round = 0; round < graph.nodes.length; round++) for (const edge of graph.edges) {
      if (reachable.has(edge.source) || reachable.has(edge.target)) { reachable.add(edge.source); reachable.add(edge.target); }
    }
    expect(reachable.size).toBe(graph.nodes.length);
    expect(selectLineageGraph(index, "both", 3, 80, { includeRelationships: true, maxEdges: 160 })).toEqual(graph);
    const grouped = selectLineageGraph(index, "both", 1, 80, { includeRelationships: true, autoGroup: true });
    expect(grouped.edges.length).toBeLessThanOrEqual(Math.max(24, grouped.nodes.length * 2));
    expect(grouped.edges.filter((edge) => edge.kind === "relationship").every((edge) => edge.source === index.focus || edge.target === index.focus)).toBe(true);
  });

  it("indexes 10,000 entities once and reuses adjacency for repeated focused queries", () => {
    const entities = createLargeLineage(10_000);
    const started = performance.now();
    const index = createLineageIndex(entities, entities[5000]);
    const indexed = performance.now();
    for (let count = 0; count < 100; count++) {
      const graph = selectLineageGraph(index, count % 2 ? "upstream" : "both", count % 3 + 1, 80, { includeRelationships: true, autoGroup: true });
      expect(graph.nodes.length).toBeLessThanOrEqual(80);
      expect(graph.edges.length).toBeLessThanOrEqual(160);
      expect(graph.nodes.some((node) => node.id === index.focus)).toBe(true);
    }
    console.log(`10,000 entities: index ${Math.round(indexed - started)} ms; 100 focused queries ${Math.round(performance.now() - indexed)} ms`);
  });
});
