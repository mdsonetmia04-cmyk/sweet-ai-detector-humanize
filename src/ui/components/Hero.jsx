import { PenLine, ScanSearch } from "lucide-react";

export default function Hero({ onStartWriting, onCheckPatterns }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pt-10 sm:px-8 sm:pt-14">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#537360]">
          Detect. Rewrite. Refine.
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#20241f] sm:text-5xl sm:leading-[1.1]">
          Make Your Writing Sound More Natural.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#686d65] sm:text-base sm:leading-7">
          Analyze writing patterns, improve readability, and refine your text with an
          intelligent writing assistant.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={onStartWriting}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1e4a37] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#16382a] sm:w-auto"
          >
            <PenLine size={17} /> Start Writing
          </button>
          <button
            onClick={onCheckPatterns}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d5dcd2] bg-white px-6 py-3 text-sm font-semibold text-[#2c4a38] transition hover:border-[#aebdb0] hover:bg-[#f4f7f1] sm:w-auto"
          >
            <ScanSearch size={17} /> Check AI Writing Patterns
          </button>
        </div>
        <p className="mt-4 text-xs text-[#9a9e97]">
          No login. No subscription. Your text is processed, not stored.
        </p>
      </div>
    </section>
  );
}
