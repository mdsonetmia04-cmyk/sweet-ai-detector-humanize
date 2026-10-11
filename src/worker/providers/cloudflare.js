/**
 * Cloudflare Workers AI provider.
 * Uses the `AI` binding from wrangler.jsonc. Model name is configurable
 * through the CF_AI_MODEL environment variable.
 */

export function cloudflareModel(env) {
  return env.CF_AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
}

function classifyError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  // Configuration problems are permanent: retrying will not help.
  if (
    message.includes("not configured") ||
    message.includes("binding") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("invalid model")
  ) {
    return { retryable: false, message: error?.message || "Cloudflare AI error" };
  }
  return { retryable: true, message: error?.message || "Cloudflare AI error" };
}

/**
 * Fallback model used when the primary model returns an empty result.
 * A smaller, widely-available instruction model keeps analysis working
 * even if the primary model has a bad day with a particular prompt.
 */
const CLOUDFLARE_FALLBACK_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

export async function callCloudflareAI(env, systemPrompt, userText, options = {}) {
  if (!env.AI) {
    const err = new Error(
      "Cloudflare Workers AI binding is not configured. Enable the AI binding for this Worker.",
    );
    err.retryable = false;
    throw err;
  }

  const models = [...new Set([cloudflareModel(env), CLOUDFLARE_FALLBACK_MODEL])];
  let lastError = null;

  for (const model of models) {
    let response;
    try {
      response = await env.AI.run(model, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.6,
      });
    } catch (error) {
      const classified = classifyError(error);
      if (classified.retryable === false) throw new Error(classified.message);
      lastError = new Error(classified.message);
      lastError.retryable = true;
      continue;
    }

    const result =
      response?.response ?? response?.choices?.[0]?.message?.content ?? "";
    if (typeof result === "string" && result.trim()) {
      return result.trim();
    }
    const shape =
      response && typeof response === "object"
        ? Object.keys(response).join(",")
        : typeof response;
    lastError = new Error(
      `Cloudflare AI model ${model} returned an empty result (response keys: ${shape}).`,
    );
    lastError.retryable = true;
  }

  throw lastError || new Error("Cloudflare AI returned an empty result.");
}
