import { normalizeProvider } from "../services/engine.js";
import { analyzeDocument, DETECT_ASSESSMENT_LABELS } from "../services/detector.js";
import {
  byteLength,
  checkRateLimit,
  errorJson,
  json,
  parseCustomProvider,
  rateLimitedResponse,
  readJsonBody,
} from "../utils/http.js";

const MAX_BODY_BYTES = 500_000; // pattern analysis works on excerpts; still generous
const MAX_ANALYSIS_CHUNKS = 8;

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

const GENERIC_ANALYSIS_ERROR =
  "Analysis failed. Check the AI provider configuration or quota and try again.";

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
        send({ type: "error", error: error?.message || "Analysis failed." });
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

function finalize(result) {
  return {
    ...result,
    assessmentLabel: DETECT_ASSESSMENT_LABELS[result.assessment] || "Mixed AI-pattern signals",
  };
}

export async function handleDetect(request, env) {
  const url = new URL(request.url);
  const limit = checkRateLimit(request, {
    key: "detect",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfter);

  const { body, error, status } = await readJsonBody(request, MAX_BODY_BYTES);
  if (error) return errorJson(error, status || 400);

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return errorJson("Paste some text to analyze.", 400);
  if (text.trim().split(/\s+/).length < 20) {
    return errorJson(
      "Pattern analysis needs at least 20 words to say anything useful.",
      400,
    );
  }
  if (byteLength(text) > MAX_BODY_BYTES) {
    return errorJson(
      "This submission exceeds the analysis payload safety limit. Analyze a shorter excerpt.",
      413,
    );
  }

  const provider = normalizeProvider(body.provider, env);
  const stream = wantsStream(request, url);

  let custom;
  if (provider === "custom") {
    const parsed = parseCustomProvider(body);
    if (parsed.error) return errorJson(parsed.error, parsed.status);
    custom = parsed.custom;
  }

  if (stream) {
    return ndjsonResponse(async (send) => {
      send({ type: "progress", done: 0, total: 1 });
      try {
        const result = await analyzeDocument(env, {
          text,
          provider,
          custom,
          maxChunks: MAX_ANALYSIS_CHUNKS,
          onProgress: async ({ done, total }) => send({ type: "progress", done, total }),
        });
        send({ type: "result", analysis: finalize(result) });
      } catch (err) {
        console.error("detect failed:", err?.message || "unknown error");
        send({
          type: "error",
          error: customProviderError(provider, err) || GENERIC_ANALYSIS_ERROR,
        });
      }
    });
  }

  try {
    const result = await analyzeDocument(env, {
      text,
      provider,
      custom,
      maxChunks: MAX_ANALYSIS_CHUNKS,
    });
    return json({ analysis: finalize(result) });
  } catch (err) {
    console.error("detect failed:", err?.message || "unknown error");
    const friendly = customProviderError(provider, err);
    if (friendly) {
      const status = err?.status === 429 ? 429 : 401;
      return errorJson(friendly, status);
    }
    return errorJson(GENERIC_ANALYSIS_ERROR, 502);
  }
}
