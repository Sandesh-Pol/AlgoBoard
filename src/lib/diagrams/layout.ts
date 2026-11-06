import type { Flowchart, FlowKind } from "../analysis/schema";

/** Archboard-compatible node data (subset of Archboard NodeData; extra fields use Archboard defaults on import). */
export type ShapeKind = "rectangle" | "rounded" | "ellipse" | "diamond" | "text" | "container";
export type ArchNodeData = {
  kind: ShapeKind;
  label: string;
  html: false;
  fill: string;
  border: string;
  textColor: string;
  borderWidth: number;
  borderStyle: "solid" | "dashed";
  radius: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  align: "center";
  vertical: "center";
  padding: number;
  width: number;
  height: number;
  flowKind: FlowKind;
  line?: number;
};
export type ArchEdgeData = {
  route: "straight" | "orthogonal";
  arrow: "single";
  stroke: string;
  width: number;
  dashed: boolean;
  dash: number;
  gap: number;
  label?: string;
  back?: boolean;
};
export type ArchNode = { id: string; type: "shape"; position: { x: number; y: number }; width: number; height: number; data: ArchNodeData };
export type ArchEdge = { id: string; type: "smart"; source: string; target: string; sourceHandle: string; targetHandle: string; data: ArchEdgeData };

// Archboard theme swatches, mapped to flow semantics.
export const KIND_THEME: Record<FlowKind, { fill: string; border: string; text: string; shape: ShapeKind }> = {
  start: { fill: "#00546D", border: "#003A4C", text: "#FFFFFF", shape: "ellipse" },
  end: { fill: "#003B5C", border: "#002B43", text: "#FFFFFF", shape: "ellipse" },
  process: { fill: "#DDF4FF", border: "#5B9DBB", text: "#173746", shape: "rectangle" },
  io: { fill: "#EEF1F6", border: "#9AA4B2", text: "#28313D", shape: "rectangle" },
  decision: { fill: "#FFF3A6", border: "#C8B85A", text: "#454015", shape: "diamond" },
  loop: { fill: "#FFE0CA", border: "#D69A6A", text: "#57351F", shape: "diamond" },
  call: { fill: "#E6E5FF", border: "#8F8AD2", text: "#292957", shape: "rounded" },
  return: { fill: "#DDF8E8", border: "#66A88B", text: "#174637", shape: "rounded" },
  phase: { fill: "#D1F1EB", border: "#4B9D91", text: "#153F3B", shape: "container" },
};

const W = 210;
const H = 54;
const DW = 190;
const DH = 84;
const GAP_X = 70;
const GAP_Y = 54;

export function layoutFlowchart(chart: Flowchart): { nodes: ArchNode[]; edges: ArchEdge[] } {
  const ids = chart.nodes.filter((n) => n.kind !== "phase").map((n) => n.id);
  const idSet = new Set(ids);
  const out = new Map<string, string[]>();
  ids.forEach((id) => out.set(id, []));
  const edges = chart.edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));
  edges.forEach((e) => out.get(e.source)!.push(e.target));

  // DFS from the first start node (or first node) to find back edges.
  const startId = chart.nodes.find((n) => n.kind === "start")?.id ?? ids[0];
  const state = new Map<string, number>();
  const back = new Set<string>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const t of out.get(id) ?? []) {
      if (state.get(t) === 1) back.add(`${id}->${t}`);
      else if (!state.has(t)) visit(t);
    }
    state.set(id, 2);
  };
  if (startId) visit(startId);
  ids.forEach((id) => !state.has(id) && visit(id));

  // Longest-path ranking over forward edges.
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  for (let i = 0; i < ids.length; i++) {
    let changed = false;
    for (const e of edges) {
      if (back.has(`${e.source}->${e.target}`) || e.source === e.target) continue;
      const r = rank.get(e.source)! + 1;
      if (r > rank.get(e.target)!) {
        rank.set(e.target, r);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const byRank = new Map<number, string[]>();
  ids.forEach((id) => {
    const r = rank.get(id)!;
    byRank.set(r, [...(byRank.get(r) ?? []), id]);
  });

  // Column assignment: keep "no" branches to the right of their decision.
  const col = new Map<string, number>();
  const sortedRanks = [...byRank.keys()].sort((a, b) => a - b);
  for (const r of sortedRanks) {
    const row = byRank.get(r)!;
    const desired = row.map((id) => {
      const incoming = edges.filter((e) => e.target === id && !back.has(`${e.source}->${e.target}`) && col.has(e.source));
      if (!incoming.length) return 0;
      const e = incoming[0];
      const shift = /^(no|false|else)$/i.test(e.label ?? "") ? 1 : 0;
      return col.get(e.source)! + shift;
    });
    const used = new Set<number>();
    row
      .map((id, i) => ({ id, d: desired[i] }))
      .sort((a, b) => a.d - b.d)
      .forEach(({ id, d }) => {
        let c = d;
        while (used.has(c)) c++;
        used.add(c);
        col.set(id, c);
      });
  }

  const meta = new Map(chart.nodes.map((n) => [n.id, n]));
  const rowY: number[] = [];
  let y = 0;
  for (const r of sortedRanks) {
    rowY[r] = y;
    const tall = byRank.get(r)!.some((id) => ["decision", "loop"].includes(meta.get(id)!.kind));
    y += (tall ? DH : H) + GAP_Y;
  }

  const nodes: ArchNode[] = ids.map((id) => {
    const n = meta.get(id)!;
    const t = KIND_THEME[n.kind];
    const isD = t.shape === "diamond";
    const w = isD ? DW : W;
    const h = isD ? DH : H;
    const rowTall = byRank.get(rank.get(id)!)!.some((x) => ["decision", "loop"].includes(meta.get(x)!.kind));
    const label = n.label.length > 40 ? n.label.slice(0, 38) + "…" : n.label;
    return {
      id,
      type: "shape",
      position: { x: col.get(id)! * (W + GAP_X) + (W - w) / 2, y: rowY[rank.get(id)!] + ((rowTall ? DH : H) - h) / 2 },
      width: w,
      height: h,
      data: {
        kind: t.shape,
        label,
        html: false,
        fill: t.fill,
        border: t.border,
        textColor: t.text,
        borderWidth: 1.5,
        borderStyle: "solid",
        radius: t.shape === "rounded" ? 14 : 4,
        fontFamily: "DM Mono",
        fontSize: 12,
        fontWeight: 500,
        align: "center",
        vertical: "center",
        padding: 10,
        width: w,
        height: h,
        flowKind: n.kind,
        line: n.line,
      },
    };
  });

  const archEdges: ArchEdge[] = edges.map((e, i) => {
    const isBack = back.has(`${e.source}->${e.target}`);
    const sc = col.get(e.source)!;
    const tc = col.get(e.target)!;
    let sourceHandle = "bottom";
    let targetHandle = "top";
    if (isBack) {
      sourceHandle = "left";
      targetHandle = "left";
    } else if (tc > sc) {
      sourceHandle = "right";
    } else if (tc < sc) {
      sourceHandle = "bottom";
    }
    const no = /^(no|false|else)$/i.test(e.label ?? "");
    return {
      id: e.id || `e${i + 1}`,
      type: "smart",
      source: e.source,
      target: e.target,
      sourceHandle,
      targetHandle,
      data: {
        route: "orthogonal",
        arrow: "single",
        stroke: isBack ? "#D69A6A" : no ? "#C86E6E" : "#4B9D91",
        width: 1.5,
        dashed: isBack,
        dash: 6,
        gap: 4,
        label: e.label || undefined,
        back: isBack,
      },
    };
  });

  return { nodes, edges: archEdges };
}
