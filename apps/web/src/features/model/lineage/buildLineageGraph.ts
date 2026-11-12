import type { ModelEntity } from "../model-types";

export type LineageDirection = "both" | "upstream" | "downstream";
export type LineageNodeData = {
  label: string;
  context: string;
  kind: "entity" | "external" | "missing";
  relPath?: string;
  focused?: boolean;
  schema?: ModelEntity["content"]["attributes"];
};
export type LineageNode = {
  id: string;
  data: LineageNodeData;
  position: { x: number; y: number };
};
export type LineageMapping = { sourceName: string; targetName: string };
export type LineageEdge = { id: string; source: string; target: string; kind: "source" | "relationship"; label?: string; mappings: LineageMapping[] };

function readMappings(value: unknown): LineageMapping[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const sourceName = item?.sourceName ?? item?.source;
    const targetName = item?.targetName ?? item?.target;
    return typeof sourceName === "string" && typeof targetName === "string" && sourceName && targetName ? [{ sourceName, targetName }] : [];
  });
}

const entityKey = (entity: ModelEntity) => `entity:${entity.relPath}`;
const normalizePath = (path: string) => path.replace(/\\/g, "/").replace(/^\//, "").replace(/\.json$/i, "");

/** Design-time source lineage with a separate, non-transitive relationship layer. */
export function buildLineageGraph(
  entities: ModelEntity[],
  current: ModelEntity,
  direction: LineageDirection = "both",
  depth = 1,
  maxNodes = 80,
  options: { includeSources?: boolean; includeRelationships?: boolean } = {},
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
        schema: entity.content.attributes,
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
      const dataSource = typeof source.dataSource === "string" ? source.dataSource.trim() : "";
      const external = !!dataSource || source.type === "external";
      let sourceId: string;
      if (external) {
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
      const mappings = readMappings(source.mapping);
      const existing = edges.get(id);
      if (existing) {
        existing.mappings.push(...mappings);
        continue;
      }
      edges.set(id, { id, source: sourceId, target, kind: "source", mappings });
      incoming.set(target, [...(incoming.get(target) ?? []), sourceId]);
      outgoing.set(sourceId, [...(outgoing.get(sourceId) ?? []), target]);
    }
  }

  if (options.includeRelationships) for (const entity of all) {
    for (const [index, relationship] of (entity.content.relationships ?? []).entries()) {
      if (!relationship || typeof relationship !== "object") continue;
      const owner = entityKey(entity);
      const location = relationship.targetModelEntityId ?? relationship.targetLocation;
      const reference = typeof location === "number" || typeof location === "string" ? String(location).trim() : "";
      // Optional dataSource is null on internal relationships in loaded API models.
      const dataSource = typeof relationship.dataSource === "string" ? relationship.dataSource.trim() : "";
      const external = !!dataSource;
      let target: string;
      if (external) {
        target = `external:${JSON.stringify([dataSource, reference])}`;
        if (!nodes.has(target)) nodes.set(target, {
          id: target, position: { x: 0, y: 0 },
          data: { label: reference || "Missing target location", context: dataSource || "Missing data source", kind: "external" },
        });
      } else {
        const matches = byId.get(reference);
        const resolved = matches?.length === 1 ? matches[0] : !matches ? byPath.get(normalizePath(reference)) : undefined;
        target = resolved ? entityKey(resolved) : `missing-relationship:${JSON.stringify([owner, reference])}`;
        if (!resolved) nodes.set(target, {
          id: target, position: { x: 0, y: 0 },
          data: { label: reference ? `Entity ${reference}` : "Missing target reference", context: matches ? "Ambiguous entity ID" : "Entity not found", kind: "missing" },
        });
      }
      const id = `relationship:${JSON.stringify([owner, target, index])}`;
      edges.set(id, {
        id, source: owner, target, kind: "relationship",
        label: typeof relationship.alias === "string" && relationship.alias ? relationship.alias : "Relationship",
        mappings: readMappings(relationship.mappings ?? relationship.attributes),
      });
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
  if (options.includeSources !== false) {
    if (direction !== "downstream") walk(incoming, -1);
    if (direction !== "upstream") walk(outgoing, 1);
  }

  // Relationships add immediate context around the source graph, never new source traversal paths.
  const sourceScope = new Map(levels);
  const visibleRelationshipIds = new Set<string>();
  for (const edge of edges.values()) {
    if (edge.kind !== "relationship") continue;
    const anchor = sourceScope.has(edge.source) ? edge.source : sourceScope.has(edge.target) ? edge.target : null;
    if (!anchor) continue;
    const neighbor = anchor === edge.source ? edge.target : edge.source;
    if (!levels.has(neighbor)) {
      if (levels.size >= Math.max(1, maxNodes)) { truncated = true; continue; }
      const anchorLevel = sourceScope.get(anchor)!;
      levels.set(neighbor, anchorLevel === 0 ? (anchor === edge.source ? 1 : -1) : anchorLevel + Math.sign(anchorLevel));
    }
    visibleRelationshipIds.add(edge.id);
  }

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
  const visibleEdges = [...edges.values()].filter((edge) => edge.kind === "relationship"
    ? visibleRelationshipIds.has(edge.id)
    : options.includeSources !== false && sourceScope.has(edge.source) && sourceScope.has(edge.target));
  return { nodes: visibleNodes, edges: visibleEdges, truncated };
}
