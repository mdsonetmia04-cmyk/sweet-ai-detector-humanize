/**
 * External OpenAI-compatible provider.
 * Credentials stay server-side: the API key is read from the
 * EXTERNAL_AI_API_KEY Worker secret and never leaves the backend.
 */

export function externalBaseUrl(env) {
  return (env.EXTERNAL_AI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
}

export function externalModel(env) {
  return env.EXTERNAL_AI_MODEL || "gpt-4o-mini";
}

export function externalConfigured(env) {
  return Boolean(env.EXTERNAL_AI_API_KEY);
}

export async function callExternalAI(env, systemPrompt, userText, options = {}) {
  if (!env.EXTERNAL_AI_API_KEY) {
    const err = new Error(
      "External AI provider is not configured. Add EXTERNAL_AI_API_KEY as a Worker secret.",
    );
    err.retryable = false;
    throw err;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 45000,
  );

  let response;
  try {
    response = await fetch(`${externalBaseUrl(env)}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.EXTERNAL_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: externalModel(env),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
        temperature: options.temperature ?? 0.6,
        max_tokens: options.maxTokens ?? 4096,
      }),
    });
  } catch (error) {
    const err = new Error(
      error?.name === "AbortError"
        ? "External AI provider timed out."
        : "Could not reach the external AI provider.",
    );
    err.retryable = true;
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const status = response.status;
    const retryable = status === 429 || status >= 500;
    const err = new Error(
      status === 401 || status === 403
        ? "External AI provider rejected the API key (authentication failed)."
        : status === 429
          ? "External AI provider rate limit reached."
          : `External AI provider returned HTTP ${status}.`,
    );
    err.retryable = retryable;
    err.status = status;
    throw err;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const err = new Error("External AI provider returned an unreadable response.");
    err.retryable = true;
    throw err;
  }

  const result = data?.choices?.[0]?.message?.content;
  if (typeof result !== "string" || !result.trim()) {
    const err = new Error("External AI provider returned an empty result.");
    err.retryable = true;
    throw err;
  }
  return result.trim();
}
