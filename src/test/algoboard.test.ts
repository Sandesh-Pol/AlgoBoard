import { describe, expect, it, vi } from "vitest";
import { classifyInput } from "@/lib/analysis/classify";
import { analysisSchema, sanitizeAnalysis } from "@/lib/analysis/schema";
import { layoutFlowchart } from "@/lib/diagrams/layout";
import { completeJson, getProviders } from "@/lib/providers/llm";
import { EXAMPLES } from "@/lib/traces/examples";

describe("classifier", () => {
  it("detects a LeetCode number", () => {
    const c = classifyInput("42");
    expect(c.inputType).toBe("leetcode_reference");
    expect(c.problemNumber).toBe(42);
  });
  it("detects a LeetCode URL", () => {
    expect(classifyInput("https://leetcode.com/problems/two-sum/").problemSlug).toBe("two-sum");
  });
  it("detects python code", () => {
    const c = classifyInput("def f(nums):\n    l = 0\n    for x in nums:\n        l += x\n    return l");
    expect(c.inputType).toBe("code");
    expect(c.language).toBe("python");
  });
  it("detects a problem statement", () => {
    expect(classifyInput("Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. Example: nums = [2,7]").inputType).toBe("problem_statement");
  });
  it("flags ambiguous input", () => {
    expect(classifyInput("hi").needsMoreInfo).toBe(true);
    expect(classifyInput("   ").inputType).toBe("unknown");
  });
});

describe("examples & diagrams", () => {
  for (const ex of EXAMPLES) {
    it(`${ex.id} is valid, deterministic and laid out without overlap`, () => {
      const a = sanitizeAnalysis(analysisSchema.parse(ex.build()));
      expect(a.dryRun.steps.length).toBeGreaterThan(3);
      expect(JSON.stringify(ex.build().dryRun)).toBe(JSON.stringify(ex.build().dryRun));
      const { nodes, edges } = layoutFlowchart(a.flowchart);
      const ids = new Set(nodes.map((n) => n.id));
      edges.forEach((e) => expect(ids.has(e.source) && ids.has(e.target)).toBe(true));
      nodes.forEach((n) => expect(n.type).toBe("shape"));
      for (const a1 of nodes) for (const b of nodes) {
        if (a1 === b) continue;
        const overlap = a1.position.x < b.position.x + b.width && b.position.x < a1.position.x + a1.width && a1.position.y < b.position.y + b.height && b.position.y < a1.position.y + a1.height;
        expect(overlap).toBe(false);
      }
    });
  }
  it("drops dangling edges from invalid diagrams", () => {
    const a = EXAMPLES[0].build();
    a.flowchart.edges.push({ id: "bad", source: "n1", target: "nope" });
    expect(sanitizeAnalysis(a).flowchart.edges.some((e) => e.id === "bad")).toBe(false);
  });
});

describe("providers", () => {
  const env = { NVIDIA_API_KEY: "a", GROQ_API_KEY: "b" };
  it("orders by LLM_PROVIDER", () => {
    expect(getProviders(env)[0].name).toBe("nvidia");
    expect(getProviders({ ...env, LLM_PROVIDER: "groq" })[0].name).toBe("groq");
  });
  it("falls back to groq when nvidia fails", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes("nvidia") ? new Response("", { status: 503 }) : new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":1}' } }] })),
    ) as unknown as typeof fetch;
    const r = await completeJson(getProviders(env), "s", "u", (x) => x, { fetchImpl, retries: 0 });
    expect(r.provider).toBe("groq");
  });
  it("reports timeout as failure", async () => {
    const fetchImpl = ((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener("abort", () => rej(Object.assign(new Error("x"), { name: "AbortError" }))))) as unknown as typeof fetch;
    await expect(completeJson(getProviders({ GROQ_API_KEY: "b" }), "s", "u", (x) => x, { fetchImpl, retries: 0, timeoutMs: 10 })).rejects.toThrow(/Timed out/);
  });
});
