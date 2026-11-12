import { useMemo, useState } from "react";
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { ArrowUpRight } from "lucide-react";
import { useTheme } from "@datam8/ui/theme";
import type { ModelEntity } from "../model-types";
import { buildLineageGraph, type LineageDirection, type LineageNodeData } from "./buildLineageGraph";
import "@xyflow/react/dist/style.css";
import "./lineage.css";

type EntityNode = Node<LineageNodeData & { onOpen?: () => void }, "lineage">;

function LineageNode({ data }: NodeProps<EntityNode>) {
  return (
    <div className={`lineage-node lineage-node--${data.kind} ${data.focused ? "lineage-node--focus" : ""}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <span className="lineage-node__context" title={data.context}>{data.context}</span>
      <strong title={data.label}>{data.label}</strong>
      <div className="lineage-node__footer">
        <span>{data.focused ? "Current entity" : data.kind === "external" ? "External source" : data.kind === "missing" ? "Unresolved reference" : "Model entity"}</span>
        {data.onOpen && !data.focused ? (
          <button type="button" className="nodrag nopan lineage-node__open" aria-label={`Open entity ${data.label}`} onClick={data.onOpen}>
            Open <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>
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
  const graph = useMemo(() => buildLineageGraph(entities, current, direction, depth), [entities, current, direction, depth]);
  const nodes = useMemo<EntityNode[]>(() => graph.nodes.map((node) => ({
    ...node,
    type: "lineage",
    // The existing editor navigation waits for autosave before changing entity.
    data: { ...node.data, onOpen: node.data.relPath ? () => onOpenEntity(node.data.relPath!) : undefined },
  })), [graph, onOpenEntity]);
  const edges = useMemo(() => graph.edges.map((edge) => ({
    ...edge,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
  })), [graph]);
  // Refit only when topology/filter changes, leaving ordinary draft text edits at the current viewport.
  const viewKey = JSON.stringify([current.relPath, direction, depth, graph.nodes.map((node) => node.id), graph.edges.map((edge) => edge.id)]);

  return (
    <section className="entity-lineage" aria-labelledby="entity-lineage-title" onKeyDownCapture={(event) => {
      // Delete in a read-only graph must not reach the app's entity-delete shortcut.
      if (event.key === "Delete" || (event.key === "Backspace" && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        event.stopPropagation();
      }
    }}>
      <div className="entity-lineage__toolbar">
        <div>
          <h3 id="entity-lineage-title">Entity lineage</h3>
          <p>Modelled sources · current entity includes editor changes.</p>
        </div>
        <div className="entity-lineage__filters">
          <label>
            Direction
            <select aria-label="Lineage direction" value={direction} onChange={(event) => setDirection(event.target.value as LineageDirection)}>
              <option value="both">Upstream &amp; downstream</option>
              <option value="upstream">Upstream</option>
              <option value="downstream">Downstream</option>
            </select>
          </label>
          <label>
            Depth
            <select aria-label="Lineage depth" value={depth} onChange={(event) => setDepth(Number(event.target.value))}>
              <option value={1}>1 level</option>
              <option value={2}>2 levels</option>
              <option value={3}>3 levels</option>
            </select>
          </label>
        </div>
      </div>
      <div className="entity-lineage__canvas" aria-label="Entity source dependency graph">
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
        </ReactFlow>
      </div>
      <div className="entity-lineage__caption" role="status">
        <span>{graph.edges.length ? `${graph.nodes.length} nodes · ${graph.edges.length} connections · Arrows show data flow.` : "No source dependencies in this direction."}</span>
        <span>{graph.truncated ? "Showing up to 80 nodes. Reduce depth to narrow the view." : "Open a model entity to explore its lineage."}</span>
      </div>
    </section>
  );
}
