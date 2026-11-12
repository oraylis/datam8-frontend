import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";
import { buildLineageGraph, createLineageIndex, selectLineageGraph } from "./buildLineageGraph";
import { layoutLineageGraph, prepareLineageLayout, type LineageLayout } from "./layoutLineageGraph";
import { createDenseLineage, createMixedLineage, lineageEntity } from "./testing/fixtures";

function assertGeometry(layout: LineageLayout) {
  for (const a of layout.nodes) for (const b of layout.nodes) {
    if (a.id >= b.id) continue;
    const overlap = a.position.x < b.position.x + b.width && a.position.x + a.width > b.position.x
      && a.position.y < b.position.y + b.height && a.position.y + a.height > b.position.y;
    expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
  }
  for (const edge of layout.edges) for (const points of edge.sections) for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const vertical = Math.abs(a.x - b.x) < 0.000001;
    expect(vertical || Math.abs(a.y - b.y) < 0.000001, `Non-orthogonal segment ${edge.id}: ${JSON.stringify([a, b])}`).toBe(true);
    for (const node of layout.nodes) {
      const inset = 0.1;
      const intersects = vertical
        ? a.x > node.position.x + inset && a.x < node.position.x + node.width - inset && Math.max(a.y, b.y) > node.position.y + inset && Math.min(a.y, b.y) < node.position.y + node.height - inset
        : a.y > node.position.y + inset && a.y < node.position.y + node.height - inset && Math.max(a.x, b.x) > node.position.x + inset && Math.min(a.x, b.x) < node.position.x + node.width - inset;
      expect(intersects, `${edge.id} passes through ${node.id}`).toBe(false);
    }
  }
}

describe("ELK lineage routing", () => {
  it("routes branching sources and backward relationships around cards with separate ports", async () => {
    const entities = createMixedLineage();
    const graph = buildLineageGraph(entities, entities[3], "both", 2, 80, { includeRelationships: true });
    const layout = await layoutLineageGraph(new ELK(), prepareLineageLayout(graph, false));
    assertGeometry(layout);
    expect(layout.edges).toHaveLength(graph.edges.length);
    const current = layout.nodes.find((node) => node.id === `entity:${entities[3].relPath}`)!;
    const sourcePorts = current.ports.filter((port) => port.type === "target" && port.side === "WEST");
    expect(sourcePorts).toHaveLength(3);
    expect(new Set(sourcePorts.map((port) => `${port.x},${port.y}`)).size).toBe(3);
    expect(current.ports.some((port) => port.side === "NORTH")).toBe(true);
  });

  it("recalculates routes for the expanded schema and supports cycles, parallel edges and self loops", async () => {
    const a = lineageEntity(1, "A");
    const b = lineageEntity(2, "B");
    a.content.sources = [{ sourceLocation: 1 }, { sourceLocation: 2 }];
    b.content.sources = [{ sourceLocation: 1 }];
    a.content.relationships = [{ targetLocation: 2 }, { targetLocation: 2 }, { targetLocation: 1 }];
    a.content.attributes = Array.from({ length: 20 }, (_, index) => ({ name: `Column${index}`, dataType: { type: "int" } }));
    const graph = buildLineageGraph([a, b], a, "both", 3, 80, { includeRelationships: true });
    const layout = await layoutLineageGraph(new ELK(), prepareLineageLayout(graph, true));
    assertGeometry(layout);
    const collapsedHeight = prepareLineageLayout(graph, false).children!.find((node) => node.id === `entity:${a.relPath}`)!.height!;
    expect(layout.nodes.find((node) => node.id === `entity:${a.relPath}`)!.height).toBeGreaterThanOrEqual(collapsedHeight + 280);
  });

  it("lays out a bounded dense graph with finite routes", async () => {
    const entities = createDenseLineage();
    const graph = buildLineageGraph(entities, entities.at(-1)!, "both", 1, 80, { includeRelationships: true, maxEdges: 160 });
    const layout = await layoutLineageGraph(new ELK(), prepareLineageLayout(graph, false));
    assertGeometry(layout);
    expect(layout.nodes.length).toBeLessThanOrEqual(80);
    expect(layout.edges.length).toBeLessThanOrEqual(160);
    console.log(`Dense lineage: ${layout.nodes.length} nodes, ${layout.edges.length} edges, ${Math.round(layout.durationMs)} ms`);
  }, 15_000);

  it("routes dense folder summaries and an expanded group", async () => {
    const entities = createDenseLineage(100);
    const index = createLineageIndex(entities, entities[99]);
    const initial = selectLineageGraph(index, "both", 1, 80, { includeRelationships: true, autoGroup: true });
    const group = initial.nodes.find((node) => node.data.groupId)!;
    const graph = selectLineageGraph(index, "both", 1, 80, { includeRelationships: true, autoGroup: true, groupExpansion: { [group.id]: 12 } });
    const layout = await layoutLineageGraph(new ELK(), prepareLineageLayout(graph, false));
    assertGeometry(layout);
    console.log(`Expanded dense folders: ${layout.nodes.length} nodes, ${layout.edges.length} edges, ${Math.round(layout.durationMs)} ms`);
  }, 20_000);
});
