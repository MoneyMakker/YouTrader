# YouTrader Google Auth — Canonical Architecture (Session 10)

## Current implementation

`signInWithGoogle` in `src/auth/googleSignIn.ts`:

1. **PATH B (native)** only when `enableNativeGoogleSignIn` is true:
   - requires distinct Web + iOS OAuth client IDs
   - `@react-native-google-signin/google-signin` → `supabase.auth.signInWithIdToken`
2. Otherwise **PATH A (canonical today)**:
   - `supabase.auth.signInWithOAuth({ provider: "google", skipBrowserRedirect: true })`
   - `WebBrowser.openAuthSessionAsync` (ASWebAuthenticationSession)
   - HTTPS Supabase callback → custom scheme `youtrader://auth` return
   - PKCE via Supabase JS storage

`enableNativeGoogleSignIn` is currently **false** because Web and iOS client IDs are identical WEB-type IDs.

## Chosen architecture: PATH A

Prefer PATH A as the smallest safe repair for the already-working ASWebAuth sheet.

### Why correct

- Staging already opens ASWebAuth against `zleojeqkzizeyerhjpur.supabase.co`
- Browser OAuth does **not** require a native iOS Google client
- WEB client must never be passed as `iosClientId`
- Apple remains native `signInWithIdToken` (separate path)

### Configuration required (PATH A)

| Item | Staging status (Session 10) |
|------|-----------------------------|
| Google WEB client ID in Supabase | Present |
| Matching WEB client secret in Supabase | **Configured** (copied from matching prod Web client → staging only; prod untouched) |
| Supabase HTTPS callback authorized in Google Cloud | **FAIL** — `Error 400: redirect_uri_mismatch` |
| App return scheme `youtrader://auth` | In staging `uri_allow_list` |
| Distinct iOS client | Not required for PATH A |

### Files corrected

- `src/auth/googleSignIn.ts` — documents PATH A as canonical; native only when distinct iOS client exists
- Staging Auth Google QA banner text updated to PATH A wording
- Staging Supabase Auth: `external_google_secret` set; `site_url` + `uri_allow_list` updated (**staging project only**)

### Migration impact

- No client API change for users on PATH A
- Native PATH B remains dormant until a dedicated iOS client is provisioned

### Security impact

- Production Supabase not modified
- Client secret never logged/committed
- Secret lives only in Supabase Auth provider config (server-side)

### Remaining Google blocker

**EXTERNAL BLOCKER — MISSING GOOGLE CLOUD PROJECT PERMISSION**

Runtime authorize hop (Session 12) proves Google receives exactly:

`redirect_uri=https://zleojeqkzizeyerhjpur.supabase.co/auth/v1/callback`

Staging Supabase Auth already has:

- Google enabled + client ID + secret present
- `youtrader://auth` in `uri_allow_list`
- staging Site URL

No `gcloud` / Firebase CLI; Playwright Google Cloud Console requires interactive sign-in.
Cannot mutate the Web OAuth client's authorized redirect URIs from this environment.
