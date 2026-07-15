# Preview Deploy Report — AI Platform V2 Phase 1

**Generated:** 2026-07-09T00:37:18.863Z
**Environment:** Preview / Staging (`izzrlsgumyabdvlmwlwn`)
**Scope:** `ai-coach` Edge Function only
**Production deploy:** NOT APPROVED · NOT EXECUTED
**Git push/merge:** NOT DONE

---

## Executive summary

| Item | Value |
|------|-------|
| Readiness gate (pre-deploy) | READY FOR PREVIEW |
| ai-coach version | 15 (was 14) |
| V2 success rate | 100% |
| Legacy success rate | 100% |
| V2 avg latency | 2862 ms |
| Static validation FAILs | 0 |

---

## 1. Pre-deploy

**Section status:** PASS

| Check | Status | Detail |
|-------|--------|--------|
| AI config backup created | PASS | scripts/ai-platform-v2/backups/2026-07-09T00-15-58-527Z |
| Feature flags verified | PASS | AI_PLATFORM_V2_ENABLED unset — router defaults to enabled (isRouterEnabled=true) |
| Rollback path verified (static) | PASS | AI_PLATFORM_V2_ENABLED=false |

---

## 2. Preview Deploy

**Section status:** PASS

| Check | Status | Detail |
|-------|--------|--------|
| ai-coach deployed (preview/staging only) | PASS | {"project_ref":"izzrlsgumyabdvlmwlwn","functions":["ai-coach"],"dashboard_url":"https://supabase.com/dashboard/project/izzrlsgumyabdvlmwlwn/functions","message":"Deployed Functions."} |
| Other functions untouched | PASS | market-intelligence, secure-upload unchanged |
| Production app NOT released | PASS | No EAS production build; no git push |

---

## 3. Live validation (V2 vs Legacy)

**Section status:** WARNING

| Check | Status | Detail |
|-------|--------|--------|
| Live comparison executed | PASS | 6 endpoints × 2 modes |
| V2 success rate | PASS | 100% |
| Legacy success rate | PASS | 100% |
| V2 avg latency | PASS | 2862ms |
| Legacy avg latency | PASS | 2724ms |
| V2 schema quality (avg) | PASS | 1 |
| Legacy schema quality (avg) | PASS | 1 |
| V2 fallback count | PASS | 0 |
| V2 cache hits (2nd pass N/A in suite) | WARNING | cache hits in run: 0 |
| V2 avg estimated cost | WARNING | metadata optional |
| Static validation pipeline | PASS | 46 pass / 0 fail |

---

## 4. Endpoint comparison

**Section status:** PASS

| Check | Status | Detail |
|-------|--------|--------|
| daily_plan | PASS | V2 3089ms openrouter / Legacy 3098ms openrouter |
| weekly_coach | PASS | V2 2899ms openrouter / Legacy 2507ms openrouter |
| journal_summary | PASS | V2 4102ms openrouter / Legacy 1120ms openrouter |
| risk_predictor | PASS | V2 2506ms openrouter / Legacy 3421ms openrouter |
| news_explainer | PASS | V2 1978ms openrouter / Legacy 3707ms openrouter |
| daily_challenge | PASS | V2 2597ms openrouter / Legacy 2489ms openrouter |

---

## 5. Production Safety

**Section status:** PASS

| Check | Status | Detail |
|-------|--------|--------|
| JWT enforced (401 without token) | PASS | HTTP 401 without Authorization |
| V2 secret restored after legacy test | PASS | AI_PLATFORM_V2_ENABLED=true |
| service_role SELECT on user_subscriptions | PASS | Migration 20260709203000 (see DB_PERMISSION_REVIEW.md) |
| Ephemeral test user cleaned up | PASS | preview validation user deleted |

---

## 6. Monitoring

**Section status:** WARNING

| Check | Status | Detail |
|-------|--------|--------|
| Usage metadata persisted | WARNING | ai_usage_events.metadata |
| Langfuse / PostHog / Sentry | WARNING | Verify in dashboards during TestFlight |

---

## 7. Documentation

**Section status:** PASS

| Check | Status | Detail |
|-------|--------|--------|
| AI Platform V2 docs present | PASS | see docs/AI_PLATFORM_V2*.md |

---

## Final gate status

```
READY FOR PREVIEW
```

Preview Deploy **passed**. Proceed to TestFlight iPhone QA. **Do not deploy Production** until CEO approves.

## TestFlight AI Checklist (iPhone)

Complete on **preview/staging** build (`eas build --profile preview`). Do **not** ship production until CEO approves.

### Setup
- [ ] Install TestFlight build from preview channel
- [ ] Sign in with Pro test account (or account with active Pro entitlement)
- [ ] Confirm `EXPO_PUBLIC_SUPABASE_URL` points to preview/staging project (`izzrlsgumyabdvlmwlwn`)
- [ ] Confirm airplane mode off for cloud AI tests

### AI Coach — Pro user
- [ ] **Daily Plan** — returns JSON card; provider badge not `free_preview`
- [ ] **Weekly Coach** — full coaching card; strengths + leaks populated
- [ ] **Journal Summary** — month/week summary renders
- [ ] **Risk Predictor** — risk level + notes present
- [ ] **News Explainer** — headline explanation (no buy/sell signal language)
- [ ] **Daily Challenge** — challenge card loads

### Free user
- [ ] Same screens show **local preview** only (`free_preview` / local fallback)
- [ ] No cloud provider charges triggered from free tier

### Reliability
- [ ] Repeat Daily Plan twice — second call same session (cache may reduce latency)
- [ ] Toggle airplane mode mid-request — graceful local fallback message
- [ ] Quota banner when daily limit approached (if test account near limit)

### Rollback drill (staging secret only)
- [ ] Set `AI_PLATFORM_V2_ENABLED=false` in Supabase secrets
- [ ] Wait ~30s; invoke Weekly Coach — still returns valid JSON (legacy path)
- [ ] Restore `AI_PLATFORM_V2_ENABLED=true`

### Observability (engineering)
- [ ] Langfuse trace visible for ai-coach request (if keys configured)
- [ ] PostHog `ai_coach` / coach events fire
- [ ] Sentry: no new crash on AI screens during session
- [ ] `ai_usage_events` row created with `estimatedCostUsd` metadata (Supabase SQL)

### Sign-off
- [ ] QA: all Pro flows pass
- [ ] Engineering: live comparison report reviewed
- [ ] CEO: approve **Production** deploy (separate gate)


---

Artifacts:
- `scripts/ai-platform-v2/reports/live-comparison.json`
- `scripts/ai-platform-v2/reports/preview-deploy.json`
- Backup: `scripts/ai-platform-v2/backups/2026-07-09T00-15-58-527Z`
