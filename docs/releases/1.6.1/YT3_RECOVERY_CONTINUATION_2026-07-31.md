# YT3 Recovery Continuation — 2026-07-31 (Phase 4F still FAILED)

**Build policy:** stay on **113** · no 114 · production Supabase not written  
**Phase 4F:** remains **FAILED / NO-GO / OPEN**

## Commits

| Commit | Scope |
| --- | --- |
| `a70d86a` | Debug-Staging Xcode/CocoaPods/scheme |
| `0443e30` | Staging QA reset, title contrast, metro staging tooling, fail-closed prod host |
| *(pending)* | Metro env quarantine, email fixture login, StoreKit config, shell mount fix, QA tab deeplink |

## Task status

### 1 — Debug-Staging
**Root cause:** no Metro-capable staging configuration (only Debug / Release / Release-Staging).  
**Fix:** `Debug-Staging` + Podfile map + scheme Launch/Test/Analyze → Debug-Staging.  
**Proof:** `xcodebuild … Debug-Staging … iphonesimulator` SUCCEEDED; Metro CI mode; S07 `appEnvironment=staging` `supabaseHost=zleojeqkzizeyerhjpur.supabase.co`; **zero** production host contacts in verified launches.  
**Mitigation:** `scripts/start-metro-staging.sh` quarantines production `.env` → `.env.production.quarantine` and writes staging overlay.

### 2 — Apple Sign-In staging
**403 diagnosis:** intermittent Management API `GET/PATCH …/config/auth` can return **403 Forbidden** even when the same Keychain `Supabase CLI` opaque `sbp…` token returns **200** for `/v1/profile` and `/v1/projects/{ref}`. Category: **insufficient/unstable project auth-config permission or rate/ACL on Auth config endpoint**, not “wrong project ref” (project GET shows YouTrader Staging `zleojeq…`). Earlier successful PATCH enabled Apple (`external_apple_enabled=true`); **secret remains non-readable via GET** (write-only).  
**UI:** Apple CTA remains visible; staging QA banner explains secret restore risk.  
**E2E interactive Apple:** not yet PASS.

### 3 — Clean-auth reset
Implemented + proven: `[YTQA] staging auth reset complete`; deeplink `youtrader://qa/reset-auth`; launch arg; env gate. Production blocked. RC anonymous logout treated as cleared.

### 4 — Allowlisted QA user
**Resolved:** gitignored `.codex/secrets/staging-qa-credentials.env` + `scripts/staging-qa-seed-email-fixture.sh` + `youtrader://qa/email-login?role=allow|deny`.  
**Proof:** `[YTQA] email login ok role=allow userPrefix=41abedc1`; deny `27d72b29` on Settings (`tf-internal-deny@staging.youtrader.local`).

### 5 — Prop Pass UI
Allowlisted: Prop Pass tab opens (`youtrader://qa/tab?id=propPass`); **empty state** “No Prop account / Set up Prop account” captured. Full challenge metrics / PI matrix not yet linked. Deny user path exists; tab absence after deny needs dedicated capture without mic dialog race.

### 6 — Google
Provider enabled via prior PATCH; CTA visible; Web vs iOS client ID pairing still suspect; secret presence not durable via GET; interactive E2E not run. Java/Temurin install blocked (sudo password) → Maestro CLI unavailable.

### 7 — RevenueCat packages
**Resolved from live offerings:** `$rc_monthly` + `$rc_annual`; products `youtrader_pro_monthly` + `youtrader_pro_yearly__`; entitlement `YouTrader Pro`. StoreKit file `ios/YouTraderStaging.storekit` attached to Staging scheme. Purchase E2E not yet executed.

### 8 — Stats contrast
Title styles use `C.text`; live screenshot shows white **Stats Dashboard**. Unit `title-contrast-qa.ts` PASS.

### 9 — Aikido
`aikido_full_scan` → **Invalid token**. MCP login reports already signed in; Keychain `aikido-mcp` opaque token invalid. `gh secret list` Forbidden; brew Temurin needs sudo. **External security-integration blocker** — must not be reported as PASS. Pipeline must fail clearly on invalid token.

### 10–11 — Matrix / device
Simulator Pro Max: funnel onboarding→paywall→auth→email allow/deny; Journal/Stats/Prop Pass empty/Settings proven in part. Maestro blocked (no JRE without sudo). Physical Release-Staging 113 matrix still open.

## Commands / tests executed

- Debug-Staging xcodebuild (prior) SUCCEEDED  
- `EXPO_PUBLIC_QA_RESET_AUTH=0 EXPO_PUBLIC_DEVICE_QA_CAPTURE=true ./scripts/start-metro-staging.sh`  
- simctl install/launch/openurl/screenshot/privacy  
- `./scripts/staging-qa-seed-email-fixture.sh`  
- `npx tsx scripts/staging-qa-reset-qa.ts` PASS  
- `npx tsx scripts/title-contrast-qa.ts` PASS  
- Aikido full_scan → Invalid token (fail-closed)  
- Supabase Management API profile/project 200; auth config intermittent 403  

## Objective blockers remaining

1. Apple secret not restorable from automatic sources; interactive Apple E2E open  
2. Google secret / iOS client pairing; interactive Google E2E open  
3. Aikido MCP token rotation requires interactive browser re-auth  
4. Maestro needs JRE (sudo brew blocked)  
5. Prop Pass linked challenge + PI full matrix  
6. StoreKit purchase monthly/annual E2E  
7. Physical device Release-Staging 113 matrix  
8. Mic permission dialog races screenshots (privacy grant incomplete for pending alerts)  

**Do not claim Phase 4F complete.**
