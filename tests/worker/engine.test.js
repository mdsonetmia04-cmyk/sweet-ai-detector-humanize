import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildPrompt,
  normalizeMode,
  normalizeProvider,
  normalizeTone,
  processChunks,
  runProvider,
  withRetry,
  MODE_KEYS,
  TONE_KEYS,
} from "../../src/worker/services/engine.js";

describe("normalizers", () => {
  it("accepts all documented modes and tones", () => {
    assert.deepEqual(MODE_KEYS.sort(), [
      "academic", "blog", "casual", "clarity", "grammar", "humanize", "professional", "simple",
    ].sort());
    assert.deepEqual(TONE_KEYS.sort(), ["academic", "casual", "natural", "professional", "simple"].sort());
  });

  it("falls back to humanize/natural on unknown values", () => {
    assert.equal(normalizeMode("nonsense"), "humanize");
    assert.equal(normalizeTone("nonsense"), "natural");
    assert.equal(normalizeMode(undefined), "humanize");
  });

  it("normalizes provider with env default", () => {
    assert.equal(normalizeProvider("cloudflare", {}), "cloudflare");
    assert.equal(normalizeProvider("bogus", { DEFAULT_PROVIDER: "external" }), "external");
    assert.equal(normalizeProvider("bogus", {}), "auto");
  });

  it("buildPrompt includes mode and tone instructions", () => {
    const prompt = buildPrompt("grammar", "academic");
    assert.match(prompt, /smallest changes/i);
    assert.match(prompt, /academic/i);
    assert.match(prompt, /one section of a larger document/i);
  });
});

describe("withRetry", () => {
  it("returns the first success", async () => {
    const result = await withRetry(async () => "ok", 3);
    assert.equal(result, "ok");
  });

  it("retries transient failures then succeeds", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls += 1;
      if (calls < 3) {
        const err = new Error("boom");
        err.retryable = true;
        throw err;
      }
      return "recovered";
    }, 3);
    assert.equal(result, "recovered");
    assert.equal(calls, 3);
  });

  it("does not retry permanent errors", async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => {
        calls += 1;
        const err = new Error("bad credentials");
        err.retryable = false;
        throw err;
      }, 3),
      /bad credentials/,
    );
    assert.equal(calls, 1);
  });

  it("throws the last error after attempts are exhausted", async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => {
        calls += 1;
        throw new Error("always fails");
      }, 2),
      /always fails/,
    );
    assert.equal(calls, 2);
  });
});

describe("runProvider hybrid behaviour", () => {
  let realFetch;
  beforeEach(() => {
    realFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const cfOk = { AI: { run: async () => ({ response: "cf result" }) } };

  it("auto uses Cloudflare first when it works", async () => {
    const result = await runProvider(cfOk, "auto", "sys", "hello");
    assert.equal(result.text, "cf result");
    assert.equal(result.provider, "cloudflare");
  });

  it("auto surfaces the Cloudflare error when no fallback is configured", async () => {
    const env = {
      AI: {
        run: async () => {
          const err = new Error("Cloudflare AI exploded");
          err.retryable = true;
          throw err;
        },
      },
    };
    await assert.rejects(runProvider(env, "auto", "sys", "hello"), /exploded/);
  });

  it("auto falls back to the external provider on transient Cloudflare failure", async () => {
    const env = {
      AI: {
        run: async () => {
          const err = new Error("cf down");
          err.retryable = true;
          throw err;
        },
      },
      EXTERNAL_AI_API_KEY: "test-key",
      EXTERNAL_AI_BASE_URL: "https://example.test/v1",
    };
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "external result" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const result = await runProvider(env, "auto", "sys", "hello");
    assert.equal(result.text, "external result");
    assert.equal(result.provider, "external");
  });

  it("external provider surfaces authentication failures without retry", async () => {
    const env = { EXTERNAL_AI_API_KEY: "bad", EXTERNAL_AI_BASE_URL: "https://example.test/v1" };
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response("nope", { status: 401 });
    };
    await assert.rejects(runProvider(env, "external", "sys", "hi"), /was rejected/);
    assert.equal(calls, 1);
  });

  it("processChunks keeps order and reports providers used", async () => {
    const seen = [];
    const result = await processChunks(
      { AI: { run: async (model, opts) => ({ response: `r:${opts.messages[1].content}` }) } },
      {
        text: "aaa\n\nbbb\n\nccc",
        provider: "cloudflare",
        systemPrompt: "sys",
        options: { chunkChars: 4 },
        onProgress: async ({ done, total }) => seen.push([done, total]),
      },
    );
    assert.equal(result.chunksProcessed, 3);
    assert.equal(result.text, "r:aaa\n\nr:bbb\n\nr:ccc");
    assert.deepEqual(result.providersUsed, ["Cloudflare Workers AI"]);
    assert.deepEqual(seen[seen.length - 1], [3, 3]);
  });
});
