import { describe, it } from "node:test";
import assert from "node:assert/strict";
import worker from "../../src/worker/index.js";

let ipCounter = 100;
function ip() {
  ipCounter += 1;
  return `192.0.2.${ipCounter}`;
}

function mockEnv() {
  return {
    AI: {
      run: async (model, opts) => {
        const systemPrompt = opts.messages.find((m) => m.role === "system")?.content || "";
        const userText = opts.messages.find((m) => m.role === "user")?.content || "";
        if (systemPrompt.includes("writing style for patterns")) {
          return { response: "not valid json, just prose" };
        }
        return { response: `REVISED: ${userText.slice(0, 40)}` };
      },
    },
    DEFAULT_PROVIDER: "auto",
    CF_AI_MODEL: "@cf/mock",
  };
}

function post(path, body, extra = {}) {
  return new Request(`https://example.test${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": ip(),
      ...(extra.headers || {}),
    },
    body: JSON.stringify(body),
  });
}

async function readNDJSON(response) {
  const text = await response.text();
  return text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

describe("GET /api/health", () => {
  it("returns status without secrets", async () => {
    const res = await worker.fetch(
      new Request("https://example.test/api/health", { headers: { "cf-connecting-ip": ip() } }),
      { ...mockEnv(), EXTERNAL_AI_API_KEY: "super-secret" },
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.externalAIConfigured, true);
    assert.ok(!JSON.stringify(data).includes("super-secret"), "secret leaked in health response");
    assert.ok(data.modes.includes("blog"));
  });
});

describe("POST /api/humanize", () => {
  it("revises short text in one chunk", async () => {
    const res = await worker.fetch(post("/api/humanize", { text: "Hello world.", mode: "grammar" }), mockEnv());
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.match(data.text, /^REVISED:/);
    assert.equal(data.chunksProcessed, 1);
    assert.equal(data.providerUsed, "Cloudflare Workers AI");
    assert.equal(data.mode, "grammar");
  });

  it("streams progress events with ?stream=1", async () => {
    const longText = Array.from({ length: 220 }, (_, i) => `Paragraph number ${i} with some words in it for the streaming test.`).join("\n\n");
    const res = await worker.fetch(post("/api/humanize?stream=1", { text: longText }), mockEnv());
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /ndjson/);
    const events = await readNDJSON(res);
    const progress = events.filter((e) => e.type === "progress");
    const results = events.filter((e) => e.type === "result");
    assert.ok(progress.length > 0);
    assert.equal(results.length, 1);
    assert.ok(results[0].chunksProcessed > 1, "expected multiple chunks");
    const last = progress[progress.length - 1];
    assert.equal(last.done, last.total);
  });

  it("rejects empty text", async () => {
    const res = await worker.fetch(post("/api/humanize", { text: "   " }), mockEnv());
    assert.equal(res.status, 400);
  });

  it("rejects wrong content type", async () => {
    const res = await worker.fetch(
      new Request("https://example.test/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "text/plain", "cf-connecting-ip": ip() },
        body: "hello",
      }),
      mockEnv(),
    );
    assert.equal(res.status, 415);
  });

  it("rejects malformed JSON", async () => {
    const res = await worker.fetch(
      new Request("https://example.test/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "cf-connecting-ip": ip() },
        body: "{oops",
      }),
      mockEnv(),
    );
    assert.equal(res.status, 400);
  });

  it("returns 502 when no provider is configured", async () => {
    const res = await worker.fetch(post("/api/humanize", { text: "Hello." }), { DEFAULT_PROVIDER: "auto" });
    assert.equal(res.status, 502);
    const data = await res.json();
    assert.match(data.error, /provider/i);
  });

  it("rate-limits after 30 requests per window", async () => {
    const fixedIp = ip();
    const env = mockEnv();
    let last;
    for (let i = 0; i < 31; i++) {
      last = await worker.fetch(
        new Request("https://example.test/api/humanize", {
          method: "POST",
          headers: { "Content-Type": "application/json", "cf-connecting-ip": fixedIp },
          body: JSON.stringify({ text: "Hello." }),
        }),
        env,
      );
    }
    assert.equal(last.status, 429);
    const data = await last.json();
    assert.match(data.error, /too many requests/i);
  });
});

describe("POST /api/detect", () => {
  const SAMPLE = Array.from({ length: 40 }, () => "The quick brown fox jumps over the lazy dog.").join(" ");

  it("returns an honest pattern analysis", async () => {
    const res = await worker.fetch(post("/api/detect", { text: SAMPLE }), mockEnv());
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.analysis.method, "ai-writing-pattern-analysis");
    assert.ok(["low", "mixed", "elevated"].includes(data.analysis.assessment));
    assert.match(data.analysis.explanation, /may be wrong|estimate/i);
    assert.ok(!JSON.stringify(data.analysis).includes("%"), "no invented percentage scores");
  });

  it("requires at least 20 words", async () => {
    const res = await worker.fetch(post("/api/detect", { text: "Too short." }), mockEnv());
    assert.equal(res.status, 400);
  });

  it("streams progress events", async () => {
    const res = await worker.fetch(post("/api/detect?stream=1", { text: SAMPLE }), mockEnv());
    assert.equal(res.status, 200);
    const events = await readNDJSON(res);
    assert.ok(events.some((e) => e.type === "progress"));
    const result = events.find((e) => e.type === "result");
    assert.ok(result?.analysis, "expected a result event with analysis");
  });
});

describe("routing", () => {
  it("returns 404 for unknown API paths", async () => {
    const res = await worker.fetch(post("/api/nope", {}), mockEnv());
    assert.equal(res.status, 404);
  });

  it("returns 405 for wrong method on known path", async () => {
    const res = await worker.fetch(
      new Request("https://example.test/api/humanize", { method: "DELETE", headers: { "cf-connecting-ip": ip() } }),
      mockEnv(),
    );
    assert.equal(res.status, 405);
  });
});
