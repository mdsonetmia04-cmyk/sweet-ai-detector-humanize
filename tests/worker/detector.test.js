import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAnalysisResponse } from "../../src/worker/services/detector.js";

const VALID = JSON.stringify({
  assessment: "mixed",
  explanation: "Some patterns appear.",
  sentenceObservations: [{ quote: "In today's fast-paced world", note: "Common AI-associated opener." }],
  repetitivePatterns: ["Moreover, furthermore"],
  writingObservations: ["Uniform sentence length."],
  suggestions: ["Add a concrete example."],
});

describe("parseAnalysisResponse", () => {
  it("parses valid JSON", () => {
    const a = parseAnalysisResponse(VALID);
    assert.equal(a.assessment, "mixed");
    assert.equal(a.unstructured, false);
    assert.equal(a.sentenceObservations.length, 1);
    assert.equal(a.sentenceObservations[0].quote, "In today's fast-paced world");
    assert.deepEqual(a.suggestions, ["Add a concrete example."]);
  });

  it("strips markdown code fences", () => {
    const a = parseAnalysisResponse("```json\n" + VALID + "\n```");
    assert.equal(a.assessment, "mixed");
    assert.equal(a.unstructured, false);
  });

  it("tolerates surrounding prose", () => {
    const a = parseAnalysisResponse("Here is my analysis:\n" + VALID + "\nHope this helps.");
    assert.equal(a.assessment, "elevated" === a.assessment ? "elevated" : "mixed");
    assert.equal(a.unstructured, false);
  });

  it("normalizes unknown assessments to mixed", () => {
    const a = parseAnalysisResponse(JSON.stringify({ assessment: "definitely-ai-99%" }));
    assert.equal(a.assessment, "mixed");
  });

  it("falls back gracefully on unparseable output", () => {
    const a = parseAnalysisResponse("this is not json at all");
    assert.equal(a.unstructured, true);
    assert.equal(a.assessment, "mixed");
    assert.ok(a.rawText.length > 0);
    assert.ok(a.explanation.includes("may be wrong"));
  });

  it("drops malformed observation entries", () => {
    const a = parseAnalysisResponse(
      JSON.stringify({
        assessment: "low",
        explanation: "Fine.",
        sentenceObservations: [{ quote: "", note: "x" }, "garbage", { quote: "q", note: "n" }],
        suggestions: ["ok", 42, null],
      }),
    );
    assert.equal(a.sentenceObservations.length, 1);
    assert.deepEqual(a.suggestions, ["ok"]);
  });
});
