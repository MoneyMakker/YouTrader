# Prop Pass Product Redesign — Session Report

Date: 2026-08-01  
Build: **113** (`1.6.1`)  
Phase 4F: **FAILED / OPEN / NO-GO**  
Build 114: **forbidden**  
Production Supabase: **not touched**

## Executed

### 1. Five-tab information architecture
Documented in `docs/releases/1.6.1/PROP_PASS_REDESIGN_IA.md`.

Primary tabs: **Journal · Prop Pass · Stats · Calendar · More**  
Prop Pass allowlist-gated; when hidden → four tabs without gap.  
More hosts Calculator / News / Settings. Secondary destinations keep **More** selected in the tab bar.

### 2–3. User-facing AI-copy audit + terminology
- Locale values scrubbed across `en/ru/uk/de/es/fr/it`
- Hard-coded fallback copy updated in `YouTraderApp`, `aiInsightEngine`
- Guard: `scripts/qa/forbiddenAiCopy.selftest.ts` (**PASS**)
- Naming: Trading Review / Prop Insights / Prop Challenge Tracking / Trade Summary / Performance Report

### 4. Prop Pass component map
Implemented under `src/propPass/ui/` + redesigned `BufferHealthSection` + `AvailableView` IA order:

AccountSwitcher → ChallengeHero → TargetProgress → BufferHealth → TodaysPlan → PropInsights → RecentActivity → AccountMenu (secondary Archive)

### 5–10. Hero / money / progress / buffers / plan / insights
- `formatMoney.ts` + `presentation.ts` (status / readiness / buffer display)
- Selftest: `scripts/qa/propPassPresentation.selftest.ts` (**PASS**)
- Diagnostics removed from production Available view
- Archive moved into account menu with confirmation + busy guard

### 11. Diagnostics removal
Internal diagnostics card no longer rendered on Prop Pass home (developer UUID panel removed from AvailableView).

### 12–14. Screenshots / physical device
**NOT RUN in this pass** — simulator visual matrix and physical Phase 4F evidence remain open. Do not mark PRODUCT UX PASS.

### QA locally executed
- `npm run typecheck` — PASS
- `npm run translations:check` — PASS
- forbidden AI copy + presentation selftests — PASS
- `expo export --platform ios` — **NOT RUN** this pass (time); required before claiming export green
- Aikido MCP — **unavailable** in this environment

## Remaining Phase 4F blockers (unchanged OPEN)

1. Google OAuth redirect / `redirect_uri_mismatch` (PATH A)
2. Google Supabase session proof
3. RevenueCat CustomerInfo / yearly / restore / isolation
4. PI timeout/Retry on staging
5. News offline/Retry Maestro matrix
6. Settings user switching
7. Apple native physical E2E
8. Final physical Phase 4F matrix + Prop Pass screenshot states on device

## Security / contracts preserved (intent)

Client formats/presents only. No snapshot recalculation, no RLS/processor changes, no production Supabase writes.
