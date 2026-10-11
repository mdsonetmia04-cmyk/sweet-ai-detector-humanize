import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, readJsonBody } from "../../src/worker/utils/http.js";

function req(ip = "1.2.3.4") {
  return new Request("https://example.test/api/humanize", {
    headers: { "cf-connecting-ip": ip },
  });
}

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(req("10.0.0.1"), { key: "t1", limit: 5, windowMs: 60000 });
      assert.equal(r.allowed, true);
    }
  });

  it("blocks requests over the limit and reports retry-after", () => {
    const opts = { key: "t2", limit: 2, windowMs: 60000 };
    assert.equal(checkRateLimit(req("10.0.0.2"), opts).allowed, true);
    assert.equal(checkRateLimit(req("10.0.0.2"), opts).allowed, true);
    const blocked = checkRateLimit(req("10.0.0.2"), opts);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfter >= 1);
  });

  it("tracks IPs independently", () => {
    const opts = { key: "t3", limit: 1, windowMs: 60000 };
    assert.equal(checkRateLimit(req("10.0.0.3"), opts).allowed, true);
    assert.equal(checkRateLimit(req("10.0.0.4"), opts).allowed, true);
  });
});

describe("readJsonBody", () => {
  it("parses a valid JSON object", async () => {
    const request = new Request("https://example.test/api/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hi" }),
    });
    const { body, error } = await readJsonBody(request, 1000);
    assert.equal(error, undefined);
    assert.equal(body.text, "hi");
  });

  it("rejects oversized declared bodies", async () => {
    const request = new Request("https://example.test/api/x", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "999999" },
      body: JSON.stringify({}),
    });
    const { error } = await readJsonBody(request, 100);
    assert.match(error, /safety limit/);
  });

  it("rejects invalid JSON and non-objects", async () => {
    const bad = new Request("https://example.test/api/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    assert.match((await readJsonBody(bad, 1000)).error, /valid JSON/);

    const arr = new Request("https://example.test/api/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([1, 2]),
    });
    assert.match((await readJsonBody(arr, 1000)).error, /JSON object/);
  });
});
