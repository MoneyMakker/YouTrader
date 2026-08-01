# YouTrader 3.0 Paywall Copy + Dynamic Subscription UX

Date: 2026-08-01  
Build: **1.6.1 (113)** — unchanged  
Phase 4F: **FAILED / OPEN / NO-GO**  
Build 114: **not prepared**  
Production Supabase: **not touched**

## Status matrix

| Gate | Status |
|------|--------|
| UI CODE | **PASS** (headline, chips, hero, plan cards, sticky CTA, legal, unavailable inline) |
| STOREKIT | **PASS** (local `YouTraderStaging.storekit` + QA copies: Weekly none / Monthly P3D / Yearly P1W) |
| REVENUECAT PACKAGE | **EXTERNAL BLOCKER** (Weekly often missing from live default offering) |
| TRIAL ELIGIBILITY | **PASS** (code path from StoreKit/RC intro only; plan-specific 3d/7d gates) |
| CUSTOMERINFO | **PARTIAL** (Settings presentation wired; live CustomerInfo matrix NOT RUN) |
| AUTH LINK | **PARTIAL** (copy + entitlement-active note; Apple/Google/Email linking NOT RUN) |
| PHYSICAL | **NOT RUN** |
| Screenshots / E2E matrix | **NOT RUN / PARTIAL** |
| Phase 4F | **FAIL / OPEN / NO-GO** |

## Implemented contract

### Plans
- Weekly `youtrader_pro_weekly` — $4.99/week, **no trial**, CTA `Start for $4.99/week`
- Monthly `youtrader_pro_monthly` — $12.99/month, **3 days free only if introDays===3 & eligible**
- Yearly `youtrader_pro_yearly__` — $99.99/year, **7 days free only if introDays===7 & eligible**
- Yearly SAVE% from **52× weekly** localized prices (USD ≈ **61%**); per-week ≈ **$1.92**

### UX
- Headline: Build a Trading System You Can Actually Trust
- Chips: Futures Journal · Prop Pass · Performance Radar · Trading Heatmap · Risk Protection
- Compact product hero (journal MES +$420, equity, radar, heatmap, Daily Risk Protected)
- CTA updates with selection; purchase uses selected package only; disabled if package missing
- Haptic on plan change; purchase debounce lock
- Offerings unavailable keeps layout + inline error (Try Again / Restore)
- Auth after entitlement: Save Your Trading Progress + active-subscription note
- Settings subscription card uses CustomerInfo presentation (Weekly / Monthly trial / Yearly trial / canceled)

### Regression selftests (local PASS)
- `scripts/qa/paywallPlanCopy.selftest.ts`
- `scripts/qa/trialEligibility.selftest.ts`
- `scripts/qa/settingsSubscriptionPresentation.selftest.ts`
- `scripts/qa/forbiddenFreeAccessCopy.selftest.ts`
- `npm run typecheck` PASS
- `npm run translations:check` PASS

## Still blocking release

1. **RevenueCat / ASC**: Weekly package on default offering + intro offers matching StoreKit (Monthly 3d, Yearly 7d) — EXTERNAL
2. Full screenshot matrix (Weekly/Monthly/Yearly × eligible/ineligible, unavailable, auth, Settings states) on iPhone 16 / 16e / Pro Max / physical 14 Pro Max
3. E2E purchase → CustomerInfo → mandatory auth → Main App for all three plans
4. Identity linking Apple / Google / Email
5. Physical device PASS for Phase 4F

## Constraint reminder
Do not call paywall “complete” from static screenshots alone. Build remains 113.
