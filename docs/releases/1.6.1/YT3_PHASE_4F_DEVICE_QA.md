# YouTrader 3.0 — Phase 4F Physical Device QA Report

**Date:** 2026-07-31  
**Branch:** `fix/yt3-device-regression-recovery` @ `a73359a` (+ recovery commits)  
**Device:** iPhone 4S — iPhone 14 Pro Max — UDID `00008120-00046D54219B401E` — **Connected**  
**Scheme / config:** `YouTrader-Staging` / `Release-Staging`  
**Metro:** OFF · embedded `main.jsbundle` · build **113**  
**Build 114:** NOT prepared / NOT uploaded  
**Production Supabase:** untouched  

---

## Verdict

# FAILED / NO-GO

Launch/embed infrastructure is green after recovery rebuild.  
**Product interactive gates are not proven** on-device (screenshots + auth + Prop Pass matrices).

Do **not** call this PARTIAL PASS.

| Gate | Result |
| --- | --- |
| Release-Staging rebuild 1.6.1 (113) + embed | **PASS** |
| Install + launch Metro OFF | **PASS** |
| Cold/warm process launches | **PASS** |
| DDI services usable | **PASS** (`contentIsCompatible`, `isUsable`) |
| Screenshots (`idevicescreenshot`) | **FAIL** — screenshotr Invalid service |
| Maestro 2.8.0 iOS driver | **FAIL** — missing `MaestroDriverLib/Info.plist` (known Xcode 26 packaging bug) |
| Apple Sign-In E2E | **FAIL** — staging provider still `provider_disabled`; Dashboard enable blocked (API 403) |
| Google Sign-In E2E | **NOT PROVEN** |
| Acquisition funnel on device | **NOT PROVEN** (code restored; needs screenshots) |
| Prop Pass allowlisted / non-allowlisted | **NOT PROVEN** |
| Visual contrast after recovery | **NOT PROVEN** (code fixed; needs screenshots) |

---

## Recovery code already on device binary

Installed recovery build includes:

- Dark product theme / readable empty-state titles  
- Onboarding → Paywall → Auth → Main state machine  
- Apple CTA visible when Supabase configured (no silent hide)  
- Prop Pass tab gated by allowlist  
- AI coaching copy removed from Journal empty state  

See `YT3_REGRESSION_AUDIT.md` and `YT3_RECOVERY_PROGRESS.md`.

---

## Unblockers required to finish Phase 4F

1. **Enable Apple** on Supabase Staging Auth (Dashboard) — Client ID `com.youtrader.pro` + secret.  
2. **Capture screenshots** manually from Xcode Devices / QuickTime (CLI screenshotr broken on iOS 26.6).  
3. Or fix Maestro driver packaging / provide working `maestro-driver-ios` provisioning for Xcode 26.  
4. Re-run allowlisted / non-allowlisted Prop Pass + auth matrix with evidence.

Until then Phase 4F stays **FAILED**. Build stays **113**. No 114.
