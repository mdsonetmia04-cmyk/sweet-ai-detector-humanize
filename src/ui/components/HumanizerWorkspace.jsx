import { useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine, Check, ChevronDown, Clipboard, ClipboardPaste,
  FileUp, FileText, LoaderCircle, RotateCcw, Sparkles,
  WandSparkles, X, GitCompare, Undo2, Eraser,
} from "lucide-react";
import {
  countChars, countCharsNoSpaces, countSentences, countWords,
  compareParagraphs, readingTimeMinutes, readTextFile,
} from "../utils/text.js";
import { postNDJSON } from "../utils/api.js";
import { hasKeyConfig, loadKeyConfig } from "../utils/byok.js";

const MODES = [
  ["humanize", "Natural Humanize"],
  ["clarity", "Improve Clarity"],
  ["grammar", "Grammar Correction"],
  ["professional", "Professional"],
  ["casual", "Casual"],
  ["academic", "Academic"],
  ["simple", "Simple English"],
  ["blog", "Blog & Article"],
];

const MODE_ACTION = {
  humanize: "Humanize text",
  clarity: "Improve clarity",
  grammar: "Fix grammar",
  professional: "Make professional",
  casual: "Make casual",
  academic: "Edit academically",
  simple: "Simplify",
  blog: "Edit for blog",
};

const TONES = [
  ["natural", "Natural"],
  ["professional", "Professional"],
  ["casual", "Casual"],
  ["academic", "Academic"],
  ["simple", "Simple English"],
];

const PROVIDERS = [
  ["auto", "Auto / Hybrid"],
  ["cloudflare", "Cloudflare AI"],
  ["external", "External API"],
  ["custom", "My API key"],
];

export default function HumanizerWorkspace({ onOpenSettings }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState("humanize");
  const [tone, setTone] = useState("natural");
  const [provider, setProvider] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [compare, setCompare] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const stats = useMemo(() => ({
    words: countWords(input),
    chars: countChars(input),
    charsNoSpaces: countCharsNoSpaces(input),
    sentences: countSentences(input),
    reading: readingTimeMinutes(input),
  }), [input]);

  const outputWords = useMemo(() => countWords(output), [output]);
  const comparison = useMemo(
    () => (compare && input && output ? compareParagraphs(input, output) : null),
    [compare, input, output],
  );

  async function run(text, { label, replaceSelection } = {}) {
    if (!text.trim() || loading) return;
    let body = { text, mode, tone, provider };
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
    setNotice("");
    setCopied(false);
    setCompare(false);
    try {
      const result = await postNDJSON(
        "/api/humanize?stream=1",
        body,
        (event) => {
          if (event.type === "progress" && event.total > 1) {
            setProgress(`Processing section ${Math.max(event.done, 1)} of ${event.total}…`);
          } else if (event.type === "progress") {
            setProgress("Processing your text…");
          }
        },
      );
      const revised = result.text || "";
      if (replaceSelection) {
        applySelectionReplacement(revised);
        setNotice(`Selection rewritten using ${result.providerUsed || "the AI engine"}.`);
      } else {
        setHistory((h) => (output ? [...h.slice(-4), output] : h));
        setOutput(revised);
        setNotice(
          `Done — ${result.chunksProcessed} section${result.chunksProcessed === 1 ? "" : "s"} processed with ${result.providerUsed || "the AI engine"}.`,
        );
      }
      setProgress("");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setProgress("");
    } finally {
      setLoading(false);
    }
  }

  function getSelection() {
    const el = inputRef.current;
    if (!el) return { text: "", start: 0, end: 0 };
    const { selectionStart, selectionEnd, value } = el;
    if (selectionStart !== selectionEnd) {
      return { text: value.slice(selectionStart, selectionEnd), start: selectionStart, end: selectionEnd };
    }
    // No selection: use the paragraph under the cursor.
    const before = value.lastIndexOf("\n\n", selectionStart - 1);
    const after = value.indexOf("\n\n", selectionStart);
    const start = before === -1 ? 0 : before + 2;
    const end = after === -1 ? value.length : after;
    return { text: value.slice(start, end), start, end };
  }

  function applySelectionReplacement(revised) {
    const el = inputRef.current;
    if (!el) return;
    const { start, end, value } = { ...getSelection(), value: el.value };
    const next = value.slice(0, start) + revised.trim() + value.slice(end);
    setInput(next);
  }

  async function rewriteSelection() {
    const sel = getSelection();
    if (!sel.text.trim()) {
      setError("Select some text first, or place the cursor inside a paragraph.");
      return;
    }
    if (sel.text.length > 8000) {
      setError("The selection is too long for in-place rewriting. Select a shorter passage.");
      return;
    }
    await run(sel.text, { replaceSelection: true });
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput((prev) => (prev ? `${prev}\n\n${text}` : text));
        setError("");
      } else {
        setError("Your clipboard is empty.");
      }
    } catch {
      setError("Clipboard access was blocked. Paste with Ctrl/Cmd + V instead.");
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await readTextFile(file);
      setInput((prev) => (prev ? `${prev}\n\n${text}` : text));
      setError("");
      setNotice(`Imported “${file.name}”.`);
    } catch (err) {
      setError(err.message || "Could not read that file.");
    }
  }

  async function copyOutput() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access was blocked. Select the result and copy it manually.");
    }
  }

  function downloadOutput() {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sweet-humanizer-revised.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setOutput(prev);
      setNotice("Restored the previous result.");
      return h.slice(0, -1);
    });
  }

  function replaceOriginal() {
    if (!output) return;
    setHistory((h) => [...h.slice(-4), output]);
    setInput(output);
    setOutput("");
    setCompare(false);
    setNotice("Result moved into the original text panel. You can rewrite it again.");
  }

  function clearAll() {
    setInput("");
    setOutput("");
    setHistory([]);
    setError("");
    setNotice("");
    setProgress("");
    setCompare(false);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Rewrite mode">
          {MODES.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              disabled={loading}
              className={`rounded-full px-4 py-2 text-sm transition ${
                mode === value
                  ? "bg-[#1e4a37] text-white"
                  : "border border-[#dedfd8] bg-white text-[#535950] hover:border-[#aebdb0]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="tone" className="text-xs text-[#6b7068]">Tone</label>
          <div className="relative">
            <select
              id="tone" value={tone} onChange={(e) => setTone(e.target.value)} disabled={loading}
              className="appearance-none rounded-full border border-[#dedfd8] bg-white py-2 pl-3 pr-8 text-sm outline-none focus:border-[#60816c]"
            >
              {TONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#777d74]" />
          </div>
          <label htmlFor="provider" className="text-xs text-[#6b7068]">AI engine</label>
          <div className="relative">
            <select
              id="provider" value={provider} onChange={(e) => setProvider(e.target.value)} disabled={loading}
              className="appearance-none rounded-full border border-[#dedfd8] bg-white py-2 pl-3 pr-8 text-sm outline-none focus:border-[#60816c]"
            >
              {PROVIDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#777d74]" />
          </div>
        </div>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-[#e1e2dc] bg-white shadow-[0_4px_22px_rgba(28,38,29,0.03)]">
          <div className="flex items-center justify-between border-b border-[#ecece7] px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2b302b]">
              <FileText size={16} className="text-[#66806d]" /> Original text
            </div>
            <div className="flex items-center gap-1">
              <button onClick={pasteFromClipboard} title="Paste from clipboard" className="grid h-8 w-8 place-items-center rounded-lg text-[#777d74] hover:bg-[#f1f3ec] hover:text-[#252923]">
                <ClipboardPaste size={15} />
              </button>
              <button onClick={() => fileRef.current?.click()} title="Import a .txt file" className="grid h-8 w-8 place-items-center rounded-lg text-[#777d74] hover:bg-[#f1f3ec] hover:text-[#252923]">
                <FileUp size={15} />
              </button>
              <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={importFile} />
              <button onClick={rewriteSelection} title="Rewrite the selected text (or the paragraph under the cursor)" disabled={loading || !input.trim()} className="grid h-8 w-8 place-items-center rounded-lg text-[#777d74] hover:bg-[#f1f3ec] hover:text-[#252923] disabled:opacity-30">
                <Eraser size={15} />
              </button>
              <button onClick={clearAll} title="Clear everything" className="grid h-8 w-8 place-items-center rounded-lg text-[#777d74] hover:bg-[#f1f3ec] hover:text-[#252923]">
                <X size={15} />
              </button>
            </div>
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your blog, article, essay, or draft here…"
            className="editor-area min-h-[320px] w-full resize-y border-0 bg-white px-5 py-5 text-[15px] leading-7 text-[#20241f] outline-none placeholder:text-[#a1a59e] sm:min-h-[400px]"
            aria-label="Original text"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#ecece7] px-5 py-3">
            <span className="text-xs text-[#7c8178]">{stats.words.toLocaleString()} words</span>
            <span className="text-xs text-[#7c8178]">{stats.chars.toLocaleString()} characters</span>
            <span className="text-xs text-[#7c8178]">{stats.sentences.toLocaleString()} sentences</span>
            {stats.words > 0 && (
              <span className="text-xs text-[#7c8178]">~{stats.reading} min read</span>
            )}
            <span className="ml-auto text-xs text-[#9a9e97]">Not stored by this app</span>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#d9e3d9] bg-white shadow-[0_4px_22px_rgba(28,38,29,0.03)]">
          <div className="flex items-center justify-between border-b border-[#e8eee7] px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2b302b]">
              <Sparkles size={16} className="text-[#3e7254]" /> Revised text
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCompare((c) => !c)} disabled={!output || !input} title="Compare before and after" className={`grid h-8 w-8 place-items-center rounded-lg hover:bg-[#f1f3ec] disabled:opacity-30 ${compare ? "bg-[#e7f0e7] text-[#2c4a38]" : "text-[#777d74]"}`}>
                <GitCompare size={15} />
              </button>
              <button onClick={undo} disabled={!history.length || loading} title="Restore previous result" className="grid h-8 w-8 place-items-center rounded-lg text-[#777d74] hover:bg-[#f1f3ec] hover:text-[#252923] disabled:opacity-30">
                <Undo2 size={15} />
              </button>
              <button onClick={downloadOutput} disabled={!output} title="Download as .txt" className="grid h-8 w-8 place-items-center rounded-lg text-[#777d74] hover:bg-[#f1f3ec] hover:text-[#252923] disabled:opacity-30">
                <ArrowDownToLine size={15} />
              </button>
              <button onClick={copyOutput} disabled={!output} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[#315b43] hover:bg-[#f1f3ec] disabled:opacity-30">
                {copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="min-h-[320px] px-5 py-5 sm:min-h-[400px]">
            {loading ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                <LoaderCircle className="mb-4 animate-spin text-[#47745a]" size={27} />
                <p className="text-sm font-medium text-[#2b302b]">Refining your writing</p>
                <p className="mt-1 text-xs text-[#858a82]">{progress || "Processing…"}</p>
                <p className="mt-4 max-w-xs text-xs leading-5 text-[#999e96]">
                  Long documents are handled section by section. Keep this tab open until it finishes.
                </p>
              </div>
            ) : comparison ? (
              <div className="space-y-3" aria-label="Before and after comparison">
                {comparison.map((para, i) => (
                  <p
                    key={i}
                    className={`rounded-lg px-3 py-2 text-[14px] leading-7 ${
                      para.changed ? "bg-[#f2f7f0] text-[#2c4a38]" : "text-[#6b7068]"
                    }`}
                  >
                    {para.text}
                  </p>
                ))}
                <p className="text-xs text-[#9a9e97]">
                  Highlighted paragraphs changed; grey ones were left as written.
                </p>
              </div>
            ) : output ? (
              <textarea
                readOnly value={output} aria-label="Revised text"
                className="editor-area min-h-[280px] w-full resize-y border-0 bg-white p-0 text-[15px] leading-7 text-[#20241f] outline-none sm:min-h-[360px]"
              />
            ) : (
              <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#f1f5ef] text-[#47745a]">
                  <Sparkles size={20} />
                </span>
                <p className="text-sm font-medium text-[#4d534b]">Your revised text will appear here</p>
                <p className="mt-2 max-w-xs text-xs leading-5 text-[#8a8f87]">
                  Choose a mode and tone, then run the tool to refine your writing.
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#e8eee7] px-5 py-3">
            <span className="text-xs text-[#7c8178]">{outputWords.toLocaleString()} words</span>
            <button
              onClick={replaceOriginal} disabled={!output || loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#315b43] hover:underline disabled:opacity-40"
            >
              <RotateCcw size={13} /> Use result as input
            </button>
            <span className="ml-auto text-xs text-[#9a9e97]">Review facts before publishing</span>
          </div>
        </section>
      </div>

      <div className="mt-4">
        <button
          onClick={() => run(input)} disabled={!input.trim() || loading}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1e4a37] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#16382a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <LoaderCircle size={17} className="animate-spin" /> : <WandSparkles size={17} />}
          {loading ? "Working…" : MODE_ACTION[mode]}
        </button>
        <p className="mt-2 text-center text-xs text-[#9a9e97]">
          Tip: select any passage and use the <Eraser size={11} className="inline" /> button to rewrite just that part.
        </p>
      </div>

      {error && <div role="alert" className="mt-4 rounded-xl border border-[#f0d5d0] bg-[#fff7f5] px-4 py-3 text-sm text-[#9a3d31]">{error}</div>}
      {notice && !error && <div role="status" className="mt-4 rounded-xl border border-[#d9e6d9] bg-[#f2f7f0] px-4 py-3 text-sm text-[#315b43]">{notice}</div>}

      <div className="mt-8 grid gap-4 border-t border-[#e3e4dd] pt-6 sm:grid-cols-3">
        <div>
          <p className="text-sm font-semibold text-[#2b302b]">Keep the meaning</p>
          <p className="mt-1 text-xs leading-5 text-[#747970]">The engine preserves your ideas, names, dates, and factual details while smoothing the wording.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#2b302b]">Long-text support</p>
          <p className="mt-1 text-xs leading-5 text-[#747970]">Large drafts are split at paragraph boundaries and processed in order, with live progress.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#2b302b]">A writing aid, not a disguise</p>
          <p className="mt-1 text-xs leading-5 text-[#747970]">Rewriting improves quality; it cannot guarantee any AI-detector result. Always review the final text.</p>
        </div>
      </div>
    </div>
  );
}
