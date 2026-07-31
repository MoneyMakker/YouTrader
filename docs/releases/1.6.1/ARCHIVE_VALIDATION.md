# Archive Validation — 1.6.1 (112)

**Date:** 2026-07-30  
**Status:** ARCHIVE VALIDATED — awaiting Product Owner **FINAL UPLOAD** approval  
**Starting commit:** `8ac1d20` (`chore(release): prepare 1.6.1 build 112`)  
**Validation commit message:** `fix(release): validate 1.6.1 build 112 archive` (see `git log -1`)  

## Build method

| Field | Value |
|-------|-------|
| Primary attempt | `eas build --profile production --platform ios` (cloud) — **blocked**: Free plan iOS quota exhausted until ~2026-08-01 |
| Successful path | `eas build --local --profile production` → **Archive Succeeded**; initial EAS-managed export failed (stale App Store profile vs Distribution cert) |
| Final IPA export | `xcodebuild -exportArchive` with `method=app-store-connect`, `signingStyle=automatic`, team `L6M4U8G8RC` |
| Distribution | App Store Connect / TestFlight-capable (`beta-reports-active=true`, `get-task-allow=false`) |
| Profile | EAS `production` + production environment secrets |

## Artifacts

| Artifact | Path |
|----------|------|
| xcarchive | `build/YouTrader-1.6.1-112.xcarchive` |
| IPA | `build/YouTrader-1.6.1-112.ipa` (~28 MB) |
| Export dir | `build/YouTrader-1.6.1-112-export/` |

Resolved from final IPA / archive:

- `CFBundleShortVersionString` = **1.6.1**
- `CFBundleVersion` = **112**
- Bundle ID = **com.youtrader.pro**
- Signing = **Apple Distribution: BOROVIK GROUP INC (L6M4U8G8RC)**

## Production secrets (redacted)

Source: EAS environment `production` (pulled to gitignored `.env.eas.production` for local archive; not committed).

| Secret / config | Result |
|-----------------|--------|
| Google iOS client ID | present — project `423302595080`, suffix `…1pj8rt` |
| Google Web client ID | present — **same value as iOS** in EAS (warning) |
| Reversed URL scheme in native IPA | present — `com.googleusercontent.apps.<redacted>` (len 72) |
| Staging/localhost Google config | not used |
| RevenueCat iOS public SDK key | present (`appl_…`, len 32) |
| RevenueCat secret API key | not bundled |
| Entitlement ID | `YouTrader Pro` |
| Sentry DSN | present on EAS builders (secret visibility — not pullable locally); app no-ops init when DSN absent (`src/observability/monitoring.ts`) |
| Sentry source-map upload credentials | absent locally; did **not** fail archive |
| Prop OS activation | absent in production env → default **off** |
| Service-role / processor credentials | absent from EAS production env + archive scan |

## Signing / provisioning (final IPA)

- Profile name: `iOS Team Store Provisioning Profile: com.youtrader.pro`
- UUID prefix: `ec194f0c…`
- Team: `L6M4U8G8RC` / BOROVIK GROUP INC
- Expires: 2027-07-28
- Device UDID list: none (App Store / TestFlight store profile)
- Method: `app-store-connect`

## Entitlements (final IPA)

- `application-identifier` = `L6M4U8G8RC.com.youtrader.pro`
- `com.apple.developer.applesignin` = Default
- `beta-reports-active` = true
- `get-task-allow` = false
- `aps-environment` = **ABSENT** (push plugin present; push entitlement not in release profile)
- Also includes `keychain-access-groups` (store profile)

## Privacy manifests

App `PrivacyInfo.xcprivacy` present. Lottie privacy bundles included:

- `LottiePrivacyInfo.bundle`
- `Lottie_React_Native_Privacy.bundle`

No secondary app extensions/widgets. No duplicate-copy Lottie warnings observed in archive log.

## Artifact scans

- `SUPABASE_SERVICE_ROLE` / `service_role=` / `sb_secret` / `sk_live` — absent  
- JWT role in binary — `anon` only  
- Supabase host — `https://izzrlsgumyabdvlmwlwn.supabase.co`  
- Residual `localhost` string hits — RN diagnostic fragments (not API base)  
- `appl_` public RC key present  

## Smoke-test matrix

| # | Test | Result |
|---|------|--------|
| 1–3 | Cold/warm/upgrade on device | **BLOCKED** — no physical device attached; App Store IPA requires TestFlight for install |
| 4–12 | Auth / Journal / analytics / RC / paywall | Deferred to post-upload device QA |
| 13 | Notification registration without startup failure | Static: notifications plugin present; entitlement absent — expect soft no-push path |
| 14–18 | Offline / network fail / not allowlisted / Prop OS unavailable / no public Prop Pass | Covered by Phase 2A/2C/3A + activation QA (re-run PASS) |
| 19 | No sync startup crash from Prop OS | PASS (gateway try/catch; entry hidden) |

## Regression re-confirmation

| Gate | Result |
|------|--------|
| typecheck / translations | PASS |
| Phase 3A / 2C / 2B hardening / 2A / live slice | PASS |
| release identity 1.6.1 (112) | PASS |

## Config fixes in this validation

- `.easignore` — exclude `.tmp/`, archives, IPAs, worktrees (fixes EAS upload socket failure + bloat)
- `ios/YouTrader/Info.plist` — inject production Google reversed client URL scheme

## Confirmations

- Production database **untouched**
- **No** TestFlight upload
- **No** App Store submission
- Subsequent roadmap phases **not started**
- Version/build **not** incremented beyond 1.6.1 / 112

## Remaining warnings

1. EAS cloud iOS quota exhausted until ~Aug 1 — local archive/IPA used instead.
2. EAS-managed remote provisioning profile was stale vs Distribution cert; Xcode automatic export succeeded.
3. Google Web and iOS client IDs are identical in EAS production — verify intended.
4. `aps-environment` absent — push not entitled in this binary.
5. Device smoke deferred until FINAL UPLOAD → TestFlight install.
6. Aikido non-blocking (auth previously unavailable).
7. `expo-updates` channel warning on production profile (package not installed).

## Waiting for

**Product Owner FINAL UPLOAD approval** before any TestFlight upload or App Store submission.
