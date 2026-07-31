# YouTrader 3.0 — Phase 4F Physical Device QA Report

**Date:** 2026-07-31  
**Branch:** `fix/yt3-device-regression-recovery`  
**Device:** iPhone 4S (iPhone 14 Pro Max) — UDID `00008120-00046D54219B401E`  
**Scheme / config:** `YouTrader-Staging` / `Release-Staging`  
**Metro:** OFF · embedded `main.jsbundle` · build **113**  
**Build 114:** NOT prepared / NOT uploaded  

---

## Verdict

# FAILED / NO-GO

The app launches with an embedded bundle, but the **product is severely regressed** on the physical device. Launch success is not product success.

Do **not** call this PARTIAL PASS.

| Gate | Result |
| --- | --- |
| Install + embed launch | Technical launch OK (not product PASS) |
| Readable YDL / contrast | **FAIL** |
| Apple Sign-In | **FAIL** |
| Google Sign-In | **FAIL** |
| Onboarding → Paywall → Auth funnel | **FAIL** |
| Prop Pass functional product | **FAIL** |
| Navigation / AI copy cleanup | **FAIL** |
| Physical interaction evidence for product flows | **FAIL** |

See `YT3_REGRESSION_AUDIT.md` and recovery branch work.

Phase 4F remains **FAILED** until physical screenshots and interaction prove recovery.
