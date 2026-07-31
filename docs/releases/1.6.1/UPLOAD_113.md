# Upload — 1.6.1 (113)

**Status:** FINAL FAILED / SUPERSEDED — do not QA, do not App Store Review

Build 113 predates SafeArea fix (`a8b10e0`) and Apple staging guard (`d1395e0`).
Expire / remove from Internal Testing when possible. Production Supabase untouched.

---

**Status:** UPLOADED — Internal Testing only  
**Date:** 2026-07-31 (UTC)

## Upload

| Field | Value |
|-------|-------|
| Method | EAS Submit (`eas submit -p ios`) → Fastlane Pilot → App Store Connect |
| IPA | `build/YouTrader-1.6.1-113-staging.ipa` |
| Submission ID | `13e8b9f8-7254-4fea-b8c4-d99e699c1e9a` |
| ASC App ID | `6774799403` |
| Expo submission | [link](https://expo.dev/accounts/pdvl/projects/youtrader-pro/submissions/13e8b9f8-7254-4fea-b8c4-d99e699c1e9a) |
| ASC upload result | **Successfully uploaded** (`FINISHED`) |
| Apple build ID | `2a621a40-250d-4511-933f-8e0119278679` |

## Apple recognition

| Field | Value |
|-------|-------|
| Marketing version | **1.6.1** |
| CFBundleVersion | **113** |
| Processing state | **VALID** |
| Internal build state | **IN_BETA_TESTING** |
| External build state | **READY_FOR_BETA_SUBMISSION** (not submitted / not enabled) |
| Encryption | `usesNonExemptEncryption` = **false** (export compliance satisfied via Info.plist) |

## Groups / distribution

| Field | Value |
|-------|-------|
| Internal group | **Team (Expo)** (`isInternalGroup=true`, `hasAccessToAllBuilds=true`) |
| External Testing | **Disabled** — no external groups; state remains ready-for-submission only |
| App Store Review submission | **Did not occur** — no `1.6.1` App Store version created; latest sale version remains `1.6.0` |
| Build 112 upload | **Did not occur** (ASC build list: …111 → **113**) |

## Constraints confirmed

- Production Supabase untouched
- No Prop OS / PI production migrations
- Allowlist / staging activation scope unchanged
- Later roadmap phases not started

## Device QA

**Status:** BLOCKED on physical install — paired iPhones currently `tunnelState=unavailable` (not connected). Store-signed IPA cannot be sideloaded; install must be via TestFlight on a team Apple ID after Internal Testing availability.

| Check | Result |
|-------|--------|
| Cold / warm launch | PENDING device |
| Google Sign-In | PENDING device |
| Email auth | PENDING device |
| Allowlisted Prop Pass nav | PENDING device (remote API slice previously PASS) |
| Account / challenge load | PENDING device |
| Assignment / recalc refresh | PENDING device |
| PI panel | PENDING device |
| Non-allowlisted denial | PENDING device |
| Journal / Analytics | PENDING device |
| RevenueCat init / restore | PENDING device |
| Offline / staging backend failure | PENDING device |
| Logout / relaunch | PENDING device |
| Black screen / sync startup crash | PENDING device |
| Remote push (`aps-environment` absent) | **Unsupported in 113** — code path `getExpoPushTokenIfServerStorageIsReady` is try/catch and returns `null` (does not throw); local notification APIs remain separate |

**Next for PO / device operator:** connect Internal TestFlight device → install **1.6.1 (113)** from TestFlight → run checklist above → report results.
