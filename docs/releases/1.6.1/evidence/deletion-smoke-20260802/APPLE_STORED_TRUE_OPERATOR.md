# Apple `stored:true` + revoke — operator steps (production)

Production project: `izzrlsgumyabdvlmwlwn`  
Functions: `store-apple-auth-token` v3, `delete-account` v3  
Table: `public.auth_provider_tokens` (service-role only)

Staging RS 113 cannot close this gate: staging has no `auth_provider_tokens` table and Apple provider enablement was previously blocked.

## Required binary

Use a **production-pointing** iOS build of current code (public **1.6.1**). Prefer the authorized local **build 115** once pre-build gates pass, or a one-off Release (non-Staging) install that still reports CFBundleVersion 113 only if 115 is not yet authorized.

## Steps

1. Sign out of any staging QA account.
2. Sign in with a **disposable** Apple ID (Hide My Email OK) via Sign in with Apple.
3. Confirm `store-apple-auth-token` returns HTTP 200 with body `{"ok":true,"stored":true}` (device oslog / Charles / temporary QA toast — do not log the authorization code).
4. Verify token presence without reading ciphertext:
   `select count(*) from public.auth_provider_tokens;` → expect `1` for that disposable user.
5. Settings → Delete Account → confirm.
6. Expect delete response `ok:true` and `appleRevoked:true` (not merely `manualAppleRevocationRequired:true`).
7. Confirm user 404 via Auth Admin and `auth_provider_tokens` count returns to `0` for that user (cascade).

## Stop conditions

- `stored:false` / `exchange_failed` → Apple secret/key mismatch; do not mark PASS.
- `manualAppleRevocationRequired:true` with no prior `stored:true` → legacy fallback only; does not satisfy this gate.
