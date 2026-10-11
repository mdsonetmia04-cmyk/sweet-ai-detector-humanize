import { useCallback, useState } from "react";
import Header from "./components/Header.jsx";
import Hero from "./components/Hero.jsx";
import HumanizerWorkspace from "./components/HumanizerWorkspace.jsx";
import DetectorWorkspace from "./components/DetectorWorkspace.jsx";
import Features from "./components/Features.jsx";
import About from "./components/About.jsx";
import Footer from "./components/Footer.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import { hasKeyConfig } from "./utils/byok.js";

export default function App() {
  const [tab, setTab] = useState("humanizer");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keySaved, setKeySaved] = useState(() => hasKeyConfig());

  const scrollTo = useCallback((id) => {
    if (id === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (id === "humanizer" || id === "detector") {
      setTab(id);
    }
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return (
    <main className="min-h-screen bg-[#fafaf7] text-[#20241f]">
      <Header
        onNavigate={scrollTo}
        onOpenSettings={() => setSettingsOpen(true)}
        hasApiKey={keySaved}
      />
      <Hero
        onStartWriting={() => scrollTo("humanizer")}
        onCheckPatterns={() => scrollTo("detector")}
      />

      <section id="workspace" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-6 sm:px-8">
        <div
          className="mb-5 inline-flex rounded-full border border-[#dedfd8] bg-white p-1"
          role="tablist"
          aria-label="Tool"
        >
          {[
            ["humanizer", "Humanizer"],
            ["detector", "AI Detector"],
          ].map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                tab === value ? "bg-[#1e4a37] text-white" : "text-[#535950] hover:text-[#20241f]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div id="humanizer" className="scroll-mt-28">
          {tab === "humanizer" && <HumanizerWorkspace onOpenSettings={() => setSettingsOpen(true)} />}
        </div>
        <div id="detector" className="scroll-mt-28">
          {tab === "detector" && <DetectorWorkspace onOpenSettings={() => setSettingsOpen(true)} />}
        </div>
      </section>

      <Features />
      <About />
      <Footer />
      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setKeySaved(hasKeyConfig());
        }}
      />
    </main>
  );
}
