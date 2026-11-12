import type { ELK, ElkNode, ElkPoint, ElkPort } from "elkjs/lib/elk-api";
import type { LineageGraph } from "./buildLineageGraph";

export type PortSide = "WEST" | "EAST" | "NORTH" | "SOUTH";
export type LineagePort = { id: string; type: "source" | "target"; side: PortSide; x: number; y: number };
export type LayoutNode = { id: string; position: ElkPoint; width: number; height: number; ports: LineagePort[] };
export type LayoutEdge = { id: string; sourceHandle: string; targetHandle: string; sections: ElkPoint[][] };
export type LineageLayout = { nodes: LayoutNode[]; edges: LayoutEdge[]; bounds: { x: number; y: number; width: number; height: number }; durationMs: number };

export function schemaRowHeight(attribute: Record<string, unknown>): number {
  const type = attribute.dataType as Record<string, unknown> | undefined;
  return attribute.isBusinessKey || attribute.history || type?.nullable === true ? 48 : 30;
}

export function prepareLineageLayout(graph: LineageGraph, schemaOpen: boolean): ElkNode {
  const ports = new Map<string, ElkPort[]>(graph.nodes.map((node) => [node.id, []]));
  const layoutEdges = graph.edges.map((edge, index) => {
    const sourcePort = `port-${index}-source`;
    const targetPort = `port-${index}-target`;
    ports.get(edge.source)!.push({ id: sourcePort, width: 0, height: 0, layoutOptions: { "elk.port.side": edge.kind === "source" ? "EAST" : "SOUTH" } });
    ports.get(edge.target)!.push({ id: targetPort, width: 0, height: 0, layoutOptions: { "elk.port.side": edge.kind === "source" ? "WEST" : "NORTH" } });
    return { id: edge.id, sources: [sourcePort], targets: [targetPort], layoutOptions: { "elk.layered.priority.direction": edge.kind === "source" ? "100" : "0" } };
  });
  const minimumLevel = Math.min(0, ...graph.nodes.map((node) => node.data.level ?? 0));
  return {
    id: "lineage",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.randomSeed": "42",
      "elk.partitioning.activate": "true",
      "elk.spacing.nodeNode": "48",
      "elk.spacing.edgeNode": "20",
      "elk.spacing.edgeEdge": "16",
      "elk.layered.spacing.nodeNodeBetweenLayers": "110",
      "elk.layered.spacing.edgeNodeBetweenLayers": "24",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.mergeEdges": "false",
      "elk.padding": "[top=90,left=30,bottom=70,right=30]",
    },
    children: graph.nodes.map((node) => {
      const nodePorts = ports.get(node.id)!;
      const count = (side: PortSide) => nodePorts.filter((port) => port.layoutOptions?.["elk.port.side"] === side).length;
      const schemaHeight = schemaOpen && node.data.focused
        ? Math.min(280, (node.data.schema ?? []).reduce((sum, attribute) => sum + schemaRowHeight(attribute), 0) || 30) + 4 : 0;
      return {
        id: node.id,
        width: Math.max(270, Math.max(count("NORTH"), count("SOUTH")) * 10 + 24),
        height: Math.max(node.data.focused ? 100 + schemaHeight : 98, Math.max(count("WEST"), count("EAST")) * 10 + 24),
        ports: nodePorts,
        layoutOptions: {
          "elk.portConstraints": "FIXED_SIDE",
          "elk.partitioning.partition": String((node.data.level ?? 0) - minimumLevel),
        },
      };
    }),
    edges: layoutEdges,
  };
}

export async function layoutLineageGraph(elk: Pick<ELK, "layout">, input: ElkNode): Promise<LineageLayout> {
  const started = performance.now();
  const result = await elk.layout(input);
  const portOwners = new Map<string, LineagePort>();
  const nodes = (result.children ?? []).map((node): LayoutNode => {
    if (![node.x, node.y, node.width, node.height].every((value) => typeof value === "number" && Number.isFinite(value))) throw new Error("Invalid layout coordinates");
    const nodePorts = (node.ports ?? []).map((port): LineagePort => {
      const type = port.id.endsWith("-source") ? "source" : "target";
      const mapped: LineagePort = { id: port.id, type, side: port.layoutOptions!["elk.port.side"] as PortSide, x: port.x ?? 0, y: port.y ?? 0 };
      portOwners.set(port.id, mapped);
      return mapped;
    });
    return { id: node.id, position: { x: node.x!, y: node.y! }, width: node.width!, height: node.height!, ports: nodePorts };
  });
  const edges = (result.edges ?? []).map((edge): LayoutEdge => {
    const clear = (a: ElkPoint, b: ElkPoint) => nodes.every((node) => a.x === b.x
      ? !(a.x > node.position.x + 0.01 && a.x < node.position.x + node.width - 0.01 && Math.max(a.y, b.y) > node.position.y + 0.01 && Math.min(a.y, b.y) < node.position.y + node.height - 0.01)
      : !(a.y > node.position.y + 0.01 && a.y < node.position.y + node.height - 0.01 && Math.max(a.x, b.x) > node.position.x + 0.01 && Math.min(a.x, b.x) < node.position.x + node.width - 0.01));
    const sections = (edge.sections ?? []).map((section) => {
      const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
      const routed = [points[0]];
      for (const point of points.slice(1)) {
        const previous = routed.at(-1)!;
        // ELK self loops may contain tiny diagonal port adjustments. Keep their
        // route, inserting an obstacle-free elbow rather than drawing a diagonal.
        if (previous.x !== point.x && previous.y !== point.y) {
          const corner = [{ x: point.x, y: previous.y }, { x: previous.x, y: point.y }].find((candidate) => clear(previous, candidate) && clear(candidate, point));
          if (!corner) throw new Error("No clear port adjustment");
          routed.push(corner);
        }
        routed.push(point);
      }
      return routed;
    });
    if (!sections.length || sections.flat().some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error("Missing edge routing");
    if (!portOwners.has(edge.sources[0]) || !portOwners.has(edge.targets[0])) throw new Error("Unknown edge port");
    return { id: edge.id, sourceHandle: edge.sources[0], targetHandle: edge.targets[0], sections };
  });
  return { nodes, edges, bounds: { x: 0, y: 0, width: result.width ?? 1, height: result.height ?? 1 }, durationMs: performance.now() - started };
}

export function routedEdgePath(sections: ElkPoint[][]): string {
  return sections.map((points) => points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ")).join(" ");
}
