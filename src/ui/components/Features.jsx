import {
  WandSparkles, ScanSearch, FileStack, ShieldCheck, Wrench, Cpu,
} from "lucide-react";

const FEATURES = [
  {
    icon: WandSparkles,
    title: "Eight rewriting modes",
    text: "Natural Humanize, Improve Clarity, Grammar Correction, Professional, Casual, Academic, Simple English, and Blog & Article editing — each with its own explicit editing instructions.",
  },
  {
    icon: ScanSearch,
    title: "Honest pattern analysis",
    text: "The detector reports AI-associated writing patterns with clear uncertainty language. It never invents a score and never pretends to be a validated classifier.",
  },
  {
    icon: FileStack,
    title: "Long-text handling",
    text: "Documents are split at paragraph boundaries, processed in order with live progress, and reassembled with their structure intact — no silent truncation.",
  },
  {
    icon: Cpu,
    title: "Hybrid AI engine",
    text: "Cloudflare Workers AI first, with an optional OpenAI-compatible fallback. Transient failures retry with backoff; authentication failures do not.",
  },
  {
    icon: Wrench,
    title: "Everyday utilities",
    text: "Word, character, and sentence counts, reading-time estimates, .txt import and export, selection rewriting, undo, and before/after comparison.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    text: "No login, no subscription, no database. Your text is processed to produce a result and is not stored. API keys stay on the server.",
  },
];

export default function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-14 sm:px-8">
      <div className="mb-8 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#537360]">Features</p>
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#20241f] sm:text-3xl">
          A clean writing utility, not a maze
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#686d65]">
          Two primary tools — the humanizer and the pattern analyzer — supported by the
          utilities you actually reach for every day.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="rounded-2xl border border-[#e1e2dc] bg-white p-6 shadow-[0_4px_22px_rgba(28,38,29,0.025)]"
          >
            <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[#eef4ec] text-[#2f5b40]">
              <Icon size={19} strokeWidth={1.8} />
            </span>
            <h3 className="text-[15px] font-semibold text-[#2b302b]">{title}</h3>
            <p className="mt-2 text-[13px] leading-6 text-[#747970]">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
