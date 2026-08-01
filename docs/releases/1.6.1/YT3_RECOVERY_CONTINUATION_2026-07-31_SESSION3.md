# YT3 Recovery Continuation — 2026-07-31 Session 3

Build: **113** (unchanged). Phase 4F: **FAILED / OPEN / NO-GO**.

## 1. Acquisition hydration fix commit

- Commit: `e0d0e4c` — `fix(qa): keep acquisition hydrated after staging auth reset`
- Helper: `stagingQaResetAcquisitionUi()` keeps `acquisitionHydrated: true`
- Regression: `scripts/acquisition-state-qa.ts` reproduces infinite “Loading your journal…” when hydrated=false after null session
- Staging-safe: only applied after gated QA reset; production cannot invoke reset
- Typecheck: PASS (after unrelated `.ts` import extension fix in untracked snap script)

## 2. Metro watch restart

| Field | Value |
| --- | --- |
| Old PID | `15252` |
| New PID | `35602` (listen; npm parent `35581`) |
| Mode | `watch (node-fs; watchman not installed)` |
| Host | `zleojeqkzizeyerhjpur.supabase.co` |
| Bundle SHA-256 | `42863d895e26a5ec2158bd41d855283735610ca8399bf405d1256a8e6d6f9108` |
| Bundle proof | Contains `stagingQaResetAcquisitionUi` + staging URL; prod marker only as refuse constant |
| Simulator | Reconnected; bundle reload observed |
| Harness fix | `YT_METRO_WATCH=1` must `unset CI` (empty `CI=` crashed Expo getenv) — commit `96f419e` |

## 3. Email fixture preflight

- Added: `scripts/qa/preflight-email-fixture-staging.{sh,ts}`
- Wired into `scripts/qa/run-maestro-staging.sh` (skip via `YT_SKIP_EMAIL_PREFLIGHT=1`)
- Result: `email_preflight_ok` — allow `41abedc1…` Prop Pass eligible; deny `27d72b29…` not eligible; fixture seeded allow+deny; production refused

## 4. Deterministic startup modes

| Mode | Result | Evidence |
| --- | --- | --- |
| A Fresh → Onboarding → Paywall → Auth | **PASS** | `modeA_01/02/03_auth_ctas.png` |
| B Allowlisted → Main → Prop Pass | **PASS** | `modeB_01/02/03_*.png` |
| C Deny → Main, Prop Pass absent | **PASS** | `modeC_01/02/03_*.png` |

Reset path: `simctl keychain reset` + `youtrader://qa/reset-auth` + hydrated fix (no reinstall required).

## 5. Auth screen CTAs

- **PASS**: Continue with Apple / Google / Email all visible (`modeA_03_auth_ctas.png`)
- QA CONFIGURATION FAILURE banner remains visible by design (CTAs not hidden)
- Contrast: white Apple CTA on black; Google/Email bordered — acceptable for staging QA

## 6. Apple E2E

- **BLOCKED** (external)
- Local CTA visible; Management API token file absent (CLI `projects list` works via other auth; file-based Bearer GET/PATCH → 401 / no token file)
- Prior evidence: `provider_disabled` / Management API 403 on secret write
- Apple E2E not PASS (no successful Supabase session → cold relaunch → logout → second login)

## 7. Google E2E

- **BLOCKED / NOT RUN to completion** in this session after Auth CTA capture
- Config present in Metro env (Web + iOS client IDs); unattended OAuth challenge not completed
- CTA visible; full session matrix not proven

## 8–10. Monthly / Yearly / RevenueCat

| Layer | Status |
| --- | --- |
| Paywall UI (MONTHLY/YEARLY + CTA) | **PASS** (prior + Mode A paywall) |
| Local StoreKit functional | **PARTIAL** — `ios/YouTraderStaging.storekit` IDs `youtrader_pro_monthly` / `youtrader_pro_yearly__`; prices aligned to $12.99/$99.99 (`96f419e`); scheme has StoreKit file, but Metro/`simctl` launch does not inject Xcode StoreKit Testing session → Apple Account sheet still blocks purchase without debugger |
| RevenueCat entitlement integration | **NOT PASS** |
| Real App Store Sandbox (device) | **NOT RUN** (device install/launch recovered; purchase matrix pending) |

## 11. Performance Intelligence matrix

| Case | Status |
| --- | --- |
| Request → queue → poll transport | **PIPELINE PASS** (prior) |
| Snapshot persist (staging fixture) | **PASS** — engine snapshot present after `persist-prop-pass-snapshot-staging.ts` |
| Semantic valid-data success UI | **PARTIAL / NOT PROVEN** this session (Request CTA not hit after scroll; PI panel not fully exercised) |
| insufficient_data | Proven previously |
| pending / fail / timeout / races / cross-user | **NOT RUN** |

## 12. Core interactions

| Area | Status | Notes |
| --- | --- | --- |
| Journal | **PARTIAL** | Populated fixture trades visible; create/edit/delete/relaunch **NOT RUN** |
| Stats | **SMOKE/PARTIAL** | Tab open captured (`core_i_03_stats.png`) |
| Calculator | **SMOKE/PARTIAL** | Tab open (`core_i_04_calc.png`) |
| News | **SMOKE/PARTIAL** | Tab open (`core_i_05_news.png`) |
| Calendar | **SMOKE/PARTIAL** | Tab open (`core_i_06_calendar.png`) |
| Settings | **SMOKE/PARTIAL** | Tab open (`core_i_07_settings.png`) |

Full CRUD / period / offline / logout matrices: **NOT PASS**.

## 13. Physical CoreDevice recovery

| Step | Result |
| --- | --- |
| `devicectl list` | iPhone 4S / 14 Pro Max `6FCFF771-…` **available (paired)** |
| Developer Mode | enabled |
| Install Release-Staging **113** | **PASS** |
| Launch `com.youtrader.pro` | **PASS** |
| Full physical matrix | **NOT PASS** — Phase 4F remains OPEN |

## 14. Remaining objective blockers

1. Apple provider secret / Management API auth for staging enablement (external)
2. Google unattended OAuth completion
3. StoreKit Testing injection for Metro-launched Debug-Staging (need Xcode debugger session or XCTest SKTestSession)
4. Complete PI semantic success + failure/race matrix after Request CTA
5. Full core CRUD + Settings logout/restore matrix
6. Physical-device Phase 4F matrix (purchase, auth, offline)
7. **Aikido**: MCP server unavailable in this agent session; prior invalid token; CI secret inspection Forbidden — **security-pipeline blocker**, not product runtime

## Commits this session

1. `e0d0e4c` acquisition hydrate fix + unit regression
2. `96f419e` Metro watch, email preflight, StoreKit price align, mode Maestro flows
