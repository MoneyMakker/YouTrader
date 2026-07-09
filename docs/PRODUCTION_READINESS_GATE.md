# Production Readiness Gate — AI Platform V2 Phase 1

**Generated:** 2026-07-09T00:13:29.230Z  
**Phase:** Pre Preview Deploy  
**Deploy status:** NOT DEPLOYED  
**Pipeline:** `npm run ai-platform:readiness`

---

## Executive summary

| Metric | Value |
|--------|-------|
| Sections | 7 |
| Total checks | 67 |
| FAIL | 0 |
| WARNING | 11 |
| PASS | 56 |

---

## 1. Architecture

**Section status:** PASS

| Check | Status | Detail |
|-------|--------|--------|
| AI Router entry (routeAIRequest) | PASS |  |
| Router integrated in aiProvider | PASS |  |
| Legacy path preserved | PASS |  |
| Local fallback preserved | PASS |  |
| Feature flag isRouterEnabled() | PASS |  |
| Rollback flag=false semantics | PASS | AI_PLATFORM_V2_ENABLED=false disables router |
| Provider config uses secretEnv refs | PASS | 5 providers |
| No hardcoded API keys in config JSON | PASS |  |
| Endpoint profiles for coach actions | PASS |  |

---

## 2. AI

**Section status:** WARNING

| Check | Status | Detail |
|-------|--------|--------|
| Phase 1 validation pipeline (0 FAIL) | PASS | npm run ai-platform:validate |
| Model selection profiles | PASS |  |
| Fallback chains (≥3 models deep) | PASS | claude-sonnet → gpt-4o → gemini-flash → deepseek-chat → nvidia-llama |
| Cache enabled + TTL | PASS | 3600s |
| Prompt registry coach_v1 | PASS |  |
| Cost logging (estimatedCostUsd) | PASS |  |
| Observability structured logs | PASS |  |
| Router metadata → ai_usage_events | PASS |  |
| Live parity vs legacy | WARNING | Requires Preview Deploy + --live |

---

## 3. Production Safety

**Section status:** WARNING

| Check | Status | Detail |
|-------|--------|--------|
| AI secrets documented (.env.example) | PASS | Edge secrets set in Supabase dashboard at deploy |
| No EXPO_PUBLIC AI provider keys | PASS |  |
| LANGFUSE keys documented | WARNING | Optional — add LANGFUSE_* to .env.example for ops clarity |
| JWT required on ai-coach | PASS |  |
| Pro entitlement server check | PASS |  |
| ai_usage_events RLS enabled | PASS |  |
| Storage user-scoped policies | PASS |  |
| AI quota / rate limits | PASS |  |
| Rate limit buckets for coach actions | PASS |  |
| V2 migration NOT applied (Phase 1 safe) | PASS | SQL ready; apply only in Phase 3+ |
| security:check | PASS |  |

---

## 4. Release

**Section status:** PASS

| Check | Status | Detail |
|-------|--------|--------|
| App version (expo.version) | PASS | 1.5.9 |
| iOS build number | PASS | 97 |
| Runtime version policy | PASS | appVersion |
| package.json version matches app.json | PASS | app 1.5.9 / pkg 1.5.9 |
| Bundle identifier unchanged | PASS | com.youtrader.pro |
| EAS preview profile | PASS | channel: preview |
| EAS production profile | PASS |  |
| EAS projectId matches app.json | PASS |  |
| Sentry plugin in app.json | PASS |  |
| app.config.js wraps app.json | PASS |  |
| npm run typecheck | PASS |  |

---

## 5. Monitoring

**Section status:** WARNING

| Check | Status | Detail |
|-------|--------|--------|
| Langfuse server module | PASS |  |
| Router → Langfuse bridge | PASS |  |
| PostHog client integration | PASS |  |
| Sentry client integration | PASS |  |
| Cost metadata in usage events | PASS |  |
| AI Cost Monitor dashboard (Phase 3) | WARNING | Designed in AI_COST_MONITOR.md — DB table not applied yet |
| Health dashboard UI (Phase 3+) | WARNING | Spec in AI_HEALTH_DASHBOARD.md — not deployed |

---

## 6. Documentation

**Section status:** PASS

| Check | Status | Detail |
|-------|--------|--------|
| AI_PLATFORM_V2.md synced | PASS | ok |
| AI_PLATFORM_V2_VALIDATION.md synced | PASS | ok |
| AI_ROUTER.md synced | PASS | ok |
| AI_COST_MONITOR.md synced | PASS | ok |
| PROMPT_VERSIONING.md synced | PASS | ok |
| AI_AB_TESTING.md synced | PASS | ok |
| AI_BENCHMARK_ENGINE.md synced | PASS | ok |
| AI_HEALTH_DASHBOARD.md synced | PASS | ok |
| MIGRATION_PLAN.md synced | PASS | ok |
| Golden suite doc reference (100 prompts) | PASS | 100 prompts |

---

## 7. Deployment Checklist

**Section status:** WARNING

| Check | Status | Detail |
|-------|--------|--------|
| Phase 1 Validation approved by CEO | PASS | Approved 2026-07-08 |
| Production Readiness Gate (this report) | PASS | Run with --write-doc |
| Preview Deploy — ai-coach Edge Function | WARNING | Awaiting CEO go — NOT RUN |
| Supabase secrets verified in dashboard | WARNING | Manual — cannot verify from repo |
| AI_PLATFORM_V2_ENABLED staging value set | WARNING | Recommend true on staging; false rollback tested |
| Live validation (--live) on staging | WARNING | After Preview Deploy |
| TestFlight build (preview profile) | WARNING | After Preview Deploy |
| Real iPhone manual QA | WARNING | Checklist in AI_PLATFORM_V2_VALIDATION.md |
| Production deploy | WARNING | Separate CEO gate |
| Client app release (no change required Phase 1) | PASS | Same ai-coach invoke API |

---

## Deployment checklist (summary)

| Step | Owner | Status |
|------|-------|--------|
| Validation approved | CEO | ✅ |
| Readiness gate green | Engineering | ✅ |
| Preview Deploy (ai-coach) | CEO + Engineering | ☐ |
| Staging live validation | Engineering | ☐ |
| TestFlight | QA | ☐ |
| iPhone QA | QA | ☐ |
| Production | CEO | ☐ |

---

## Final gate status

```
READY FOR PREVIEW
```

Phase 1 may proceed to **Preview Deploy** when CEO explicitly approves. No production changes have been made. Warnings are expected for manual steps (staging secrets, live parity, TestFlight) and Phase 3+ monitoring surfaces.

---

## Re-run

```bash
npm run ai-platform:readiness
npm run ai-platform:readiness:report
```

Raw JSON: `scripts/ai-platform-v2/reports/readiness-latest.json`
