import {
  buildPrompt,
  normalizeMode,
  normalizeProvider,
  normalizeTone,
  processChunks,
  providerLabel,
  MODE_KEYS,
} from "../services/engine.js";
import { chunkText } from "../services/chunking.js";
import {
  byteLength,
  checkRateLimit,
  errorJson,
  json,
  parseCustomProvider,
  rateLimitedResponse,
  readJsonBody,
} from "../utils/http.js";

const MAX_BODY_BYTES = 1_000_000; // technical payload safeguard, not a plan limit
const MAX_CHUNKS = 160;
const CHUNK_CHARS = 6500;

function wantsStream(request, url) {
  if (url.searchParams.get("stream") === "1") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("application/x-ndjson");
}

function customProviderError(provider, err) {
  // For user-supplied keys, surface actionable messages instead of the
  // generic provider-configuration error. Messages never contain the key.
  if (provider === "custom" && (err?.status === 401 || err?.status === 403)) {
    return "Your API key was rejected by the provider. Check the key in Settings.";
  }
  if (provider === "custom" && err?.status === 429) {
    return "Your provider's rate limit was reached. Try again in a moment.";
  }
  return null;
}

const GENERIC_PROCESSING_ERROR =
  "Processing failed before completing. Check the AI provider configuration or quota and try again. No partial result was kept.";

function ndjsonResponse(pull) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await pull(send);
      } catch (error) {
        send({ type: "error", error: error?.message || "Processing failed." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    },
  });
}

export async function handleHumanize(request, env) {
  const url = new URL(request.url);
  const limit = checkRateLimit(request, {
    key: "humanize",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfter);

  const { body, error, status } = await readJsonBody(request, MAX_BODY_BYTES);
  if (error) return errorJson(error, status || 400);

  const text = typeof body.text === "string" ? body.text : ""; // humanize

  if (!text.trim()) return errorJson("Paste some text first.", 400);
  if (byteLength(text) > MAX_BODY_BYTES) {
    return errorJson(
      "This submission exceeds the 1 MB request safety limit. It is a technical payload limit, not a word-count plan limit.",
      413,
    );
  }

  const mode = normalizeMode(body.mode);
  const tone = normalizeTone(body.tone);
  const provider = normalizeProvider(body.provider, env);

  let custom;
  if (provider === "custom") {
    const parsed = parseCustomProvider(body);
    if (parsed.error) return errorJson(parsed.error, parsed.status);
    custom = parsed.custom;
  }

  const chunkCount = chunkText(text, CHUNK_CHARS).length;
  if (chunkCount > MAX_CHUNKS) {
    return errorJson(
      `This document needs ${chunkCount} processing sections, which exceeds the per-request ceiling of ${MAX_CHUNKS}. ` +
        "Split the document into a few submissions. Actual limits depend on the AI model, provider quota, and runtime resources.",
      413,
    );
  }

  const systemPrompt = buildPrompt(mode, tone);
  const stream = wantsStream(request, url);

  if (stream) {
    return ndjsonResponse(async (send) => {
      send({ type: "progress", done: 0, total: chunkCount });
      try {
        const result = await processChunks(env, {
          text,
          provider,
          systemPrompt,
          options: { chunkChars: CHUNK_CHARS, custom },
          onProgress: async ({ done, total }) => send({ type: "progress", done, total }),
        });
        send({
          type: "result",
          text: result.text,
          chunksProcessed: result.chunksProcessed,
          providerUsed: result.providersUsed.join(" + "),
          mode,
          tone,
        });
      } catch (err) {
        // Never log the submitted text in production logs.
        console.error("humanize failed:", err?.message || "unknown error");
        send({
          type: "error",
          error: customProviderError(provider, err) || GENERIC_PROCESSING_ERROR,
        });
      }
    });
  }

  try {
    const result = await processChunks(env, {
      text,
      provider,
      systemPrompt,
      options: { chunkChars: CHUNK_CHARS, custom },
    });
    return json({
      text: result.text,
      chunksProcessed: result.chunksProcessed,
      providerUsed: result.providersUsed.join(" + "),
      mode,
      tone,
    });
  } catch (err) {
    console.error("humanize failed:", err?.message || "unknown error");
    const friendly = customProviderError(provider, err);
    if (friendly) {
      const status = err?.status === 429 ? 429 : 401;
      return errorJson(friendly, status);
    }
    return errorJson(GENERIC_PROCESSING_ERROR, 502);
  }
}

export function humanizeApiDocs() {
  return {
    endpoint: "POST /api/humanize",
    body: {
      text: "string (required)",
      mode: MODE_KEYS,
      tone: ["natural", "professional", "casual", "academic", "simple"],
      provider: ["auto", "cloudflare", "external"],
    },
    query: { stream: "set to 1 for newline-delimited JSON progress events" },
  };
}
