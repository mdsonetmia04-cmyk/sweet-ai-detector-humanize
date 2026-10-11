import { useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ClipboardPaste, FileText,
  LoaderCircle, MinusCircle, ScanSearch, X, Lightbulb, Quote,
} from "lucide-react";
import { countSentences, countWords } from "../utils/text.js";
import { postNDJSON } from "../utils/api.js";
import { hasKeyConfig, loadKeyConfig } from "../utils/byok.js";

const ASSESSMENT_STYLE = {
  low: {
    icon: CheckCircle2,
    chip: "border-[#cfe0d2] bg-[#f0f6ef] text-[#2f5b40]",
    label: "Low AI-pattern signals",
  },
  mixed: {
    icon: MinusCircle,
    chip: "border-[#e8dfc8] bg-[#faf6e9] text-[#7a5f22]",
    label: "Mixed AI-pattern signals",
  },
  elevated: {
    icon: AlertTriangle,
    chip: "border-[#efd4cd] bg-[#fdf3f0] text-[#96402f]",
    label: "Elevated AI-pattern signals",
  },
};

export default function DetectorWorkspace({ onOpenSettings }) {
  const [input, setInput] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [provider, setProvider] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const stats = useMemo(() => ({
    words: countWords(input),
    sentences: countSentences(input),
  }), [input]);

  async function analyze() {
    if (!input.trim() || loading) return;
    let body = { text: input, provider };
    if (provider === "custom") {
      const cfg = loadKeyConfig();
      if (!cfg) {
        setError("Add your API key in Settings first to use this engine.");
        if (onOpenSettings) onOpenSettings();
        return;
      }
      body = {
        ...body,
        apiKey: cfg.apiKey,
        custom: { baseUrl: cfg.baseUrl, model: cfg.model },
      };
    }
    setLoading(true);
    setError("");
    setAnalysis(null);
    try {
      const result = await postNDJSON(
        "/api/detect?stream=1",
        body,
        (event) => {
          if (event.type === "progress" && event.total > 1) {
            setProgress(`Analyzing section ${Math.max(event.done, 1)} of ${event.total}…`);
          } else if (event.type === "progress") {
            setProgress("Analyzing writing patterns…");
          }
        },
      );
      setAnalysis(result.analysis || null);
      setProgress("");
    } catch (err) {
      setError(err.message || "Analysis failed. Please try again.");
      setProgress("");
    } finally {
      setLoading(false);
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(text);
        setError("");
      } else {
        setError("Your clipboard is empty.");
      }
    } catch {
      setError("Clipboard access was blocked. Paste with Ctrl/Cmd + V instead.");
    }
  }

  const style = analysis ? ASSESSMENT_STYLE[analysis.assessment] || ASSESSMENT_STYLE.mixed : null;
  const Icon = style?.icon || MinusCircle;

  return (
    <div>
      <div className="rounded-xl border border-[#e8dfc8] bg-[#faf6e9] px-4 py-3 text-[13px] leading-6 text-[#6b5a2b]">
        <strong className="font-semibold">Heuristic pattern analysis — not a validated AI detector.</strong>{" "}
        This estimates how many AI-associated writing patterns appear in your text. The estimate can be
        wrong: human-written text can be flagged and AI-assisted text can be missed. Never use it alone
        for academic, employment, disciplinary, or other high-stakes decisions.
      </div>

      {provider === "custom" && !hasKeyConfig() && (
        <button
          onClick={onOpenSettings}
          className="mb-4 w-full rounded-xl border border-[#e8dfc8] bg-[#faf6e9] px-4 py-3 text-left text-[13px] leading-6 text-[#6b5a2b] hover:border-[#d8cba4]"
        >
          <strong className="font-semibold">“My API key” needs a key.</strong>{" "}
          Open Settings to add a free Gemini, Groq, or OpenRouter key — it takes a minute.
        </button>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-[#e1e2dc] bg-white shadow-[0_4px_22px_rgba(28,38,29,0.03)]">
          <div className="flex items-center justify-between border-b border-[#ecece7] px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2b302b]">
              <FileText size={16} className="text-[#66806d]" /> Text to analyze
            </div>
            <div className="flex items-center gap-1">
              <button onClick={pasteFromClipboard} title="Paste from clipboard" className="grid h-8 w-8 place-items-center rounded-lg text-[#777d74] hover:bg-[#f1f3ec] hover:text-[#252923]">
                <ClipboardPaste size={15} />
              </button>
              <button onClick={() => { setInput(""); setAnalysis(null); setError(""); }} title="Clear" className="grid h-8 w-8 place-items-center rounded-lg text-[#777d74] hover:bg-[#f1f3ec] hover:text-[#252923]">
                <X size={15} />
              </button>
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste the text you want to analyze… (at least 20 words)"
            className="editor-area min-h-[300px] w-full resize-y border-0 bg-white px-5 py-5 text-[15px] leading-7 text-[#20241f] outline-none placeholder:text-[#a1a59e] sm:min-h-[380px]"
            aria-label="Text to analyze"
          />
          <div className="flex items-center justify-between border-t border-[#ecece7] px-5 py-3">
            <span className="text-xs text-[#7c8178]">
              {stats.words.toLocaleString()} words · {stats.sentences.toLocaleString()} sentences
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="detect-provider" className="text-xs text-[#6b7068]">AI engine</label>
              <div className="relative">
                <select
                  id="detect-provider" value={provider} onChange={(e) => setProvider(e.target.value)} disabled={loading}
                  className="appearance-none rounded-full border border-[#dedfd8] bg-white py-1.5 pl-3 pr-8 text-xs outline-none focus:border-[#60816c]"
                >
                  <option value="auto">Auto / Hybrid</option>
                  <option value="cloudflare">Cloudflare AI</option>
                  <option value="external">External API</option>
                  <option value="custom">My API key</option>
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777d74]" />
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#d9e3d9] bg-white shadow-[0_4px_22px_rgba(28,38,29,0.03)]">
          <div className="flex items-center justify-between border-b border-[#e8eee7] px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2b302b]">
              <ScanSearch size={16} className="text-[#3e7254]" /> Pattern analysis
            </div>
            {analysis && (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${style.chip}`}>
                <Icon size={14} /> {analysis.assessmentLabel || style.label}
              </span>
            )}
          </div>
          <div className="max-h-[420px] min-h-[300px] overflow-y-auto px-5 py-5 sm:max-h-[460px]">
            {loading ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                <LoaderCircle className="mb-4 animate-spin text-[#47745a]" size={27} />
                <p className="text-sm font-medium text-[#2b302b]">Analyzing patterns</p>
                <p className="mt-1 text-xs text-[#858a82]">{progress || "Reading your text…"}</p>
              </div>
            ) : analysis ? (
              <div className="space-y-5">
                <p className="text-sm leading-7 text-[#3d433c]">{analysis.explanation}</p>

                {analysis.sectionsAnalyzed > 1 && (
                  <p className="text-xs text-[#9a9e97]">
                    Analyzed in {analysis.sectionsAnalyzed} sections; signals were merged across the document.
                    {analysis.truncated ? " Very long documents are analyzed from the first sections." : ""}
                  </p>
                )}

                {analysis.sentenceObservations?.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#6f8a76]">
                      Notable passages
                    </p>
                    <ul className="space-y-2.5">
                      {analysis.sentenceObservations.map((obs, i) => (
                        <li key={i} className="rounded-lg border border-[#ecece7] bg-[#fbfbf8] px-3.5 py-2.5">
                          <p className="flex gap-2 text-[13px] italic leading-6 text-[#4e554d]">
                            <Quote size={13} className="mt-1 shrink-0 text-[#a1a59e]" />
                            <span>“{obs.quote}”</span>
                          </p>
                          <p className="mt-1 pl-5 text-xs leading-5 text-[#7c8178]">{obs.note}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.repetitivePatterns?.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#6f8a76]">
                      Repetitive / formulaic patterns
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-[13px] leading-6 text-[#4e554d]">
                      {analysis.repetitivePatterns.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}

                {analysis.writingObservations?.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#6f8a76]">
                      Writing observations
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-[13px] leading-6 text-[#4e554d]">
                      {analysis.writingObservations.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  </div>
                )}

                {analysis.suggestions?.length > 0 && (
                  <div className="rounded-xl border border-[#d9e6d9] bg-[#f2f7f0] px-4 py-3.5">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#3e7254]">
                      <Lightbulb size={13} /> Ways to make it more natural
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-[13px] leading-6 text-[#3d4a40]">
                      {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#f1f5ef] text-[#47745a]">
                  <ScanSearch size={20} />
                </span>
                <p className="text-sm font-medium text-[#4d534b]">Your analysis will appear here</p>
                <p className="mt-2 max-w-xs text-xs leading-5 text-[#8a8f87]">
                  Paste at least 20 words, then run the analysis to see pattern observations.
                </p>
              </div>
            )}
          </div>
          <div className="border-t border-[#e8eee7] px-5 py-3">
            <p className="text-xs text-[#9a9e97]">
              Pattern analysis is probabilistic. Treat it as a writing-quality aid, not a verdict.
            </p>
          </div>
        </section>
      </div>

      <div className="mt-4">
        <button
          onClick={analyze} disabled={!input.trim() || loading}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1e4a37] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#16382a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <LoaderCircle size={17} className="animate-spin" /> : <ScanSearch size={17} />}
          {loading ? "Analyzing…" : "Analyze writing patterns"}
        </button>
      </div>

      {error && <div role="alert" className="mt-4 rounded-xl border border-[#f0d5d0] bg-[#fff7f5] px-4 py-3 text-sm text-[#9a3d31]">{error}</div>}
    </div>
  );
}
