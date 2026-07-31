# Release Report — 1.6.1 (112)

**Date:** 2026-07-30  
**Candidate type:** Internal TestFlight regression  
**Status:** READY FOR TESTFLIGHT (awaiting Product Owner approval)  
**Not for:** App Store Review / public production Prop OS rollout

---

## Identity

| Field | Value |
|-------|-------|
| Starting baseline (Phase 3A FINAL) | `84bd80e` foundation · `7374397` remediation |
| Prep start HEAD | `7374397` |
| Marketing version | `1.6.1` |
| iOS build | `112` |
| Bundle ID | `com.youtrader.pro` |
| EAS project | `02ed40d6-5ad8-4a6d-9716-5ba40ec714c6` |

---

## Version / build configuration files

- `app.json` → `expo.version=1.6.1`, `expo.ios.buildNumber=112`
- `ios/YouTrader/Info.plist` → `CFBundleShortVersionString=1.6.1`, `CFBundleVersion=112`
- `ios/YouTrader.xcodeproj/project.pbxproj` → `MARKETING_VERSION=1.6.1`, `CURRENT_PROJECT_VERSION=112` (Debug + Release)
- `package.json` → already `1.6.1` (unchanged)
- `scripts/release-stability-check.mjs` → expected build `112` (+ tighter console-secret pattern)

Single iOS target `YouTrader` — no widget/extension with alternate version/build.

---

## Feature-flag state (public-safe defaults)

| Flag / gate | Default / production behavior |
|-------------|-------------------------------|
| `DEFAULT_ACTIVATION_CONFIG.mode` | `off` |
| `EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE` | absent → `off` (`.env.example` commented) |
| `isPropPassEntryVisible` (production `APP_ENV`) | `false` even if mode were `internal_read_only` |
| `getPropPassGateway` | try/catch → `null` on init failure; never throws to App |
| Prop OS / PI migrations | present in repo only — **not applied to production** |

---

## Production environment verification

- Local `.env` `EXPO_PUBLIC_SUPABASE_URL` host: `izzrlsgumyabdvlmwlwn.supabase.co` (https, non-localhost)
- No Prop OS / PI production migration applied during this prep
- Production Supabase schema/config not modified by this release task
- Processor role **names** may appear as source string constants; **no processor credentials** bundled

---

## Release bundle endpoint / secret scan (`expo export --platform ios`)

| Check | Result |
|-------|--------|
| `SUPABASE_SERVICE_ROLE` | absent |
| `service_role=` | absent |
| `sb_secret` | absent |
| JWT in bundle | 1 token, role=`anon` (publishable) |
| Supabase hosts | `https://izzrlsgumyabdvlmwlwn.supabase.co` only |
| `https://localhost` string hits | residual RN/Metro diagnostic fragments in Hermes bytecode (not configured API base) |
| Processor role string literals | present as code constants only |

`npm run security:check` — passed (tracked secret patterns).

---

## Validation results

| Gate | Result |
|------|--------|
| Dependency restore / typecheck | PASS (`tsc --noEmit`) — full `npm ci` wipe blocked by OS locks on nested `.claude`/`.vscode`/`.idea` junk under `node_modules`; tree repaired without wipe; `npm ci --dry-run` OK |
| `translations:check` | PASS |
| `lint` script | N/A (not configured); `lint:ui-infra` not required for this identity bump |
| Phase 3A (`test:prop-pass-phase3a`) | PASS (65) |
| Phase 2C (`test:prop-pass-phase2c`) | PASS |
| Phase 2B hardening static | PASS (10) |
| Phase 2A (`test:prop-pass-phase2a`) | PASS (9) |
| Phase 2A live vertical slice | PASS (10) — local isolated env |
| Activation / accounts / invariants / fixtures | PASS |
| `release:stability` | PASS (includes expo ios export) |
| `test:release-readiness` | PARTIAL — Google Sign-In client IDs missing in local `.env` (`GOOGLE_WEB`/`GOOGLE_IOS` false). RevenueCat iOS key + entitlement present. |
| Expo config | version `1.6.1`, buildNumber `112`, bundleId `com.youtrader.pro` |
| Xcode Release settings | `MARKETING_VERSION=1.6.1`, `CURRENT_PROJECT_VERSION=112` |
| Native `.xcarchive` for 112 | **Not produced** in this prep (STOP before upload). Prior archive `build/YouTrader-1.6.1-111.xcarchive` remains 111. |
| Cold-start Prop Pass audit | PASS — peek `off`, entry hidden in production env, gateway non-throwing |
| Notification entitlements | `expo-notifications` plugin present; `YouTrader.entitlements` currently Apple Sign In only (no `aps-environment` in checked entitlements) |
| Upload / App Store submit | **Not performed** |

---

## Safety proof (static / QA)

Build can keep existing production experience when:

- Prop OS / PI tables absent (activation off → zero Prop OS calls — Phase 2A/activation QA)
- Prop OS RPCs unavailable (gateway/repository_unavailable paths covered)
- User not allowlisted / flags disabled / entry not visible in production
- Temporary network failure — repository timeout/exception gates covered in activation QA
- No Prop OS module synchronously throws during App startup (`getPropPassGateway` catch)

---

## Explicit non-goals (not started)

- Pass Probability, Discipline Streak UX, Decision Replay, Smart Intervention
- AI explanations, brokers, public Prop OS rollout
- Production Prop OS / PI migrations
- App Store Review submission
- Automatic TestFlight upload (PO approval required first)

---

## Remaining warnings

1. Local `.env` lacks Google Sign-In client IDs → `test:release-readiness` Google check FAIL (EAS secrets may still supply them for cloud builds — confirm before upload).
2. Full clean `npm ci` after wipe not completed due to OS `EPERM` on nested IDE junk under `node_modules`.
3. Native signed archive for build **112** not created in this prep.
4. Sentry Expo plugin warns missing organization/project in local export (env fallback at EAS build).
5. Hermes bundle contains residual `localhost` diagnostic string fragments from RN tooling — not used as Supabase base URL.

---

## Waiting for

**Product Owner approval** before any Internal TestFlight upload or further release actions.
