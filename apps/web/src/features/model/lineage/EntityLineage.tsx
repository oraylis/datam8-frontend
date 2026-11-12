import { memo, useEffect, useMemo, useState } from "react";
import { Background, BaseEdge, Controls, getViewportForBounds, Handle, MarkerType, Panel, Position, ReactFlow, useReactFlow, useStore, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";
import { useTheme } from "@datam8/ui/theme";
import { FormSelect } from "@datam8/ui";
import type { ModelEntity } from "../model-types";
import { createLineageIndex, selectLineageGraph, type LineageDirection, type LineageEdge, type LineageNodeData } from "./buildLineageGraph";
import { routedEdgePath, type LineageLayout, type LineagePort, type PortSide } from "./layoutLineageGraph";
import { useLineageLayout } from "./useLineageLayout";
import "@xyflow/react/dist/style.css";
import "./lineage.css";

type EntityNode = Node<LineageNodeData & {
  onOpen?: () => void;
  schemaOpen?: boolean;
  onToggleSchema?: () => void;
  selectedAttribute?: string | null;
  onSelectAttribute?: (name: string) => void;
  ports: LineagePort[];
  highlighted?: boolean;
  onHighlight?: () => void;
  onShowEntities?: () => void;
  groupExpansionDisabled?: boolean;
}, "lineage">;

type RoutedEdge = Edge<{ path: string }, "routed">;
const portPositions: Record<PortSide, Position> = { WEST: Position.Left, EAST: Position.Right, NORTH: Position.Top, SOUTH: Position.Bottom };

const RoutedLineageEdge = memo(({ id, data, style, markerEnd }: EdgeProps<RoutedEdge>) => <BaseEdge id={id} path={data?.path ?? ""} style={style} markerEnd={markerEnd} />);

function FitLineage({ bounds }: { bounds: LineageLayout["bounds"] }) {
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const { setViewport, viewportInitialized } = useReactFlow();
  useEffect(() => {
    if (viewportInitialized && width && height) void setViewport(getViewportForBounds(bounds, width, height, 0.03, 1, 0.05));
  }, [bounds, viewportInitialized, width, height, setViewport]);
  return null;
}

function LineageNode({ data }: NodeProps<EntityNode>) {
  const status = data.kind === "group" ? `${data.memberCount} entities` : data.kind === "external" ? "External source" : data.kind === "missing" ? "Unresolved reference" : null;
  const canOpen = !!data.onOpen && !data.focused;
  return (
    <div className={`lineage-node lineage-node--${data.kind} ${data.focused ? "lineage-node--focus" : ""} ${data.highlighted ? "lineage-node--highlighted" : ""}`}>
      {data.ports.map((port) => <Handle key={port.id} id={port.id} type={port.type} position={portPositions[port.side]} isConnectable={false}
        style={{ left: port.x, top: port.y, right: "auto", bottom: "auto", transform: "translate(-50%, -50%)" }} />)}
      <span className="lineage-node__context" title={data.context}>{data.context}</span>
      <button type="button" className="nodrag nopan lineage-node__name" aria-label={`Highlight connections for ${data.label}`} aria-pressed={!!data.highlighted} onClick={data.onHighlight}><strong title={data.label}>{data.label}</strong></button>
      {status || data.onShowEntities || canOpen ? <div className="lineage-node__footer">
        {status ? <span>{status}</span> : null}
        {data.onShowEntities ? <button type="button" className="nodrag nopan lineage-node__open" disabled={data.groupExpansionDisabled} aria-label={`Show entities in ${data.context}`} onClick={data.onShowEntities}>Show entities</button> : null}
        {canOpen ? (
          <button type="button" className="nodrag nopan lineage-node__open" aria-label={`Open entity ${data.label}`} onClick={data.onOpen}>
            Open <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div> : null}
      {data.focused ? <>
        <button type="button" className="nodrag nopan lineage-node__schema-toggle" aria-expanded={data.schemaOpen} aria-controls="lineage-current-schema" onClick={data.onToggleSchema}>
          {data.schemaOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />} Schema
        </button>
        {data.schemaOpen ? <div id="lineage-current-schema" className="nodrag nopan nowheel lineage-node__schema">
          {(data.schema ?? []).map((attribute, index) => {
            const name = String(attribute.name ?? "");
            const dataType = attribute.dataType && typeof attribute.dataType === "object" ? attribute.dataType as Record<string, unknown> : {};
            const type = typeof attribute.dataType === "string" ? attribute.dataType : String(dataType.type ?? "");
            const flags = [attribute.isBusinessKey ? "BK" : "", attribute.history, dataType.nullable === true ? "NULL" : ""].filter(Boolean).join(" · ");
            return <button type="button" key={`${name}:${index}`} className={`lineage-node__attribute ${flags ? "lineage-node__attribute--flags" : ""}`} aria-label={`Inspect attribute ${name}`} aria-pressed={data.selectedAttribute === name} onClick={() => data.onSelectAttribute?.(name)}>
              <span className="lineage-node__attribute-name" title={name}>{name}</span>
              <span className="lineage-node__attribute-type">{type}</span>
              {flags ? <span className="lineage-node__attribute-flags">{flags}</span> : null}
            </button>;
          })}
          {!data.schema?.length ? <p className="lineage-node__empty">No attributes defined.</p> : null}
        </div> : null}
      </> : null}
    </div>
  );
}

const nodeTypes = { lineage: memo(LineageNode) };
const edgeTypes = { routed: RoutedLineageEdge };

export default function EntityLineage({ entities, current, onOpenEntity }: {
  entities: ModelEntity[];
  current: ModelEntity;
  onOpenEntity: (relPath: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const [direction, setDirection] = useState<LineageDirection>("both");
  const [depth, setDepth] = useState(1);
  const [showSources, setShowSources] = useState(true);
  const [showRelationships, setShowRelationships] = useState(true);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [selectedAttribute, setSelectedAttribute] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [groupExpansion, setGroupExpansion] = useState<Record<string, number>>({});
  const index = useMemo(() => createLineageIndex(entities, current), [entities, current]);
  const requestedGraph = useMemo(() => selectLineageGraph(index, direction, depth, 80, {
    includeSources: showSources, includeRelationships: showRelationships, groupExpansion, autoGroup: true, maxEdges: 160,
  }), [index, direction, depth, showSources, showRelationships, groupExpansion]);
  const { view, pending, showProgress, error: layoutError, retry } = useLineageLayout(requestedGraph, schemaOpen);
  const graph = view?.graph ?? requestedGraph;
  const layout = view?.layout;
  const renderedSchemaOpen = view?.schemaOpen ?? schemaOpen;
  useEffect(() => {
    if (selectedNode && !graph.nodes.some((node) => node.id === selectedNode)) setSelectedNode(null);
  }, [graph, selectedNode]);
  const focus = `entity:${current.relPath}`;
  const originalEdges = useMemo(() => graph.edges.flatMap((edge) => edge.members ?? [edge]), [graph]);
  const matchingEdges = useMemo(() => selectedAttribute ? originalEdges.filter((edge) => edge.mappings.some((mapping) =>
    (edge.source === focus && mapping.sourceName === selectedAttribute) || (edge.target === focus && mapping.targetName === selectedAttribute),
  )) : [], [originalEdges, focus, selectedAttribute]);
  const isHighlighted = (edge: LineageEdge) => selectedAttribute ? (edge.members ?? [edge]).some((member) => matchingEdges.includes(member)) : !!selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
  const highlightedNodes = new Set(selectedNode ? [selectedNode, ...graph.edges.filter(isHighlighted).flatMap((edge) => [edge.source, edge.target])] : []);
  const nodes = useMemo<EntityNode[]>(() => {
    if (!layout) return [];
    const geometry = new Map(layout.nodes.map((node) => [node.id, node]));
    return graph.nodes.map((node) => {
      const placed = geometry.get(node.id)!;
      return {
        ...node, position: placed.position, type: "lineage", width: placed.width, height: placed.height, style: { width: placed.width, height: placed.height },
        data: {
          ...node.data, ports: placed.ports, highlighted: selectedNode === node.id,
          onHighlight: () => { setSelectedAttribute(null); setSelectedNode((previous) => previous === node.id ? null : node.id); },
          onOpen: node.data.relPath ? () => onOpenEntity(node.data.relPath!) : undefined,
          schemaOpen: renderedSchemaOpen, selectedAttribute,
          onToggleSchema: () => { setSchemaOpen((open) => !open); setSelectedAttribute(null); },
          onSelectAttribute: (name) => { setSelectedNode(null); setSelectedAttribute((previous) => previous === name ? null : name); },
          groupExpansionDisabled: graph.nodes.length >= 80,
          onShowEntities: node.data.groupId ? () => setGroupExpansion((previous) => ({ ...previous, [node.data.groupId!]: (previous[node.data.groupId!] ?? 0) + 12 })) : undefined,
        },
      };
    });
  }, [graph, layout, onOpenEntity, renderedSchemaOpen, selectedAttribute, selectedNode]);
  const routedGeometry = new Map(layout?.edges.map((edge) => [edge.id, edge]) ?? []);
  const edges: RoutedEdge[] = layout ? graph.edges.map((edge) => {
    const route = routedGeometry.get(edge.id)!;
    const highlighted = isHighlighted(edge);
    return {
      ...edge,
      type: "routed", data: { path: routedEdgePath(route.sections) }, sourceHandle: route.sourceHandle, targetHandle: route.targetHandle,
      className: `lineage-edge--${edge.kind}`,
      ariaLabel: edge.kind === "relationship" ? `Relationship: ${edge.label}` : "Source dependency",
      label: undefined,
      markerEnd: edge.kind === "source" ? { type: MarkerType.ArrowClosed } : undefined,
      style: { stroke: edge.kind === "relationship" ? "var(--highlight)" : "var(--muted)", strokeDasharray: edge.kind === "relationship" ? "6 4" : undefined, strokeWidth: highlighted ? 3 : 1.5, opacity: (selectedAttribute || selectedNode) && !highlighted ? 0.15 : 1 },
    };
  }) : [];
  const renderedNodes = selectedNode ? nodes.map((node) => ({ ...node, style: { ...node.style, opacity: highlightedNodes.has(node.id) ? 1 : 0.45 } })) : nodes;

  return (
    <section id="entity-lineage-view" className="entity-lineage" aria-labelledby="entity-lineage-title" aria-busy={pending} data-layout-ms={layout?.durationMs.toFixed(1)} onKeyDownCapture={(event) => {
      // Delete in a read-only graph must not reach the app's entity-delete shortcut.
      if (event.key === "Delete" || (event.key === "Backspace" && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        event.stopPropagation();
      }
    }}>
      <h3 id="entity-lineage-title" className="sr-only">Entity lineage</h3>
      <div className="entity-lineage__canvas" aria-label="Entity dependency graph">
        <ReactFlow<EntityNode, RoutedEdge>
          nodes={renderedNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={resolvedTheme}
          minZoom={0.03}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          zoomOnScroll={false}
          preventScrolling={false}
          onNodeDoubleClick={(_event, node) => node.data.onOpen?.()}
          onPaneClick={() => { setSelectedNode(null); setSelectedAttribute(null); }}
        >
          <Background color="var(--border)" gap={20} />
          <Controls showInteractive={false} />
          {layout ? <FitLineage bounds={layout.bounds} /> : null}
          {showProgress || layoutError || Object.keys(groupExpansion).length > 0 ? <Panel position="top-left" className="entity-lineage__status nodrag nopan">
            {layoutError ? <div role="alert">{layoutError} <button type="button" onClick={retry}>Retry layout</button></div>
              : showProgress ? <span role="status">{layout ? "Updating lineage…" : "Arranging lineage…"}</span> : null}
            {Object.keys(groupExpansion).length > 0 ? <button type="button" onClick={() => { setGroupExpansion({}); setSelectedNode(null); }}>Reset groups</button> : null}
          </Panel> : null}
          <Panel position="top-right" className="entity-lineage__filters entity-lineage__filter-panel nodrag nopan" role="group" aria-label="Lineage filters">
            <label>
              Direction
              <FormSelect
                aria-label="Lineage direction"
                disabled={!showSources}
                value={direction}
                onChange={(value) => setDirection(value as LineageDirection)}
                options={[
                  { value: "both", label: "Upstream & downstream" },
                  { value: "upstream", label: "Upstream" },
                  { value: "downstream", label: "Downstream" },
                ]}
              />
            </label>
            <label>
              Depth
              <FormSelect
                aria-label="Lineage depth"
                disabled={!showSources}
                value={String(depth)}
                onChange={(value) => setDepth(Number(value))}
                options={[
                  { value: "1", label: "1 level" },
                  { value: "2", label: "2 levels" },
                  { value: "3", label: "3 levels" },
                ]}
              />
            </label>
          </Panel>
          <Panel position="bottom-right" className="entity-lineage__legend nodrag nopan" role="group" aria-label="Lineage legend">
            <div className="entity-lineage__layers">
              <label><input type="checkbox" checked={showSources} onChange={(event) => setShowSources(event.target.checked)} /> <span className="entity-lineage__source-key" aria-hidden="true" /> Sources</label>
              <label><input type="checkbox" checked={showRelationships} onChange={(event) => setShowRelationships(event.target.checked)} /> <span className="entity-lineage__relationship-key" aria-hidden="true" /> Relationships</label>
            </div>
          </Panel>
        </ReactFlow>
      </div>
      {graph.truncated ? <div className="entity-lineage__caption" role="status">
        Showing {graph.nodes.length} nodes and {graph.edges.length} connections. Some dependencies are hidden; reduce depth or hide a layer to narrow the view.
      </div> : null}
    </section>
  );
}
