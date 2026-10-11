export default function Footer() {
  return (
    <footer className="border-t border-[#e6e7e1] bg-[#fbfbf8]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 sm:flex-row sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-7 w-7 place-items-center rounded-md bg-[#1e4a37] text-[15px] font-semibold text-[#f7f3e8]"
            aria-hidden="true"
          >
            ¶
          </span>
          <span className="text-sm font-semibold text-[#2b302b]">Sweet AI Detector &amp; Humanizer</span>
        </div>
        <p className="text-xs tracking-[0.14em] text-[#9a9e97] uppercase">Detect. Rewrite. Refine.</p>
        <p className="text-xs text-[#9a9e97]">Write naturally. Check confidently.</p>
      </div>
    </footer>
  );
}
