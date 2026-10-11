import { handleHumanize } from "./routes/humanize.js";
import { handleDetect } from "./routes/detect.js";
import { handleHealth } from "./routes/health.js";
import { errorJson, json } from "./utils/http.js";

const API_ROUTES = {
  "GET /api/health": handleHealth,
  "POST /api/humanize": handleHumanize,
  "POST /api/detect": handleDetect,
};

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return corsPreflight();

      const handler = API_ROUTES[`${request.method} ${url.pathname}`];
      if (handler) {
        if (request.method === "POST") {
          const contentType = request.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            return errorJson("Content-Type must be application/json.", 415);
          }
        }
        try {
          return await handler(request, env);
        } catch (error) {
          // Never include the submitted text in error output or logs.
          console.error("api error:", url.pathname, error?.message || "unknown error");
          return errorJson("An unexpected server error occurred.", 500);
        }
      }

      if (request.method === "GET" || request.method === "POST") {
        return errorJson("Not found.", 404);
      }
      return errorJson("Method not allowed.", 405);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response(
      "Sweet AI Detector & Humanizer assets are not built yet. Run npm run build.",
      { status: 503 },
    );
  },
};
