# Phase 1A — Additive Database Foundation

**Status:** CONDITIONALLY APPROVED → live validation complete; awaiting FINAL APPROVAL  
**Baseline commit:** `cc9ed42`  
**Live validation:** [`PROP_OS_PHASE_1A_LIVE_VALIDATION.md`](./PROP_OS_PHASE_1A_LIVE_VALIDATION.md)  
**Contract:** [`PROP_OS_PHASE_1A_MIGRATION_CONTRACT.md`](./PROP_OS_PHASE_1A_MIGRATION_CONTRACT.md)  
**Rollback:** [`PROP_OS_PHASE_1A_ROLLBACK.md`](./PROP_OS_PHASE_1A_ROLLBACK.md)

## Delivered

| Artifact | Path |
|---|---|
| Additive migration | `supabase/migrations/20260730190000_prop_os_database_foundation.sql` |
| Live SQL tests (local/CI) | `supabase/tests/prop_os_phase1a_schema_rls.sql`, `supabase/tests/prop_os_phase1a_live_assertions.sql` |
| Live validation runner | `scripts/prop-os-phase1a-live-validate.sh` |
| Live validation report | [`PROP_OS_PHASE_1A_LIVE_VALIDATION.md`](./PROP_OS_PHASE_1A_LIVE_VALIDATION.md) |
| Static contract QA | `scripts/prop-os-schema-static-qa.ts` |
| DB types generator (SQL parse, secondary) | `scripts/generate-prop-os-db-types.ts` |
| DB types generator (live DB, primary) | `scripts/generate-prop-os-db-types-live.ts` |
| Schema drift check | `scripts/prop-os-schema-drift-qa.ts` |
| Generated types | `src/types/propOsDatabase.ts` |

## Tables (12)

`prop_accounts`, `prop_challenges`, `prop_challenge_rule_snapshots`, `prop_trade_assignments`, `prop_executions`, `prop_account_events`, `prop_challenge_transitions`, `prop_engine_snapshots`, `prop_score_snapshots`, `prop_violation_records`, `prop_data_quality_flags`, `prop_correction_events`

## Security

- RLS enabled + forced on all Prop OS tables  
- **Zero** policies for `anon` / `authenticated` (deny-by-default; inert to App)  
- DML granted to `postgres` / `service_role` only  
- Immutable triggers: rule snapshots, account events, transitions, engine/score snapshots, correction events  
- Append-only DELETE bans: challenges, executions, violation records  
- Owner checks: challenge↔account, assignment↔account/challenge  
- No legacy trade assignment / no journal ALTER

## Explicit non-goals (still true)

No App wiring, no `src/propOs` import, no backfill, no shadow, no Prop Pass UI, no navigation/AI/RevenueCat changes.

## Validation notes

- Static contract QA runs without Docker.  
- Live migration apply + RLS SQL tests require local Supabase/Postgres (Docker). If unavailable in the agent environment, results are reported as **NOT RUN** with reason — not as PASS.
