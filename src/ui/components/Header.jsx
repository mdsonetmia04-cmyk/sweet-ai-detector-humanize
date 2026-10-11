import { useState } from "react";
import { Menu, Settings, X } from "lucide-react";

const NAV = [
  { id: "humanizer", label: "Humanizer" },
  { id: "detector", label: "AI Detector" },
  { id: "features", label: "Features" },
  { id: "about", label: "About" },
];

export default function Header({ onNavigate, onOpenSettings, hasApiKey }) {
  const [open, setOpen] = useState(false);

  function go(id) {
    setOpen(false);
    onNavigate(id);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#e6e7e1] bg-[#fbfbf8]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
        <button
          onClick={() => go("top")}
          className="flex items-center gap-2.5 bg-transparent p-0"
          aria-label="Sweet AI Detector and Humanizer home"
        >
          <span
            className="grid h-9 w-9 place-items-center rounded-lg bg-[#1e4a37] text-[20px] font-semibold text-[#f7f3e8]"
            aria-hidden="true"
          >
            ¶
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight text-[#20241f]">
              Sweet AI Detector &amp; Humanizer
            </span>
            <span className="block text-[11px] font-medium tracking-[0.14em] text-[#6f8a76] uppercase">
              Detect. Rewrite. Refine.
            </span>
          </span>
        </button>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className="rounded-full bg-transparent px-4 py-2 text-sm font-medium text-[#4e554d] transition hover:bg-[#eef1e8] hover:text-[#20241f]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            title="API settings — use your own free API key"
            aria-label="Open API settings"
            className={`relative grid h-10 w-10 place-items-center rounded-xl border transition ${
              hasApiKey
                ? "border-[#cfe0d2] bg-[#eef4ec] text-[#2f5b40]"
                : "border-[#dedfd8] bg-white text-[#4e554d] hover:border-[#aebdb0]"
            }`}
          >
            <Settings size={17} />
            {hasApiKey && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#fbfbf8] bg-[#2f5b40]" aria-hidden="true" />
            )}
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#dedfd8] bg-white text-[#4e554d] md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-[#e6e7e1] bg-[#fbfbf8] px-5 py-3 md:hidden" aria-label="Mobile">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className="block w-full rounded-lg bg-transparent px-3 py-2.5 text-left text-sm font-medium text-[#4e554d] hover:bg-[#eef1e8]"
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
