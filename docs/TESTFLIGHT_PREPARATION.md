# TestFlight Preparation — YouTrader 1.5.9 (97)

**Generated:** 2026-07-09T00:57:19.706Z
**Pipeline:** Release Command Center · `testflight`
**Final status:** `BLOCKED`
**Production / App Store:** NOT APPROVED · NOT SUBMITTED
**Git push / merge:** NOT PERFORMED

---

## Executive summary

| Gate | Status |
|------|--------|
| Step 1 — Git Validation | **WARNING** |
| Step 2 — Production Readiness Gate | **PASS** |
| Step 3 — AI Platform Validation | **WARNING** |
| Step 4 — Preview Deploy Report | **PASS** |
| Step 5 — SQL Permission Audit | **WARNING** |
| Step 6 — Release Notes | **PASS** |
| Step 7 — TestFlight Checklist | **PASS** |
| Step 8 — Version Validation | **PASS** |
| Step 9 — Preview Build | **FAIL** |

---

## Git Status

| Check | Status | Detail |
|-------|--------|--------|
| Current branch | PASS | main |
| Clean working tree | PASS | clean |
| No merge conflict markers | PASS |  |
| Agent worktrees reviewed | WARNING | 3 worktree(s): agent-1-fix-bugs-20260708-191608, agent-2-improve-ui-20260708-191608, agent-3-aso-downloads-20260708-191608 |
| Pending migrations (local vs linked DB) | WARNING | 202606280001_market_intelligence.sql, 202606280002_security_hardening.sql, 202606280003_secure_uploads.sql, 202606300001_harden_security_function_search_paths.sql |

---

## Architecture & Production Readiness

**Section:** PASS

- PASS Production Readiness Gate executed
- PASS FAIL count — 0 FAIL
- PASS WARNING count — 12 WARNING
- PASS PASS count — 55 PASS

---

## AI Platform Validation

**Section:** WARNING

- PASS Static validation (npm run ai-platform:validate) — 42 pass / 0 fail
- PASS Live validation (--live) — 46 pass / 0 fail
- PASS Live router vs legacy parity — V2 100% / Legacy 100%
- PASS Live latency measurement — V2 avg 2697ms · Legacy avg 2749ms
- WARNING Live cost metadata — avg $n/a
- PASS Live fallback behavior — V2 fallbacks: 0
- WARNING Live cache hit rate — cache hits in run: 0 (repeat invoke for full cache test)
- PASS Response schema quality — V2 1 / Legacy 1

---

## Preview Deploy & AI Status

| Check | Status | Detail |
|-------|--------|--------|
| Preview ai-coach deployed | PASS | {"project_ref":"izzrlsgumyabdvlmwlwn","functions":["ai-coach"],"dashboard_url":"https://supabase.com/dashboard/project/izzrlsgumyabdvlmwlwn/functions","message":"Deployed Functions."} |
| Rollback path (AI_PLATFORM_V2_ENABLED=false) | PASS |  |
| Feature flag wiring | PASS |  |
| Legacy compatibility preserved | PASS |  |
| AI Router module | PASS |  |
| Fallback chains configured | PASS |  |
| Cache module | PASS |  |
| Prompt versioning registry | PASS |  |
| Observability module | PASS |  |
| Cost logging fields | PASS |  |
| PREVIEW_DEPLOY_REPORT.md | PASS |  |
| V2 live success rate | PASS | 100% |

---

## Database Permission Audit

| Check | Status | Detail |
|-------|--------|--------|
| user_subscriptions · service_role · SELECT | PASS | Pro entitlement check in ai-coach / market-intelligence |
| user_subscriptions · authenticated · SELECT | PASS | Client reads own subscription via RLS |
| ai_usage_events · service_role · SELECT | WARNING | Rate limits + usage metadata from Edge (recommended) |
| ai_usage_events · service_role · INSERT | WARNING | Rate limits + usage metadata from Edge (recommended) |
| ai_usage_events · authenticated · SELECT | PASS | Client usage events via RLS |
| ai_usage_events · authenticated · INSERT | PASS | Client usage events via RLS |
| user_subscriptions + ai_usage_events · all · RLS enabled | PASS | RLS must stay enabled |
| user_subscriptions · anon · SELECT absent | PASS | Least privilege for anonymous clients |

---

## Release Notes

### Summary

- YouTrader 1.5.9 — TestFlight / Preview candidate
- AI Platform V2 Phase 1 (ai-coach router) on preview staging
- Server-side Pro entitlement fix (user_subscriptions GRANT)

### Changelog (recent commits)

- e0d619d Add AI orchestration workflow documentation
- 2f8de08 Add AI Platform V2 Phase 1 foundation
- fdf778f Add Release Command Center workflow
- c57a378 release: YouTrader 1.5.9 build 97
- a568c0c release: YouTrader 1.5.9 build 95
- 084eb42 release: YouTrader 1.5.9 build 94
- d05656d release: YouTrader 1.5.9 build 93
- 93f4dfc release: YouTrader 1.5.9 build 92
- f25a06e Checkpoint YouTrader 1.5.9 (91) enterprise production audit complete.
- d67d333 Checkpoint latest YouTrader 1.5.8 build 90 state
- 0d2c1cc Fix TestFlight startup crash caused by expo-localization
- 6899893 Fix share limits and clean achievement card layout
- 5f28c37 Use static premium trader card templates for share images
- 8758bf9 Redesign trader share cards and achievement images
- e6e8604 Fix Prop Firm Assistant integration for safe startup and Supabase access.

### Known Issues

- ai_usage_events: service_role SELECT/INSERT may be missing (quota metadata WARNING)
- AI cost metadata in live validation may show n/a until ai_usage_events grants applied
- Market Intelligence still on legacy AI path (Phase 2)

### Migration Summary

- `20260703121500_prop_firm_risk_assistant.sql`
- `20260703140000_fix_prop_firms_rls.sql`
- `20260703160000_user_app_state.sql`
- `20260708180000_ai_platform_v2_foundation.sql`
- `20260709203000_grant_service_role_user_subscriptions_select.sql`

---

## Manual iPhone QA Checklist

### AI Coach

- [ ] Daily Plan (Pro)
- [ ] Weekly Coach (Pro)
- [ ] Journal Summary
- [ ] Risk Predictor
- [ ] News Explainer
- [ ] Daily Challenge
- [ ] Free user → local preview only

### Market Intelligence

- [ ] Pre-market brief
- [ ] Sentiment card
- [ ] Watchlist risk
- [ ] Pro gating
- [ ] Cached rows for free tier

### Achievements & Share

- [ ] Achievement unlock
- [ ] Share card export
- [ ] Monthly share limit (free)
- [ ] Watermarked vs Pro share

### PDF & Export

- [ ] Monthly PDF preview (free)
- [ ] Pro PDF export
- [ ] Export rate limits

### Cloud Sync & Media

- [ ] Cloud sync sign-in
- [ ] Voice notes record/playback
- [ ] Photo/screenshot attach
- [ ] Secure upload

### Localization & UI

- [ ] EN / RU / DE / FR / ES / IT / UK spot check
- [ ] Dark mode readability
- [ ] Premium lock overlays

### Performance & Offline

- [ ] Cold launch < 3s feel
- [ ] AI screen scroll 60fps
- [ ] Airplane mode → local fallback
- [ ] Quota banner when near limit

### Rollback drill (staging)

- [ ] AI_PLATFORM_V2_ENABLED=false
- [ ] Weekly Coach still returns JSON
- [ ] Restore AI_PLATFORM_V2_ENABLED=true

---

## Version & Build Configuration

| Check | Status | Detail |
|-------|--------|--------|
| expo.version | PASS | 1.5.9 |
| iOS buildNumber | PASS | 97 |
| runtimeVersion policy | PASS | appVersion |
| bundleIdentifier | PASS | com.youtrader.pro |
| package.json version match | PASS | app 1.5.9 / pkg 1.5.9 |
| EAS preview profile | PASS | preview |
| EAS production profile | PASS |  |
| EAS projectId | PASS | 02ed40d6-5ad8-4a6d-9716-5ba40ec714c6 |
| RevenueCat entitlement in .env.example | PASS |  |
| Linked Supabase project | PASS | izzrlsgumyabdvlmwlwn |

---

## Build Result

| Field | Value |
|-------|-------|
| Profile | preview |
| Status | failed |
| Duration | 68s |
| URL | see EAS dashboard |

---

## Final gate status

```
BLOCKED
```

### Blocking issues

- [Step 9 — Preview Build] EAS build failed (preview)
- [Step 9 — Preview Build] EAS build completed: Resolved "preview" environment for the build. Learn more: https://docs.expo.dev/eas/environment-variables/#setting-the-environment-for-your-builds
Environment variables with visibility "Plain text" and "Sensitive" loaded from the "preview" environment on EAS: EXPO_PUBLIC_POSTHOG_API_KEY, EXPO_PUBLIC_POSTHOG_HOST.

Specified value for "ios.bundleIdentifier" in app.config.js or app.json is ignored because an ios directory was detected in the project.
EAS Build will use the value found in the nativ

---

Raw report: `scripts/release-command-center/reports/latest-run.json`
