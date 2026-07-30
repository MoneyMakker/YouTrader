# Prop Pass — Internal Account & Challenge Setup (Phase 2B)

**Status:** READY FOR FINAL REVIEW (security remediation)  
**Depends on:** Phase 2A FINAL APPROVED (`b072f52`)  
**Baseline feature commit:** `932e9e9`  
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

Three verified internal templates in `src/propOs/templates/` — not comprehensive firm coverage. Rule snapshots are immutable copies. Provenance via `listTemplateProvenance()` (template ID, version, firm/program, effective date, evidence, date verified, verified fields, unsupported fields, sizes). Catalogue N+1 must not mutate existing snapshots.

## Activation / App gate

Local/staging + `internal_read_only` | `staging_preview` + App allowlist. Production / off → entry hidden.

**App UI visibility is not authoritative for mutations.**

## Server command boundary (hardening)

Migration: `supabase/migrations/20260730230000_prop_os_command_boundary_hardening.sql` — **do not apply to production** without Ops approval.

| Control | Behavior |
| --- | --- |
| `prop_os_command_gate.commands_enabled` | Authoritative kill switch (local/staging). When `false`, no new mutation command begins. Reads unaffected. History not deleted. Re-enable needs no data repair. |
| `prop_os_command_allowlist` | Server-side eligibility. Authenticated non-members → `forbidden`. Removal blocks the next command immediately. No App/DML forge path. |
| Actor | Exclusively `auth.uid()` via `prop_os_cmd_assert_authorized()`. Client cannot override `user_id`. Null uid → forbidden. |
| Privileges | `EXECUTE` revoked from `PUBLIC`/`anon`; mutation cmds granted to `authenticated` only. Admin gate/allowlist helpers: `service_role`/`postgres` only. |
| `search_path` | Every SECURITY DEFINER cmd: `pg_catalog, public`. Schema-qualified table/helper refs. |
| Errors | Catch → `{ kind: 'forbidden' \| 'unexpected_error' \| ... }` — no SQLSTATE/DETAIL leak to clients. |
| Attempt numbers | `prop_challenges.attempt_number` + unique `(account_id, attempt_number)`. |
| Receipts | Written only after mutations; success never reported before commit of the command subtransaction. |

### Mid-flight kill-switch policy

Authorization (gate + allowlist + `auth.uid()`) is evaluated **once at command entry**.

If the gate flips to disabled **during** an already-running command transaction:

- the in-flight command **commits atomically under its initial authorization**, or
- on any failure, the PL/pgSQL exception handler aborts the function subtransaction — **zero partial rows**.

Partial mutation is forbidden. The next command after disable is rejected.

## Migrations (prepare only)

1. `20260730220000_prop_os_internal_commands.sql`
2. `20260730230000_prop_os_command_boundary_hardening.sql`

Do **not** apply to production without separate Ops approval.

## QA

```bash
node --experimental-strip-types --experimental-transform-types scripts/prop-os-command-hardening-static-qa.ts
bash scripts/prop-pass-phase2b-hardening-pg-qa.sh
npm run test:prop-pass-phase2b
npm run test:prop-pass-phase2b-pg
npm run test:prop-pass-phase2a
npm run test:prop-pass-live-slice
```

## Forbidden (still)

Production apply, public nav, trade assignment UI, broker, Pass Probability, AI, Decision Engine, next roadmap phase.

## Waiting for

Product Owner **FINAL** review.
