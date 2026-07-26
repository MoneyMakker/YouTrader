# Security Architecture

This document summarizes the implementation model. Detailed historical controls are in [SECURITY_HARDENING.md](./SECURITY_HARDENING.md); task workflow is in [AGENTS.md](../AGENTS.md).
Security task sequencing and readiness are recorded in [BACKLOG.md](./BACKLOG.md).

## Authentication and Sessions

Supabase Auth supports Apple, Google, and email flows. Native persisted sessions use SecureStore with a fail-safe legacy migration. Never expose session, refresh, provider, or service-role secrets in logs or clients.

## Authorization and Database

User-facing Supabase tables use RLS and ownership predicates. Edge Functions validate JWTs, then authorize the verified user against the requested resource. Service-role clients are server-only and must use minimal table grants.

## Storage and Media

User media buckets are private. Paths are user-scoped; secure uploads validate names, MIME types, extensions, magic bytes, sizes, and ownership. Protected media must use short-lived signed URLs and cross-user negative tests.

## AI, Quota, and Rate Limiting

AI provider keys remain in Edge Function secrets. Protected AI actions require server-side entitlement and quota checks. Quota failures must fail closed with a generic error before provider calls. Client-side limits improve UX but are never authorization.

## Audit Logging and Privacy

Authoritative security events are server-generated, append-only, and must exclude prompts, tokens, secrets, and private trading content. Telemetry uses privacy-safe metadata only. Privacy manifests, App Store disclosures, and analytics configuration must remain aligned.

## Known Assumptions

- Supabase policies, buckets, and Edge Function deployment settings must be verified against the target environment before release.
- Service-role permissions are least-privilege and never shipped to Expo clients.
- Production backup/PITR and restore drills are operational controls that require external verification.

## Security Change Workflow

1. Read migrations, policies, functions, and current grants.
2. Prefer forward-only migrations; never edit applied history.
3. Add authorization and negative-access tests.
4. Check `SECURITY DEFINER` ownership, fixed search path, execution grants, and rollback.
5. Run typecheck, security scans, Gitleaks, relevant tests, and environment-specific validation.
6. Do not apply migrations or deploy without explicit approval.
