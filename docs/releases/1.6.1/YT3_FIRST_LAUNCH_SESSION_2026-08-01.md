# YouTrader 3.0 — First-launch + Stats Radar/Heatmap session report

**Build:** 113 (unchanged). **Phase 4F:** FAILED / OPEN / NO-GO. **Do not prepare 114.**

**Date:** 2026-08-01

## Commits landed

| Commit | Scope |
|--------|--------|
| `90ba5fa` YT3-FL-1 | Onboarding profile schema + guest-aware acquisition phases |
| `fc9df99` YT3-FL-2 | First-launch funnel Screens 1–4, 3-plan paywall, guest CTA |
| `845df8d` YT3-FL-3 | Performance Radar + Trading Heatmap on Stats |
| `f1c1080` YT3-FL-3b | Shared Stats presentation helpers |
| `b71296a` YT3-FL-4 | User-facing AI terminology scrub + forbidden-copy guard |

## 1. First-launch state-machine design

Phases: `loading → onboarding → paywall → auth → main`

- No session + onboarding incomplete → **onboarding** (new funnel)
- Paywall incomplete and not premium → **paywall** (wait RC ready)
- Premium purchase **does not** skip account choice → **auth**
- `guestContinued` → **main**
- Authenticated users skip marketing onboarding; entitled authenticated → **main**
- Entitled users are not incorrectly paywalled when `isPremium`

Local keys: `yt-acquisition-onboarding-v1`, `yt-acquisition-paywall-device-v1`, `yt-acquisition-guest-v1`, `yt-onboarding-profile-v1`

Selftests: `acquisitionPhase.selftest`, `acquisition-state-qa`, `entitlement-startup-routing-qa` → **PASS**

## 2–5. Screenshots Screens 1–4

**Status: PENDING device rebuild.** Installed simulator binary still showed legacy “Log. Review. Improve.” marketing screen (embedded Release-Staging). Debug-Staging rebuild started to load Metro with new funnel JS. Evidence folder: `docs/releases/1.6.1/first-launch-evidence/` (baseline `00_after_reset.png` = legacy until rebuild installs).

## 6–8. StoreKit / RevenueCat product status

| Plan | Product ID | StoreKit local | RevenueCat offering |
|------|------------|----------------|---------------------|
| Weekly $4.99 | `youtrader_pro_weekly` | **Added** in `YouTraderStaging.storekit` | **NOT configured** (RC MCP unavailable this session) |
| Monthly $12.99 | `youtrader_pro_monthly` | Present | Existing (verify in RC dashboard) |
| Yearly $99.99 | `youtrader_pro_yearly__` | Present + intro `P1W` free | Existing; trial CTA only when `introPrice` resolves |

Paywall never shows purchase CTA together with unavailable offerings — Retry + Continue with Free Journal + Restore.

## 9. Purchase-before-auth

Resolver: anonymous `isPremium` → **auth** (account/guest). Unit: **PASS**. Device purchase E2E: **PENDING** (rebuild + StoreKit).

## 10. Continue without account

`continueAsGuest` sets guest + paywall + onboarding flags → **main**. Auth CTA `auth.continue-guest`. Unit: **PASS**. Device: **PENDING**.

## 11–12. Anonymous→account linking / CustomerInfo

**PENDING** — requires RC identity merge device matrix. Parallel Phase 4F blocker remains OPEN.

## 13–16. Performance Radar / Heatmap

- Radar model: `src/stats/performanceRadar.ts` — docs in `PERFORMANCE_RADAR_SCORE_SOURCES.md`
- Heatmap: Day×Hour / Weekday / Session / Instrument / Setup
- Stats order: Period → Hero → Equity → Core Metrics → Radar → Heatmap → …
- Screenshots: **PENDING** rebuild

## 17–19. Device matrix

| Device | Result |
|--------|--------|
| iPhone 16 | Booted; legacy screenshot only; Debug-Staging build in progress |
| iPhone 16e | Not yet |
| Pro Max | Not yet |
| Physical iPhone 14 Pro Max | Not claimed; prior device had build **114** — do not use for 113 PASS |

## 20. Remaining Phase 4F blockers (OPEN)

- Google `redirect_uri_mismatch` / Supabase session
- Apple native device E2E
- RevenueCat CustomerInfo + identity isolation
- PI timeout/Retry
- News offline/Retry
- Settings user isolation
- Complete physical Phase 4F

## QA gates executed this session

- `npm run typecheck` → PASS
- `npm run translations:check` → PASS
- forbidden AI / unlock copy selftests → PASS
- acquisition / entitlement routing selftests → PASS
- Aikido MCP → **unavailable** (server not in catalog)
- `expo export --platform ios` → run after rebuild evidence
- Simulator new-funnel PRODUCT UX → **NOT PASS yet**
- Physical 113 → **NOT PASS**

## Production safety

- Build number remains **113**
- Production Supabase not touched
- No build 114 prepared
EOF
