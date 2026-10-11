import { json } from "../utils/http.js";
import { cloudflareModel } from "../providers/cloudflare.js";
import { externalBaseUrl, externalConfigured, externalModel } from "../providers/external.js";
import { MODE_KEYS, TONE_KEYS } from "../services/engine.js";

/**
 * GET /api/health — basic service status.
 * Never exposes secret values or raw credentials.
 */
export function handleHealth(request, env) {
  return json({
    ok: true,
    service: "sweet-ai-detector-humanizer",
    cloudflareAIConfigured: Boolean(env.AI),
    cloudflareAIModel: cloudflareModel(env),
    externalAIConfigured: externalConfigured(env),
    externalAIBaseUrl: externalConfigured(env) ? externalBaseUrl(env) : null,
    externalAIModel: externalConfigured(env) ? externalModel(env) : null,
    defaultProvider: env.DEFAULT_PROVIDER || "auto",
    modes: MODE_KEYS,
    tones: TONE_KEYS,
    limits: {
      humanizeMaxBodyBytes: 1_000_000,
      humanizeMaxChunksPerRequest: 160,
      detectMaxBodyBytes: 500_000,
      detectMaxChunksPerRequest: 8,
      rateLimit: "30 requests per 10 minutes per IP, per endpoint (best-effort, per-isolate)",
    },
  });
}
