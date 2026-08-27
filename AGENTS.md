# AAOS Research — Agent Instructions

This document is the canonical reference for all AI coding agents (OpenAI Codex, Claude Code, Gemini, etc.) working in this repository. It covers project goals, architecture, tech stack, development and deployment workflows, conventions, and hard constraints.

---

## Project overview

**AAOS Research** is a multi-model AI chat laboratory deployed at [aaos-research.vercel.app](https://aaos-research.vercel.app). It exposes three frontier language models through a dark space-themed web interface:

| Model | Role | Provider |
|-------|------|---------|
| Kimi K2 (1T-param MoE) | Reasoning, research, analysis | Groq LPU |
| GPT-OSS 20B | Educational tutor, STEM, PDF Q&A | Groq / Together AI |
| NousCoder-14B | Code generation, debugging, refactoring | HuggingFace Router |

The repo also contains a **custom 32-bit x86 kernel** (in `src/`) that boots under QEMU. In local kernel-backed web mode, FastAPI requires the kernel to echo each browser question over QEMU COM1 before inference and returns the final answer through the kernel before completing the SSE stream. The kernel is local-only and **not part of the Vercel deployment**.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Vercel (production)                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Next.js 16 App Router                 │  │
│  │  ┌──────────────────┐  ┌────────────────────────┐  │  │
│  │  │  /app/page.tsx   │  │  /app/chat/page.tsx    │  │  │
│  │  │  (homepage)      │  │  (full chat UI)        │  │  │
│  │  └──────────────────┘  └────────────────────────┘  │  │
│  │                                                    │  │
│  │  ┌────────────────────────────────────────────┐   │  │
│  │  │              Edge API Routes               │   │  │
│  │  │  /api/chat        multi-provider LLM+tools │   │  │
│  │  │  /api/chart       Yahoo Finance proxy      │   │  │
│  │  │  /api/flashcards  card generation          │   │  │
│  │  │  /api/pdf         text extraction (nodejs) │   │  │
│  │  └────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
        │              │               │
        ▼              ▼               ▼
   Groq LPU API   Together AI    HuggingFace Router
   (Kimi K2,      (fallback for  (NousCoder-14B)
    gpt-oss-20b,   all chains)
    Llama 3.3)

┌──────────────────────────────┐
│      Local-only (not Vercel) │
│ Next.js ↔ FastAPI ↔ QEMU     │
│         COM1 ↔ x86 kernel    │
└──────────────────────────────┘
```

---

## Repository structure

| Path | Role | Deployed |
|------|------|---------|
| `web/` | Next.js 16 frontend + API routes | ✅ Vercel |
| `web/app/api/chat/route.ts` | Chat endpoint — multi-provider LLM, tool calling, streaming SSE, Kimi K2 leak handling | ✅ Edge |
| `web/app/api/chart/route.ts` | Yahoo Finance v8 chart data proxy | ✅ Edge |
| `web/app/api/flashcards/route.ts` | Standalone flashcard generation endpoint | ✅ Edge |
| `web/app/api/pdf/route.ts` | PDF text extraction via `unpdf` | ✅ Node.js |
| `web/app/page.tsx` | Homepage: model cards, AAOI chart, NeptuneMuseum section | ✅ |
| `web/app/chat/page.tsx` | Full chat interface with model switcher, PDF/image attach, flashcard trigger | ✅ |
| `web/components/` | All React UI components | ✅ |
| `api/main.py` | Kernel-required FastAPI SSE and model gateway (local) | ❌ |
| `api/kernel_link.py` | QEMU COM1/TCP protocol client and round-trip verifier | ❌ |
| `api/supabase_schema.sql` | Supabase schema: sessions + messages tables | ❌ |
| `bridge/bridge.py` | TCP serial ↔ OpenAI bridge for the x86 kernel | ❌ |
| `src/boot.s` / `src/kernel.c` | x86 Multiboot1 OS kernel | ❌ |
| `build.ps1`, `run.ps1` | Kernel build (clang/lld) and QEMU launch scripts | ❌ |
| `vercel.json` | Vercel build config — builds `web/` and routes `/` → `web/` | ✅ |

---

## Tech stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.6 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | v4 |
| Language | TypeScript | 5.x |
| Math rendering | KaTeX (`remark-math`, `rehype-katex`) | 0.17.0 |
| Markdown | `react-markdown` + `remark-gfm` | — |
| PDF extraction | `unpdf` | 1.6.2 |
| Icons | `lucide-react` | 1.16.0 |
| LLM SDK | `openai` (OpenAI-compatible for all providers) | 6.39.0 |
| Deployment | Vercel Edge Functions | — |

---

## LLM provider architecture

`web/app/api/chat/route.ts` defines four **ordered fallback chains**. Each chain is tried top-to-bottom; a provider is skipped on HTTP 400/404/422/429/500/503/529.

### Chain selection (`resolveProviderChain`)

```
image attached         → VISION_PROVIDERS
model = "gpt-oss-20b"  → EDU_PDF_PROVIDERS (if PDF) or EDU_PROVIDERS
model = "nouscoder-14b"→ CODING_PROVIDERS
default                → GENERAL_PROVIDERS
```

### Provider chains

| Chain | Providers in order |
|-------|-------------------|
| `GENERAL_PROVIDERS` | Groq Kimi K2 → Groq gpt-oss-120b → OpenAI gpt-4o-mini → Together Llama-4 Scout → Together Llama 3.1 70B |
| `EDU_PROVIDERS` | Groq gpt-oss-20b → Together gpt-oss-20b → Together Llama-4 Scout → Together Llama 3.1 8B |
| `EDU_PDF_PROVIDERS` | Groq Kimi K2 → Groq gpt-oss-120b → then EDU_PROVIDERS |
| `CODING_PROVIDERS` | Dedicated NousCoder-14B endpoint (HF_TOKEN or HUGGINGFACE_API_KEY + NOUSCODER_BASE_URL) → OpenAI fine-tune or gpt-4o-mini |
| `VISION_PROVIDERS` | Groq Qwen 3.6 27B → OpenAI gpt-4o-mini |

---

## Chat tools

Three tools are exposed to the LLM in `/api/chat`:

| Tool | Description | Implementation |
|------|-------------|---------------|
| `get_stock` | Live US stock quote: price, change, day range, 52w high/low, YTD% | Yahoo Finance v8 chart API — no auth, no cookies |
| `web_search` | Live web results with publisher names and publish dates | Google News RSS (primary) → DuckDuckGo Instant Answer (fallback) |
| `fetch_page` | Full text of any HTTPS URL, HTML stripped, capped at 20k chars | Direct `fetch()`, Edge-compatible |

### Kimi K2 leak handling (critical)

Kimi K2 on Groq occasionally emits tool invocations as raw text in `delta.content` instead of structured `delta.tool_calls`. The route contains:

- `TOOLCALL_MARKERS` — prefixes that signal a leak (`<function`, `<tool_call`, `functools[`, etc.)
- `safeFlushLength()` — decides how many chars to stream vs. hold back (avoids marker split across deltas)
- `parseLeakedToolCalls()` — parses leaked text back into structured `{name, args}` calls

This code is correct and handles a real upstream bug. **Do not remove or simplify it.**

---

## Development workflow

### Setup

```bash
cd web
npm install
```

Create `web/.env.local`:
```
GROQ_API_KEY=...
TOGETHER_API_KEY=...
OPENAI_API_KEY=...
HF_TOKEN=...
NOUSCODER_BASE_URL=... # OpenAI-compatible dedicated endpoint, including /v1
```

### Commands

```bash
npm run dev     # http://localhost:3000 — hot reload
npm run build   # production build (mirrors Vercel exactly)
npm run lint    # ESLint
```

### Route runtimes — do not change

| Route | Runtime | Reason |
|-------|---------|--------|
| `api/chat` | `edge` | Zero cold-start, global CDN, streaming SSE |
| `api/chart` | `edge` | Lightweight proxy |
| `api/flashcards` | `edge` | LLM call only |
| `api/pdf` | `nodejs` | `unpdf` requires Node.js built-ins |

---

## Deployment workflow

1. **Push to `main`** → Vercel auto-deploys.
2. Vercel reads `vercel.json` at repo root → builds `web/package.json` with `@vercel/next`.
3. All traffic routes `/` → `web/`.
4. Environment variables are managed **only** in the Vercel dashboard.

### Critical deployment files

| File | Purpose | Change risk |
|------|---------|------------|
| `vercel.json` | Declares the build and routing | High — breaks deploy if wrong |
| `web/next.config.ts` | `ignoreBuildErrors: true` is intentional | Medium |
| `web/package.json` | Dependency versions | Medium |

---

## Streaming SSE protocol

`/api/chat` emits newline-delimited `data: <json>` events:

```
{ "type": "tool_call",   "tool": "web_search", "args": {"query": "..."} }
{ "type": "tool_result", "tool": "web_search", "result": {...} }
{ "type": "text",        "text": "Hello" }
{ "type": "flashcards",  "cards": [{"front": "...", "back": "..."}] }
{ "type": "done",        "text": "<full response>" }
{ "type": "error",       "message": "..." }
```

`ChatMessage.tsx` and `FloatingChat.tsx` parse these event types. Do not rename them.

---

## Repository conventions

### File naming
- API routes: `web/app/api/<name>/route.ts`
- Page components: `web/app/<path>/page.tsx`
- Shared components: `web/components/<ComponentName>.tsx` (PascalCase)
- No barrel `index.ts` files

### TypeScript
- Strict mode. New code should be fully typed.
- `ignoreBuildErrors: true` in `next.config.ts` is a legacy escape hatch — do not spread existing type errors.

### Styling
- Tailwind CSS v4, utility-first, dark space theme.
- Background base: `#050607` / `#04020e`. Text: white/zinc scale.
- Accent colors: blue (general), emerald (coding), violet (educational/featured).
- Cards: `border-white/10 bg-[#0c0e10]/80 backdrop-blur-xl shadow-2xl shadow-black/30`.

### State management
- No global state library. React `useState` / `useRef` / `useCallback` only.
- Chat session IDs: `uuid` v4, generated client-side per page load.

### History window (tuned — do not change without reason)
- PDF sessions: last 20 messages (context needed across pages)
- General / Kimi K2: last 6 messages (reduces prefill cost on 1T-param model)
- Other: last 10 messages

---

## Important constraints

1. **Never commit API keys.** Secrets live only in Vercel encrypted env.
2. **Edge runtime is mandatory** for `api/chat`, `api/chart`, `api/flashcards`. No `fs`, no `child_process`, no Node.js built-ins.
3. **Kimi K2 leak handling must be preserved.** This is not dead code — it is a live workaround for a provider bug.
4. **Do not modify `vercel.json` builds/routes** without verifying the deployment still works.
5. **`web/` is the production codebase.** `api/`, `bridge/`, and `src/` are local-only development tools.
6. **AAOI is core branding.** The `FloatingAaoiTicker`, homepage chart, and "Origin Signal" section must be preserved.
7. **History window values are intentional.** The 6/10/20 message windows are performance trade-offs, not bugs.
8. **`next.config.ts` type suppression is intentional.** Do not remove `ignoreBuildErrors` without adding full type coverage first.

---

## The x86 kernel (local only, not deployed)

| File | Role |
|------|------|
| `src/boot.s` | Multiboot1 header + `_start` |
| `src/kernel.c` | VGA text driver, COM1 serial driver, chat loop |
| `linker.ld` | ELF layout at 1 MiB |
| `build.ps1` | Builds with clang + ld.lld (requires LLVM installed) |
| `run.ps1` | Boots in QEMU; `-Chat` flag opens TCP serial port for bridge |
| `bridge/bridge.py` | Python: serial ↔ OpenAI bridge over TCP COM1 |
| `bridge/bridge.ps1` | PowerShell: launch bridge, decrypt API key from DPAPI |

The kernel communicates via `>question` / `?echo` / `<answer` protocol over COM1.

---

## Supabase (optional, local FastAPI only)

`api/supabase_schema.sql` defines `sessions` and `messages` tables. The FastAPI backend (`api/main.py`) persists chat history when `SUPABASE_URL` and `SUPABASE_ANON_KEY` are configured. The **Next.js web app does not use Supabase** — all chat state is client-side, in-memory, per session.
