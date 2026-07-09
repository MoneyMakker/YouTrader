# YouTrader Production AI Architecture Audit

**Date:** 2026-07-08  
**Scope:** Production mobile app + Supabase Edge Functions + background workers  
**Method:** Static code and documentation review (no Supabase dashboard access, no live secret inspection)  
**Status:** Read-only audit — no code modified

---

## Executive summary

YouTrader’s **production AI** is correctly architected as **server-side only**: the Expo client never holds OpenRouter or other LLM keys and never calls LLM APIs directly. All paid cloud AI for coaching flows through **`supabase.functions.invoke("ai-coach")`**.

**OpenRouter** is used in production **only if** `OPENROUTER_API_KEY` is set in **Supabase Edge Function secrets** — the Edge Function calls `https://openrouter.ai/api/v1` directly from Deno. **9Router is not part of production**; it is a local developer tool (`~/Projects/ai-dev-tools`).

Two gaps worth addressing in 2026:

1. **Market Intelligence** (`market-intelligence` Edge Function) uses a **separate, legacy** provider path (NVIDIA NIM / OpenAI) and does **not** route through OpenRouter or `aiProvider.ts`.
2. **AI Analytics / Detective** (`analyzeTrades`) is **100% deterministic local** — not cloud LLM — which is good for cost and safety but should be understood separately from AI Coach.

---

## Architecture diagram (production)

```text
┌─────────────────────────────────────────────────────────────────┐
│  YouTrader iOS App (Expo)                                       │
│  • No LLM API keys in bundle                                    │
│  • EXPO_PUBLIC_SUPABASE_* only for auth + Edge invoke           │
└────────────┬───────────────────────────────┬────────────────────┘
             │                               │
             │ JWT                           │ JWT
             ▼                               ▼
┌────────────────────────────┐   ┌────────────────────────────────┐
│  Edge: ai-coach            │   │  Edge: market-intelligence      │
│  • Pro entitlement check   │   │  • Pro + rate limits            │
│  • AI quota (Upstash/DB)   │   │  • Brave Search (news)          │
│  • RAG retrieval           │   │  • marketAiProvider (legacy)    │
└────────────┬───────────────┘   └────────────┬───────────────────┘
             │                                 │
             ▼                                 ▼
┌────────────────────────────┐   ┌────────────────────────────────┐
│  aiProvider.ts             │   │  NVIDIA NIM or OpenAI API       │
│  OpenRouter (preferred)    │   │  (NOT OpenRouter today)         │
│  Gemini / Anthropic direct │   │  default: llama-3.1-70b-instruct│
│  NVIDIA fallback           │   └────────────────────────────────┘
└────────────┬───────────────┘
             │
             ├─► OpenRouter API ──► google/gemini-2.5-flash (fast)
             │                      anthropic/claude-sonnet-4 (deep)
             ├─► Google Gemini API (direct)
             ├─► Anthropic API (direct)
             ├─► NVIDIA NIM API (direct)
             └─► OpenAI API ──► text-embedding-3-small (RAG only)

┌────────────────────────────┐
│  Local (client, no cloud)  │
│  • analyzeTrades()         │
│  • aiCoach free fallback   │
└────────────────────────────┘

┌────────────────────────────┐
│  market-intel-worker       │  (server cron, not user-facing LLM)
│  • RSS / scraping          │
│  • Optional Ollama local   │  ENABLE_LOCAL_LLM_SUMMARIES=true
└────────────────────────────┘

┌────────────────────────────┐
│  9Router (localhost)     │  ⚠️ DEV ONLY — not in app or Edge
│  Cursor / Codex / DeerFlow │
└────────────────────────────┘
```

---

## 1. Which OpenRouter models are currently used?

OpenRouter is invoked **only from** `supabase/functions/_shared/aiProvider.ts` when:

- `AI_PROVIDER=openrouter`, **or**
- `AI_PROVIDER=auto` (default) and `OPENROUTER_API_KEY` is present (first choice in fallback chain).

**Model IDs** come from Supabase secrets `AI_MODEL_FAST` and `AI_MODEL_DEEP`, with code defaults:

| Tier | Env var | Default (OpenRouter slug) | Used for actions |
|------|---------|---------------------------|------------------|
| **Fast** | `AI_MODEL_FAST` | `google/gemini-2.5-flash` | `daily_plan`, `news_explainer`, `daily_challenge` |
| **Deep** | `AI_MODEL_DEEP` | `anthropic/claude-sonnet-4` | `weekly_coach`, `journal_summary`, `risk_predictor` |

Documented in `.env.example` and `docs/AI_PROVIDER_SETUP.md`:

```env
AI_MODEL_FAST=google/gemini-2.5-flash
AI_MODEL_DEEP=anthropic/claude-sonnet-4
```

**Not on OpenRouter today:**

- RAG embeddings (`text-embedding-3-small`) → **OpenAI direct**
- Market Intelligence summaries → **NVIDIA NIM or OpenAI direct** (`marketAiProvider.ts`)
- Background market-intel-worker → **deterministic** or optional **local Ollama** (`qwen2.5:7b`)

**Production note:** Actual models in live Supabase depend on secrets set in the dashboard. This audit reports **code + documented defaults**, not live secret values.

---

## 2. Which API keys are used?

### Client (Expo) — public / safe keys only

From `.env.example` — **no private LLM keys**:

| Key | Purpose |
|-----|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Auth + Edge invoke |
| `EXPO_PUBLIC_REVENUECAT_*` | Subscriptions |
| `EXPO_PUBLIC_FINNHUB_API_KEY` | Economic calendar (not LLM) |
| `EXPO_PUBLIC_SENTRY_DSN` | Crash reporting |
| `EXPO_PUBLIC_POSTHOG_*` | Product analytics |

Explicitly **forbidden** in client (documented + security-check):

- `EXPO_PUBLIC_OPENROUTER_API_KEY`
- `EXPO_PUBLIC_GEMINI_API_KEY`
- `EXPO_PUBLIC_ANTHROPIC_API_KEY`
- `EXPO_PUBLIC_NVIDIA_API_KEY`

### Supabase Edge Functions — server-only secrets

| Secret | Used by | Purpose |
|--------|---------|---------|
| `OPENROUTER_API_KEY` | `aiProvider.ts` | OpenRouter gateway for AI Coach |
| `GEMINI_API_KEY` | `aiProvider.ts` | Direct Gemini fallback |
| `ANTHROPIC_API_KEY` | `aiProvider.ts` | Direct Claude fallback |
| `NVIDIA_API_KEY` | `aiProvider.ts`, `marketAiProvider.ts` | NVIDIA NIM fallback |
| `NVIDIA_MODEL` | Both providers | Override NIM model |
| `OPENAI_API_KEY` | `retrievalService.ts`, `marketAiProvider.ts` | Embeddings + market AI fallback |
| `OPENAI_EMBEDDING_MODEL` | `retrievalService.ts` | Default `text-embedding-3-small` |
| `AI_PROVIDER` | `aiProvider.ts` | `auto` \| `openrouter` \| `gemini` \| `anthropic` \| `nvidia` |
| `AI_MODEL_FAST` / `AI_MODEL_DEEP` | `aiProvider.ts` | Model slugs per tier |
| `SUPABASE_SERVICE_ROLE_KEY` | All Edge Functions | Admin DB, RAG RPC, quotas |
| `BRAVE_SEARCH_API_KEY` | `braveSearch.ts` | Market news fetch |
| `UPSTASH_REDIS_REST_*` | `rateLimits.ts` | Rate limiting (optional) |
| `LANGFUSE_*` | `langfuse.ts` | Optional AI tracing |
| `REVENUECAT_ENTITLEMENT_ID` | `ai-coach`, `market-intelligence` | Pro gating |

### Developer machine only (not production app)

| Key / tool | Location | Purpose |
|------------|----------|---------|
| `OPENROUTER_API_KEY` | `~/.config/youtrader-ai/.env` | Cursor/Codex/DeerFlow via 9Router |
| 9Router API key | 9Router dashboard | Local OpenAI-compatible proxy |

---

## 3. Which requests go through Supabase?

All **user-facing cloud AI** from the app goes through Supabase Edge Functions:

| Client API | Edge Function | Auth | Pro gate |
|------------|---------------|------|----------|
| `src/api/aiCoach.ts` → `invoke("ai-coach")` | `supabase/functions/ai-coach/` | JWT required | Free = local preview; Pro = cloud AI + quota |
| `src/api/marketIntelligence.ts` → `invoke("market-intelligence")` | `supabase/functions/market-intelligence/` | JWT required | Pro only |
| `src/security/uploadSecurity.ts` → `invoke("secure-upload")` | Media upload validation | JWT | Not LLM |

**Inside Edge Functions**, Supabase is also used for:

- **Auth:** `supabase.auth.getUser(jwt)`
- **Entitlements:** `user_subscriptions` table
- **Quotas:** `ai_usage_events` / rate limit buckets
- **RAG:** `rag_match_knowledge_chunks` RPC on pgvector

**Does not go through Supabase:**

- `analyzeTrades()` — runs entirely on device (`src/api/tradeAnalysis.ts`)
- Client-side AI Coach fallback when offline / no session / Edge error
- Finnhub calendar HTTP calls from client (market data, not LLM)
- Developer 9Router stack

---

## 4. Which requests go directly to OpenRouter?

| Caller | Direct to OpenRouter? | Endpoint |
|--------|----------------------|----------|
| **Expo app** | **Never** | — |
| **ai-coach Edge Function** | **Yes**, when `OPENROUTER_API_KEY` set and provider resolves to `openrouter` | `https://openrouter.ai/api/v1/chat/completions` |
| **market-intelligence** | **No** | Uses NVIDIA or OpenAI only |
| **RAG embeddings** | **No** | OpenAI `https://api.openai.com/v1/embeddings` |
| **9Router (dev)** | Yes, from developer machine | Proxies to OpenRouter for Cursor/Codex |

OpenRouter calls include headers `HTTP-Referer: https://youtrader.app` and `X-Title: YouTrader` per `aiProvider.ts`.

**Auto-mode provider order** (`AI_PROVIDER=auto`):

- **Deep tier:** OpenRouter → Anthropic → Gemini → NVIDIA  
- **Fast tier:** OpenRouter → Gemini → NVIDIA → Anthropic  

Skipped if the corresponding API key is missing.

---

## 5. Which models are used for AI Coach?

AI Coach = **`ai-coach` Edge Function** + **`aiProvider.ts`**.

### Actions and tiers

| Action | Tier | Typical model (OpenRouter defaults) |
|--------|------|-------------------------------------|
| `daily_plan` | fast | `google/gemini-2.5-flash` |
| `news_explainer` | fast | `google/gemini-2.5-flash` |
| `daily_challenge` | fast | `google/gemini-2.5-flash` |
| `weekly_coach` | deep | `anthropic/claude-sonnet-4` |
| `journal_summary` | deep | `anthropic/claude-sonnet-4` |
| `risk_predictor` | deep | `anthropic/claude-sonnet-4` |

### Generation parameters

- Temperature: `0.2`
- Max tokens: `900`
- Timeout: `18s`
- Output: strict JSON (schema per action)
- RAG context injected when `OPENAI_API_KEY` + knowledge base available

### Free vs Pro

| User | Behavior |
|------|----------|
| **Free** | `generateAI(..., allowNvidia: false)` → deterministic **local fallback** only; `providerStatus: free_preview` |
| **Pro** | Cloud providers + quota; fallback to local on provider failure |

### Not AI Coach (often confused)

| Feature | Implementation |
|---------|----------------|
| **AI Analytics / Detective** | `analyzeTrades()` — local deterministic rules |
| **Stats / achievements** | Deterministic engines in `src/analytics/` |
| **Prop survival scores** | Deterministic |

---

## 6. Which models should be upgraded?

| Component | Current default | Recommendation (2026) | Priority |
|-----------|-----------------|----------------------|----------|
| **Fast tier (Coach)** | `google/gemini-2.5-flash` | Keep Flash family; evaluate **`google/gemini-2.5-flash`** vs newer Flash-Lite for cost/latency after A/B via OpenRouter | Medium |
| **Deep tier (Coach)** | `anthropic/claude-sonnet-4` | Upgrade to latest **Claude Sonnet** generation available on OpenRouter when JSON reliability validated; reserve Opus-class only for experimental deep features | High |
| **NVIDIA fallback** | `meta/llama-3.1-70b-instruct` | **Deprecate as primary**; keep only as emergency fallback or remove after OpenRouter + direct keys stable | High |
| **Market Intelligence** | Same Llama 3.1 70B path | **Route through OpenRouter** with `AI_MODEL_FAST` or dedicated `AI_MODEL_MARKET` — unify with `aiProvider.ts` | High |
| **RAG embeddings** | `text-embedding-3-small` | Adequate for cost; consider **`text-embedding-3-large`** only if retrieval quality metrics show gaps | Low |
| **market-intel-worker** | Optional Ollama `qwen2.5:7b` | Keep optional/local; do not expose to mobile users | Low |

**MASTER_CONTEXT.md lag:** Still mentions older provider-status vocabulary (`nvidia` only in §7.2). Code already supports `openrouter`, `gemini`, `anthropic`. Documentation sync recommended (separate from this audit).

---

## 7. Should 9Router be used in production?

## 8. If not — why?

**No. 9Router must not be used in production.**

| Reason | Detail |
|--------|--------|
| **Deployment model** | 9Router is a **local Node/Electron proxy** on `localhost:20128` — unavailable to iOS devices or Supabase Edge |
| **Security boundary** | Production design keeps LLM keys in **Supabase secrets**, not on user devices or a dev laptop |
| **Latency & reliability** | Adding a non-HA local hop between Edge and OpenRouter would break globally distributed users |
| **Scope** | Documented explicitly for **Cursor, Codex, Parallel Code, DeerFlow** (`docs/AI_DEV_TOOLS_SETUP.md`) |
| **Code evidence** | Zero references to `9router` or `127.0.0.1:20128` in `src/`, `supabase/`, or app config |

**Correct production pattern:** Supabase Edge → **direct** OpenRouter API (already implemented in `aiProvider.ts`).

**Correct dev pattern:** Cursor/Codex → 9Router → OpenRouter (cost routing, model picker).

---

## 9. Recommended optimal production AI architecture (2026)

### Design principles (preserve)

1. **Client never holds LLM secrets**
2. **Journal remains source of truth** — AI explains, does not invent metrics
3. **Free users never trigger paid generation**
4. **Pro gating + quotas on server**
5. **Strict JSON + safety prompts** — no financial advice / signals
6. **RAG for prop-firm / rules grounding** with low-confidence handling
7. **Local fallback always available**

### Target architecture

```text
iOS App
  └─► Supabase Edge (JWT + Pro + quota)
        ├─► ai-coach ──► unified aiProvider router
        │                  ├─ primary: OpenRouter (AI_MODEL_FAST / AI_MODEL_DEEP)
        │                  ├─ fallback: direct Gemini / Anthropic (same model IDs)
        │                  └─ last resort: deterministic local JSON fallback
        │
        ├─► market-intelligence ──► SAME aiProvider router (fast tier)
        │                  └─ Brave Search for headlines (unchanged)
        │
        └─► RAG pipeline
               ├─ OpenAI embeddings (text-embedding-3-small)
               └─ Supabase pgvector retrieval

Observability: Langfuse (optional) + Sentry + PostHog (no PII in traces)
Rate limits: Upstash Redis + per-action daily caps
Background: market-intel-worker stays non-LLM or local Ollama only
Dev tools: 9Router + OpenRouter (never shipped to users)
```

### Concrete roadmap

| Phase | Action |
|-------|--------|
| **P0** | Confirm Supabase secrets: `AI_PROVIDER=auto`, `OPENROUTER_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_DEEP`, `OPENAI_API_KEY` (RAG) |
| **P0** | Remove reliance on NVIDIA Llama 3.1 70B for new deployments unless explicitly needed |
| **P1** | Refactor `marketAiProvider.ts` to call shared `aiProvider.ts` (single routing, single observability) |
| **P1** | Set deep model to latest Sonnet on OpenRouter; run Promptfoo safety suite |
| **P2** | Add model/version fields to `ai_usage_events` for cost analytics |
| **P2** | Evaluate Gemini Flash-Lite for fast tier cost reduction |
| **P3** | Consider Edge-level circuit breaker + cached responses for identical daily_plan queries |

### What not to do

- Do not put OpenRouter keys in `EXPO_PUBLIC_*`
- Do not route production traffic through 9Router
- Do not merge AI Analytics (`analyzeTrades`) into paid LLM without strong cost justification
- Do not send screenshots, voice notes, or full journals to LLM providers (already stripped — keep enforced)

---

## Appendix A — File reference

| File | Role |
|------|------|
| `src/api/aiCoach.ts` | Client → `ai-coach` Edge only |
| `src/api/tradeAnalysis.ts` | Local deterministic analytics |
| `src/api/marketIntelligence.ts` | Client → `market-intelligence` Edge |
| `supabase/functions/ai-coach/index.ts` | Auth, Pro, quota, orchestration |
| `supabase/functions/_shared/aiProvider.ts` | OpenRouter + multi-provider routing |
| `supabase/functions/_shared/marketAiProvider.ts` | Legacy NVIDIA/OpenAI path |
| `supabase/functions/_shared/retrievalService.ts` | OpenAI embeddings + pgvector |
| `docs/AI_PROVIDER_SETUP.md` | Operator setup guide |
| `docs/AI_DEV_TOOLS_SETUP.md` | 9Router / dev stack (not production) |

---

## Appendix B — Unknowns (not visible in repo)

- Actual Supabase secret values configured in production project
- Live OpenRouter spend, model routing logs, and per-provider error rates
- Whether Langfuse and Upstash are enabled in production
- Current Brave Search quota and fallback behavior when key missing

For live verification, use Supabase dashboard secrets audit + Langfuse/OpenRouter usage dashboards (no keys in chat).

---

**Audit conclusion:** Production AI architecture is **fundamentally sound** (server-side, Supabase-gated, OpenRouter-ready). **9Router is correctly excluded from production.** Main improvement for 2026 is **unifying Market Intelligence with the same OpenRouter-first router** and **retiring NVIDIA Llama 3.1 70B as a default path**.
