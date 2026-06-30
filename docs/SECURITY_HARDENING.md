# YouTrader Security Hardening

This pass adds free security controls for React Native + Expo + Supabase + RevenueCat without adding paid services.

## Implemented In App

- Central limits in `src/security/securityConfig.ts`
- Local rate limiting for:
  - auth attempts
  - trade create/update/delete
  - screenshot and voice note attachment
  - CSV import
  - export generation
  - purchase and restore attempts
- Local idempotency protection for sensitive repeated actions.
- Strict trade input validation and sanitization before local save and Cloud Sync.
- CSV size and row-count limits.
- Upload size limits for screenshots and voice notes.
- Request timeout handling for Supabase Cloud Sync and RevenueCat calls.
- Safer user-facing error messages for auth, cloud sync, purchase, restore, import, and export failures.
- Local security event logging without sensitive raw data.

## Implemented In Supabase Migration

Migration: `supabase/migrations/202606280002_security_hardening.sql`

- `idempotency_keys`
- `request_limits`
- `security_events`
- RLS on security tables.
- RPC helpers:
  - `security_log_event`
  - `security_consume_request_limit`
  - `security_claim_idempotency_key`
- Trade validation trigger for `trade_journal`.
- Private storage buckets:
  - `user-screenshots`
  - `user-voice-notes`
  - `user-exports`
  - `user-attachments`
- Storage policies requiring paths to begin with the authenticated `user_id`.


## Secure Upload System

Current and future cloud uploads must use `secureUploadFile` from `src/security/uploadSecurity.ts` and the Supabase Edge Function `supabase/functions/secure-upload`. Do not call `supabase.storage.from(...).upload(...)` directly from the mobile app for user files.

The secure upload path enforces:

- Original filenames are validated but never trusted for storage paths.
- Server-generated UUID filenames only.
- Safe paths under `<user_id>/screenshots`, `<user_id>/voice-notes`, `<user_id>/exports`, or `<user_id>/csv`.
- No custom client folders.
- No `../`, `..\`, null bytes, control characters, path separators, or unicode normalization traversal tricks.
- MIME allowlists per category.
- Extension must match MIME type.
- File size limits: screenshots 10 MB, voice notes 25 MB, exports 10 MB, CSV 10 MB.
- SHA-256 duplicate detection for the same user/category within a short window.
- Suspicious upload events are logged without file contents.

Deploy the Edge Function after applying migrations:

```bash
supabase functions deploy secure-upload
```

Required Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Manual Supabase Steps

1. Apply migrations in order:

```bash
supabase db push
```

Or paste the SQL into the Supabase SQL editor.

2. Verify Storage buckets are private:

- `user-screenshots`
- `user-voice-notes`
- `user-exports`
- `user-attachments`

3. Store files only under authenticated user folders:

```text
<user_id>/screenshots/...
<user_id>/voice-notes/...
<user_id>/exports/...
<user_id>/attachments/...
```

4. Keep `SUPABASE_SERVICE_ROLE_KEY` out of Expo/EAS public env variables.

5. For true IP-based throttling, route future server actions through Supabase Edge Functions or another server endpoint and call `security_consume_request_limit` there. The mobile client cannot reliably know the public IP.

## Remaining Risks

- Client-side rate limiting can be bypassed by a modified client; Supabase RLS and DB triggers are the authoritative controls.
- RevenueCat purchase/restore still uses the client SDK. For stronger entitlement enforcement around future server features, verify entitlement server-side before granting server resources.
- Current screenshot and voice note attachments are local URIs unless future cloud upload is added; storage policies are ready for secure cloud uploads.
- IP-based bot protection requires a server/Edge layer because mobile apps do not have trustworthy client-side IP identity.

## Security Advisor Function Hardening (2026-06-30)

Migration: `supabase/migrations/202606300001_harden_security_function_search_paths.sql`

This migration addresses Supabase Security Advisor warnings for:

- `public.security_validate_trade_journal`
- `public.security_validate_upload_metadata`
- `public.security_claim_idempotency_key`
- `public.security_consume_request_limit`
- `public.security_log_event`

Changes:

- Sets explicit `search_path = public, pg_catalog` on affected functions.
- Revokes direct `EXECUTE` from `public`, `anon`, and `authenticated` for trigger-only validation functions.
- Revokes direct client RPC access for affected security-definer helper functions.
- Preserves `service_role` access for backend/Edge Function workflows.
- Preserves `security_consume_request_limit_for_actor` for the secure-upload Edge Function with service-role-only execution.

Apply to Supabase with:

```bash
supabase db push
```

After deployment, rerun Supabase Security Advisor. Client-side local rate limiting and idempotency remain active; privileged request limiting should run through service-role Edge Functions.


## Production Security Audit Addendum (2026-06-30)

### Edge Function CORS

- Production Edge Functions must not use wildcard CORS.
- `_shared/cors.ts`, `ai-coach`, and `secure-upload` now use an origin allowlist.
- Set the optional Supabase Edge Function secret `ALLOWED_ORIGINS` to a comma-separated list, for example:

```text
https://youtrader.app,https://www.youtrader.app
```

Native Expo/iOS requests usually do not send a browser `Origin`; those continue to work while browser-based calls are constrained to the allowlist.

### Secrets And AI Agent Safety

- `npm run security:check` scans tracked files for Supabase secret keys, service-role JWTs, private key blocks, private AI keys, RevenueCat/webhook secret assignments, GitHub tokens, and Slack tokens.
- Do not paste service role keys, webhook secrets, private Apple keys, RevenueCat secrets, or `.env` files into AI chats.
- Review agents should use read-only database access. Production write access requires human approval.
- Do not put private server keys in `EXPO_PUBLIC_*` variables.

### Environments

- Local: developer `.env` only, never committed.
- Staging/sandbox: separate Supabase and RevenueCat/App Store sandbox credentials.
- Production: human-reviewed deploys only; verify branch, latest commit, migrations, and secrets before `supabase db push` or release builds.

### Backups And Recovery

- Verify Supabase production backups/PITR in the Supabase dashboard according to the project plan.
- Test restore into a non-production project before relying on backups for releases.
- Keep storage cleanup aligned with user data deletion; user upload buckets are private and path-scoped by user id.
- Rotate production secrets every 90 days and immediately after suspected exposure.

### GDPR And Account/Data Deletion

- Users must be able to export their journal data before deletion when applicable.
- Account deletion should remove or anonymize user-owned journal rows, uploads metadata, screenshots, voice notes, exports, idempotency keys, request limits, and security events where legally appropriate.
- Storage cleanup should delete files under the user's `<user_id>/...` prefixes in private buckets.
- Payment/subscription records may need retention for fraud, tax, or App Store/RevenueCat reconciliation; document retention before adding automated deletion.

### Webhooks And Payments

- RevenueCat/App Store webhook handlers must validate provider signatures before changing entitlement state.
- Test webhook endpoints must not be able to mutate production subscription data.
- Payment entitlement changes should be logged without raw webhook secrets or full payment payloads.
