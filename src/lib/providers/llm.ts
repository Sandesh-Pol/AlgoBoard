export type ProviderName = "nvidia" | "groq";

export type ProviderConfig = {
  name: ProviderName;
  apiKey?: string;
  model: string;
  url: string;
};

export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: ProviderName,
    public transient: boolean,
    public status?: number,
  ) {
    super(message);
  }
}

export type Env = { NVIDIA_API_KEY?: string; NVIDIA_MODEL?: string; GROQ_API_KEY?: string; GROQ_MODEL?: string; LLM_PROVIDER?: string };

export function getProviders(env: Env): ProviderConfig[] {
  const nvidia: ProviderConfig = {
    name: "nvidia",
    apiKey: env.NVIDIA_API_KEY,
    model: env.NVIDIA_MODEL || "deepseek-ai/deepseek-v4.1-flash",
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
  };
  const groq: ProviderConfig = {
    name: "groq",
    apiKey: env.GROQ_API_KEY,
    model: env.GROQ_MODEL || "qwen/qwen3.8-27b",
    url: "https://api.groq.com/openai/v1/chat/completions",
  };
  const order = env.LLM_PROVIDER === "groq" ? [groq, nvidia] : [nvidia, groq];
  return order.filter((p) => !!p.apiKey);
}

export function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : content;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in model response");
  return JSON.parse(body.slice(start, end + 1));
}

type FetchLike = typeof fetch;

async function callOnce(p: ProviderConfig, system: string, user: string, timeoutMs: number, fetchImpl: FetchLike) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(p.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({
        model: p.model,
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const transient = res.status === 429 || res.status >= 500;
      throw new ProviderError(res.status === 429 ? "Rate limited" : `Provider returned ${res.status}`, p.name, transient, res.status);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new ProviderError("Empty response", p.name, true);
    return content;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if ((e as Error).name === "AbortError") throw new ProviderError("Timed out", p.name, true);
    throw new ProviderError((e as Error).message || "Network error", p.name, true);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls providers in configured order. Retries transient errors once per provider,
 * then falls back to the next provider. `parse` validates the content; a validation
 * failure also triggers fallback.
 */
export async function completeJson<T>(
  providers: ProviderConfig[],
  system: string,
  user: string,
  parse: (raw: unknown) => T,
  opts: { timeoutMs?: number; fetchImpl?: FetchLike; retries?: number } = {},
): Promise<{ result: T; provider: ProviderName; model: string }> {
  if (!providers.length) throw new ProviderError("No AI provider is configured. Add NVIDIA_API_KEY or GROQ_API_KEY.", "nvidia", false);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const errors: string[] = [];
  for (const p of providers) {
    for (let attempt = 0; attempt <= (opts.retries ?? 1); attempt++) {
      try {
        const content = await callOnce(p, system, user, opts.timeoutMs ?? 60000, fetchImpl);
        const result = parse(extractJson(content));
        return { result, provider: p.name, model: p.model };
      } catch (e) {
        const msg = `${p.name}: ${(e as Error).message}`;
        errors.push(msg);
        const transient = e instanceof ProviderError ? e.transient : false;
        if (!transient && e instanceof ProviderError) break;
      }
    }
  }
  throw new Error(`All providers failed — ${errors.join(" | ")}`);
}
