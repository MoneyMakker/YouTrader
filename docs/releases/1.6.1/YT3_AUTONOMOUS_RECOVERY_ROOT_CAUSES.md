# YT3 Autonomous Recovery — Root Causes + Simulator Launch

**Date:** 2026-07-31  
**Branch:** `fix/yt3-autonomous-recovery`  
**Safety tags:** `yt3-broken-113-head-6500391`, `yt3-autonomous-recovery-start-87f2f56`  
**Build policy:** stay on **113** · no 114 · no TF upload · production Supabase untouched  
**Phase 4F:** remains open / FAILED until physical interactive PASS  

---

## Absolute status

Build **1.6.1 (113)** is **FAILED / NO-GO**.  
Launch + screenshots ≠ product complete. Formal PASS claims are forbidden until real flows verify.

---

## Root causes (proven)

### R1 — Apple Sign-In product regression (`d1395e0`)

**Cause:** staging-like env silently hid Apple CTA unless `EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGN_IN=true`.  
**Code recovery:** `enableNativeAppleSignIn = ios && isSupabaseConfigured` (CTA restored).  
**Backend still broken on Staging:** Auth GET shows:

| Field | Staging | Production |
| --- | --- | --- |
| `external_apple_enabled` | **false** | **true** |
| `external_apple_client_id` | **null** | `com.youtrader.pro,host.exp.Exponent` |
| `external_apple_secret` | **null** (and GET never returns secrets) | present (write-only; not readable via API) |

**Automated attempts:**

1. Management API GET staging/prod auth config — **200**  
2. PATCH staging enable Apple (client_id only) — **403** (`error code: 1010`)  
3. Mirror prod Apple secret — **impossible**: prod secret not returned by GET  
4. Auth logs still contain historical `provider_disabled` for Apple id_token exchange  

**Classification:** external config blocker (token lacks Auth config write; Apple JWT secret not available via API).  
Feature remains **BLOCKED**, not PASS. CTA must stay visible.

### R2 — Acquisition funnel missing on earlier TF/device builds

**Cause:** no deterministic onboarding → paywall → auth → main machine; users dropped into Journal.  
**Recovery in code:** `src/app/startup/acquisitionState.ts` + shell wiring.  
**Unit:** `scripts/acquisition-state-qa.ts` → **PASS** (this session).  
**Physical:** Keychain-restored session skipped onboarding/auth on reinstall (documented in Phase 4F).

### R3 — YDL contrast (dark-on-dark)

**Cause:** appearance followed system light; Empty/Status titles missing explicit primary color → RN default black on black.  
**Recovery:** force product dark theme + explicit title color (`58fac91`).  
**Physical evidence:** Journal / Settings / Paywall readable; Stats section title still low-contrast (**CONCERN**).

### R4 — Prop Pass as primary product incomplete

**Cause:** tab always mounted or Settings-only; allowlist/activation env; PI memory-demo path.  
**Recovery:** tab gated by `isPropPassEntryVisible`; assignment remote hydrate.  
**Physical:** non-allowlisted restored user → tab correctly **hidden**. Allowlisted content **not** verified.

### R5 — AI Analytics still in IA historically

**Cause:** primary `ai` tab + Journal→AI CTA.  
**Physical evidence (device captures):** tab bar is Journal / Stats / Calculator / News / Calendar / Settings — AI tab absent.

### R6 — Tooling false-negatives

- `idevicescreenshot` / screenshotr invalid on iOS 26.6  
- Maestro driver packaging broken on Xcode 26  
- Aikido token invalid  

Workaround: in-app view-shot captures (staging flag).

---

## Preserve (do not regress)

- `a8b10e0` SafeArea black-screen fix  
- `e009c5a` Release-Staging embed fail-closed  
- `6500391` QA cred hygiene  
- Prop OS RLS / immutable snapshots / DML denial  

---

## Simulator recovery suite (this session)

| Step | Result |
| --- | --- |
| Boot iPhone 17 Pro Max (`A6BA9300-…`) | **Booted** |
| `acquisition-state-qa.ts` | **PASS** |
| Staging Apple Auth config write | **403** (`error code: 1010`) |
| Debug `xcodebuild` → `Debug-iphonesimulator` | **BUILD SUCCEEDED** (build **113**) |
| First launch without Metro | **FAIL** — `No script URL provided` (expected for Debug) |
| Expo Metro + relaunch | App bundled; RevenueCat offerings received |
| Funnel evidence | `paywall_viewed` log + Auth screen screenshot with **Apple + Google + Email** CTAs visible |
| Auth copy defect | Headline still “Your AI Trading Journal” / AI insights body — must replace |
| Evidence dir | `docs/releases/1.6.1/simulator-recovery/` |
| Maestro E2E | see `maestro-funnel.log` |
| Physical Phase 4F | still **FAILED / NO-GO** |

---

## Next autonomous steps (ordered)

1. Finish Debug simulator install + fresh-install funnel screenshots.  
2. Maestro flows: onboarding → paywall → auth visibility (Apple/Google/Email).  
3. Email auth E2E against Staging with secret-backed QA account (no commit of creds).  
4. Google Sign-In simulator/device E2E.  
5. RevenueCat StoreKit config + monthly/annual purchase tests on simulator.  
6. Allowlisted Prop Pass remote content verification.  
7. Fix Stats section-title contrast centrally.  
8. Only then re-enter physical Release-Staging 113 Phase 4F.

**Build 114 remains forbidden.**
