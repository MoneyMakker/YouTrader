# Apple Sign-In — staging recovery status (1.6.1)

## Product policy (updated)

Do **not** silently hide the Apple CTA on staging when Auth is misconfigured.
Show the button on iOS when Supabase is configured; treat a disabled provider as a **failed configuration to repair**.

App gate (`src/config/appConfig.ts`):

`enableNativeAppleSignIn = Platform.OS === "ios" && isSupabaseConfigured`

## Native capability

- Entitlement `com.apple.developer.applesignin` = Default
- Bundle `com.youtrader.pro`
- Native `signInWithIdToken` path in `src/auth/appleSignIn.ts`

## Staging Supabase Auth

| Check | Status |
| --- | --- |
| Project | YouTrader Staging (`zleojeqkzizeyerhjpur`) only — production untouched |
| Apple provider enabled | **BLOCKED** — Management API PATCH returned **403 Forbidden** for the current CLI token |
| Prior runtime evidence | `provider_disabled` on `/token` id_token exchange |

### Minimal manual action required (one step)

In Supabase Dashboard → **YouTrader Staging** → Authentication → Providers → **Apple**:

1. Enable Apple.
2. Set Client IDs to include native bundle `com.youtrader.pro` (same App ID as production).
3. Paste the Apple Secret Key / Services configuration used for YouTrader (do not commit secrets).

After that, rebuild Release-Staging **113** (no build bump) and re-run physical Apple E2E.

## Google

Staging `.xcode.env.staging` already supplies Google client IDs and Info.plist has the reversed client URL scheme. Physical E2E still required; do not declare PASS from config alone.
