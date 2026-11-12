import type { ModelEntity } from "../model-types";

export type LineageDirection = "both" | "upstream" | "downstream";
export type LineageNodeData = {
  label: string;
  context: string;
  kind: "entity" | "external" | "missing";
  relPath?: string;
  focused?: boolean;
};
export type LineageNode = {
  id: string;
  data: LineageNodeData;
  position: { x: number; y: number };
};
export type LineageEdge = { id: string; source: string; target: string };

const entityKey = (entity: ModelEntity) => `entity:${entity.relPath}`;
const normalizePath = (path: string) => path.replace(/\\/g, "/").replace(/^\//, "").replace(/\.json$/i, "");

/** Design-time source lineage only; relationships are not data-flow dependencies. */
export function buildLineageGraph(
  entities: ModelEntity[],
  current: ModelEntity,
  direction: LineageDirection = "both",
  depth = 1,
  maxNodes = 80,
) {
  // The open editor owns the latest draft of the current entity.
  const all = [...entities.filter((entity) => entity.relPath !== current.relPath), current];
  const byId = new Map<string, ModelEntity[]>();
  const byPath = new Map<string, ModelEntity>();
  const nodes = new Map<string, LineageNode>();
  const edges = new Map<string, LineageEdge>();
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  const focus = entityKey(current);

  for (const entity of all) {
    if (entity.content.id !== undefined && entity.content.id !== null) {
      const id = String(entity.content.id);
      byId.set(id, [...(byId.get(id) ?? []), entity]);
    }
    byPath.set(normalizePath(entity.relPath), entity);
    byPath.set(normalizePath(entity.locator), entity);
    nodes.set(entityKey(entity), {
      id: entityKey(entity),
      data: {
        label: entity.content.name || entity.name,
        context: entity.relPath.replace(/\\/g, "/").split("/").slice(1, -1).join(" / ") || "Model",
        kind: "entity",
        relPath: entity.relPath,
        focused: entityKey(entity) === focus,
      },
      position: { x: 0, y: 0 },
    });
  }

  for (const entity of all) {
    const target = entityKey(entity);
    for (const source of entity.content.sources ?? []) {
      if (!source || typeof source !== "object") continue;
      const location = source.sourceLocation;
      const reference = typeof location === "number" || typeof location === "string" ? String(location).trim() : "";
      const external = Object.prototype.hasOwnProperty.call(source, "dataSource") || source.type === "external";
      let sourceId: string;
      if (external) {
        const dataSource = typeof source.dataSource === "string" ? source.dataSource : "";
        sourceId = `external:${JSON.stringify([dataSource, reference])}`;
        nodes.set(sourceId, {
          id: sourceId,
          data: { label: reference || "Missing source location", context: dataSource || "Missing data source", kind: "external" },
          position: { x: 0, y: 0 },
        });
      } else {
        const matches = byId.get(reference);
        const resolved = matches?.length === 1 ? matches[0] : !matches ? byPath.get(normalizePath(reference)) : undefined;
        if (resolved) {
          sourceId = entityKey(resolved);
        } else {
          sourceId = `missing:${JSON.stringify([target, reference])}`;
          nodes.set(sourceId, {
            id: sourceId,
            data: {
              label: reference ? `Entity ${reference}` : "Missing source reference",
              context: matches ? "Ambiguous entity ID" : "Entity not found",
              kind: "missing",
            },
            position: { x: 0, y: 0 },
          });
        }
      }
      const id = JSON.stringify([sourceId, target]);
      if (edges.has(id)) continue;
      edges.set(id, { id, source: sourceId, target });
      incoming.set(target, [...(incoming.get(target) ?? []), sourceId]);
      outgoing.set(sourceId, [...(outgoing.get(sourceId) ?? []), target]);
    }
  }

  // Independent breadth-first walks keep upstream/downstream scope precise and terminate on cycles.
  const levels = new Map<string, number>([[focus, 0]]);
  let truncated = false;
  const walk = (adjacency: Map<string, string[]>, sign: number) => {
    const visited = new Set([focus]);
    let frontier = [focus];
    for (let distance = 1; distance <= Math.max(1, Math.min(3, depth)) && frontier.length; distance++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const neighbor of adjacency.get(id) ?? []) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          if (!levels.has(neighbor)) {
            if (levels.size >= Math.max(1, maxNodes)) {
              truncated = true;
              continue;
            }
            levels.set(neighbor, sign * distance);
          }
          next.push(neighbor);
        }
      }
      frontier = next;
    }
  };
  if (direction !== "downstream") walk(incoming, -1);
  if (direction !== "upstream") walk(outgoing, 1);

  const columns = new Map<number, LineageNode[]>();
  for (const [id, level] of levels) {
    const node = nodes.get(id)!;
    columns.set(level, [...(columns.get(level) ?? []), node]);
  }
  for (const [level, column] of columns) {
    column.sort((a, b) => a.data.label.localeCompare(b.data.label) || a.id.localeCompare(b.id));
    column.forEach((node, index) => {
      node.position = { x: level * 310, y: (index - (column.length - 1) / 2) * 112 };
    });
  }
  const visibleNodes = [...columns.values()].flat();
  const visibleEdges = [...edges.values()].filter((edge) => levels.has(edge.source) && levels.has(edge.target));
  return { nodes: visibleNodes, edges: visibleEdges, truncated };
}
