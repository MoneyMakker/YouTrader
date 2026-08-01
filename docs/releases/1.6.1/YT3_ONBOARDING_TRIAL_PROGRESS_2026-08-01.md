# YT3 Onboarding Visual + Trial Paywall Progress — 2026-08-01 (session 2)

Build: **113**. Phase 4F: **FAILED / OPEN / NO-GO**. No build 114. Production Supabase untouched.

## Commits

| Hash | Task |
|---|---|
| `3677439` | YT3-ONB-1 profile consistency + selftest |
| `f33ef8f` | YT3-ONB-2 Screens 1–4 visual densify / carousel |
| `26e8250` | YT3-PAY-1 StoreKit 7-day intros on W/M/Y + trial-aware paywall |
| `be7983a` | YT3-AUTH-1 mandatory auth entitlement note |

## Executed results (requested 20)

| # | Item | Result |
|---|---|---|
| 1 | Upgraded Screen 1 | **CODE PASS** · evidence `v2_01_screen1.png` (sim may still need Metro restart for latest JS) |
| 2 | Screen 2 profile consistency | **CODE PASS** (selftest PASS). **SIM CAPTURE FAIL/STALE** — `v2_02_stocks.png` still shows MES while Stocks selected because Metro PID could not be killed/restarted from agent (`kill: operation not permitted`) |
| 3 | Screen 3 non-clipped preview | **CODE PASS** (snap + dots). Capture `v2_03_preview.png` still shows old peek without dots until Metro reload |
| 4 | Screen 4 visual | **CODE PASS** · `v2_04_prep.png` captured |
| 5 | Weekly product/package | StoreKit: **PASS** (+7-day intro). RC default offering: **FAIL / PENDING dashboard** — Weekly still absent on sim paywall |
| 6 | Monthly 7-day trial | StoreKit intro: **PASS**. Runtime eligibility: **PENDING** Xcode StoreKit session |
| 7 | Yearly 7-day trial | StoreKit intro: **PASS**. Runtime eligibility: **PENDING** |
| 8 | Intro eligibility resolver | **CODE PASS** — `trialEligibility.selftest.ts` PASS |
| 9 | Weekly-selected paywall | **FAIL** — package not resolved |
| 10 | Monthly-selected paywall | **PASS** — `v2_05_monthly.png` |
| 11 | Yearly-selected paywall | **PASS** — `v2_05_yearly.png` |
| 12 | StoreKit trial start | **PENDING** (needs StoreKit Testing session + Weekly in RC) |
| 13 | CustomerInfo during trial | **PENDING** |
| 14 | Post-trial auth screen | **CODE PASS** — copy + entitlement note wired |
| 15–17 | Apple / Google / Email identity link | **PENDING** device E2E (`Purchases.logIn` already on session) |
| 18 | Trial cancel/renewal | **PENDING** |
| 19 | Physical iPhone | **PENDING** (113 only) |
| 20 | Phase 4F blockers | Weekly RC package; Metro reload unblock; Google/Apple E2E; CustomerInfo; physical 113 |

## StoreKit contract (repo)

All three products in group **YouTrader Pro**:

- `youtrader_pro_weekly` — $4.99/wk — free intro `P1W`
- `youtrader_pro_monthly` — $12.99/mo — free intro `P1W`
- `youtrader_pro_yearly__` — $99.99/yr — free intro `P1W`

Synced to `ios/YTStoreKitQA/...` copies.

## Paywall behavior (code)

- Trial CTA only when `resolveIntroTrialInfo` → `eligible`
- Sticky CTA: `Start My 7-Day Free Trial` + subcopy `7 days free, then $X/period`
- Ineligible: `Start Weekly/Monthly/Yearly · price`
- Missing Weekly shows non-blocking warning `paywall-weekly-missing` (still release-blocking until RC attaches Weekly)

## Manual unblock required

1. Kill stuck Metro on :8081 and run `bash scripts/qa/start-metro-staging.sh clear` (agent cannot `kill` that PID).
2. RevenueCat dashboard: attach Weekly to default offering + YouTrader Pro entitlement.
3. Xcode Run Debug-Staging with `YouTraderStaging.storekit` for three-plan + trial eligibility proof.

## QA

- `npm run typecheck` PASS
- `npm run translations:check` PASS
- `onboardingProfileConsistency.selftest` PASS
- `trialEligibility.selftest` PASS
- Aikido MCP unavailable
