# Apple Sign-In — staging diagnosis (1.6.1)

## Observed UI

Physical device (`YouTrader-Staging` / Release-Staging):

> Sign in failed — Apple sign in couldn't be completed.

## Root cause (runtime evidence)

Staging Auth logs (`zleojeqkzizeyerhjpur`, service `auth`):

- HTTP `400` on `/token`
- `grant_type`: `id_token`
- Message: `Provider (issuer "https://appleid.apple.com") is not enabled`
- `error_code`: `provider_disabled`

Interpretation:

1. Native Apple sheet can complete and return an identity token.
2. Supabase staging rejects `signInWithIdToken` because the Apple provider is disabled.
3. This is not an App ID / entitlement stripping issue.

## Native capability (PASS)

From `ios/YouTrader/YouTrader.entitlements` and the installed Release-Staging `.app`:

- Entitlement `com.apple.developer.applesignin` = `Default`
- Bundle / application-identifier: `L6M4U8G8RC.com.youtrader.pro`
- Sign in with Apple present on the target / provisioning used for device install

No signing secrets recorded here.

## Staging provider (FAIL until configured)

| Check | Result |
| --- | --- |
| Apple provider enabled on staging | **No** (`provider_disabled`) |
| Native client / bundle id `com.youtrader.pro` | Correct for native flow |
| Redirect / localhost dependency | N/A for native `id_token` |
| Production Supabase touched | **No** |

## Chosen product behavior — Option B

Hide Apple CTA when `EXPO_PUBLIC_APP_ENV` is staging-like unless:

`EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGN_IN=true`

Wire:

- `showApple={enableNativeAppleSignIn}` on AuthScreen
- same gate in Settings account signed-out buttons

Email auth remains available. Production continues to show Apple when `APP_ENV` is production and Supabase is configured.

## Build 114

Do not start build 114 until:

- this guard is on device, and
- allowlisted / non-allowlisted interactive email matrix passes.
