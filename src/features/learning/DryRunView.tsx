import type { TraceStep } from "@/lib/analysis/schema";

const treeLayout = (nodes: TraceStep["treeState"]["nodes"]) => {
  const children = new Map<string | undefined, string[]>();
  nodes.forEach((n) => {
    const p = n.parent && nodes.some((x) => x.id === n.parent) ? n.parent : undefined;
    children.set(p, [...(children.get(p) ?? []), n.id]);
  });
  const pos = new Map<string, { x: number; y: number }>();
  let leaf = 0;
  let maxDepth = 0;
  const place = (id: string, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = children.get(id) ?? [];
    let x: number;
    if (!kids.length) x = leaf++;
    else {
      const xs = kids.map((k) => place(k, depth + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    pos.set(id, { x, y: depth });
    return x;
  };
  (children.get(undefined) ?? []).forEach((r) => place(r, 0));
  return { pos, width: Math.max(1, leaf), depth: maxDepth + 1 };
};

function Tree({ nodes }: { nodes: TraceStep["treeState"]["nodes"] }) {
  const { pos, width, depth } = treeLayout(nodes);
  const CW = 92;
  const RH = 58;
  const w = width * CW + 20;
  const h = depth * RH + 10;
  return (
    <div className="ab-ds">
      <div className="ab-ds-title">recursion / decision tree</div>
      <div className="ab-tree-scroll">
        <svg width={w} height={h} role="img" aria-label="Recursion tree">
          {nodes.map((n) => {
            const p = n.parent ? pos.get(n.parent) : undefined;
            const c = pos.get(n.id);
            if (!p || !c) return null;
            return <line key={`l${n.id}`} x1={p.x * CW + 10 + CW / 2} y1={p.y * RH + 34} x2={c.x * CW + 10 + CW / 2} y2={c.y * RH + 8} className="ab-tree-edge" />;
          })}
          {nodes.map((n) => {
            const c = pos.get(n.id);
            if (!c) return null;
            return (
              <g key={n.id} transform={`translate(${c.x * CW + 14}, ${c.y * RH + 8})`} className={`ab-tree-node is-${n.state}`}>
                <rect width={CW - 8} height={26} rx={13} />
                <text x={(CW - 8) / 2} y={17} textAnchor="middle">
                  {n.label.length > 13 ? n.label.slice(0, 12) + "…" : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function DryRunView({ step }: { step: TraceStep }) {
  const empty =
    !step.arrayState.length && !step.mapState.length && !step.setState.length && !step.stackState.length && !step.queueState.length && !step.treeState.nodes.length && !step.tableState.length;
  return (
    <div className="ab-dryrun">
      {step.arrayState.map((a) => {
        const ptrAt = new Map<number, string[]>();
        Object.entries(a.pointers).forEach(([k, v]) => ptrAt.set(v, [...(ptrAt.get(v) ?? []), k]));
        const [wl, wr] = a.window ?? [];
        return (
          <div className="ab-ds" key={`a-${a.name}`}>
            <div className="ab-ds-title">{a.name}</div>
            <div className="ab-array">
              {a.values.map((v, i) => {
                const inWin = wl != null && wr != null && i >= wl && i <= wr;
                const cls = ["ab-cell", a.highlight.includes(i) && "is-hl", inWin && "is-win", a.discarded?.includes(i) && "is-out"].filter(Boolean).join(" ");
                return (
                  <div className="ab-cell-wrap" key={i}>
                    <div className={cls}>{v}</div>
                    <div className="ab-idx">{i}</div>
                    <div className="ab-ptrs">
                      {(ptrAt.get(i) ?? []).map((p) => (
                        <span key={p} className="ab-ptr">
                          ▲{p}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {step.tableState.map((t) => (
        <div className="ab-ds" key={`t-${t.name}`}>
          <div className="ab-ds-title">{t.name}</div>
          <table className="ab-table">
            {t.colLabels && (
              <thead>
                <tr>
                  {t.rowLabels && <th />}
                  {t.colLabels.map((c, i) => (
                    <th key={i}>{c}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {t.rows.map((r, ri) => (
                <tr key={ri}>
                  {t.rowLabels && <th>{t.rowLabels[ri]}</th>}
                  {r.map((c, ci) => (
                    <td key={ci} className={t.highlight.some(([a, b]) => a === ri && b === ci) ? "is-hl" : ""}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {step.treeState.nodes.length > 0 && <Tree nodes={step.treeState.nodes} />}
      <div className="ab-ds-row">
        {step.mapState.map((m) => (
          <div className="ab-ds" key={`m-${m.name}`}>
            <div className="ab-ds-title">{m.name} · map</div>
            <div className="ab-map">
              {m.entries.length === 0 && <span className="ab-muted">empty</span>}
              {m.entries.map((e) => (
                <div key={e.key} className={`ab-kv ${m.highlightKey === e.key ? "is-hl" : ""}`}>
                  <b>{e.key}</b>
                  <span>{e.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {step.setState.map((m) => (
          <div className="ab-ds" key={`s-${m.name}`}>
            <div className="ab-ds-title">{m.name} · set</div>
            <div className="ab-chips">{m.items.length ? m.items.map((x, i) => <span key={i} className="ab-chip">{x}</span>) : <span className="ab-muted">empty</span>}</div>
          </div>
        ))}
        {step.stackState.map((m) => (
          <div className="ab-ds" key={`st-${m.name}`}>
            <div className="ab-ds-title">{m.name} · stack (top ↑)</div>
            <div className="ab-stack">
              {[...m.items].reverse().map((x, i) => (
                <span key={i} className={`ab-chip ${i === 0 ? "is-top" : ""}`}>
                  {x}
                </span>
              ))}
              {!m.items.length && <span className="ab-muted">empty</span>}
            </div>
          </div>
        ))}
        {step.queueState.map((m) => (
          <div className="ab-ds" key={`q-${m.name}`}>
            <div className="ab-ds-title">{m.name} · queue (front →)</div>
            <div className="ab-chips">{m.items.length ? m.items.map((x, i) => <span key={i} className={`ab-chip ${i === 0 ? "is-top" : ""}`}>{x}</span>) : <span className="ab-muted">empty</span>}</div>
          </div>
        ))}
      </div>
      {empty && <div className="ab-muted">No data structures for this step — see variables.</div>}
    </div>
  );
}
