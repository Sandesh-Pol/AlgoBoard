import { memo, useCallback, useMemo } from "react";
import {
  Background,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  applyNodeChanges,
  type EdgeProps,
  type Node,
  type Edge,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ArchEdge, ArchEdgeData, ArchNode, ArchNodeData } from "@/lib/diagrams/layout";
import { useBoard } from "./store";

type FNode = Node<ArchNodeData & { active?: boolean }, "shape">;
type FEdge = Edge<ArchEdgeData & { active?: boolean }, "smart">;

const ShapeNode = memo(function ShapeNode({ data, selected }: NodeProps<FNode>) {
  const style = { color: data.textColor, fontFamily: data.fontFamily, fontSize: data.fontSize, fontWeight: data.fontWeight } as const;
  const cls = `ab-shape kind-${data.kind} ${data.active ? "is-active" : ""} ${selected ? "is-selected" : ""}`;
  return (
    <div className={cls} style={{ width: data.width, height: data.height }}>
      {data.kind === "diamond" ? (
        <svg className="ab-diamond" width={data.width} height={data.height} aria-hidden>
          <polygon points={`${data.width / 2},2 ${data.width - 2},${data.height / 2} ${data.width / 2},${data.height - 2} 2,${data.height / 2}`} fill={data.fill} stroke={data.border} strokeWidth={data.borderWidth} />
        </svg>
      ) : (
        <div className="ab-shape-bg" style={{ background: data.fill, borderColor: data.border, borderWidth: data.borderWidth, borderRadius: data.kind === "ellipse" ? 999 : data.radius }} />
      )}
      <span className="ab-shape-label" style={style}>
        {data.label}
      </span>
      {data.line != null && <span className="ab-shape-line">L{data.line}</span>}
      {(["top", "right", "bottom", "left"] as const).map((p) => (
        <Handle key={p} id={p} type="source" position={p === "top" ? Position.Top : p === "right" ? Position.Right : p === "bottom" ? Position.Bottom : Position.Left} className="ab-handle" />
      ))}
    </div>
  );
});

function SmartEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps<FEdge>) {
  const [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 10, offset: data?.back ? 36 : 20 });
  const active = data?.active;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={active ? "ab-edge is-active" : "ab-edge"} style={{ stroke: active ? undefined : data?.stroke, strokeWidth: active ? 3 : data?.width, strokeDasharray: data?.dashed && !active ? `${data.dash} ${data.gap}` : undefined }} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div className={`ab-edge-label ${active ? "is-active" : ""}`} style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}>
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { shape: ShapeNode };
const edgeTypes = { smart: SmartEdge };

export function FlowCanvas({ activeNodeIds, activeEdgeIds, onNodeFocus, minimap = true }: { activeNodeIds: string[]; activeEdgeIds: string[]; onNodeFocus: (n: ArchNode) => void; minimap?: boolean }) {
  const nodes = useBoard((s) => s.project.nodes);
  const edges = useBoard((s) => s.project.edges);
  const setDiagram = useBoard((s) => s.setDiagram);
  const select = useBoard((s) => s.select);

  const rfNodes = useMemo<FNode[]>(() => nodes.map((n) => ({ ...n, data: { ...n.data, active: activeNodeIds.includes(n.id) } })), [nodes, activeNodeIds]);
  const rfEdges = useMemo<FEdge[]>(
    () => edges.map((e) => ({ ...e, markerEnd: { type: "arrowclosed" as never, color: activeEdgeIds.includes(e.id) ? "#E58A1F" : e.data.stroke, width: 16, height: 16 }, data: { ...e.data, active: activeEdgeIds.includes(e.id) } })),
    [edges, activeEdgeIds],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<FNode>[]) => {
      const meaningful = changes.filter((c) => c.type === "position" || c.type === "remove");
      if (!meaningful.length) return;
      const next = applyNodeChanges(meaningful, rfNodes).map(({ data, ...rest }) => {
        const { active: _a, ...d } = data;
        return { ...rest, data: d } as ArchNode;
      });
      const ended = meaningful.some((c) => c.type === "position" && c.dragging === false) || meaningful.some((c) => c.type === "remove");
      const ids = new Set(next.map((n) => n.id));
      setDiagram({ nodes: next, edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)) as ArchEdge[] }, ended);
    },
    [rfNodes, edges, setDiagram],
  );

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      connectionMode={ConnectionMode.Loose}
      onNodeClick={(_, n) => {
        select(n.id);
        onNodeFocus(nodes.find((x) => x.id === n.id)!);
      }}
      onPaneClick={() => select(null)}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
    >
      <Background gap={20} size={1} color="#cfdcdf" />
      <Controls showInteractive={false} />
      {minimap && <MiniMap pannable zoomable nodeColor={(n) => (n.data as ArchNodeData).fill} maskColor="rgba(23,49,61,0.08)" />}
    </ReactFlow>
  );
}
