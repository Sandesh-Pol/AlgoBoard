import { z } from "zod";

export const INPUT_TYPES = ["code", "problem_statement", "leetcode_reference", "mixed", "unknown"] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export const FLOW_KINDS = ["start", "end", "process", "decision", "loop", "call", "return", "io", "phase"] as const;
export type FlowKind = (typeof FLOW_KINDS)[number];

const str = z.preprocess((v) => (v == null ? "" : typeof v === "string" ? v : String(v)), z.string());
const strArr = z.preprocess(
  (v) => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))) : typeof v === "string" && v ? [v] : []),
  z.array(z.string()),
);
const scalar = z.preprocess(
  (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v)),
  z.string(),
);

export const flowNodeSchema = z.object({
  id: z.preprocess((v) => String(v ?? ""), z.string().min(1)),
  kind: z.preprocess((v) => (FLOW_KINDS.includes(v as FlowKind) ? v : "process"), z.enum(FLOW_KINDS)),
  label: str,
  line: z.preprocess((v) => (typeof v === "number" ? v : Number(v) || undefined), z.number().int().optional()),
  phase: str.optional(),
});
export const flowEdgeSchema = z.object({
  id: str.optional(),
  source: z.preprocess((v) => String(v ?? ""), z.string()),
  target: z.preprocess((v) => String(v ?? ""), z.string()),
  label: str.optional(),
});
export const flowchartSchema = z.object({
  nodes: z.array(flowNodeSchema).min(1),
  edges: z.array(flowEdgeSchema).default([]),
});
export type Flowchart = z.infer<typeof flowchartSchema>;

const arrayStateSchema = z.object({
  name: str,
  values: z.array(scalar).default([]),
  pointers: z.record(z.preprocess((v) => Number(v), z.number())).default({}),
  highlight: z.array(z.preprocess((v) => Number(v), z.number())).default([]),
  window: z.array(z.preprocess((v) => Number(v), z.number())).optional(),
  discarded: z.array(z.preprocess((v) => Number(v), z.number())).optional(),
});
const kvSchema = z.object({ key: scalar, value: scalar });
const mapStateSchema = z.object({ name: str, entries: z.array(kvSchema).default([]), highlightKey: scalar.optional() });
const listStateSchema = z.object({ name: str, items: z.array(scalar).default([]) });
const treeNodeSchema = z.object({
  id: z.preprocess((v) => String(v ?? ""), z.string()),
  label: str,
  parent: z.preprocess((v) => (v == null || v === "" ? undefined : String(v)), z.string().optional()),
  state: z.preprocess(
    (v) => (["active", "done", "memo", "pruned", "pending"].includes(v as string) ? v : "pending"),
    z.enum(["active", "done", "memo", "pruned", "pending"]),
  ),
});
const tableSchema = z.object({
  name: str,
  rows: z.array(z.array(scalar)).default([]),
  rowLabels: strArr.optional(),
  colLabels: strArr.optional(),
  highlight: z.array(z.array(z.preprocess((v) => Number(v), z.number()))).default([]),
});

const recordOfStrings = z.preprocess((v) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === "string" ? x : JSON.stringify(x)]));
}, z.record(z.string()));

export const traceStepSchema = z.object({
  stepIndex: z.preprocess((v) => Number(v) || 0, z.number()),
  title: str,
  description: str.default(""),
  sourceLine: z.preprocess((v) => (typeof v === "number" ? v : Number(v) || undefined), z.number().optional()),
  variables: recordOfStrings.default({}),
  arrayState: z.array(arrayStateSchema).default([]),
  mapState: z.array(mapStateSchema).default([]),
  setState: z.array(listStateSchema).default([]),
  stackState: z.array(listStateSchema).default([]),
  queueState: z.array(listStateSchema).default([]),
  treeState: z.preprocess((v) => (Array.isArray(v) ? { nodes: v } : v ?? { nodes: [] }), z.object({ nodes: z.array(treeNodeSchema).default([]) })),
  tableState: z.array(tableSchema).default([]),
  activeNodeIds: strArr.default([]),
  activeEdgeIds: strArr.default([]),
  changedValues: strArr.default([]),
  invariant: str.default(""),
  narration: str.default(""),
});
export type TraceStep = z.infer<typeof traceStepSchema>;

export const insightsSchema = z.object({
  patternName: str,
  whyThisPattern: str,
  approach: strArr,
  pseudocode: str,
  timeComplexity: str,
  spaceComplexity: str,
  invariant: str,
  edgeCases: strArr,
  commonMistakes: strArr,
  alternativeApproach: str.optional(),
});
export type Insights = z.infer<typeof insightsSchema>;

export const problemSchema = z.object({
  title: str,
  source: str.default("user"),
  number: z.preprocess((v) => (v == null || v === "" ? undefined : Number(v) || undefined), z.number().optional()),
  inputFormat: str.default(""),
  outputFormat: str.default(""),
  constraints: strArr.default([]),
  examples: strArr.default([]),
});

export const analysisSchema = z.object({
  requestId: str.default(""),
  inputType: z.preprocess((v) => (INPUT_TYPES.includes(v as InputType) ? v : "unknown"), z.enum(INPUT_TYPES)),
  language: str.default("plaintext"),
  needsMoreInfo: z.boolean().default(false),
  clarification: str.optional(),
  problem: problemSchema,
  algorithmPattern: str,
  secondaryPatterns: strArr.default([]),
  normalizedProblem: str.default(""),
  assumptions: strArr.default([]),
  code: str.default(""),
  flowchart: flowchartSchema,
  dryRun: z.object({ input: str.default(""), steps: z.array(traceStepSchema).min(1) }),
  insights: insightsSchema,
  warnings: strArr.default([]),
  confidence: z.preprocess((v) => Math.max(0, Math.min(1, Number(v) || 0)), z.number()),
});
export type Analysis = z.infer<typeof analysisSchema>;

export const clarificationSchema = z.object({
  needsMoreInfo: z.literal(true),
  inputType: z.preprocess((v) => (INPUT_TYPES.includes(v as InputType) ? v : "unknown"), z.enum(INPUT_TYPES)),
  clarification: str,
});

/** Removes dangling edges / ids so the diagram is always renderable. */
export function sanitizeAnalysis(a: Analysis): Analysis {
  const seen = new Set<string>();
  const nodes = a.flowchart.nodes.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
  const edgeIds = new Set<string>();
  const edges = a.flowchart.edges
    .filter((e) => seen.has(e.source) && seen.has(e.target))
    .map((e, i) => {
      let id = e.id || `e-${e.source}-${e.target}`;
      if (edgeIds.has(id)) id = `${id}-${i}`;
      edgeIds.add(id);
      return { ...e, id };
    });
  const steps = a.dryRun.steps.slice(0, 80).map((s, i) => ({
    ...s,
    stepIndex: i,
    activeNodeIds: s.activeNodeIds.filter((id) => seen.has(id)),
    activeEdgeIds: s.activeEdgeIds.filter((id) => edgeIds.has(id)),
  }));
  return { ...a, flowchart: { nodes, edges }, dryRun: { ...a.dryRun, steps } };
}
