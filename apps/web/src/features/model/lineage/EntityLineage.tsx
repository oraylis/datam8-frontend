import { useMemo, useState } from "react";
import { Background, Controls, Handle, MarkerType, Panel, Position, ReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";
import { useTheme } from "@datam8/ui/theme";
import { FormSelect } from "@datam8/ui";
import type { ModelEntity } from "../model-types";
import { buildLineageGraph, type LineageDirection, type LineageNodeData } from "./buildLineageGraph";
import "@xyflow/react/dist/style.css";
import "./lineage.css";

type EntityNode = Node<LineageNodeData & {
  onOpen?: () => void;
  schemaOpen?: boolean;
  onToggleSchema?: () => void;
  selectedAttribute?: string | null;
  onSelectAttribute?: (name: string) => void;
}, "lineage">;

function LineageNode({ data }: NodeProps<EntityNode>) {
  return (
    <div className={`lineage-node lineage-node--${data.kind} ${data.focused ? "lineage-node--focus" : ""}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <span className="lineage-node__context" title={data.context}>{data.context}</span>
      <strong title={data.label}>{data.label}</strong>
      <div className="lineage-node__footer">
        <span>{data.focused ? "Current entity" : data.kind === "external" ? "External location" : data.kind === "missing" ? "Unresolved reference" : "Model entity"}</span>
        {data.onOpen && !data.focused ? (
          <button type="button" className="nodrag nopan lineage-node__open" aria-label={`Open entity ${data.label}`} onClick={data.onOpen}>
            Open <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>
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
            return <button type="button" key={`${name}:${index}`} className="lineage-node__attribute" aria-label={`Inspect attribute ${name}`} aria-pressed={data.selectedAttribute === name} onClick={() => data.onSelectAttribute?.(name)}>
              <span className="lineage-node__attribute-name" title={name}>{name}</span>
              <span className="lineage-node__attribute-type">{type}</span>
              {flags ? <span className="lineage-node__attribute-flags">{flags}</span> : null}
            </button>;
          })}
          {!data.schema?.length ? <p className="lineage-node__empty">No attributes defined.</p> : null}
        </div> : null}
      </> : null}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { lineage: LineageNode };

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
  const graph = useMemo(() => buildLineageGraph(entities, current, direction, depth, 80, {
    includeSources: showSources, includeRelationships: showRelationships,
  }), [entities, current, direction, depth, showSources, showRelationships]);
  const nodes = useMemo<EntityNode[]>(() => graph.nodes.map((node) => ({
    ...node,
    type: "lineage",
    // The existing editor navigation waits for autosave before changing entity.
    position: node.data.focused && schemaOpen ? { ...node.position, y: node.position.y - (Math.min((node.data.schema?.length ?? 0) * 42, 280) + 40) / 2 } : node.position,
    data: {
      ...node.data,
      onOpen: node.data.relPath ? () => onOpenEntity(node.data.relPath!) : undefined,
      schemaOpen, selectedAttribute,
      onToggleSchema: () => { setSchemaOpen((open) => !open); setSelectedAttribute(null); },
      onSelectAttribute: (name) => setSelectedAttribute((previous) => previous === name ? null : name),
    },
  })), [graph, onOpenEntity, schemaOpen, selectedAttribute]);
  const focus = `entity:${current.relPath}`;
  const matchingEdges = useMemo(() => selectedAttribute ? graph.edges.filter((edge) => edge.mappings.some((mapping) =>
    (edge.source === focus && mapping.sourceName === selectedAttribute) || (edge.target === focus && mapping.targetName === selectedAttribute),
  )) : [], [graph, focus, selectedAttribute]);
  const edges = useMemo(() => graph.edges.map((edge) => {
    const highlighted = matchingEdges.includes(edge);
    return {
      ...edge,
      type: "smoothstep",
      className: `lineage-edge--${edge.kind}`,
      ariaLabel: edge.kind === "relationship" ? `Relationship: ${edge.label}` : "Source dependency",
      label: undefined,
      markerEnd: edge.kind === "source" ? { type: MarkerType.ArrowClosed } : undefined,
      style: { stroke: edge.kind === "relationship" ? "var(--highlight)" : "var(--muted)", strokeDasharray: edge.kind === "relationship" ? "6 4" : undefined, strokeWidth: highlighted ? 3 : 1.5, opacity: selectedAttribute && !highlighted ? 0.25 : 1 },
    };
  }), [graph, matchingEdges, selectedAttribute]);
  // Refit only when topology/filter changes, leaving ordinary draft text edits at the current viewport.
  const viewKey = JSON.stringify([current.relPath, direction, depth, schemaOpen, graph.nodes.map((node) => node.id), graph.edges.map((edge) => edge.id)]);

  return (
    <section id="entity-lineage-view" className="entity-lineage" aria-labelledby="entity-lineage-title" onKeyDownCapture={(event) => {
      // Delete in a read-only graph must not reach the app's entity-delete shortcut.
      if (event.key === "Delete" || (event.key === "Backspace" && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        event.stopPropagation();
      }
    }}>
      <h3 id="entity-lineage-title" className="sr-only">Entity lineage</h3>
      <div className="entity-lineage__canvas" aria-label="Entity dependency graph">
        <ReactFlow<EntityNode>
          key={viewKey}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={resolvedTheme}
          fitView
          fitViewOptions={{ padding: 0.22, maxZoom: 1 }}
          minZoom={0.15}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          zoomOnScroll={false}
          preventScrolling={false}
          onNodeDoubleClick={(_event, node) => node.data.onOpen?.()}
        >
          <Background color="var(--border)" gap={20} />
          <Controls showInteractive={false} />
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
        Showing up to 80 nodes. Reduce depth to narrow the view.
      </div> : null}
      {selectedAttribute ? <div className="entity-lineage__mapping-detail" role="status">
        {matchingEdges.length ? matchingEdges.flatMap((edge) => edge.mappings.filter((mapping) =>
          (edge.source === focus && mapping.sourceName === selectedAttribute) || (edge.target === focus && mapping.targetName === selectedAttribute),
        ).map((mapping, index) => <span key={`${edge.id}:${index}`}>
          {graph.nodes.find((node) => node.id === edge.source)?.data.label}.{mapping.sourceName} → {graph.nodes.find((node) => node.id === edge.target)?.data.label}.{mapping.targetName}
          {` (${edge.kind === "relationship" ? "Relationship" : "Source mapping"})`}
        </span>)) : <span>No explicit mappings for {selectedAttribute} in this view.</span>}
      </div> : null}
    </section>
  );
}
