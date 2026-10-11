/**
 * Bring-your-own-key (BYOK) storage.
 * The user's API key lives ONLY in this browser's localStorage.
 * It is sent with each request over HTTPS and never stored server-side.
 */

const STORAGE_KEY = "sweet-byok-v1";

export const PRESETS = {
  gemini: {
    name: "Google Gemini",
    tag: "Free tier via AI Studio",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "Get a free key at AI Studio → Get API key.",
  },
  groq: {
    name: "Groq",
    tag: "Free tier",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    keyUrl: "https://console.groq.com/keys",
    keyHint: "Create a free key in the Groq console → API Keys.",
  },
  openrouter: {
    name: "OpenRouter",
    tag: "Free models available",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "",
    modelPlaceholder: "e.g. deepseek/deepseek-chat-v3-0324:free",
    keyUrl: "https://openrouter.ai/keys",
    keyHint: "Use a :free model id from openrouter.ai/models.",
  },
  custom: {
    name: "Custom",
    tag: "OpenAI-compatible endpoint",
    baseUrl: "",
    model: "",
    keyUrl: "",
    keyHint: "Any https endpoint with /chat/completions on a supported host.",
  },
};

export const PRESET_KEYS = Object.keys(PRESETS);

export function loadKeyConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    if (!cfg || typeof cfg.apiKey !== "string" || !cfg.apiKey.trim()) return null;
    return {
      preset: PRESET_KEYS.includes(cfg.preset) ? cfg.preset : "custom",
      baseUrl: typeof cfg.baseUrl === "string" ? cfg.baseUrl : "",
      model: typeof cfg.model === "string" ? cfg.model : "",
      apiKey: cfg.apiKey,
    };
  } catch {
    return null;
  }
}

export function saveKeyConfig({ preset, baseUrl, model, apiKey }) {
  const cfg = {
    preset: PRESET_KEYS.includes(preset) ? preset : "custom",
    baseUrl: (baseUrl || "").trim(),
    model: (model || "").trim(),
    apiKey: (apiKey || "").trim(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Storage unavailable (private mode etc.) — the key simply won't persist.
  }
  return cfg;
}

export function clearKeyConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasKeyConfig() {
  return loadKeyConfig() !== null;
}
