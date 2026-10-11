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

export async function callCloudflareAI(env, systemPrompt, userText, options = {}) {
  if (!env.AI) {
    const err = new Error(
      "Cloudflare Workers AI binding is not configured. Enable the AI binding for this Worker.",
    );
    err.retryable = false;
    throw err;
  }

  let response;
  try {
    response = await env.AI.run(cloudflareModel(env), {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.6,
    });
  } catch (error) {
    const classified = classifyError(error);
    const err = new Error(classified.message);
    err.retryable = classified.retryable;
    throw err;
  }

  const result =
    response?.response ?? response?.choices?.[0]?.message?.content ?? "";
  if (typeof result !== "string" || !result.trim()) {
    const err = new Error("Cloudflare AI returned an empty result.");
    err.retryable = true;
    throw err;
  }
  return result.trim();
}
