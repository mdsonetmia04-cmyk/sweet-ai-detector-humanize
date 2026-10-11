const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...BASE_HEADERS,
      ...extraHeaders,
    },
  });
}

export function errorJson(message, status = 400, extra = {}) {
  return json({ error: message, ...extra }, status);
}

export function getClientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Best-effort, per-isolate fixed-window rate limiter.
 * It runs in the Worker's memory, so counters are not shared across
 * isolates or restarts. It is a basic abuse-prevention layer, not a
 * distributed quota system. For production, pair it with Cloudflare
 * Rate Limiting rules in the dashboard.
 */
const buckets = new Map();

export function checkRateLimit(request, { key, limit, windowMs }) {
  const now = Date.now();
  const bucketKey = `${key}:${getClientIp(request)}`;
  let bucket = buckets.get(bucketKey);

  if (!bucket || now - bucket.start >= windowMs) {
    bucket = { start: now, count: 0 };
  }
  bucket.count += 1;
  buckets.set(bucketKey, bucket);

  if (buckets.size > 5000) {
    // Prevent unbounded growth in long-lived isolates.
    const oldest = buckets.keys().next().value;
    buckets.delete(oldest);
  }

  if (bucket.count > limit) {
    const retryAfter = Math.ceil((bucket.start + windowMs - now) / 1000);
    return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
  }
  return { allowed: true, retryAfter: 0 };
}

export function rateLimitedResponse(retryAfter) {
  return errorJson(
    "Too many requests. Please wait a moment and try again.",
    429,
    {},
  );
}

export async function readJsonBody(request, maxBytes) {
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > maxBytes) {
    return { error: `Request body exceeds the ${maxBytes}-byte safety limit.`, status: 413 };
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: "Request body must be valid JSON.", status: 400 };
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object.", status: 400 };
  }
  return { body };
}

import { checkCustomHost } from "../providers/external.js";

export function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

/**
 * Parse and validate a user-supplied (BYOK) provider configuration.
 * Returns { custom } or { error, status }. The API key is never logged
 * or echoed back — only generic validation messages are returned.
 */
export function parseCustomProvider(body) {
  const raw = body.custom && typeof body.custom === "object" ? body.custom : {};
  const baseUrl = typeof raw.baseUrl === "string" ? raw.baseUrl.trim() : "";
  const model = typeof raw.model === "string" ? raw.model.trim().slice(0, 200) : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";

  if (!apiKey.trim()) {
    return { error: "Add your API key in Settings first.", status: 400 };
  }
  if (apiKey.length > 500) {
    return { error: "That API key looks invalid. Check it in Settings.", status: 400 };
  }
  if (!model) {
    return { error: "Choose a model in Settings first.", status: 400 };
  }
  const hostCheck = checkCustomHost(baseUrl);
  if (!hostCheck.ok) {
    return { error: hostCheck.error, status: 400 };
  }
  return { custom: { baseUrl: hostCheck.baseUrl, model, apiKey } };
}
