# YouTrader 3.0 Recovery — Session 5 (executed)

**Build:** 113 (not incremented)  
**Phase 4F:** FAILED / OPEN / NO-GO  
**Production Supabase:** untouched  
**Staging:** `zleojeqkzizeyerhjpur.supabase.co`  
**Date:** 2026-07-31

---

## 1. Available StoreKit / runtime alternatives

| Runtime | Status |
|---|---|
| iOS 26.5 (23F77) | Installed; `SKTestSession` → `SKInternalErrorDomain Code=3` (XCTSkip only) |
| iOS 18.5 (22F77) | **Installed and used** — iPhone 16 Pro `22E6489D-464C-45EE-984D-1416998048C1` |
| watchOS 26.5 | Present (irrelevant) |
| Xcode | 26.6 (17F113) |

Paths attempted:

1. Inventory: `xcrun simctl list runtimes` / `devices` / `xcodebuild -version`
2. Boot existing iOS 18.5 simulator (no new runtime download required)
3. `YTStoreKitQA` scheme with `YouTraderStaging.storekit` attached (Run + Test)
4. `xcodebuild test` on destination id `22E6489D-…`
5. iOS 26.5 remains XCTSkip for SKTestSession mutations (no false PASS)

Code=3 on 26.5 is **SKTestSession-layer** (documented). Scheme StoreKit injection for YouTrader-Staging remains PASS from Session 4; 18.5 proves local buyProduct works outside the 26.3+ regression.

---

## 2. Monthly local transaction result

**FUNCTIONAL PASS** on iOS 18.5  
`StoreKitLocalTransactionTests.testMonthlyProductPurchaseWithoutAppleAccount` — product `youtrader_pro_monthly` present in `SKTestSession.allTransactions()`.

Log: `docs/releases/1.6.1/qa-artifacts/storekit-ios185-rerun.log` → `** TEST SUCCEEDED **`

---

## 3. Yearly local transaction result

**FUNCTIONAL PASS** on iOS 18.5  
`testAnnualProductPurchaseWithoutAppleAccount` — product `youtrader_pro_yearly__` present.

Also PASS: expiration/renewal reflection; failTransactions recovery path (buy after fail mode disabled).

---

## 4. RevenueCat CustomerInfo result

| Check | Status |
|---|---|
| Offering / entitlement / product mapping | PASS (Session 4) |
| Entitlement → startup routing (deterministic) | **PASS** (`scripts/entitlement-startup-routing-qa.ts`) |
| CustomerInfo after real StoreKit→RC purchase in app | **NOT RUN** (requires staging app purchase with RC SDK; YTStoreKitQA host has no RC) |
| Cancel / fail unlock prevention (app) | PARTIAL — covered by startup state machine tests; live paywall close-after-entitlement still needs RC-linked purchase |

---

## 5. Apple secret discovery result

**EXTERNAL BLOCKER — MISSING APPLE PRIVATE KEY OR REQUIRED OWNER PERMISSION**

Searched (no `.p8` material printed/copied):

- gitignored env / secrets dirs (`.codex/secrets`, staging env)
- repo history for AuthKey / `.p8` **references** only
- macOS Keychain item names (Supabase CLI; Apple Development certs — no Sign in with Apple AuthKey)
- GitHub Actions secret **names** (SUPABASE_* only)
- EAS secret / env **names** (no Apple private key)
- Fastlane / ASC API / CI configs
- sibling `youtrader-111-rc` shallow search
- staging Supabase Apple provider: enabled, `client_id=com.youtrader.pro`, **secret empty**

Permission missing: App Store Connect / Apple Developer key with Sign in with Apple capability + Team/Key IDs to mint JWT client secret. Cannot auto-generate without creating a new key under an authenticated owner account with sufficient role.

CTA remains visible with QA configuration banner.

---

## 6. Google Supabase session result

| Step | Status |
|---|---|
| Tap Google CTA | PASS |
| ASWebAuthenticationSession permission → Continue | PASS |
| Reach accounts.google.com | PASS |
| Supabase session | **FAIL** |

Objective error (screenshot `google_s5_oauth_page.png`):

> Access blocked: Authorization Error  
> **Custom scheme URIs are not allowed for 'WEB' client type.**  
> Error 400: invalid_request

Root cause confirmed in staging env: `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` are set to the **same** client ID (Web type). Native Google Sign-In / OAuth cannot complete custom-scheme return until a distinct **iOS** OAuth client exists in Google Cloud Console and is wired into staging env + Info.plist reverse scheme.

**EXTERNAL BLOCKER — GOOGLE OAUTH CLIENT TYPE MISMATCH (WEB used as iOS)**  
CTA stays visible. No session / cold relaunch / logout isolation proven for Google.

---

## 7. Journal CRUD result

| Step | Status |
|---|---|
| Visible Add Trade CTA (`journal-add-trade`) | FUNCTIONAL PASS |
| Open form | PASS |
| Fill entry/exit/contracts + Save Trade | FUNCTIONAL PASS |
| Trade appears (MES, Jul 31, month P&L +$1.5K) | FUNCTIONAL PASS |
| Stats opens after create | SMOKE PASS |
| Edit / delete / cold relaunch persistence | PARTIAL / NOT RUN this session |
| Backend failure / stale-write / double-tap | NOT RUN |

Fixes:

- Header Add Trade CTA when journal populated
- `testID`s: `journal-entry-price`, `journal-exit-price`, `journal-contracts`, `journal-pnl`
- `console.error` → `console.warn` in `startupPerf` (LogBox was blocking Save Trade)
- Maestro: `.maestro/yt3/journal_crud_fill_s5.yaml`  
- Evidence: `jcrud_fill_03_journal.png`

---

## 8. Stats filter / mutation result

| Check | Status |
|---|---|
| Open Stats | PASS |
| Filters 1D / 7D / 1M / YTD / 1Y / ALL | FUNCTIONAL PASS (taps + screenshots) |
| Scroll | PASS |
| Heading contrast | PARTIAL (visual capture only) |
| Update after journal create | SMOKE (opened Stats after create) |
| Update after edit/delete / user isolation | NOT RUN |

Flow: `.maestro/yt3/stats_filters_s5.yaml`

---

## 9. Calculator validation result

| Check | Status |
|---|---|
| Unit boundaries (`scripts/calculator-risk-qa.ts`) | **PASS** |
| UI open + input smoke | SMOKE PASS |
| Full Maestro matrix (NaN/Infinity/reset/keyboard) | PARTIAL |

---

## 10. News offline / Retry result

| Check | Status |
|---|---|
| Authenticated News open | FUNCTIONAL PASS (populated Yahoo Finance list) |
| Scroll | PASS |
| Retry CTA (when shown) | NOT shown when feed healthy — SKIPPED |
| Offline / timeout / malformed | NOT RUN |
| Staging endpoint | app staging host `zleojeqkzizeyerhjpur.supabase.co` (News feed via existing app news service; no secrets exposed) |

---

## 11. Calendar navigation / timezone result

| Check | Status |
|---|---|
| Open Calendar | PASS |
| Prev / next month taps | SMOKE PASS |
| Journal sync (month P&L after create on Journal calendar) | PARTIAL PASS on Journal calendar (+$1.5K / day 31) |
| DST / midnight boundary / user isolation | NOT RUN |

---

## 12. Settings logout / user-switch result

| Check | Status |
|---|---|
| Sign Out visible after scroll | FUNCTIONAL PASS |
| Return to Auth CTAs | FUNCTIONAL PASS |
| Relogin via `youtrader://qa/email-login?role=allow` | FUNCTIONAL PASS |
| Second-user switch / RC identity / Keychain contract deep proof | PARTIAL |
| Obsolete AI Analytics Maestro expectation | removed from settings flow |

Flow: `.maestro/yt3/settings_logout_s5.yaml`

---

## 13. PI timeout / reaper implementation and tests

| Item | Status |
|---|---|
| Staging migration `20260731290000_prop_os_pi_timeout_reaper.sql` | Applied staging (Session 5 prior) |
| Thresholds | queue 600s / processing 300s |
| Edge ops `claim` / `reap` | Deployed; Edge shared-secret 403 PARTIAL vs SQL reaper PASS |
| Unit `scripts/pi-timeout-reaper-qa.ts` | **PASS** |
| Client: stop polling on non-queued/running; clear on `userId` change; timeout UI + Retry label | Implemented in `PerformanceIntelligenceInternalPanel.tsx` + i18n |
| Full matrix stale worker / logout stop / relaunch | PARTIAL (unit + prior semantic/fail proofs) |

---

## 14. Physical harness expansion

`scripts/qa/physical-device-harness.sh` modes: `status|install|launch|terminate|relaunch|cycle|verify|cold|warm|screenshot|logs`

Executed:

- `verify` → **physical_verify_ok** (build 113, embedded jsbundle, staging host in bundle; Metro warned ON during sim work)
- `warm` → **physical_warm3_ok** (3 warm relaunches process_ok)

Full Phase 4F physical matrix: **NOT RUN** (simulator gates not all green).

---

## 15. Remaining objective external blockers

1. **Apple Sign-In** — empty provider secret; no `.p8` / owner key permission  
2. **Google Sign-In** — Web client ID reused as iOS client → Error 400 `invalid_request` (custom scheme vs WEB type)  
3. **RC CustomerInfo after in-app purchase** — needs StoreKit+RC on staging app (physical Sandbox preferred after Google/Apple config)  
4. **Maestro env expansion** — `${STAGING_QA_*}` requires `-e` flags; prefer QA deep-link + fixture preflight  

---

## Product / tooling changes this session

- `src/app/YouTraderApp.tsx` — journal CTA testIDs / Input a11y  
- `src/lib/startupPerf.ts` — warn instead of error for non-fatal checkpoints  
- `src/propPass/PerformanceIntelligenceInternalPanel.tsx` — timeout display + polling stop + user switch clear  
- i18n timeout/retry keys (en + locales)  
- `ios/YTStoreKitQA/Tests/StoreKitLocalTransactionTests.swift` — 18.5 path; skip message updated  
- Maestro flows under `.maestro/yt3/*_s5.yaml`  
- `scripts/qa/run-maestro-staging.sh` — `MAESTRO_DRIVER_STARTUP_TIMEOUT=180000` (ms)  
- `scripts/qa/physical-device-harness.sh` — warm/screenshot  

## QA commands

```
npm run typecheck          # PASS
npm run translations:check # PASS
node scripts/calculator-risk-qa.ts
node scripts/pi-timeout-reaper-qa.ts
node --experimental-strip-types scripts/entitlement-startup-routing-qa.ts
xcodebuild test … iOS 18.5 YTStoreKitQA
```

`expo export --platform ios` — NOT RUN this session (time; report honestly).

Aikido MCP: authenticated; full scan pending tokenized content upload in follow-up if required.

---

## Phase 4F gate

**FAILED / OPEN / NO-GO** — do not prepare build 114.
