import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkText, splitLongParagraph } from "../../src/worker/services/chunking.js";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const chunks = chunkText("Hello world. This is short.");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0], "Hello world. This is short.");
  });

  it("splits at paragraph boundaries first", () => {
    const p1 = "a".repeat(4000);
    const p2 = "b".repeat(4000);
    const chunks = chunkText(`${p1}\n\n${p2}`, 6500);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0], p1);
    assert.equal(chunks[1], p2);
  });

  it("splits long paragraphs at sentence boundaries", () => {
    const sentence = "This is a reasonably long sentence with several words in it. ";
    const para = sentence.repeat(200); // ~12k chars, no paragraph breaks
    const chunks = chunkText(para, 6500);
    assert.ok(chunks.length >= 2, "expected multiple chunks");
    for (const c of chunks) {
      assert.ok(c.length <= 6500, `chunk too long: ${c.length}`);
    }
    // Order preserved: reassembly matches the original (ignoring edge whitespace).
    const norm = (s) => s.replace(/\s+/g, " ").trim();
    assert.equal(norm(chunks.join("\n\n")), norm(para));
  });

  it("preserves document order and paragraph separation", () => {
    const text = "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here.";
    const chunks = chunkText(text, 30);
    assert.equal(chunks.join("\n\n"), text);
  });

  it("ignores empty input", () => {
    assert.deepEqual(chunkText(""), []);
    assert.deepEqual(chunkText("   \n\n  "), []);
  });
});

describe("splitLongParagraph", () => {
  it("keeps short paragraphs whole", () => {
    assert.deepEqual(splitLongParagraph("short", 100), ["short"]);
  });

  it("hard-cuts when no sentence boundary exists", () => {
    const pieces = splitLongParagraph("x".repeat(250), 100);
    assert.ok(pieces.length >= 3);
    assert.equal(pieces.join(""), "x".repeat(250));
  });
});
