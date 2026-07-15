# AI Platform V2 — Migration Plan

Incremental, reversible migration. **Each step requires CEO approval before deploy.**

**Current status:** Phase 1 preview deployed (`ai-coach` v15) · DB permission migration applied on preview · **TestFlight NOT started**

**DB (preview):** [DB_PERMISSION_REVIEW.md](./DB_PERMISSION_REVIEW.md) — `20260709203000_grant_service_role_user_subscriptions_select.sql`

---

## Phase 1 — AI Router (AI Coach)

**Status:** Code complete, not deployed

### Changes

- Module `supabase/functions/_shared/aiPlatform/`
- `aiProvider.ts` delegates to router when `AI_PLATFORM_V2_ENABLED` ≠ `false`
- Legacy provider loop preserved
- Router metadata → `ai_usage_events.metadata`

### Validation gate (mandatory)

```bash
npm run ai-platform:validate:report   # 0 FAIL required
npm run ai-platform:readiness:report  # Production Readiness Gate
```

Report: [AI_PLATFORM_V2_VALIDATION.md](./AI_PLATFORM_V2_VALIDATION.md)

### Deploy sequence (CEO approval each step)

| Step | Action | Status |
|------|--------|--------|
| 1 | Validation pipeline green | ☐ |
| 2 | Preview Deploy (staging secrets) | ☐ |
| 3 | Live validation `--live` | ☐ |
| 4 | TestFlight build | ☐ |
| 5 | Real iPhone testing | ☐ |
| 6 | Production deploy | ☐ |

### Preview / production deploy (after approval only)

```bash
supabase functions deploy ai-coach
# Optional: supabase secrets set AI_PLATFORM_V2_ENABLED=true
```

### Rollback

```bash
supabase secrets set AI_PLATFORM_V2_ENABLED=false
supabase functions deploy ai-coach
```

No client update required.

### Risk

**Low** — same client API, same secrets, local fallback unchanged.

---

## Phase 2 — Market Intelligence → unified router

**Status:** Not started

### Changes

- Refactor `marketAiProvider.ts` → `routeAIRequest()`
- Map market actions via `endpointProfiles` in config
- Remove direct NVIDIA/OpenAI calls from market path

### Validation

- All 8+ market actions return valid JSON
- Rate limits unchanged
- Parity vs legacy responses (golden suite market category)
- `npm run ai-platform:validate:report`

### Risk

**Medium** — different schemas; test every market action.

---

## Phase 3 — AI Cost Monitor

**Status:** Design complete — see [AI_COST_MONITOR.md](./AI_COST_MONITOR.md)

### Changes

- Apply migration: `ai_platform_requests` table
- Router inserts row on each call
- SQL views: daily/weekly/monthly cost, per-user, per-model
- Historical charts for dashboard

### Metrics

requests/day, requests/user, cost/request, cost/user, tokens, cached tokens, provider, model, latency, retries, fallback, monthly/yearly projection

### Rollback

Stop inserts; Phase 1 metadata still available in `ai_usage_events`.

### Risk

**Low** — append-only logging.

---

## Phase 4 — Prompt Versioning (DB)

**Status:** Registry in code + migration SQL ready, not applied

See [PROMPT_VERSIONING.md](./PROMPT_VERSIONING.md)

### Changes

- Apply `20260708180000_ai_platform_v2_foundation.sql` (prompt tables)
- Versions: `coach_v1`, `coach_v2`, `coach_v3`, …
- Fields: version, date, author, description
- Never overwrite old prompts
- Rollback via env or `active` flag

### Risk

**Low** if registry.ts fallback remains.

---

## Phase 5 — A/B Testing Framework

**Status:** Schema designed — not enabled

See [AI_AB_TESTING.md](./AI_AB_TESTING.md)

### Changes

- Experiment assignment in router (sticky per user)
- Example: 50% Claude / 50% Gemini
- Collect: quality, latency, retention, conversion, completion rate
- **Recommendations only** — never auto-switch production

### Risk

**Medium** — product impact; one endpoint at a time.

---

## Phase 6 — AI Benchmark Engine

**Status:** Dry-run script ready

See [AI_BENCHMARK_ENGINE.md](./AI_BENCHMARK_ENGINE.md)

### Changes

- Weekly automated benchmark (Golden Test Suite = 100 prompts)
- Rankings: quality, latency, price, overall, cost/quality
- Recommendations only — never modify production automatically

### Commands

```bash
npm run ai-platform:benchmark              # dry-run
node scripts/ai-platform-v2/run-benchmark.mjs --live   # staging only
```

### Risk

**Low** — read-only evaluation.

---

## AI Health Dashboard

Cross-cutting — see [AI_HEALTH_DASHBOARD.md](./AI_HEALTH_DASHBOARD.md)

Implemented incrementally as Phases 3–6 add data sources.

---

## What we are NOT changing (without explicit approval)

- iOS client secrets / `EXPO_PUBLIC_*`
- RevenueCat, auth, subscriptions
- RAG embedding path (OpenAI direct)
- `analyzeTrades()` local deterministic analytics
- Production Supabase until CEO approves each gate

---

## Approval log

| Phase / Step | Approved | Deployed | Notes |
|--------------|----------|----------|-------|
| 1 — Router code | ☐ | ☐ | |
| 1 — Validation | ☐ | — | |
| 1 — Preview | ☐ | ☐ | |
| 1 — TestFlight | ☐ | ☐ | |
| 1 — Production | ☐ | ☐ | |
| 2 — Market router | ☐ | ☐ | |
| 3 — Cost monitor | ☐ | ☐ | |
| 4 — Prompt DB | ☐ | ☐ | |
| 5 — A/B testing | ☐ | ☐ | |
| 6 — Benchmark live | ☐ | ☐ | |

---

## Timeline (suggested)

| Week | Milestone |
|------|-----------|
| 1 | Validation green + Preview Deploy |
| 2 | TestFlight + iPhone QA + Production Phase 1 |
| 3 | Phase 2 Market Intelligence |
| 4 | Phase 3 Cost Monitor + dashboard v1 |
| 5 | Phase 4 Prompt versioning DB |
| 6+ | Phase 5 A/B, Phase 6 weekly benchmark |

Adjust based on cost data and stability.
