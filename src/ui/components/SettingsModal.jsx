import { useEffect, useState } from "react";
import { ExternalLink, Eye, EyeOff, KeyRound, ShieldCheck, Trash2, X } from "lucide-react";
import { PRESETS, PRESET_KEYS, clearKeyConfig, loadKeyConfig, saveKeyConfig } from "../utils/byok.js";

export default function SettingsModal({ open, onClose }) {
  const [preset, setPreset] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(PRESETS.gemini.baseUrl);
  const [model, setModel] = useState(PRESETS.gemini.model);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      const existing = loadKeyConfig();
      if (existing) {
        setPreset(existing.preset);
        setApiKey(existing.apiKey);
        setBaseUrl(existing.baseUrl);
        setModel(existing.model);
        setSaved(true);
      } else {
        setSaved(false);
      }
      setError("");
      setShowKey(false);
    }
  }, [open ]);

  if (!open) return null;

  function selectPreset(key) {
    setPreset(key);
    const p = PRESETS[key];
    setBaseUrl(p.baseUrl);
    if (p.model) setModel(p.model);
    else setModel("");
  }

  function handleSave() {
    if (!apiKey.trim()) {
      setError("Paste your API key first.");
      return;
    }
    if (!baseUrl.trim().startsWith("https://")) {
      setError("The provider URL must start with https://");
      return;
    }
    if (!model.trim()) {
      setError("Enter the model name to use.");
      return;
    }
    saveKeyConfig({ preset, baseUrl, model, apiKey });
    setSaved(true);
    setError("");
  }

  function handleRemove() {
    clearKeyConfig();
    setApiKey("");
    setSaved(false);
    setError("");
  }

  const active = PRESETS[preset];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="API settings"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#ecece7] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef4ec] text-[#2f5b40]">
              <KeyRound size={17} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-[#20241f]">API Settings</h2>
              <p className="text-xs text-[#858a82]">Use your own free API key for full access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="grid h-9 w-9 place-items-center rounded-lg text-[#777d74] hover:bg-[#f1f3ec]"
          >
            <X size={17} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <p className="text-[13px] leading-6 text-[#4e554d]">
            Add a <strong className="font-semibold">free API key</strong> from Gemini, Groq, or
            OpenRouter to run the humanizer and detector on your own quota — no limits from
            the shared engine. The key is stored <strong className="font-semibold">only in this
            browser</strong> and sent with your requests over HTTPS. It is never saved on the server.
          </p>

          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#6f8a76]">
            Choose provider
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_KEYS.map((key) => {
              const p = PRESETS[key];
              const selected = preset === key;
              return (
                <button
                  key={key}
                  onClick={() => selectPreset(key)}
                  className={`rounded-xl border px-3.5 py-3 text-left transition ${
                    selected
                      ? "border-[#1e4a37] bg-[#f2f7f0]"
                      : "border-[#e1e2dc] bg-white hover:border-[#aebdb0]"
                  }`}
                >
                  <span className="block text-[13px] font-semibold text-[#2b302b]">{p.name}</span>
                  <span className="block text-[11px] text-[#858a82]">{p.tag}</span>
                </button>
              );
            })}
          </div>

          <label htmlFor="byok-key" className="mb-1.5 mt-5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#6f8a76]">
            API key
          </label>
          <div className="relative">
            <input
              id="byok-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key here"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-[#dedfd8] bg-white px-4 py-2.5 pr-11 text-sm outline-none focus:border-[#60816c]"
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#777d74] hover:bg-[#f1f3ec]"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#858a82]">
            {active.keyHint}
            {active.keyUrl && (
              <a
                href={active.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[#2f5b40] hover:underline"
              >
                Get a key <ExternalLink size={11} />
              </a>
            )}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="byok-url" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#6f8a76]">
                Base URL
              </label>
              <input
                id="byok-url"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://…"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-[#dedfd8] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#60816c]"
              />
            </div>
            <div>
              <label htmlFor="byok-model" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#6f8a76]">
                Model
              </label>
              <input
                id="byok-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={active.modelPlaceholder || "model-name"}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-[#dedfd8] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#60816c]"
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-[#f0d5d0] bg-[#fff7f5] px-4 py-2.5 text-[13px] text-[#9a3d31]">
              {error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1e4a37] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#16382a]"
            >
              {saved ? "Update key" : "Save key"}
            </button>
            {saved && (
              <button
                onClick={handleRemove}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#e3c9c4] bg-white px-4 py-2.5 text-sm font-medium text-[#9a3d31] hover:bg-[#fff7f5]"
              >
                <Trash2 size={14} /> Remove key
              </button>
            )}
            {saved && !error && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2f5b40]">
                <ShieldCheck size={14} /> Key saved in this browser
              </span>
            )}
          </div>

          <p className="mt-4 rounded-xl bg-[#faf6e9] px-4 py-3 text-xs leading-5 text-[#6b5a2b]">
            After saving, choose <strong className="font-semibold">“My API key”</strong> in the
            AI engine dropdown to use it. Switch back to Auto / Hybrid anytime — adding a key
            is optional and never required.
          </p>
        </div>
      </div>
    </div>
  );
}
