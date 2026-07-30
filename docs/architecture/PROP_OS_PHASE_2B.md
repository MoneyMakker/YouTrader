# Prop Pass — Internal Account & Challenge Setup (Phase 2B)

**Status:** READY FOR REVIEW  
**Depends on:** Phase 2A FINAL APPROVED (`b072f52`)  
**Package:** `src/propOs/commands/`, `src/propOs/templates/`, Prop Pass onboarding UI  
**Mutation boundary:** `prop_os_cmd_*` SECURITY DEFINER RPCs (authenticated session only)

## Read / write split

- `PropOsAccountReadStore` — SELECT-only (Prop Pass UI / activation)
- `PropOsAccountWriteService` — typed commands via App command gateway
- Authenticated read transport remains SELECT-only
- React never receives service-role

## Commands

`createPropAccount`, `createChallengeAttempt`, `setDefaultAccount`, `archivePropAccount`, `selectActiveChallenge`, `clearActiveChallengeSelection`

Idempotency: `(user_id, client_request_id)` receipts + request hash.

## Templates

Three verified internal templates in `src/propOs/templates/` — not comprehensive firm coverage. Rule snapshots are immutable copies.

## Activation gate

Local/staging + `internal_read_only` | `staging_preview` + allowlist. Production / off → forbidden; entry hidden.

## Migration

`supabase/migrations/20260730220000_prop_os_internal_commands.sql` — **do not apply to production** without Ops approval.

## QA

```bash
npm run test:prop-pass-phase2b
npm run test:prop-pass-phase2b-pg
npm run test:prop-pass-phase2a
npm run test:prop-pass-live-slice
```

## Forbidden (still)

Production apply, public nav, trade assignment UI, broker, Pass Probability, AI, Decision Engine, next roadmap phase.

## Waiting for

Product Owner review.
