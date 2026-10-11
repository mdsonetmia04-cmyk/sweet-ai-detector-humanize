import { callCloudflareAI } from "../providers/cloudflare.js";
import {
  callExternalAI,
  callUserProvider,
  externalConfigured,
} from "../providers/external.js";
import { chunkText } from "./chunking.js";

/**
 * Provider abstraction for the hybrid AI engine.
 *
 * provider = "auto"        -> Cloudflare Workers AI first, external fallback
 * provider = "cloudflare"  -> Cloudflare Workers AI only
 * provider = "external"    -> external OpenAI-compatible API only
 */

export const MODES = {
  humanize: {
    label: "Natural Humanize",
    instruction:
      "Rewrite the supplied text so it reads naturally and fluently, as if written by a careful human writer. " +
      "Vary sentence length and structure where it helps, remove stiff, repetitive, or formulaic phrasing, and smooth the transitions between sentences and paragraphs. " +
      "Preserve the original meaning, intent, names, dates, numbers, factual claims, quotations, citations, and URLs exactly. " +
      "Do not add new facts, invented personal experiences, unsupported claims, or fake references. " +
      "Do not rewrite passages that are already clear and natural; leave them alone. " +
      "Do not mention AI detection and do not claim the text is human-written. Return only the revised text, with no commentary.",
  },
  clarity: {
    label: "Improve Clarity",
    instruction:
      "Edit the supplied text for clarity and logical flow. Prefer concrete, direct wording; break up convoluted sentences; " +
      "make the relationships between ideas explicit without changing what is being said. " +
      "Preserve the original meaning, names, dates, numbers, factual claims, quotations, citations, and URLs. " +
      "Do not add new claims or commentary. Return only the revised text.",
  },
  grammar: {
    label: "Grammar Correction",
    instruction:
      "Correct spelling, grammar, punctuation, capitalization, and obvious word-choice errors in the supplied text. " +
      "Make the smallest changes needed and do not rewrite the passage beyond what is required to fix the errors. " +
      "Preserve the original voice, meaning, names, quotations, citations, and formatting. Return only the corrected text.",
  },
  professional: {
    label: "Professional Writing",
    instruction:
      "Rewrite the supplied text in a polished, professional tone suitable for business communication, reports, and client-facing material. " +
      "Keep it direct and readable: remove slang, hedged filler, and awkward phrasing, but avoid stiff corporate jargon. " +
      "Preserve the original meaning, names, dates, numbers, factual claims, quotations, citations, and URLs. " +
      "Do not add new facts or claims. Return only the revised text.",
  },
  casual: {
    label: "Casual Writing",
    instruction:
      "Rewrite the supplied text in a relaxed, approachable, conversational tone, as if explaining the idea to a friend. " +
      "Keep it clear and easy to read without becoming sloppy or losing important detail. " +
      "Preserve the original meaning, names, dates, numbers, factual claims, quotations, citations, and URLs. " +
      "Do not add new facts or invented personal experiences. Return only the revised text.",
  },
  academic: {
    label: "Academic Editing",
    instruction:
      "Edit the supplied text for academic style: precise vocabulary, measured tone, clear argument structure, and correct formal grammar. " +
      "Improve cohesion between sentences and paragraphs while keeping every claim exactly as strong as in the original; do not strengthen or weaken assertions. " +
      "Preserve names, dates, numbers, factual claims, quotations, citations, and references. " +
      "Do not invent sources, data, or citations. Return only the revised text.",
  },
  simple: {
    label: "Simple English",
    instruction:
      "Rewrite the supplied text in plain, simple English that is easy for learners and non-native readers to follow. " +
      "Use common words, shorter sentences, and clear structure, while keeping all important meaning, names, dates, numbers, and facts. " +
      "Do not oversimplify to the point of losing meaning, and do not add new information. Return only the revised text.",
  },
  blog: {
    label: "Blog & Article Editing",
    instruction:
      "Edit the supplied text as an experienced blog and article editor would. Improve the hook, flow, and readability; " +
      "vary sentence rhythm; tighten wordy passages; and make headings-worthy ideas stand out without adding headings. " +
      "Keep the author's voice and preserve meaning, names, dates, numbers, factual claims, quotations, citations, and URLs. " +
      "Do not add new facts, anecdotes, or claims. Return only the revised text.",
  },
};

export const MODE_KEYS = Object.keys(MODES);

export const TONES = {
  natural: "Use a natural, clear, conversational style without forced slang.",
  professional: "Use a polished, professional tone that stays readable and direct.",
  casual: "Use a relaxed, approachable tone without becoming overly informal.",
  academic: "Use a precise, measured academic tone. Do not make the claims stronger than the original.",
  simple: "Use plain English with shorter, easy-to-follow sentences without losing important meaning.",
};

export const TONE_KEYS = Object.keys(TONES);

export const PROVIDER_KEYS = ["auto", "cloudflare", "external", "custom"];

export function normalizeMode(mode) {
  return MODE_KEYS.includes(mode) ? mode : "humanize";
}

export function normalizeTone(tone) {
  return TONE_KEYS.includes(tone) ? tone : "natural";
}

export function normalizeProvider(provider, env) {
  if (PROVIDER_KEYS.includes(provider)) return provider;
  const fallback = env.DEFAULT_PROVIDER || "auto";
  return PROVIDER_KEYS.includes(fallback) ? fallback : "auto";
}

export function buildPrompt(mode, tone) {
  const modeInstruction = MODES[normalizeMode(mode)].instruction;
  const toneInstruction = TONES[normalizeTone(tone)];
  return (
    `${modeInstruction}\n\n` +
    `Style instruction: ${toneInstruction}\n\n` +
    "Important: this is one section of a larger document. Preserve its meaning, keep the same paragraph " +
    "structure, and do not add an introduction, conclusion, heading, or commentary unless one is present in the source."
  );
}

export function providerLabel(provider) {
  if (provider === "cloudflare") return "Cloudflare Workers AI";
  if (provider === "custom") return "your API key";
  return "External AI";
}

/**
 * Retry with exponential backoff and jitter.
 * Permanent errors (authentication, invalid request, missing configuration)
 * are not retried: err.retryable === false stops immediately.
 */
export async function withRetry(operation, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (error?.retryable === false) break;
      if (attempt === attempts - 1) break;
      const wait = 500 * 2 ** attempt + Math.floor(Math.random() * 150);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError || new Error("AI provider request failed.");
}

async function runOnce(env, provider, systemPrompt, userText, options = {}) {
  if (provider === "cloudflare") {
    return {
      text: await withRetry(() => callCloudflareAI(env, systemPrompt, userText, options)),
      provider: "cloudflare",
    };
  }
  if (provider === "custom") {
    return {
      text: await withRetry(() =>
        callUserProvider(options.custom, systemPrompt, userText, options),
      ),
      provider: "custom",
    };
  }
  return {
    text: await withRetry(() => callExternalAI(env, systemPrompt, userText, options)),
    provider: "external",
  };
}

/**
 * Run one chunk through the hybrid engine.
 * "auto" tries Cloudflare Workers AI first, then the external provider
 * when it is configured. Returns { text, provider }.
 */
export async function runProvider(env, provider, systemPrompt, userText, options = {}) {
  if (provider === "auto") {
    try {
      return await runOnce(env, "cloudflare", systemPrompt, userText, options);
    } catch (cloudflareError) {
      if (!externalConfigured(env)) throw cloudflareError;
      // Do not fall back on permanent Cloudflare config/auth failures
      // when the failure is clearly not transient? We still try the
      // external provider once: it is a different service and may work.
      const result = await runOnce(env, "external", systemPrompt, userText, options);
      return result;
    }
  }
  return runOnce(env, provider, systemPrompt, userText, options);
}

/**
 * Process a long document chunk-by-chunk, in order, with a progress
 * callback. Sequential processing keeps ordering deterministic and
 * avoids hammering the provider with unbounded concurrency.
 */
export async function processChunks(env, { text, provider, systemPrompt, options, onProgress }) {
  const chunks = chunkText(text, options?.chunkChars ?? 6500);
  const outputs = [];
  const used = new Set();

  for (let i = 0; i < chunks.length; i++) {
    const result = await runProvider(env, provider, systemPrompt, chunks[i], options);
    outputs.push(result.text);
    used.add(providerLabel(result.provider));
    if (onProgress) {
      await onProgress({ done: i + 1, total: chunks.length });
    }
  }

  return {
    text: outputs.join("\n\n"),
    chunksProcessed: chunks.length,
    providersUsed: [...used],
  };
}
