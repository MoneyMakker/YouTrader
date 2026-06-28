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

