import type { ModelEntity } from "../model-types";

export type LineageDirection = "both" | "upstream" | "downstream";
export type LineageNodeData = {
  label: string;
  context: string;
  kind: "entity" | "external" | "missing" | "group";
  relPath?: string;
  focused?: boolean;
  schema?: ModelEntity["content"]["attributes"];
  level?: number;
  groupId?: string;
  memberCount?: number;
};
export type LineageNode = {
  id: string;
  data: LineageNodeData;
  position: { x: number; y: number };
};
export type LineageMapping = { sourceName: string; targetName: string };
export type LineageEdge = { id: string; source: string; target: string; kind: "source" | "relationship"; label?: string; mappings: LineageMapping[]; members?: LineageEdge[] };
export type LineageIndex = {
  focus: string;
  nodes: Map<string, LineageNode>;
  edges: Map<string, LineageEdge>;
  incoming: Map<string, string[]>;
  outgoing: Map<string, string[]>;
  relationships: Map<string, LineageEdge[]>;
};
export type LineageViewOptions = {
  includeSources?: boolean;
  includeRelationships?: boolean;
  groupExpansion?: Readonly<Record<string, number>>;
  autoGroup?: boolean;
  maxEdges?: number;
};
export type LineageGraph = {
  nodes: LineageNode[];
  edges: LineageEdge[];
  truncated: boolean;
  omittedNodes: number;
  omittedEdges: number;
};

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

/** Index loaded metadata once; filters and folder grouping only query this index. */
export function createLineageIndex(entities: ModelEntity[], current: ModelEntity): LineageIndex {
  // The open editor owns the latest draft of the current entity.
  const all = [...entities.filter((entity) => entity.relPath !== current.relPath), current];
  const byId = new Map<string, ModelEntity[]>();
  const byPath = new Map<string, ModelEntity>();
  const nodes = new Map<string, LineageNode>();
  const edges = new Map<string, LineageEdge>();
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  const relationships = new Map<string, LineageEdge[]>();
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
      if (!incoming.has(target)) incoming.set(target, []);
      if (!outgoing.has(sourceId)) outgoing.set(sourceId, []);
      incoming.get(target)!.push(sourceId);
      outgoing.get(sourceId)!.push(target);
    }
  }

  for (const entity of all) {
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
      for (const endpoint of new Set([owner, target])) {
        if (!relationships.has(endpoint)) relationships.set(endpoint, []);
        relationships.get(endpoint)!.push(edges.get(id)!);
      }
    }
  }

  return { focus, nodes, edges, incoming, outgoing, relationships };
}

/** Depth controls source traversal; relationships connect only to the current entity. */
export function selectLineageGraph(index: LineageIndex, direction: LineageDirection = "both", depth = 1, maxNodes = 80, options: LineageViewOptions = {}): LineageGraph {
  const { focus, nodes, edges, incoming, outgoing, relationships } = index;
  const budget = Math.max(1, maxNodes);
  const levels = new Map<string, number>([[focus, 0]]);
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

  // Capture the source scope before adding direct relationships, so relationship
  // neighbors never become traversal anchors or add unrelated source connections.
  const sourceScope = new Map(levels);
  const visibleRelationships = options.includeRelationships ? relationships.get(focus) ?? [] : [];
  for (const edge of visibleRelationships) {
    const neighbor = edge.source === focus ? edge.target : edge.source;
    if (!levels.has(neighbor)) levels.set(neighbor, edge.source === focus ? 1 : -1);
  }

  const rawEdges: LineageEdge[] = [];
  if (options.includeSources !== false) for (const target of sourceScope.keys()) {
    for (const source of incoming.get(target) ?? []) if (sourceScope.has(source)) rawEdges.push(edges.get(JSON.stringify([source, target]))!);
  }
  rawEdges.push(...visibleRelationships);
  const renderIds = new Map<string, string>();
  const candidates = new Map<string, LineageNode>();
  const buckets = new Map<string, string[]>();
  for (const [id, level] of levels) {
    const node = nodes.get(id)!;
    const key = `folder:${JSON.stringify([level, node.data.context])}`;
    if (!node.data.focused && node.data.kind === "entity" && options.autoGroup && levels.size > 40) {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(id);
    }
  }
  for (const [groupId, members] of buckets) {
    if (members.length < 4) continue;
    members.sort((a, b) => nodes.get(a)!.data.label.localeCompare(nodes.get(b)!.data.label) || a.localeCompare(b));
    const shown = Math.max(0, options.groupExpansion?.[groupId] ?? 0);
    const hidden = members.slice(shown);
    if (!hidden.length) continue;
    const first = nodes.get(hidden[0])!;
    candidates.set(groupId, {
      id: groupId, position: { x: 0, y: 0 },
      data: { kind: "group", label: first.data.context.split(" / ").at(-1) || "Model", context: first.data.context, level: levels.get(hidden[0]), groupId, memberCount: hidden.length },
    });
    for (const id of hidden) renderIds.set(id, groupId);
  }
  for (const [id, level] of levels) {
    if (renderIds.has(id)) continue;
    renderIds.set(id, id);
    const node = nodes.get(id)!;
    candidates.set(id, { ...node, data: { ...node.data, level }, position: { x: level * 360, y: 0 } });
  }
  const ranked = [...candidates.values()].sort((a, b) => Number(!!b.data.focused) - Number(!!a.data.focused)
    || Math.abs(a.data.level ?? 0) - Math.abs(b.data.level ?? 0)
    || Number(!!b.data.groupId) - Number(!!a.data.groupId)
    || a.id.localeCompare(b.id));
  const retained = new Set(ranked.slice(0, budget).map((node) => node.id));
  const groupedEdges = new Map<string, LineageEdge>();
  for (const edge of rawEdges) {
    const source = renderIds.get(edge.source)!;
    const target = renderIds.get(edge.target)!;
    if (!retained.has(source) || !retained.has(target)) continue;
    if (source === target && source !== edge.source) continue;
    const grouped = source !== edge.source || target !== edge.target;
    const id = grouped ? `grouped:${JSON.stringify([edge.kind, source, target])}` : edge.id;
    if (groupedEdges.has(id)) groupedEdges.get(id)!.members!.push(edge);
    else groupedEdges.set(id, { ...edge, id, source, target, ...(grouped ? { members: [edge], mappings: [] } : {}) });
  }
  const allVisibleEdges = [...groupedEdges.values()].sort((a, b) => Number(b.source === focus || b.target === focus) - Number(a.source === focus || a.target === focus)
    || Number(a.kind === "relationship") - Number(b.kind === "relationship") || a.id.localeCompare(b.id));
  // Folder summaries can still form a dense mesh. Keep a focused view sparse
  // enough to inspect, prioritizing the current entity before other context.
  const edgeBudget = Math.max(1, Math.min(options.maxEdges ?? 160, options.autoGroup ? Math.max(24, retained.size * 2) : Infinity));
  const boundedEdges = allVisibleEdges.slice(0, edgeBudget);
  const connected = new Set([focus]);
  for (let changed = true; changed;) {
    changed = false;
    for (const edge of boundedEdges) {
      if (connected.has(edge.source) === connected.has(edge.target)) continue;
      connected.add(edge.source);
      connected.add(edge.target);
      changed = true;
    }
  }
  const visibleEdges = boundedEdges.filter((edge) => connected.has(edge.source) && connected.has(edge.target));
  const visibleNodes = ranked.slice(0, budget).filter((node) => connected.has(node.id));
  const columns = new Map<number, LineageNode[]>();
  for (const node of visibleNodes) {
    const level = node.data.level ?? 0;
    columns.set(level, [...(columns.get(level) ?? []), node]);
  }
  for (const [level, column] of columns) {
    column.sort((a, b) => a.data.label.localeCompare(b.data.label) || a.id.localeCompare(b.id));
    column.forEach((node, index) => {
      node.position = { x: level * 310, y: (index - (column.length - 1) / 2) * 112 };
    });
  }
  const omittedNodes = ranked.length - visibleNodes.length;
  const omittedEdges = allVisibleEdges.length - visibleEdges.length;
  return { nodes: visibleNodes, edges: visibleEdges, truncated: omittedNodes > 0 || omittedEdges > 0, omittedNodes, omittedEdges };
}

export function buildLineageGraph(entities: ModelEntity[], current: ModelEntity, direction: LineageDirection = "both", depth = 1, maxNodes = 80, options: LineageViewOptions = {}): LineageGraph {
  return selectLineageGraph(createLineageIndex(entities, current), direction, depth, maxNodes, options);
}
