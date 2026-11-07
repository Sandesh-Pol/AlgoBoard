import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analysisSchema, clarificationSchema, sanitizeAnalysis, type Analysis } from "./schema";
import { classifyInput } from "./classify";

export type AnalyzeResult =
  | { ok: true; analysis: Analysis; provider: string; model: string }
  | { ok: false; kind: "clarify" | "error"; message: string };

export const analyzeInput = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      input: z.string().min(1).max(20000),
      language: z.string().max(30).default("python"),
    }),
  )
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    const { completeJson, getProviders } = await import("../providers/llm");
    const { SYSTEM_PROMPT, buildUserPrompt } = await import("./prompt");
    const c = classifyInput(data.input);
    if (c.needsMoreInfo) return { ok: false, kind: "clarify", message: c.reason };

    const providers = getProviders(process.env as never);
    if (!providers.length) {
      return { ok: false, kind: "error", message: "No AI provider key is configured yet. Add an NVIDIA or Groq API key to enable live analysis — the built-in examples still work." };
    }
    try {
      const { result, provider, model } = await completeJson(
        providers,
        SYSTEM_PROMPT,
        buildUserPrompt(data.input, c, data.language),
        (raw) => {
          const r = raw as { needsMoreInfo?: boolean };
          if (r && r.needsMoreInfo === true) return { clarify: clarificationSchema.parse(raw) };
          return { analysis: sanitizeAnalysis(analysisSchema.parse(raw)) };
        },
      );
      if ("clarify" in result) return { ok: false, kind: "clarify", message: result.clarify!.clarification };
      return { ok: true, analysis: { ...result.analysis, requestId: crypto.randomUUID() }, provider, model };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown provider error";
      console.error("analyze failed:", message.slice(0, 500));
      return { ok: false, kind: "error", message: `AI analysis failed: ${message.slice(0, 300)}` };
    }
  });
