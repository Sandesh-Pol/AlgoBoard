import type { InputType } from "./schema";

export type Classification = {
  inputType: InputType;
  language: string;
  confidence: number;
  problemNumber?: number;
  problemSlug?: string;
  url?: string;
  needsMoreInfo: boolean;
  reason: string;
};

const LANG_RULES: [string, RegExp[]][] = [
  ["python", [/^\s*def \w+\(/m, /^\s*class \w+(\(.*\))?:\s*$/m, /\bself\b/, /\belif\b/, /:\s*$/m]],
  ["java", [/public (static )?\w+(<.*>)? \w+\(/, /\bnew int\[/, /System\.out/, /\bList<Integer>/]],
  ["cpp", [/#include\s*</, /\bvector</, /std::/, /\bunordered_map</, /->\s*\w+/]],
  ["typescript", [/:\s*(number|string|boolean)(\[\])?\b/, /\binterface \w+/, /function \w+\(.*:\s*\w+/]],
  ["javascript", [/\bfunction\b/, /=>/, /\b(const|let|var) \w+\s*=/, /console\.log/]],
  ["go", [/^\s*func \w+\(/m, /:=/, /\bpackage main\b/]],
  ["rust", [/\bfn \w+\(/, /\blet mut\b/, /impl Solution/]],
  ["csharp", [/public class \w+/, /\bvar \w+ = new\b/, /int\[\] \w+/]],
];

export function detectLanguage(text: string): string {
  let best = "plaintext";
  let bestScore = 0;
  for (const [lang, rules] of LANG_RULES) {
    const score = rules.reduce((n, r) => n + (r.test(text) ? 1 : 0), 0);
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return bestScore >= 1 ? best : "plaintext";
}

function codeScore(text: string): number {
  const lines = text.split("\n").filter((l) => l.trim());
  if (!lines.length) return 0;
  const signals = [/[;{}]\s*$/, /^\s*(def|class|function|func|fn|public|private|for|while|if|return|const|let|var|int|#include)\b/, /\w+\s*\(.*\)\s*[:{]?\s*$/, /[=!<>]=|\+\+|--|\+=|-=|=>|->/, /^\s{2,}\S/];
  let hits = 0;
  for (const l of lines) if (signals.some((s) => s.test(l))) hits++;
  return hits / lines.length;
}

function proseScore(text: string): number {
  const keywords = /\b(given|return|example|constraints|input:|output:|explanation|you may assume|find|determine|array of|integer|string s)\b/gi;
  const k = (text.match(keywords) ?? []).length;
  const sentences = (text.match(/[a-z][^.\n]{20,}[.?]/gi) ?? []).length;
  return Math.min(1, k * 0.12 + sentences * 0.08);
}

export function classifyInput(raw: string): Classification {
  const text = raw.trim();
  if (!text) return { inputType: "unknown", language: "plaintext", confidence: 0, needsMoreInfo: true, reason: "Input is empty." };

  const url = text.match(/https?:\/\/(?:www\.)?leetcode\.(?:com|cn)\/problems\/([a-z0-9-]+)/i);
  const num = text.match(/^(?:leetcode|lc|problem)?\s*#?\s*(\d{1,4})\s*\.?\s*([a-z][\w\s-]{0,60})?$/i);

  const cs = codeScore(text);
  const ps = proseScore(text);
  const lineCount = text.split("\n").length;

  if (url && text.length < 200) {
    return { inputType: "leetcode_reference", language: "plaintext", confidence: 0.97, url: url[0], problemSlug: url[1], needsMoreInfo: false, reason: "LeetCode URL detected." };
  }
  if (num && text.length < 80) {
    return { inputType: "leetcode_reference", language: "plaintext", confidence: 0.92, problemNumber: Number(num[1]), needsMoreInfo: false, reason: "LeetCode problem number detected." };
  }

  const language = detectLanguage(text);
  const looksCode = cs >= 0.45 && lineCount >= 2 && language !== "plaintext";
  const hasProse = ps >= 0.35;

  if (looksCode && hasProse && cs < 0.85) {
    return { inputType: "mixed", language, confidence: 0.75, needsMoreInfo: false, reason: "Problem statement with code." };
  }
  if (looksCode) {
    return { inputType: "code", language, confidence: Math.min(0.99, 0.55 + cs * 0.45), needsMoreInfo: false, reason: `Source code detected (${language}).` };
  }
  if (hasProse) {
    return { inputType: "problem_statement", language: "plaintext", confidence: Math.min(0.95, 0.5 + ps / 2), needsMoreInfo: false, reason: "Problem statement detected." };
  }
  if (text.split(/\s+/).length >= 6) {
    return { inputType: "problem_statement", language: "plaintext", confidence: 0.45, needsMoreInfo: false, reason: "Short description; treated as a problem statement." };
  }
  return { inputType: "unknown", language, confidence: 0.2, needsMoreInfo: true, reason: "Too little information. Paste code, a full problem statement, or a LeetCode number/URL." };
}
