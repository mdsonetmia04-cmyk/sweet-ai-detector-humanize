export default function About() {
  return (
    <section id="about" className="scroll-mt-24 border-t border-[#e3e4dd] bg-[#fbfbf8]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#537360]">About</p>
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#20241f] sm:text-3xl">
              What this tool is — and is not
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#4e554d]">
              <strong className="font-semibold text-[#2b302b]">Sweet AI Detector &amp; Humanizer</strong>{" "}
              is a writing-quality assistant for bloggers, students, teachers, marketers, and website
              owners. The humanizer refines wording, flow, and readability while preserving your meaning,
              names, dates, and facts. The pattern analyzer describes writing-style signals that are
              commonly associated with AI-assisted drafting.
            </p>
            <p className="mt-3 text-sm leading-7 text-[#4e554d]">
              It is not a plagiarism checker, not a guarantee of originality, and not a way to disguise
              authorship. Rewritten text is not promised to pass any AI detector, and the analyzer's
              output is an estimate that can be wrong.
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#e1e2dc] bg-white p-5">
              <h3 className="text-sm font-semibold text-[#2b302b]">Privacy</h3>
              <p className="mt-2 text-[13px] leading-6 text-[#747970]">
                There is no account system and nothing you paste is saved. Text travels to the
                configured AI provider only to produce your result. Provider API keys are stored as
                server-side secrets and never appear in the browser or in source control.
              </p>
            </div>
            <div className="rounded-2xl border border-[#e1e2dc] bg-white p-5">
              <h3 className="text-sm font-semibold text-[#2b302b]">Fair limits</h3>
              <p className="mt-2 text-[13px] leading-6 text-[#747970]">
                There are no arbitrary word-count plans. Real limits come from the AI model's context
                window, provider quotas, request payload size, and runtime duration — and the app tells
                you when one is reached instead of silently cutting your text.
              </p>
            </div>
            <div className="rounded-2xl border border-[#e8dfc8] bg-[#faf6e9] p-5">
              <h3 className="text-sm font-semibold text-[#6b5a2b]">Use responsibly</h3>
              <p className="mt-2 text-[13px] leading-6 text-[#7a6a3d]">
                Always review revised text before publishing — especially facts, quotes, and citations.
                Never base academic, employment, or disciplinary decisions on the pattern analysis alone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
