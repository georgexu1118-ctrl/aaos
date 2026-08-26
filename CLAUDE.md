# AAOS Research — Claude Code Instructions

> Claude Code: read this first. Architecture, env setup, development workflow, and hard constraints are all here.

## What this repo is

**AAOS Research** is two things in one repository:

1. **Web app** (`web/`) — a deployed Next.js AI chat interface at [aaos-research.vercel.app](https://aaos-research.vercel.app). This is the **active, production codebase**. All day-to-day development happens here.
2. **x86 kernel** (`src/`, `bridge/`, `api/`) — a custom 32-bit Multiboot OS that boots under QEMU. **Local only, not deployed.** Touch this only when explicitly asked.

## Repository layout

```
aaos/
├── .claude/              # Claude Code config & permissions
├── CLAUDE.md             # This file — read first
├── AGENTS.md             # General agent instructions (Codex, etc.)
├── vercel.json           # Vercel build config — routes web/ as root
├── web/                  # ← PRIMARY CODEBASE (Next.js 16, React 19)
│   ├── CLAUDE.md         # Web-subdirectory overrides
│   ├── AGENTS.md         # Codex nextjs-agent rules (auto-injected)
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts       # Main chat endpoint (Edge, multi-provider)
│   │   │   ├── chart/route.ts      # Yahoo Finance chart proxy (Edge)
│   │   │   ├── flashcards/route.ts # Flashcard generation (Edge)
│   │   │   └── pdf/route.ts        # PDF text extraction (Node.js runtime)
│   │   ├── chat/page.tsx           # Full chat UI
│   │   ├── layout.tsx              # Root layout + metadata
│   │   └── page.tsx                # Homepage (model cards + AAOI section)
│   └── components/
│       ├── ChatInput.tsx           # Message input + image/PDF attach
│       ├── ChatMessage.tsx         # Markdown + LaTeX + tool badge rendering
│       ├── FlashcardDeck.tsx       # Flashcard modal
│       ├── FloatingAaoiTicker.tsx  # Live AAOI stock widget
│       ├── FloatingChat.tsx        # Floating chat bubble (homepage)
│       ├── Navbar.tsx              # Top navigation
│       ├── NebulaLayers.tsx        # CSS nebula background
│       ├── NeptuneMuseum.tsx       # Homepage bottom section
│       └── StarField.tsx           # Canvas starfield (SSR disabled)
├── api/                  # FastAPI backend (local use only, not deployed)
├── bridge/               # Serial ↔ OpenAI bridge for kernel
├── src/                  # x86 Multiboot kernel (C + Assembly)
├── Makefile / build.ps1  # Kernel build
└── run.ps1               # Boot kernel in QEMU
```

## Web stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI library | React 19 |
| Styling | Tailwind CSS v4 |
| Language | TypeScript 5 |
| Package manager | npm |
| Deployment | Vercel (Edge Functions) |
| Math rendering | KaTeX (`remark-math` + `rehype-katex`) |
| Markdown | `react-markdown` + `remark-gfm` |
| PDF extraction | `unpdf` |

## LLM provider chains (`web/app/api/chat/route.ts`)

The chat API runs on **Vercel Edge Runtime** and uses a multi-provider fallback chain keyed on the `?model=` param.
On HTTP 400/404/422/429/500/503/529, the chain silently falls to the next provider.

| UI label | `model` param | Primary model | Fallbacks |
|---|---|---|---|
| Kimi K2 (Reasoning) | `gpt-4o-mini` | Groq → `moonshotai/kimi-k2-instruct-0905` | Groq gpt-oss-120b → OpenAI gpt-4o-mini → Together Llama-4 |
| GPT-OSS 20B (Educational) | `gpt-oss-20b` | Groq → `openai/gpt-oss-20b` | Together gpt-oss-20b → Llama-4 Scout → Llama 3.1 8B |
| NousCoder-14B (Coding) | `nouscoder-14b` | Dedicated endpoint → `NousResearch/NousCoder-14B` | OpenAI fine-tune or gpt-4o-mini |
| Vision (screenshot) | auto-detected | Groq → `llama-4-scout-17b-16e-instruct` | Together Llama-4-Scout |

## Built-in tools

| Tool | What it does | Source |
|------|-------------|--------|
| `get_stock` | Live price, day range, 52w high/low, YTD% | Yahoo Finance v8 chart API (no auth) |
| `web_search` | Live headlines + publication dates | Google News RSS → DuckDuckGo fallback |
| `fetch_page` | Full clean text of any URL | Direct fetch, HTML stripped, 20k char cap |

**Kimi K2 leak handling**: Kimi K2 on Groq sometimes emits tool calls as raw text. The `TOOLCALL_MARKERS` + `safeFlushLength()` + `parseLeakedToolCalls()` system in `route.ts` detects every known leak syntax and converts it back to a real tool call. This is a live provider bug — **do not remove this code**.

## Environment variables (Vercel only — never commit)

```
GROQ_API_KEY           # Groq LPU (Kimi K2, Llama 3.3, gpt-oss-20b)
TOGETHER_API_KEY       # Together AI (fallback for all chains)
OPENAI_API_KEY         # OpenAI gpt-4o-mini (fallback for general chain)
HF_TOKEN               # Auth for the dedicated NousCoder-14B endpoint
HUGGINGFACE_API_KEY    # Alternate key name for the dedicated endpoint
NOUSCODER_BASE_URL     # OpenAI-compatible dedicated NousCoder endpoint, including /v1
OPENAI_FINETUNE_MODEL  # Optional: swap a fine-tuned model into the OpenAI slot
```

## Development workflow

```bash
cd web
npm install          # first time only
npm run dev          # http://localhost:3000
npm run build        # production build (mirrors Vercel)
npm run lint         # ESLint
```

Create `web/.env.local` with the env vars above for local testing.
The `vercel.json` at the repo root routes all traffic to `web/` — `npm run dev` from `web/` is all you need locally.

## Deployment

Push to `main` → Vercel auto-deploys via `vercel.json` → `web/package.json` → `@vercel/next`.

- Do **not** change `vercel.json` builds/routes without verifying the deploy still works.
- `web/next.config.ts` has `typescript: { ignoreBuildErrors: true }` — intentional for rapid iteration.
- `api/pdf/route.ts` uses `runtime = "nodejs"` explicitly — `unpdf` requires it. All other API routes are Edge.

## Hard constraints

1. **Never hardcode or commit API keys** anywhere in the repo.
2. **Edge runtime**: `api/chat`, `api/chart`, `api/flashcards` must stay on Vercel Edge. No Node.js-only imports.
3. **Kimi K2 leak handling must be preserved** — do not remove `TOOLCALL_MARKERS`, `safeFlushLength`, or `parseLeakedToolCalls`.
4. **Never change `vercel.json` builds/routes** without a clear deployment reason.
5. **`web/` is the production deployment.** Files in `api/`, `bridge/`, `src/` are local-only.
6. **AAOI branding is intentional.** The AAOI ticker, chart, and homepage section are core to the project.

## Common tasks

### Add a new model
1. Add a `ProviderConfig` entry to the correct chain array in `route.ts`
2. Add the model to `MODELS` in `web/app/chat/page.tsx`
3. Add the UI card to `labs` in `web/app/page.tsx`
4. Update `resolveProviderChain()` if the model needs a new `model` param value

### Add a new tool
1. Implement the function in `route.ts` (before `TOOLS`)
2. Add its schema to `TOOLS[]`
3. Add its name to the `known` set in `parseLeakedToolCalls()`
4. Handle it in the parallel tool execution block (`if (tc.name === ...)`)
5. Add a `ToolBadge` case in `ChatMessage.tsx`

### Edit system prompts
Each mode has a dedicated constant in `route.ts`:
- `SYSTEM_PROMPT` — general (Kimi K2)
- `SYSTEM_PROMPT_EDU` — educational (GPT-OSS 20B); includes `STEM_RULES` + `CHEMISTRY_OF_SOLUTIONS`
- `SYSTEM_PROMPT_CODING` — coding (NousCoder-14B)
- `SYSTEM_PROMPT_VISION` — vision/screenshot mode; includes `STEM_RULES`
- `SYSTEM_PROMPT_FLASHCARDS` — flashcard generation (JSON-only output)

## AAOI context

The project name AAOS was inspired by AAOI (Applied Optoelectronics Inc, NASDAQ: AAOI). The homepage includes a live AAOI chart image (`/public/aaoi-chart.png`), a floating live ticker (`FloatingAaoiTicker.tsx`), and an "Origin Signal" section. The `get_stock` tool and `COMPANY_TICKERS` map in `route.ts` include AAOI by default. Do not remove these.
