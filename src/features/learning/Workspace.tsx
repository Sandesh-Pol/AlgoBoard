import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import { ReactFlowProvider } from "@xyflow/react";
import { toJpeg, toPng, toSvg } from "html-to-image";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen, Braces, ChevronLeft, ChevronRight, Code2, Download, Eraser, FileJson, FolderOpen, GitBranch, Lightbulb, Loader2, Pause, Play,
  Moon, Plus, Presentation, Sun, Redo2, RotateCcw, Sparkles, Trash2, Undo2, Upload, Workflow, X,
} from "lucide-react";
import { toast } from "sonner";
import { analyzeInput } from "@/lib/analysis/analyze.functions";
import { classifyInput } from "@/lib/analysis/classify";
import { analysisSchema, sanitizeAnalysis, type TraceStep } from "@/lib/analysis/schema";
import { EXAMPLES } from "@/lib/traces/examples";
import { KIND_THEME, type ArchNode } from "@/lib/diagrams/layout";
import { FlowCanvas } from "./FlowCanvas";
import { DryRunView } from "./DryRunView";
import { CURRENT_KEY, newProject, readProjects, useBoard, writeProjects, type Project } from "./store";

const LANGS = ["python", "java", "cpp", "javascript", "typescript", "go", "rust", "csharp"];
const SWATCHES = [
  ["#DDF4FF", "#5B9DBB", "#173746"], ["#DDF8E8", "#66A88B", "#174637"], ["#E6E5FF", "#8F8AD2", "#292957"], ["#FFE0E8", "#CE8EA2", "#4D2733"],
  ["#FFF3A6", "#C8B85A", "#454015"], ["#FFE0CA", "#D69A6A", "#57351F"], ["#D1F1EB", "#4B9D91", "#153F3B"], ["#00546D", "#003A4C", "#FFFFFF"],
  ["#003B5C", "#002B43", "#FFFFFF"], ["#F5B9B9", "#C86E6E", "#4C2525"], ["#EEF1F6", "#9AA4B2", "#28313D"], ["#FFFFFF", "#333333", "#202020"],
];

function download(name: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

export default function Workspace() {
  const s = useBoard();
  const { project, step, playing, speed, reducedMotion } = s;
  const analysis = project.analysis;
  const steps = analysis?.dryRun.steps ?? [];
  const current: TraceStep | undefined = steps[step];
  const [leftTab, setLeftTab] = useState<"input" | "code">("input");
  const [rightTab, setRightTab] = useState<"insights" | "step" | "node">("insights");
  const [mobileTab, setMobileTab] = useState<"left" | "center" | "right">("left");
  const [dock, setDock] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("algoboard.theme");
    setDark(saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const toggleTheme = () => { const n = !dark; setDark(n); localStorage.setItem("algoboard.theme", n ? "dark" : "light"); };
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "clarify" | "error"; text: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [selectedVar, setSelectedVar] = useState<string | null>(null);
  const abortRef = useRef<{ cancelled: boolean } | null>(null);
  const analyze = useServerFn(analyzeInput);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const decoRef = useRef<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const classification = useMemo(() => classifyInput(project.input), [project.input]);

  // Restore persisted project + reduced motion preference.
  useEffect(() => {
    const list = readProjects();
    setProjects(list);
    const cur = list.find((p) => p.id === localStorage.getItem(CURRENT_KEY));
    if (cur) s.loadProject(cur);
    else loadExample(EXAMPLES[0].id);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) s.setReducedMotion(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave.
  useEffect(() => {
    if (!project.input && !project.analysis) return;
    const t = setTimeout(() => {
      const list = [project, ...readProjects().filter((p) => p.id !== project.id)];
      writeProjects(list);
      localStorage.setItem(CURRENT_KEY, project.id);
      setProjects(list);
    }, 500);
    return () => clearTimeout(t);
  }, [project]);

  // Playback.
  useEffect(() => {
    if (!playing) return;
    if (step >= steps.length - 1) {
      s.setPlaying(false);
      return;
    }
    const t = setTimeout(() => s.setStep(step + 1), 1400 / speed);
    return () => clearTimeout(t);
  }, [playing, step, steps.length, speed, s]);

  // Source line sync.
  const highlightLine = useCallback((line?: number) => {
    const ed = editorRef.current;
    if (!ed || !line) return;
    decoRef.current = ed.deltaDecorations(decoRef.current, [{ range: { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: 1 }, options: { isWholeLine: true, className: "ab-line-active", glyphMarginClassName: "ab-line-glyph" } }]);
    ed.revealLineInCenterIfOutsideViewport(line);
  }, []);
  useEffect(() => {
    if (current?.sourceLine) highlightLine(current.sourceLine);
  }, [current, highlightLine, leftTab]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || (e.target as HTMLElement)?.closest?.(".monaco-editor")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); }
      else if (e.key === "ArrowRight") s.setStep(step + 1);
      else if (e.key === "ArrowLeft") s.setStep(step - 1);
      else if (e.key === " ") { e.preventDefault(); s.setPlaying(!playing); }
      else if (e.key === "Escape") setPresenting(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s, step, playing]);

  const runAnalyze = async () => {
    if (!project.input.trim()) return;
    if (classification.needsMoreInfo) { setNotice({ kind: "clarify", text: classification.reason }); return; }
    setNotice(null);
    setLoading(true);
    const token = { cancelled: false };
    abortRef.current = token;
    try {
      const res = await analyze({ data: { input: project.input.slice(0, 20000), language: project.language } });
      if (token.cancelled) return;
      if (res.ok) {
        s.setAnalysis(res.analysis);
        setLeftTab("code");
        setMobileTab("center");
        toast.success(`Analyzed with ${res.provider}`);
      } else setNotice({ kind: res.kind, text: res.message });
    } catch (e) {
      if (!token.cancelled) setNotice({ kind: "error", text: "Request failed. Check your connection and try again." });
    } finally {
      if (!token.cancelled) setLoading(false);
    }
  };
  const cancel = () => { if (abortRef.current) abortRef.current.cancelled = true; setLoading(false); };

  const loadExample = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    const a = ex.build();
    s.loadProject({ ...newProject(), input: a.code, language: "python" });
    s.setAnalysis(a);
    setNotice(null);
    setLeftTab("code");
  };

  const focusNode = (n: ArchNode) => {
    setRightTab("node");
    if (n.data.line) { setLeftTab("code"); setTimeout(() => highlightLine(n.data.line), 30); }
    const idx = steps.findIndex((st) => st.activeNodeIds.includes(n.id));
    if (idx >= 0 && !current?.activeNodeIds.includes(n.id)) s.setStep(idx);
  };

  const exportImage = async (fmt: "png" | "jpg" | "svg") => {
    const el = document.querySelector(".ab-canvas .react-flow__viewport")?.parentElement as HTMLElement | null;
    if (!el) return;
    const opts = { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--ab-bg") || "#f7fafb", pixelRatio: 2, filter: (n: HTMLElement) => !n.classList?.contains("react-flow__minimap") && !n.classList?.contains("react-flow__controls") };
    const url = fmt === "png" ? await toPng(el, opts) : fmt === "jpg" ? await toJpeg(el, { ...opts, quality: 0.95 }) : await toSvg(el, opts);
    download(`${project.title || "algoboard"}.${fmt}`, url);
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ nodes: project.nodes, edges: project.edges, algoboard: analysis }, null, 2)], { type: "application/json" });
    download(`${project.title || "algoboard"}.json`, URL.createObjectURL(blob));
  };
  const importJson = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      if (raw.algoboard) {
        const a = sanitizeAnalysis(analysisSchema.parse(raw.algoboard));
        s.loadProject({ ...newProject(), input: a.code });
        s.setAnalysis(a);
      }
      if (Array.isArray(raw.nodes) && Array.isArray(raw.edges)) {
        const nodes = raw.nodes.filter((n: ArchNode) => n && typeof n.id === "string" && n.position && n.data);
        const ids = new Set(nodes.map((n: ArchNode) => n.id));
        s.setDiagram({ nodes, edges: raw.edges.filter((e: { source: string; target: string }) => ids.has(e.source) && ids.has(e.target)) });
      } else if (!raw.algoboard) throw new Error();
      toast.success("Diagram imported");
    } catch {
      toast.error("Invalid diagram JSON");
    }
  };

  const selectedNode = project.nodes.find((n) => n.id === s.selectedNodeId);
  const updateNode = (patch: Partial<ArchNode["data"]>) => {
    if (!selectedNode) return;
    s.setDiagram({ nodes: project.nodes.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, ...patch } } : n)), edges: project.edges });
  };

  const varHistory = useMemo(() => {
    if (!selectedVar) return [];
    return steps.filter((st) => st.changedValues.includes(selectedVar)).map((st) => st.stepIndex);
  }, [selectedVar, steps]);

  const player = (
    <div className={`ab-player ${presenting ? "is-present" : ""}`}>
      <button className="ab-icon" title="Restart" aria-label="Restart" onClick={() => { s.setStep(0); s.setPlaying(false); }} disabled={!steps.length}><RotateCcw size={15} /></button>
      <button className="ab-icon" title="Previous step (←)" aria-label="Previous step" onClick={() => s.setStep(step - 1)} disabled={!steps.length || step === 0}><ChevronLeft size={16} /></button>
      <button className="ab-icon is-primary" title="Play / pause (space)" aria-label={playing ? "Pause" : "Play"} onClick={() => { if (step >= steps.length - 1) s.setStep(0); s.setPlaying(!playing); }} disabled={!steps.length}>
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <button className="ab-icon" title="Next step (→)" aria-label="Next step" onClick={() => s.setStep(step + 1)} disabled={!steps.length || step >= steps.length - 1}><ChevronRight size={16} /></button>
      <input className="ab-timeline" type="range" min={0} max={Math.max(0, steps.length - 1)} value={step} onChange={(e) => s.setStep(Number(e.target.value))} aria-label="Seek step" disabled={!steps.length} />
      <span className="ab-mono ab-stepcount">{steps.length ? `${step + 1}/${steps.length}` : "0/0"}</span>
      <select className="ab-select ab-speed" value={speed} onChange={(e) => s.setSpeed(Number(e.target.value))} aria-label="Speed">
        {[0.5, 1, 1.5, 2, 3].map((v) => <option key={v} value={v}>{v}×</option>)}
      </select>
    </div>
  );

  const stepCard = current && (
    <div className="ab-stepcard" key={step}>
      <div className="ab-stepcard-head"><span className="ab-badge">STEP {step + 1}</span>{current.sourceLine && <span className="ab-mono ab-muted">line {current.sourceLine}</span>}</div>
      <strong>{current.title}</strong>
      {current.narration && <p>{current.narration}</p>}
    </div>
  );

  const canvas = (
    <div className={`ab-canvas ${reducedMotion ? "reduce-motion" : ""}`}>
      {project.nodes.length ? (
        <ReactFlowProvider>
          <FlowCanvas activeNodeIds={current?.activeNodeIds ?? []} activeEdgeIds={current?.activeEdgeIds ?? []} onNodeFocus={focusNode} minimap={!presenting} />
        </ReactFlowProvider>
      ) : (
        <div className="ab-empty">
          <Workflow size={30} />
          <h2>Paste code, a problem, or a LeetCode number</h2>
          <p>AlgoBoard builds the flowchart, an animated dry run, and the pattern insights.</p>
          <div className="ab-example-row">
            {EXAMPLES.map((e) => <button key={e.id} className="ab-btn" onClick={() => loadExample(e.id)}>{e.label}</button>)}
          </div>
        </div>
      )}
    </div>
  );

  if (presenting) {
    return (
      <div className={`ab-present ${reducedMotion ? "reduce-motion" : ""}`}>
        <div className="ab-present-bar">
          <div className="ab-brand-sm"><strong>{project.title}</strong><span>{analysis?.algorithmPattern}</span></div>
          {player}
          <button className="ab-icon ab-on-dark" aria-label="Exit presentation" title="Exit (Esc)" onClick={() => setPresenting(false)}><X size={16} /></button>
        </div>
        <div className="ab-present-body">
          {canvas}
          {current && <aside className="ab-present-side">{stepCard}<DryRunView step={current} /></aside>}
        </div>
      </div>
    );
  }

  return (
    <div className={`ab-shell ${reducedMotion ? "reduce-motion" : ""}`} data-mobile={mobileTab}>
      <header className="ab-top">
        <div className="ab-brand">
          <span className="ab-logo"><GitBranch size={16} /></span>
          <span className="ab-brand-name">AlgoBoard</span>
          <span className="ab-sep" />
          <input className="ab-title" value={project.title} onChange={(e) => s.setProject({ title: e.target.value })} aria-label="Project title" />
          {analysis && <span className="ab-pattern-pill">{analysis.algorithmPattern}</span>}
        </div>
        <div className="ab-top-tools">
          <button className="ab-icon" title="Undo (Ctrl+Z)" aria-label="Undo" onClick={s.undo} disabled={!s.past.length}><Undo2 size={15} /></button>
          <button className="ab-icon" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" onClick={s.redo} disabled={!s.future.length}><Redo2 size={15} /></button>
          <span className="ab-sep" />
          <div className="ab-menu-wrap">
            <button className="ab-btn" onClick={() => setShowProjects(!showProjects)}><FolderOpen size={14} /> Projects</button>
            {showProjects && (
              <div className="ab-menu" onMouseLeave={() => setShowProjects(false)}>
                <button className="ab-menu-item" onClick={() => { s.loadProject(newProject()); setShowProjects(false); setLeftTab("input"); }}><Plus size={13} /> New problem</button>
                {projects.map((p) => (
                  <div className="ab-menu-item" key={p.id}>
                    <button className="ab-menu-grow" onClick={() => { s.loadProject(p); setShowProjects(false); }}>{p.title || "Untitled"}</button>
                    <button className="ab-icon ab-icon-sm" aria-label="Delete project" onClick={() => { const l = readProjects().filter((x) => x.id !== p.id); writeProjects(l); setProjects(l); }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="ab-icon" title="Import diagram JSON" aria-label="Import JSON" onClick={() => fileRef.current?.click()}><Upload size={15} /></button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          <button className="ab-icon" title="Export diagram JSON" aria-label="Export JSON" onClick={exportJson} disabled={!project.nodes.length}><FileJson size={15} /></button>
          <div className="ab-menu-wrap ab-hover-menu">
            <button className="ab-icon" title="Export image" aria-label="Export image" disabled={!project.nodes.length}><Download size={15} /></button>
            <div className="ab-menu ab-menu-hover">
              {(["png", "jpg", "svg"] as const).map((f) => <button key={f} className="ab-menu-item" onClick={() => exportImage(f)}>Export {f.toUpperCase()}</button>)}
            </div>
          </div>
          <button className="ab-icon" title={dark ? "Light mode" : "Dark mode"} aria-label="Toggle dark mode" onClick={toggleTheme}>{dark ? <Sun size={15} /> : <Moon size={15} />}</button>
          <label className="ab-toggle" title="Reduced motion"><input type="checkbox" checked={reducedMotion} onChange={(e) => s.setReducedMotion(e.target.checked)} /> Reduce motion</label>
          <button className="ab-btn is-dark" onClick={() => setPresenting(true)} disabled={!project.nodes.length}><Presentation size={14} /> Present</button>
        </div>
      </header>

      <nav className="ab-mobile-tabs">
        {(["left", "center", "right"] as const).map((t) => (
          <button key={t} className={mobileTab === t ? "active" : ""} onClick={() => setMobileTab(t)}>{t === "left" ? "Input / Code" : t === "center" ? "Flow & Dry run" : "Insights"}</button>
        ))}
      </nav>

      <main className="ab-main">
        {/* LEFT */}
        <section className="ab-left">
          <div className="ab-tabs">
            <button className={leftTab === "input" ? "active" : ""} onClick={() => setLeftTab("input")}><Braces size={13} /> Input</button>
            <button className={leftTab === "code" ? "active" : ""} onClick={() => setLeftTab("code")} disabled={!analysis}><Code2 size={13} /> Code</button>
          </div>
          {leftTab === "input" ? (
            <div className="ab-input-pane">
              <textarea
                className="ab-input"
                value={project.input}
                onChange={(e) => s.setProject({ input: e.target.value.slice(0, 20000) })}
                placeholder={"Paste LeetCode code, a problem statement,\nor a problem number / URL (e.g. 42 or leetcode.com/problems/two-sum)"}
                spellCheck={false}
                aria-label="Problem input"
              />
              <div className="ab-detect">
                <span className="ab-mono">detected</span>
                <span className={`ab-type type-${classification.inputType}`}>{classification.inputType.replace("_", " ")}</span>
                {classification.language !== "plaintext" && <span className="ab-type">{classification.language}</span>}
                {classification.problemNumber && <span className="ab-type">#{classification.problemNumber}</span>}
                <span className="ab-mono ab-muted">{Math.round(classification.confidence * 100)}%</span>
              </div>
              {notice && <div className={`ab-notice is-${notice.kind}`}>{notice.text}</div>}
              <div className="ab-input-actions">
                <select className="ab-select" value={project.language} onChange={(e) => s.setProject({ language: e.target.value })} aria-label="Solution language">
                  {LANGS.map((l) => <option key={l}>{l}</option>)}
                </select>
                <button className="ab-icon" title="Clear input" aria-label="Clear input" onClick={() => { s.setProject({ input: "" }); setNotice(null); }}><Eraser size={15} /></button>
                <select className="ab-select" value="" onChange={(e) => loadExample(e.target.value)} aria-label="Load example">
                  <option value="" disabled>Examples…</option>
                  {EXAMPLES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
                {loading ? (
                  <button className="ab-btn is-primary ab-grow" onClick={cancel}><Loader2 size={14} className="ab-spin" /> Cancel</button>
                ) : (
                  <button className="ab-btn is-primary ab-grow" onClick={runAnalyze} disabled={!project.input.trim()}><Sparkles size={14} /> Analyze</button>
                )}
              </div>
            </div>
          ) : (
            <div className="ab-editor">
              <MonacoEditor
                height="100%"
                language={analysis?.language === "cpp" ? "cpp" : analysis?.language || "python"}
                theme={dark ? "vs-dark" : "light"}
                value={analysis?.code ?? ""}
                onMount={(ed) => { editorRef.current = ed; if (current?.sourceLine) highlightLine(current.sourceLine); }}
                onChange={(v) => analysis && s.setProject({ analysis: { ...analysis, code: v ?? "" } })}
                options={{ automaticLayout: true, minimap: { enabled: false }, fontSize: 13, fontFamily: "DM Mono, monospace", glyphMargin: true, lineNumbersMinChars: 3, scrollBeyondLastLine: false, padding: { top: 12 } }}
              />
            </div>
          )}
        </section>

        {/* CENTER */}
        <section className="ab-center">
          <div className="ab-center-head">
            <div className="ab-seg">
              <button className="active"><Workflow size={13} /> Flowchart</button>
              <button className={dock ? "active" : ""} onClick={() => setDock(!dock)} disabled={!steps.length}><Play size={13} /> Dry run</button>
            </div>
            {analysis && <span className="ab-mono ab-muted ab-truncate">input: {analysis.dryRun.input}</span>}
            <div className="ab-legend">
              {(["start", "process", "decision", "loop", "call", "return"] as const).map((k) => (
                <span key={k}><i style={{ background: KIND_THEME[k].fill, borderColor: KIND_THEME[k].border }} />{k}</span>
              ))}
            </div>
          </div>
          {canvas}
          {dock && current && (
            <div className="ab-dock">
              <div className="ab-dock-head">{player}</div>
              <div className="ab-dock-body">
                {stepCard}
                <DryRunView step={current} />
              </div>
            </div>
          )}
        </section>

        {/* RIGHT */}
        <aside className="ab-right">
          <div className="ab-tabs">
            <button className={rightTab === "insights" ? "active" : ""} onClick={() => setRightTab("insights")}><Lightbulb size={13} /> Insights</button>
            <button className={rightTab === "step" ? "active" : ""} onClick={() => setRightTab("step")}><BookOpen size={13} /> State</button>
            <button className={rightTab === "node" ? "active" : ""} onClick={() => setRightTab("node")}><Workflow size={13} /> Node</button>
          </div>
          <div className="ab-right-body">
            {!analysis && <p className="ab-muted">Run an analysis or load an example to see insights.</p>}
            {analysis && rightTab === "insights" && (
              <div className="ab-insights">
                <div className="ab-ai-label">AI-generated · confidence {Math.round(analysis.confidence * 100)}%</div>
                <h3>{analysis.problem.title}</h3>
                {analysis.normalizedProblem && <p>{analysis.normalizedProblem}</p>}
                <div className="ab-kpis">
                  <div><span>Pattern</span><b>{analysis.insights.patternName || analysis.algorithmPattern}</b></div>
                  <div><span>Time</span><b className="ab-mono">{analysis.insights.timeComplexity}</b></div>
                  <div><span>Space</span><b className="ab-mono">{analysis.insights.spaceComplexity}</b></div>
                </div>
                {analysis.secondaryPatterns.length > 0 && <div className="ab-chips">{analysis.secondaryPatterns.map((p) => <span className="ab-chip" key={p}>{p}</span>)}</div>}
                <h4>Why this pattern</h4><p>{analysis.insights.whyThisPattern}</p>
                <h4>Approach</h4><ol>{analysis.insights.approach.map((a, i) => <li key={i}>{a}</li>)}</ol>
                <h4>Pseudocode</h4><pre className="ab-pre">{analysis.insights.pseudocode}</pre>
                <h4>Invariant</h4><p className="ab-invariant">{analysis.insights.invariant}</p>
                <h4>Edge cases</h4><ul>{analysis.insights.edgeCases.map((a, i) => <li key={i}>{a}</li>)}</ul>
                <h4>Common mistakes</h4><ul>{analysis.insights.commonMistakes.map((a, i) => <li key={i}>{a}</li>)}</ul>
                {analysis.insights.alternativeApproach && (<><h4>Alternative</h4><p>{analysis.insights.alternativeApproach}</p></>)}
                {analysis.assumptions.length > 0 && (<><h4>Assumptions (not verified)</h4><ul className="ab-muted">{analysis.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></>)}
                {analysis.warnings.length > 0 && (<><h4>Warnings</h4><ul className="ab-warn">{analysis.warnings.map((a, i) => <li key={i}>{a}</li>)}</ul></>)}
              </div>
            )}
            {analysis && rightTab === "step" && current && (
              <div className="ab-insights">
                {stepCard}
                {current.invariant && (<><h4>Invariant</h4><p className="ab-invariant">{current.invariant}</p></>)}
                <h4>Variables</h4>
                <div className="ab-vars">
                  {Object.entries(current.variables).map(([k, v]) => (
                    <button key={k} className={`ab-var ${current.changedValues.includes(k) ? "is-changed" : ""} ${selectedVar === k ? "is-sel" : ""}`} onClick={() => setSelectedVar(selectedVar === k ? null : k)}>
                      <span>{k}</span><b>{v}</b>
                    </button>
                  ))}
                </div>
                {selectedVar && (
                  <div className="ab-varhist">
                    <span className="ab-muted">{selectedVar} changes at steps:</span>
                    {varHistory.length ? varHistory.map((i) => <button key={i} className="ab-chip" onClick={() => s.setStep(i)}>{i + 1}{steps[i].sourceLine ? ` · L${steps[i].sourceLine}` : ""}</button>) : <span className="ab-muted"> never</span>}
                  </div>
                )}
                <h4>All steps</h4>
                <ol className="ab-steplist">
                  {steps.map((st) => (
                    <li key={st.stepIndex}><button className={st.stepIndex === step ? "active" : ""} onClick={() => s.setStep(st.stepIndex)}>{st.title}</button></li>
                  ))}
                </ol>
              </div>
            )}
            {analysis && rightTab === "node" && (
              selectedNode ? (
                <div className="ab-insights">
                  <h4>Label</h4>
                  <input className="ab-field" value={selectedNode.data.label} onChange={(e) => updateNode({ label: e.target.value })} />
                  <h4>Font size</h4>
                  <input type="range" min={10} max={18} value={selectedNode.data.fontSize} onChange={(e) => updateNode({ fontSize: Number(e.target.value) })} />
                  <h4>Theme</h4>
                  <div className="ab-swatches">
                    {SWATCHES.map(([fill, border, text]) => (
                      <button key={fill} aria-label={`Theme ${fill}`} style={{ background: fill, borderColor: border, color: text }} onClick={() => updateNode({ fill, border, textColor: text })}>Aa</button>
                    ))}
                  </div>
                  <p className="ab-muted ab-mono">{selectedNode.data.flowKind} · {selectedNode.id}{selectedNode.data.line ? ` · line ${selectedNode.data.line}` : ""}</p>
                  <button className="ab-btn" onClick={() => s.setDiagram({ nodes: project.nodes.filter((n) => n.id !== selectedNode.id), edges: project.edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id) })}><Trash2 size={13} /> Delete node</button>
                </div>
              ) : <p className="ab-muted">Click a flowchart node to edit it and jump to its code line.</p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
