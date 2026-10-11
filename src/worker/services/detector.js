import { runProvider } from "./engine.js";
import { chunkText } from "./chunking.js";

/**
 * AI-writing-pattern analysis.
 *
 * IMPORTANT HONESTY CONTRACT:
 * This is an LLM-based heuristic analysis of writing patterns, NOT a
 * scientifically validated AI detector. There is no invented confidence
 * score. The output is always labeled as an estimate that can be wrong:
 * human-written text can show these patterns, and AI-assisted text can
 * miss them. Results must never drive academic, employment, disciplinary,
 * or other high-stakes decisions on their own.
 */

const DETECTOR_SYSTEM_PROMPT = `You analyze writing style for patterns that are commonly associated with AI-assisted drafting. This is a heuristic style analysis, not a validated AI detector.

Examine the text and return ONLY a JSON object with exactly these keys:
{
  "assessment": "low" | "mixed" | "elevated",
  "explanation": "2-3 sentences explaining what the assessment means and its limits, in plain language",
  "sentenceObservations": [{"quote": "short excerpt, max 25 words", "note": "what pattern this shows, max 20 words"}],
  "repetitivePatterns": ["observed repetitive or formulaic constructions, max 4 items"],
  "writingObservations": ["neutral observations about structure, vocabulary, rhythm, max 5 items"],
  "suggestions": ["practical writing improvements: specificity, examples, varied rhythm, concrete detail, max 5 items"]
}

Rules:
- "assessment" describes how many AI-associated writing patterns you observe: "low" (few or none), "mixed" (some passages), "elevated" (many throughout). It is NOT a probability that a machine wrote the text.
- Quote excerpts verbatim from the text. Keep each list short and specific; skip empty sections with [].
- Do not invent scores, percentages, or model names. Do not claim certainty.
- The explanation must say the result is an estimate and may be wrong.`;

export const DETECT_ASSESSMENT_LABELS = {
  low: "Low AI-pattern signals",
  mixed: "Mixed AI-pattern signals",
  elevated: "Elevated AI-pattern signals",
};

function stripCodeFences(raw) {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z]*\n?/, "").replace(/```\s*$/, "").trim();
  }
  return text;
}

function coerceString(value, maxLen = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function coerceStringArray(value, maxItems = 6, maxLen = 300) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => coerceString(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

/**
 * Parse the model's JSON, tolerating fences and surrounding prose.
 * Returns a normalized analysis object, or a fallback object that keeps
 * the raw text when parsing fails.
 */
export function parseAnalysisResponse(raw) {
  const fallback = {
    assessment: "mixed",
    explanation:
      "The analysis could not be structured automatically, so treat this as an unclassified estimate. " +
      "Pattern analysis is heuristic and may be wrong.",
    sentenceObservations: [],
    repetitivePatterns: [],
    writingObservations: [],
    suggestions: [],
    unstructured: true,
    rawText: coerceString(raw, 4000),
  };

  let text = stripCodeFences(raw);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return fallback;

  let parsed;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return fallback;
  }
  if (!parsed || typeof parsed !== "object") return fallback;

  const assessment = ["low", "mixed", "elevated"].includes(parsed.assessment)
    ? parsed.assessment
    : "mixed";

  return {
    assessment,
    explanation: coerceString(parsed.explanation, 600) || fallback.explanation,
    sentenceObservations: Array.isArray(parsed.sentenceObservations)
      ? parsed.sentenceObservations
          .filter((o) => o && typeof o === "object")
          .map((o) => ({
            quote: coerceString(o.quote, 160),
            note: coerceString(o.note, 160),
          }))
          .filter((o) => o.quote && o.note)
          .slice(0, 8)
      : [],
    repetitivePatterns: coerceStringArray(parsed.repetitivePatterns, 4),
    writingObservations: coerceStringArray(parsed.writingObservations, 5),
    suggestions: coerceStringArray(parsed.suggestions, 5),
    unstructured: false,
  };
}

function mergeAssessments(assessments) {
  const order = { low: 0, mixed: 1, elevated: 2 };
  // Use the highest observed level across chunks, labeled honestly.
  return assessments.reduce(
    (acc, a) => (order[a] > order[acc] ? a : acc),
    "low",
  );
}

function dedupeKeepOrder(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/**
 * Analyze text chunk-by-chunk and merge the per-chunk analyses into one
 * document-level result. Keeps the number of chunks bounded so a single
 * request stays within provider and runtime limits.
 */
export async function analyzeDocument(env, { text, provider, onProgress, maxChunks = 8 }) {
  const chunks = chunkText(text, 6500).slice(0, maxChunks);
  const analyses = [];
  const used = new Set();

  for (let i = 0; i < chunks.length; i++) {
    const result = await runProvider(
      env,
      provider,
      DETECTOR_SYSTEM_PROMPT,
      chunks[i],
      { temperature: 0.2, maxTokens: 2048 },
    );
    analyses.push(parseAnalysisResponse(result.text));
    used.add(result.provider === "cloudflare" ? "Cloudflare Workers AI" : "External AI");
    if (onProgress) {
      await onProgress({ done: i + 1, total: chunks.length });
    }
  }

  const sentenceObservations = analyses
    .flatMap((a) => a.sentenceObservations)
    .slice(0, 10);

  return {
    method: "ai-writing-pattern-analysis",
    assessment: mergeAssessments(analyses.map((a) => a.assessment)),
    assessmentLabel: null, // filled by the route for i18n-free labeling
    explanation:
      "This is a heuristic analysis of writing patterns, not a validated AI detector. " +
      "It estimates how many AI-associated style patterns appear in the text; the estimate can be wrong. " +
      "Human-written text can be flagged and AI-assisted text can be missed. " +
      "Do not use this result alone for academic, employment, disciplinary, or other high-stakes decisions.",
    sectionsAnalyzed: chunks.length,
    sentenceObservations,
    repetitivePatterns: dedupeKeepOrder(
      analyses.flatMap((a) => a.repetitivePatterns),
    ).slice(0, 6),
    writingObservations: dedupeKeepOrder(
      analyses.flatMap((a) => a.writingObservations),
    ).slice(0, 8),
    suggestions: dedupeKeepOrder(analyses.flatMap((a) => a.suggestions)).slice(0, 8),
    providersUsed: [...used],
    truncated: chunkText(text, 6500).length > maxChunks,
  };
}
