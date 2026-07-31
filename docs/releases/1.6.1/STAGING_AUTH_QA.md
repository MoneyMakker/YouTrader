# Staging Auth QA — credential gate (1.6.1)

**Status:** Auth users READY — waiting on Product Owner device interactive matrix  
**Production Supabase:** untouched (`izzrlsgumyabdvlmwlwn` not modified)

## Root cause of device “Email or password is incorrect”

Staging Auth logs show `invalid_credentials` for password grants.

API prove against staging with the dedicated QA fixtures: **PASS** for both allow + deny users.

So the accounts/passwords are valid on `zleojeqkzizeyerhjpur`. Device failures mean the typed credentials do not match the staging fixtures (wrong email, wrong password, autocorrect, or non-staging account).

## Sanitized user existence

| Account | UUID prefix | Provider | Email confirmed | Banned/deleted | Has password | Allowlist |
| --- | --- | --- | --- | --- | --- | --- |
| Allowlisted QA | `41abedc1…` | email | yes | no | yes | **yes** (`prop_os_command_allowlist` + client `EXPO_PUBLIC_PROP_OS_ALLOWLIST`) |
| Non-allowlisted QA | `27d72b29…` | email | yes | no | yes | **no** |

Emails (masks): `tf-…@staging.youtrader.local` (allow + deny variants).

## Credentials for PO

Local secure file (mode `0600`, gitignored):

`.codex/secrets/staging-qa-credentials.env`

Import into 1Password. Do not paste into chat, commits, or screenshots.

Scripts no longer embed passwords; they require these env vars.

## Auth UI expectations (Release-Staging)

After rebuild with Apple opt-in unset:

- Apple: hidden
- Google: hidden unless Google client IDs configured
- Email: visible
- `appEnvironment=staging`
- `activationMode=staging_preview`
- host `zleojeqkzizeyerhjpur.supabase.co`

## Build 114

Do not start until interactive allowlisted + non-allowlisted matrices PASS.
