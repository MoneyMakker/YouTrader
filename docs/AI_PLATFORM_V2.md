# YouTrader AI Platform V2

**Status:** Phase 1 implemented (AI Router) — **validation before deploy**
**Last updated:** 2026-07-08
**Owner:** Chief AI Architect
**Deploy:** NOT DEPLOYED · NOT PUSHED · NOT MERGED

---

## Vision

Production-grade AI platform for millions of users: cost-efficient, observable, secure, maintainable — modeled after practices at Apple, OpenAI, Anthropic, and Stripe. Optimized for the next **5 years**.

---

## Target architecture

```text
iOS App
  └─► Supabase Edge Functions (JWT, Pro, quotas)
        └─► AI Platform V2 Router
              ├─► Model selection (profile + long-context)
              ├─► Fallback chains
              ├─► Cache (TTL)
              ├─► Prompt registry (versioned)
              └─► Provider adapters (config-driven)
                    └─► OpenRouter, Gemini, Anthropic, NVIDIA, OpenAI, …

Observability
  ├─► Structured logs
  ├─► Langfuse (server)
  ├─► PostHog (client)
  └─► Sentry (client)

Embeddings (RAG) — unchanged
  └─► OpenAI text-embedding-3-small (server-side)
```

---

## Principles

1. **No hardcoded providers or models** — `config.default.json` + `AI_PLATFORM_CONFIG_JSON`
2. **All LLM traffic via `routeAIRequest()`** — no feature-level OpenRouter calls
3. **Client never sees providers** — only `providerStatus` for UX
4. **Fail safe** — local deterministic fallback preserved
5. **Feature flags** — `AI_PLATFORM_V2_ENABLED=false` → full legacy path
6. **CEO gate** on every deploy step

---

## Module layout

```text
supabase/functions/_shared/aiPlatform/
├── config.default.json
├── config.ts
├── types.ts
├── router.ts
├── modelSelection.ts
├── providers.ts
├── cache.ts
├── observability.ts
├── prompts/registry.ts
└── index.ts

scripts/ai-platform-v2/
├── validate-pipeline.mjs    # Pre-deploy validation
├── golden-prompts.json      # 100 benchmark prompts
├── run-benchmark.mjs        # Weekly benchmark (dry-run)
└── reports/
```

---

## Phase roadmap

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | AI Router + AI Coach | **Implemented** — awaiting validation + deploy approval |
| **1b** | Validation → Preview → TestFlight → iPhone → Prod | Pipeline ready |
| **2** | Market Intelligence → router | Planned |
| **3** | AI Cost Monitor + historical charts | Designed |
| **4** | DB prompt versioning (`coach_v1`, `coach_v2`, …) | Migration ready |
| **5** | A/B testing (recommendations only) | Designed |
| **6** | Weekly benchmark engine + Golden Suite | Dry-run ready |

See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md).

---

## Validation (Step 1 — mandatory before deploy)

```bash
npm run ai-platform:validate          # Run checks
npm run ai-platform:validate:report   # Update AI_PLATFORM_V2_VALIDATION.md
npm run ai-platform:benchmark         # Dry-run benchmark rankings
```

Verifies: endpoints, router, model selection, fallback, cache, prompts, cost logging, observability, Langfuse, PostHog, Sentry, security, rollback, golden suite.

**Gate:** 0 FAIL in validation report before Preview Deploy.

---

## Configuration

| Variable | Purpose |
|----------|---------|
| `AI_PLATFORM_V2_ENABLED` | `false` = legacy `aiProvider` path |
| `AI_PLATFORM_CONFIG_JSON` | Partial/full JSON override |
| `AI_PLATFORM_CACHE_ENABLED` | `false` disables cache |
| `AI_PLATFORM_CACHE_TTL_SECONDS` | Cache TTL |
| `AI_PROMPT_VERSION_COACH` | e.g. `coach_v1` |
| Provider keys | Supabase secrets only |

---

## Rollback

```bash
AI_PLATFORM_V2_ENABLED=false
```

Static validation confirms legacy path in `aiProvider.ts` — **no client changes**.

---

## Architecture review summary

| Finding | Action |
|---------|--------|
| Legacy + router dual path in `aiProvider.ts` | Keep until Phase 1 stable; remove later |
| `marketAiProvider.ts` separate from router | Phase 2 |
| In-memory cache (per Edge instance) | Accept Phase 1; optional Redis later |
| No secrets in client | Verified by validation pipeline |

Full table: [AI_PLATFORM_V2_VALIDATION.md](./AI_PLATFORM_V2_VALIDATION.md#architecture-review-static)

---

## Related docs

| Doc | Topic |
|-----|-------|
| [AI_PLATFORM_V2_VALIDATION.md](./AI_PLATFORM_V2_VALIDATION.md) | Pre-deploy validation |
| [AI_ROUTER.md](./AI_ROUTER.md) | Router API |
| [PROMPT_VERSIONING.md](./PROMPT_VERSIONING.md) | Prompt lifecycle |
| [AI_COST_MONITOR.md](./AI_COST_MONITOR.md) | Cost metrics |
| [AI_AB_TESTING.md](./AI_AB_TESTING.md) | Experiments |
| [AI_BENCHMARK_ENGINE.md](./AI_BENCHMARK_ENGINE.md) | Weekly benchmarks |
| [AI_HEALTH_DASHBOARD.md](./AI_HEALTH_DASHBOARD.md) | Ops dashboard |
| [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) | Phase gates |
| [AI_ARCHITECTURE_AUDIT_2026.md](./AI_ARCHITECTURE_AUDIT_2026.md) | Pre-V2 audit |

---

## Deploy Phase 1 (CEO approval only)

```bash
# NOT RUN until approved:
# supabase functions deploy ai-coach
```

Rollback: `AI_PLATFORM_V2_ENABLED=false` + redeploy.
