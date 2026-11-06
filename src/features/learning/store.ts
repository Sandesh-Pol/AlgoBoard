import { create } from "zustand";
import type { Analysis } from "@/lib/analysis/schema";
import { layoutFlowchart, type ArchEdge, type ArchNode } from "@/lib/diagrams/layout";

export type Project = {
  id: string;
  title: string;
  input: string;
  language: string;
  analysis: Analysis | null;
  nodes: ArchNode[];
  edges: ArchEdge[];
  updatedAt: number;
};

const KEY = "algoboard.projects.v1";
const CURRENT = "algoboard.current";

export function readProjects(): Project[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function writeProjects(list: Project[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    /* quota */
  }
}

export const newProject = (): Project => ({
  id: crypto.randomUUID(),
  title: "Untitled problem",
  input: "",
  language: "python",
  analysis: null,
  nodes: [],
  edges: [],
  updatedAt: Date.now(),
});

type Snapshot = { nodes: ArchNode[]; edges: ArchEdge[] };

type State = {
  project: Project;
  step: number;
  playing: boolean;
  speed: number;
  reducedMotion: boolean;
  selectedNodeId: string | null;
  past: Snapshot[];
  future: Snapshot[];
  setProject: (p: Partial<Project>) => void;
  loadProject: (p: Project) => void;
  setAnalysis: (a: Analysis) => void;
  setDiagram: (d: Snapshot, record?: boolean) => void;
  undo: () => void;
  redo: () => void;
  setStep: (n: number) => void;
  setPlaying: (b: boolean) => void;
  setSpeed: (n: number) => void;
  setReducedMotion: (b: boolean) => void;
  select: (id: string | null) => void;
};

export const useBoard = create<State>((set, get) => ({
  project: newProject(),
  step: 0,
  playing: false,
  speed: 1,
  reducedMotion: false,
  selectedNodeId: null,
  past: [],
  future: [],
  setProject: (p) => set({ project: { ...get().project, ...p, updatedAt: Date.now() } }),
  loadProject: (p) => set({ project: p, step: 0, playing: false, past: [], future: [], selectedNodeId: null }),
  setAnalysis: (a) => {
    const d = layoutFlowchart(a.flowchart);
    set({
      project: { ...get().project, analysis: a, title: a.problem.title || get().project.title, nodes: d.nodes, edges: d.edges, updatedAt: Date.now() },
      step: 0,
      playing: false,
      past: [],
      future: [],
      selectedNodeId: null,
    });
  },
  setDiagram: (d, record = true) => {
    const { project, past } = get();
    set({
      project: { ...project, ...d, updatedAt: Date.now() },
      past: record ? [...past.slice(-49), { nodes: project.nodes, edges: project.edges }] : past,
      future: record ? [] : get().future,
    });
  },
  undo: () => {
    const { past, project, future } = get();
    const prev = past.at(-1);
    if (!prev) return;
    set({ past: past.slice(0, -1), future: [{ nodes: project.nodes, edges: project.edges }, ...future], project: { ...project, ...prev } });
  },
  redo: () => {
    const { past, project, future } = get();
    const next = future[0];
    if (!next) return;
    set({ future: future.slice(1), past: [...past, { nodes: project.nodes, edges: project.edges }], project: { ...project, ...next } });
  },
  setStep: (n) => {
    const max = (get().project.analysis?.dryRun.steps.length ?? 1) - 1;
    set({ step: Math.max(0, Math.min(max, n)) });
  },
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  select: (selectedNodeId) => set({ selectedNodeId }),
}));

export { CURRENT as CURRENT_KEY };
