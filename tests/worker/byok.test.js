import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  checkCustomHost,
  callUserProvider,
  ALLOWED_CUSTOM_HOSTS,
} from "../../src/worker/providers/external.js";
import { parseCustomProvider } from "../../src/worker/utils/http.js";
import { normalizeProvider, runProvider } from "../../src/worker/services/engine.js";
import worker from "../../src/worker/index.js";

describe("checkCustomHost allowlist", () => {
  it("allows the documented free-tier provider hosts", () => {
    for (const host of ALLOWED_CUSTOM_HOSTS) {
      const r = checkCustomHost(`https://${host}/v1`);
      assert.equal(r.ok, true, host);
    }
  });

  it("rejects plain http", () => {
    const r = checkCustomHost("http://api.groq.com/openai/v1");
    assert.equal(r.ok, false);
    assert.match(r.error, /https/);
  });

  it("rejects unknown hosts", () => {
    const r = checkCustomHost("https://evil.example.com/v1");
    assert.equal(r.ok, false);
    assert.match(r.error, /not supported/);
  });

  it("rejects subdomain spoofing", () => {
    assert.equal(checkCustomHost("https://api.groq.com.evil.com/v1").ok, false);
    assert.equal(checkCustomHost("https://evilapi.groq.com/v1").ok, false);
  });

  it("rejects malformed URLs", () => {
    assert.equal(checkCustomHost("not a url").ok, false);
  });

  it("normalizes trailing slashes", () => {
    const r = checkCustomHost("https://api.groq.com/openai/v1///");
    assert.equal(r.ok, true);
    assert.equal(r.baseUrl, "https://api.groq.com/openai/v1");
  });
});

describe("parseCustomProvider", () => {
  const valid = {
    provider: "custom",
    apiKey: "gsk_test123",
    custom: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  };

  it("accepts a valid BYOK configuration", () => {
    const r = parseCustomProvider(valid);
    assert.equal(r.error, undefined);
    assert.equal(r.custom.model, "llama-3.3-70b-versatile");
    assert.equal(r.custom.baseUrl, "https://api.groq.com/openai/v1");
  });

  it("rejects a missing API key", () => {
    const r = parseCustomProvider({ ...valid, apiKey: "  " });
    assert.equal(r.status, 400);
    assert.match(r.error, /API key/);
    assert.ok(!r.error.includes("gsk_test123"), "must not echo the key");
  });

  it("rejects a disallowed host", () => {
    const r = parseCustomProvider({
      ...valid,
      custom: { baseUrl: "https://evil.example.com/v1", model: "x" },
    });
    assert.equal(r.status, 400);
  });

  it("rejects a missing model", () => {
    const r = parseCustomProvider({ ...valid, custom: { baseUrl: "https://api.groq.com/openai/v1", model: "" } });
    assert.equal(r.status, 400);
  });
});

describe("runProvider with custom key", () => {
  let realFetch;
  beforeEach(() => {
    realFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("sends the user key to the user provider host", async () => {
    let seenUrl, seenAuth;
    globalThis.fetch = async (url, opts) => {
      seenUrl = url;
      seenAuth = opts.headers.Authorization;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "custom result" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    const result = await runProvider(
      {},
      "custom",
      "sys",
      "hello",
      {
        custom: {
          baseUrl: "https://api.groq.com/openai/v1",
          model: "llama-3.3-70b-versatile",
          apiKey: "gsk_userkey",
        },
      },
    );
    assert.equal(result.text, "custom result");
    assert.equal(result.provider, "custom");
    assert.equal(seenUrl, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(seenAuth, "Bearer gsk_userkey");
  });

  it("does not retry a rejected user key", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response("no", { status: 401 });
    };
    await assert.rejects(
      runProvider({}, "custom", "sys", "hi", {
        custom: { baseUrl: "https://api.groq.com/openai/v1", model: "m", apiKey: "bad" },
      }),
      /rejected/,
    );
    assert.equal(calls, 1);
  });

  it("normalizeProvider accepts custom", () => {
    assert.equal(normalizeProvider("custom", {}), "custom");
  });
});

describe("POST /api/humanize with custom provider", () => {
  function post(body) {
    return new Request("https://example.test/api/humanize", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "203.0.113.9" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 when the key is missing", async () => {
    const res = await worker.fetch(
      post({ text: "Hello world, this is a test.", provider: "custom" }),
      { AI: { run: async () => ({ response: "x" }) } },
    );
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /API key/);
  });

  it("returns 400 for a disallowed host", async () => {
    const res = await worker.fetch(
      post({
        text: "Hello world, this is a test.",
        provider: "custom",
        apiKey: "k",
        custom: { baseUrl: "https://evil.example.com", model: "m" },
      }),
      { AI: { run: async () => ({ response: "x" }) } },
    );
    assert.equal(res.status, 400);
  });
});

describe("callUserProvider validation", () => {
  it("refuses to call without a key (no network)", async () => {
    await assert.rejects(
      callUserProvider({ baseUrl: "https://api.groq.com/openai/v1", model: "m", apiKey: "" }, "s", "u"),
      /API key/,
    );
  });
});

describe("custom provider auth errors are user-friendly", () => {
  let realFetch;
  beforeEach(() => {
    realFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function post(body) {
    return new Request("https://example.test/api/humanize", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "203.0.113.10" },
      body: JSON.stringify(body),
    });
  }

  const byokBody = {
    text: "Hello world, this is a longer test sentence.",
    provider: "custom",
    apiKey: "bad-key",
    custom: { baseUrl: "https://api.groq.com/openai/v1", model: "m" },
  };

  it("returns 401 with a Settings hint for rejected keys (JSON)", async () => {
    globalThis.fetch = async () => new Response("no", { status: 401 });
    const res = await worker.fetch(post(byokBody), { AI: { run: async () => ({ response: "x" }) } });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /Check the key in Settings/);
    assert.ok(!data.error.includes("bad-key"), "must not echo the key");
  });

  it("returns 429 hint for rate-limited keys", async () => {
    globalThis.fetch = async () => new Response("slow", { status: 429 });
    const res = await worker.fetch(post(byokBody), { AI: { run: async () => ({ response: "x" }) } });
    assert.equal(res.status, 429);
  });
});
