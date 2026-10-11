/**
 * External OpenAI-compatible providers.
 *
 * Two credential modes:
 *  1. Owner-configured: API key from the EXTERNAL_AI_API_KEY Worker secret.
 *  2. User-supplied (BYOK): the browser sends the user's own key with the
 *     request. The Worker uses it only for that request — it is never logged,
 *     never stored, and never echoed back in responses.
 *
 * SSRF guard: user-supplied base URLs are restricted to an allowlist of
 * well-known provider hosts. The Worker will not fetch arbitrary hosts.
 */

export const ALLOWED_CUSTOM_HOSTS = [
  "generativelanguage.googleapis.com", // Google Gemini (AI Studio free tier)
  "api.groq.com", // Groq (free tier)
  "openrouter.ai", // OpenRouter (incl. :free models)
  "api.openai.com", // OpenAI
  "api.mistral.ai", // Mistral
];

export function checkCustomHost(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return { ok: false, error: "Provider URL is not valid." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "Provider URL must use https." };
  }
  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_CUSTOM_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`),
  );
  if (!allowed) {
    return {
      ok: false,
      error:
        "This provider host is not supported. Use one of the presets in Settings.",
    };
  }
  return { ok: true, baseUrl: url.origin + url.pathname.replace(/\/+$/, "") };
}

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

function classifyHttpError(status) {
  const retryable = status === 429 || status >= 500;
  const err = new Error(
    status === 401 || status === 403
      ? "The API key was rejected (authentication failed). Check the key in Settings."
      : status === 429
        ? "The provider rate limit was reached."
        : `The AI provider returned HTTP ${status}.`,
  );
  err.retryable = retryable;
  err.status = status;
  return err;
}

/**
 * Generic OpenAI-compatible /chat/completions call.
 * `auth` is { baseUrl, model, apiKey }. The key is used only in the
 * Authorization header and never logged.
 */
export async function callOpenAICompatible(auth, systemPrompt, userText, options = {}) {
  const { baseUrl, model, apiKey } = auth;
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    const err = new Error("No API key was provided.");
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
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
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
        ? "The AI provider timed out."
        : "Could not reach the AI provider.",
    );
    err.retryable = true;
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw classifyHttpError(response.status);

  let data;
  try {
    data = await response.json();
  } catch {
    const err = new Error("The AI provider returned an unreadable response.");
    err.retryable = true;
    throw err;
  }

  const result = data?.choices?.[0]?.message?.content;
  if (typeof result !== "string" || !result.trim()) {
    const err = new Error("The AI provider returned an empty result.");
    err.retryable = true;
    throw err;
  }
  return result.trim();
}

export async function callExternalAI(env, systemPrompt, userText, options = {}) {
  if (!env.EXTERNAL_AI_API_KEY) {
    const err = new Error(
      "External AI provider is not configured. Add EXTERNAL_AI_API_KEY as a Worker secret.",
    );
    err.retryable = false;
    throw err;
  }
  return callOpenAICompatible(
    {
      baseUrl: externalBaseUrl(env),
      model: externalModel(env),
      apiKey: env.EXTERNAL_AI_API_KEY,
    },
    systemPrompt,
    userText,
    options,
  );
}

/**
 * User-supplied key (BYOK) call. Validates the host against the allowlist
 * before any network access.
 */
export async function callUserProvider(custom, systemPrompt, userText, options = {}) {
  const baseUrl = typeof custom?.baseUrl === "string" ? custom.baseUrl.trim() : "";
  const model = typeof custom?.model === "string" ? custom.model.trim().slice(0, 200) : "";
  const apiKey = typeof custom?.apiKey === "string" ? custom.apiKey : "";

  if (!model) {
    const err = new Error("Choose a model in Settings first.");
    err.retryable = false;
    throw err;
  }
  if (!apiKey.trim() || apiKey.length > 500) {
    const err = new Error("Add your API key in Settings first.");
    err.retryable = false;
    throw err;
  }
  const hostCheck = checkCustomHost(baseUrl);
  if (!hostCheck.ok) {
    const err = new Error(hostCheck.error);
    err.retryable = false;
    throw err;
  }
  return callOpenAICompatible(
    { baseUrl: hostCheck.baseUrl, model, apiKey },
    systemPrompt,
    userText,
    options,
  );
}
