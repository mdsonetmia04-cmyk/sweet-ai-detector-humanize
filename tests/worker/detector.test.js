import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeDocument,
  countSentencesSimple,
  parseAnalysisResponse,
} from "../../src/worker/services/detector.js";

const VALID = JSON.stringify({
  assessment: "mixed",
  explanation: "Some patterns appear.",
  sentenceObservations: [{ quote: "In today's fast-paced world", note: "Common AI-associated opener." }],
  repetitivePatterns: ["Moreover, furthermore"],
  writingObservations: ["Uniform sentence length."],
  suggestions: ["Add a concrete example."],
  flaggedSentences: 2,
});

describe("parseAnalysisResponse", () => {
  it("parses valid JSON", () => {
    const a = parseAnalysisResponse(VALID);
    assert.equal(a.assessment, "mixed");
    assert.equal(a.unstructured, false);
    assert.equal(a.sentenceObservations.length, 1);
    assert.equal(a.sentenceObservations[0].quote, "In today's fast-paced world");
    assert.deepEqual(a.suggestions, ["Add a concrete example."]);
    assert.equal(a.flaggedSentences, 2);
  });

  it("strips markdown code fences", () => {
    const a = parseAnalysisResponse("```json\n" + VALID + "\n```");
    assert.equal(a.assessment, "mixed");
    assert.equal(a.unstructured, false);
  });

  it("tolerates surrounding prose", () => {
    const a = parseAnalysisResponse("Here is my analysis:\n" + VALID + "\nHope this helps.");
    assert.equal(a.assessment, "mixed");
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
    assert.equal(a.flaggedSentences, 0);
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

  it("parses flaggedSentences as a non-negative integer", () => {
    assert.equal(parseAnalysisResponse(JSON.stringify({ flaggedSentences: 4 })).flaggedSentences, 4);
    assert.equal(parseAnalysisResponse(JSON.stringify({ flaggedSentences: -3 })).flaggedSentences, 0);
    assert.equal(parseAnalysisResponse(JSON.stringify({ flaggedSentences: "x" })).flaggedSentences, 0);
    assert.equal(parseAnalysisResponse(JSON.stringify({})).flaggedSentences, 0);
  });
});

describe("countSentencesSimple", () => {
  it("counts sentences deterministically", () => {
    assert.equal(countSentencesSimple(""), 0);
    assert.equal(countSentencesSimple("Hello world"), 1);
    assert.equal(countSentencesSimple("One. Two! Three?"), 3);
    assert.equal(countSentencesSimple("First line.\n\nSecond line."), 2);
  });
});

describe("analyzeDocument pattern coverage", () => {
  function mockEnv(flagged) {
    return {
      AI: {
        run: async () => ({
          response: JSON.stringify({
            assessment: "mixed",
            explanation: "Test.",
            sentenceObservations: [],
            repetitivePatterns: [],
            writingObservations: [],
            suggestions: [],
            flaggedSentences: flagged,
          }),
        }),
      },
    };
  }

  it("computes coverage from flagged vs analyzed sentences", async () => {
    const text = "Sentence one here. Sentence two here. Sentence three here. Sentence four here.";
    const result = await analyzeDocument(mockEnv(2), { text, provider: "cloudflare" });
    assert.equal(result.sentencesAnalyzed, 4);
    assert.equal(result.sentencesFlagged, 2);
    assert.equal(result.patternCoverage, 50);
    assert.match(result.coverageNote, /heuristic/i);
  });

  it("clamps flagged counts to the chunk sentence count", async () => {
    const text = "Just one sentence here.";
    const result = await analyzeDocument(mockEnv(99), { text, provider: "cloudflare" });
    assert.equal(result.patternCoverage, 100);
    assert.ok(result.patternCoverage <= 100);
  });

  it("reports zero coverage when nothing is flagged", async () => {
    const text = "One. Two. Three.";
    const result = await analyzeDocument(mockEnv(0), { text, provider: "cloudflare" });
    assert.equal(result.patternCoverage, 0);
    assert.equal(result.assessment, "mixed");
  });
});
