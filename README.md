# Sweet AI Detector & Humanizer

**Detect. Rewrite. Refine.**

A clean, no-login writing assistant: analyze AI-associated writing patterns, rewrite drafts into
more natural language, and use everyday text utilities. Built with React, Vite, Tailwind CSS, and a
Cloudflare Worker API with a hybrid AI engine (Cloudflare Workers AI first, optional OpenAI-compatible
fallback).

## Features

- **AI Humanizer** — 8 modes: Natural Humanize, Improve Clarity, Grammar Correction, Professional,
  Casual, Academic, Simple English, Blog & Article Editing — with 5 tone options.
- **AI Detector** — honest AI-writing-pattern analysis with uncertainty language, sentence-level
  observations, repetitive-pattern notes, and improvement suggestions. It never invents a score and
  never pretends to be a validated classifier.
- **Long-text support** — paragraph-aware chunking, ordered processing, live progress
  ("Processing section 4 of 12"), retry with backoff, no silent truncation.
- **Utilities** — word / character / sentence counters, reading-time estimate, `.txt` import and
  export, selection rewriting, undo history, before/after comparison, copy to clipboard.
- **Hybrid AI engine** — auto mode tries Cloudflare Workers AI, then falls back to an external
  OpenAI-compatible provider when configured. Transient errors retry; auth/config errors do not.
- **Private by design** — no login, no subscription, no database, no stored text. API keys stay
  server-side as Worker secrets.
- **Abuse prevention** — request-size limits, per-IP rate limiting on API routes, safe error
  messages, security headers.

## Requirements

- Node.js 20+ recommended
- A Cloudflare account (for deployment)
- Cloudflare Workers AI enabled for the account (used as the primary engine)
- Optional: an API key for an OpenAI-compatible provider (fallback engine)

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars
```

Run the Worker (serves the built UI + API) in one terminal:

```bash
npm run dev:worker
```

Then the Vite dev server with hot reload in a second terminal:

```bash
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` calls to the local Worker at `http://127.0.0.1:8787`.

For local external-provider testing, add your key to `.dev.vars` (never commit it):

```dotenv
EXTERNAL_AI_API_KEY=<redacted>
```

Run the Worker unit tests:

```bash
npm run test:worker
```

## AI provider behaviour

- **Auto / Hybrid (default):** calls Cloudflare Workers AI first. If it fails and `EXTERNAL_AI_API_KEY`
  is configured, falls back to the external API.
- **Cloudflare AI:** uses the `AI` binding and the `CF_AI_MODEL` variable from `wrangler.jsonc`.
- **External API:** uses `EXTERNAL_AI_BASE_URL`, `EXTERNAL_AI_MODEL`, and the `EXTERNAL_AI_API_KEY`
  secret. The endpoint must expose an OpenAI-compatible `/chat/completions` API.

Model names in `wrangler.jsonc` are defaults — verify availability and pricing for your Cloudflare
account and region, and for your external provider, before production use.

## Deploy to Cloudflare

1. Create a GitHub repository named `sweet-ai-detector-humanizer` and push this project.
2. Install dependencies and authenticate:

   ```bash
   npm install
   npx wrangler login
   ```

3. Add the external API key only if you want the fallback engine:

   ```bash
   npx wrangler secret put EXTERNAL_AI_API_KEY
   ```

   Paste the key at the prompt. Never put secrets in `wrangler.jsonc`, frontend code, or Git history.

4. Build and deploy:

   ```bash
   npm run deploy
   ```

5. For deploy-on-push, connect the repository in the Cloudflare dashboard (Workers & Pages →
   Create → Connect to Git). Set the build command to `npm run build` and the deploy command to
   `npx wrangler deploy`. Configure `EXTERNAL_AI_API_KEY` under the Worker's Settings → Variables
   as an encrypted secret.

6. Optional hardening in the Cloudflare dashboard:
   - Add a **Rate Limiting** rule for `/api/*` as a second layer behind the Worker's built-in limiter.
   - Add **Turnstile** on the site if you see automated abuse.
   - Monitor Workers AI usage and external-provider spend.

## Bring your own API key (Settings)

Users can optionally add their own free API key in the app's **Settings** (gear icon in the
header) and choose **"My API key"** in the AI engine dropdown. Supported presets:

- **Google Gemini** — free tier via AI Studio (`generativelanguage.googleapis.com`)
- **Groq** — free tier (`api.groq.com`)
- **OpenRouter** — including `:free` models (`openrouter.ai`)
- **Custom** — any OpenAI-compatible `https` endpoint on a supported host

How it works:

- The key is stored **only in the user's browser** (localStorage). It is sent with each
  request over HTTPS and used by the Worker solely to call the chosen provider for that
  request. It is never logged, never stored server-side, and never echoed in responses.
- The Worker only allows an allowlist of well-known provider hosts
  (`ALLOWED_CUSTOM_HOSTS` in `src/worker/providers/external.js`) to prevent abuse of the
  backend as an open proxy.
- Adding a key is **optional** — the app works fully without it using the owner's
  configured providers. It simply lets users run on their own quota.

## API

### `GET /api/health`

Service status and non-secret configuration (enabled providers, model names, limits).
Never returns secret values.

### `POST /api/humanize`

```json
{
  "text": "Text to revise",
  "mode": "humanize",
  "tone": "natural",
  "provider": "auto"
}
```

Modes: `humanize`, `clarity`, `grammar`, `professional`, `casual`, `academic`, `simple`, `blog`.
Tones: `natural`, `professional`, `casual`, `academic`, `simple`.
Providers: `auto`, `cloudflare`, `external`, `custom`.

For `provider: "custom"`, also send the user's key and endpoint (used only for that request,
never stored):

```json
{
  "text": "Text to revise",
  "provider": "custom",
  "apiKey": "user-supplied key",
  "custom": { "baseUrl": "https://api.groq.com/openai/v1", "model": "llama-3.3-70b-versatile" }
}
```

Append `?stream=1` (or `Accept: application/x-ndjson`) for newline-delimited JSON progress events:

```json
{"type":"progress","done":3,"total":12}
{"type":"result","text":"…","chunksProcessed":12,"providerUsed":"Cloudflare Workers AI","mode":"humanize","tone":"natural"}
{"type":"error","error":"…"}
```

### `POST /api/detect`

```json
{ "text": "Text to analyze", "provider": "auto" }
```

Returns `{ "analysis": { "method": "ai-writing-pattern-analysis", "assessment": "low|mixed|elevated",
"assessmentLabel": "…", "explanation": "…", "sentenceObservations": […],
"repetitivePatterns": […], "writingObservations": […], "suggestions": […],
"sectionsAnalyzed": 2, "providersUsed": […] } }`. Also supports `?stream=1`.

All endpoints validate input server-side and return consistent JSON errors
(`{ "error": "…" }`) with appropriate HTTP status codes.

## Long text and limits

The Worker groups paragraphs into ~6,500-character chunks and processes them in order.
Transient provider errors are retried with exponential backoff. Technical safeguards:
1 MB payload limit for humanize (500 KB for detect), 160 chunks per humanize request,
8 analysis sections per detect request, and 30 requests per 10 minutes per IP per endpoint.

These are infrastructure safeguards, not word-count plans. Real limits depend on the model's
context window, provider quotas, request payload size, and Worker runtime duration. For
book-length manuscripts, add a durable background queue (Workers Queues + KV/D1 job storage)
instead of completing everything in one HTTP request.

## Honesty notes

- The "AI Detector" is an LLM-based **writing-pattern analysis**, labeled as such everywhere in
  the UI and API. It produces no invented scores and must not drive academic, employment,
  disciplinary, or other high-stakes decisions.
- The humanizer improves writing quality. It is not promised to bypass AI detectors or to make
  text be classified as human-written.
- Submitted text is not logged or stored by the Worker. Cloudflare and the configured AI
  provider process the text to produce the result; review their data policies for your use case.

## Folder structure

```text
sweet-ai-detector-humanizer/
├── src/
│   ├── ui/
│   │   ├── components/      # Header, Hero, workspaces, Features, About, Footer
│   │   ├── utils/           # text counters, diff, NDJSON client
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   └── worker/
│       ├── routes/          # humanize, detect, health
│       ├── providers/       # cloudflare, external (OpenAI-compatible)
│       ├── services/        # engine (modes/tones/hybrid/chunk loop), chunking, detector
│       ├── utils/           # http helpers, rate limiting
│       └── index.js         # router
├── tests/
│   └── worker/              # node:test unit tests (chunking, engine, detector parsing)
├── public/
│   └── _headers             # static-asset security headers
├── index.html
├── package.json
├── vite.config.js
├── wrangler.jsonc
├── .gitignore
├── .dev.vars.example
└── README.md
```

## Remaining limitations

- The detector is heuristic: it can misread human style and miss AI-assisted text. Treat it as a
  writing-quality aid.
- Per-isolate in-memory rate limiting is best-effort; pair it with Cloudflare dashboard Rate
  Limiting rules for production.
- No background-job system yet: extremely long documents must fit the per-request chunk ceilings
  or be split by the user.
- No streaming of generated tokens (only progress events); very long single chunks wait for the
  full model response.
- Automated tests cover chunking, retry/fallback logic, detector parsing, and rate-limit helpers —
  not live provider calls or browser rendering.

## License

This project is open source under the [MIT License](LICENSE).
