# Build 113 black-screen investigation (NO-GO)

Status: **FAILED / NO-GO** for App Store Review. Do not upload build 114 until physical-device PASS.

## Observed TestFlight behavior (build 113)

- Installation succeeds.
- App opens to a black screen; user cannot enter the app.
- Classification from evidence: process remains **alive** (not an instant crash to home).
- No App Store Connect crash IPS tied to this failure path was available.
- Staging JS env **was** embedded in the IPA (`zleojeqkzizeyerhjpur`, `staging_preview`) — missing `EXPO_PUBLIC_*` embedding is **not** the root cause.

## Runtime reproduction (Release-Staging simulator)

Scheme: `YouTrader-Staging` / `Release-Staging` (same archive configuration family as TestFlight).

A/B probes:

| Probe | Result |
|--------|--------|
| Minimal root View | Visible |
| Outer View + `SafeAreaProvider` without `initialMetrics` | Provider shell paints; **children render as null** → black body |
| Same + `initialMetrics={initialWindowMetrics}` | Children visible |
| Full app after fix | Startup skeleton → AuthScreen |

## Exact root cause

`react-native-safe-area-context` `SafeAreaProvider` (v5.6.2) renders:

```text
insets == null ? null : children
```

In Release-Staging / TestFlight, native `onInsetsChange` did not populate insets in time (or at all). Nested providers around startup/Auth/main shell therefore mounted a flex shell with **no React children** → permanent black window while JS effects still ran (`auth_hydration_timeout` observed).

Affected path:

- `src/app/YouTraderApp.tsx` — multiple `SafeAreaProvider` wrappers without `initialMetrics`
- Library: `node_modules/react-native-safe-area-context/src/SafeAreaContext.tsx`

## Fix implemented (not committed unless PO asks)

1. `YouTraderSafeAreaProvider` with `initialWindowMetrics` + Dimensions fallback.
2. Single root provider; remove nested providers from App branches / error boundary.
3. Startup checkpoints S04–S14 (Release-visible via `logger.warn`).
4. Minimal `StartupFailureFallback` + 15s startup watchdog.
5. Prop Pass client register wrapped in try/catch; `PropPassInternalScreen` lazy-loaded.
6. `sanitizedRuntimeConfigReport()` for safe runtime config logging.

## Physical device

- `iPhone 4S` (iOS 26.6) and `iPhone Milochka` (18.7.8): **offline** / Developer Mode blocked earlier.
- **Build 114 not started.** Simulator PASS is not sufficient per release gate.

## Sanitized runtime config (staging bundle)

```text
appEnvironment: staging
supabaseHost: zleojeqkzizeyerhjpur.supabase.co
activationMode: staging_preview
revenueCatConfigured: true
googleSignInConfigured: (per embedded keys)
propOsEnabledForEnvironment: true
```

## Next for Product Owner

1. Connect the TestFlight iPhone, enable Developer Mode if needed.
2. Run `YouTrader-Staging` / Debug-Staging (Run) or Release-Staging on device; confirm 5 cold launches.
3. Only then bump to build **114**, archive IPA, **STOP before upload**.
