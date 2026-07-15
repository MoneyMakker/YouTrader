# AI Platform V2 — Validation Report

**Generated:** 2026-07-09T00:09:07.228Z
**Phase:** Pre-deployment validation (Phase 1)
**Deploy status:** NOT DEPLOYED
**Pipeline:** `npm run ai-platform:validate`

---

## Summary

| Metric | Count |
|--------|-------|
| Passed | 42 |
| Failed | 0 |
| Warnings | 3 |
| Total checks | 45 |

**Gate:** Failed checks must be **0** before Preview Deploy approval.

---

## Automated checks

| Check | Status | Detail |
|-------|--------|--------|
| AI Platform module files | PASS | 7 files present |
| Feature flag + legacy path | PASS | AI_PLATFORM_V2_ENABLED + legacy fallback |
| Rollback flag=false disables router | PASS |  |
| Flag=true enables router | PASS |  |
| Default router enabled when unset | PASS |  |
| Platform config structure | PASS | v2.0.0, 6 models |
| No API keys in config JSON | PASS |  |
| Daily Plan → fast profile | PASS | fast |
| Long context → long_context profile | PASS |  |
| Weekly Coach → deep profile | PASS | deep |
| Deep fallback chain | PASS | claude-sonnet → gpt-4o → gemini-flash → deepseek-chat → nvidia-llama |
| Fallback includes Gemini + DeepSeek path | PASS |  |
| Cache key hashing | PASS |  |
| Cache TTL configurable | PASS | 3600s |
| Prompt registry baseline | PASS | coach_v1, market_v1 |
| Prompt version for daily_plan | PASS | coach family |
| Prompt version for weekly_coach | PASS | coach family |
| Prompt version for journal_summary | PASS | coach family |
| Prompt version for risk_predictor | PASS | coach family |
| Prompt version for news_explainer | PASS | coach family |
| Prompt version for daily_challenge | PASS | coach family |
| Observability: requestId | PASS |  |
| Observability: promptVersion | PASS |  |
| Observability: estimatedCostUsd | PASS |  |
| Observability: fallbackReason | PASS |  |
| Observability: cacheHit | PASS |  |
| Observability: langfuse | PASS |  |
| Observability: structured log | PASS |  |
| Router metadata → ai_usage_events | PASS |  |
| security:check script | PASS |  |
| No provider secrets in client | PASS |  |
| No 9Router in production paths | PASS | clean |
| No EXPO_PUBLIC AI keys in .env.example | PASS |  |
| Golden test suite count | PASS | 100 prompts |
| Coach actions in golden suite | PASS | 90 coach prompts |
| Router + legacy dual path in aiProvider | PASS |  |
| Local fallback preserved | PASS |  |
| Market Intelligence still legacy (Phase 2) | PASS | expected until Phase 2 |
| npm run typecheck | PASS |  |
| promptfoo AI safety | WARN | 6 passed, 2 failed |
| PostHog integration present | PASS | client-side product analytics |
| Sentry integration present | PASS | client crash reporting |
| Langfuse server-side (Edge) | PASS |  |
| Live router vs legacy parity | WARN | Skipped — run with --live and provider keys after preview deploy approval |
| Live latency measurement | WARN | Requires preview deploy + --live |

---

## Endpoints validated (static)

| Endpoint | Profile | Golden prompts |
|----------|---------|----------------|
| daily_plan | fast | 10+ |
| weekly_coach | deep | 10+ |
| journal_summary | deep | 10+ |
| risk_predictor | deep | 10+ |
| news_explainer | fast | 10+ |
| daily_challenge | fast | 5+ |

Market Intelligence: **legacy path** until Phase 2.

---

## Rollback verification

```bash
# Supabase secret (after deploy approval only):
AI_PLATFORM_V2_ENABLED=false
```

Static validation confirms:
- `isRouterEnabled()` returns false when flag is `false`
- `callLegacyConfiguredProvider` remains in `aiProvider.ts`
- No code changes required for rollback

---

## Live validation (post Preview Deploy)

After CEO approves **Preview Deploy** only:

```bash
npm run ai-platform:validate -- --live
```

Measure per endpoint:
- Latency (p50, p95)
- Cost estimate (router metadata)
- Token usage
- Success rate / fallback frequency
- JSON schema validity vs legacy

---

## Manual iPhone checklist (TestFlight)

- [ ] Daily Plan — Pro user
- [ ] Weekly Coach — Pro user
- [ ] Journal Summary
- [ ] Risk Predictor
- [ ] News Explainer
- [ ] Free user — local preview only
- [ ] Airplane mode — local fallback
- [ ] Rollback flag — legacy providers (staging secret)

---

## Re-run validation

```bash
npm run ai-platform:validate
npm run ai-platform:validate:report
```

Raw JSON: `scripts/ai-platform-v2/reports/latest.json`

---

## Architecture review (static)

| Area | Finding | Severity | Phase |
|------|---------|----------|-------|
| Duplicated provider logic | `aiProvider.ts` legacy loop mirrors `aiPlatform/providers.ts` | Medium | Remove legacy after stable V2 |
| Market Intelligence | `marketAiProvider.ts` still direct NVIDIA/OpenAI | Expected | Phase 2 |
| Hardcoded models (legacy) | `DEFAULT_FAST_MODEL`, etc. in `aiProvider.ts` | Low | Legacy path only; router uses config |
| Hardcoded models (router) | None in router — `config.default.json` + env | OK | — |
| Tight coupling | `ai-coach` → `aiProvider` → router (acceptable facade) | Low | — |
| Security | No client keys; secrets via `secretEnv`; JWT on Edge | OK | — |
| Cache | In-memory per Edge instance (not shared) | Medium | Phase 3+ Redis optional |
| Observability | Langfuse + structured logs + usage metadata | OK | — |
| Migration risk | Feature flag rollback without redeploy of client | Low | — |
| Scalability | OpenRouter aggregation; fallback chains; rate limits exist | OK | Monitor cost at scale |

**Recommendation:** Proceed to Preview Deploy only after **0 FAIL** in this pipeline + CEO sign-off.

---

## Phase roadmap (CEO gates)

| Step | Gate | Status |
|------|------|--------|
| Phase 1 — AI Router | Code complete | ✅ |
| Validation | `npm run ai-platform:validate:report` | ✅ (0 FAIL) |
| Preview Deploy | CEO approval | ☐ |
| TestFlight | QA sign-off | ☐ |
| Real iPhone testing | Manual checklist | ☐ |
| Production | CEO approval | ☐ |
| Phase 2 — Market → router | After Phase 1 prod stable | ☐ |
| Phase 3 — Cost Monitor | After Phase 2 | ☐ |
| Phase 4 — Prompt versioning (DB) | After Phase 3 | ☐ |
| Phase 5 — A/B testing | After Phase 4 | ☐ |
| Phase 6 — Benchmark engine | Weekly dry-run → live | ☐ |

See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md), [AI_BENCHMARK_ENGINE.md](./AI_BENCHMARK_ENGINE.md), [AI_HEALTH_DASHBOARD.md](./AI_HEALTH_DASHBOARD.md).
