# Release blocker — missing JS bundle / build 113 retired

**Date:** 2026-07-31  
**Status:** IN PROGRESS (bundle harden) — build **113 FINAL FAILED**

## Dual failure evidence

### TestFlight — build 113 permanently superseded

Device opens `1.6.1 (113)`.

Build 113 was archived/uploaded **before**:

- `a8b10e0` — SafeArea black-screen fix
- `d1395e0` — staging Apple Sign-In guard

Do **not** use 113 for QA. Do **not** submit to App Store Review.

### Xcode Release-Staging — “No script URL provided”

```
No script URL provided. Make sure the packager is running or you have embedded a JS bundle in your application bundle.
unsanitizedScriptURLString = (null)
```

This RN loader error means the process received a **nil** script URL: neither Metro nor `main.jsbundle`.

## Diagnosis (Release-Staging bundling)

| Check | Result |
| --- | --- |
| Exact `CONFIGURATION = "Release"` skip? | **No** — `react-native-xcode.sh` uses `*Debug*` → `DEV=true`, else `*)` → `DEV=false`. `Release-Staging` correctly takes the release path. |
| Project Bundle phase | Skips only when `CONFIGURATION` matches `*Debug*`. `Release-Staging` is **not** skipped by name. |
| Archive 113 IPA | Contains `Payload/YouTrader.app/main.jsbundle` (~11 MB) — Archive embed **works**. |
| AppDelegate | Was `#if DEBUG` → Metro; `#else` → `main.jsbundle`. Release-Staging sets `-D EXPO_CONFIGURATION_RELEASE` and does **not** set Swift `DEBUG`. |
| Local DerivedData | Recent **Run** products are `Debug-iphoneos` **without** `main.jsbundle`. No current `Release-Staging-iphoneos` Run product. |
| Device install | `com.youtrader.pro` = `1.6.1` / **113** |

### Most likely local failure modes

1. **Debug Run without Metro** (scheme `YouTrader` Launch=`Debug`, or Debug destination) → Metro URL null → exact error.  
2. **Release-Staging Run** where embed did not land in the installed `.app` (script failure / stale install), while Archive still embeds.

Not root-caused as “script only accepts exact `Release`”.

## Fixes applied

1. **AppDelegate** — prefer `#if EXPO_CONFIGURATION_RELEASE` embedded `main.jsbundle` (covers `Release` + `Release-Staging`) before Metro.  
2. **Bundle RN phase** — for non-Debug: `unset SKIP_BUNDLING`, `FORCE_BUNDLING=1`, re-assert after `.xcode.env.local`; **fail the build** if `main.jsbundle` is missing; require `.xcode.env.staging` for Staging configs.

## Build 114

Do **not** start or upload 114 until a physical-device Release-Staging install (no Metro) proves AuthScreen / JS shell loads with embedded bundle.
