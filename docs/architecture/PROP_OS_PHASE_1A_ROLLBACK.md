# Phase 1A — Rollback & Operations

**Schema:** `prop-os-schema-v0`  
**Migration:** `supabase/migrations/20260730190000_prop_os_database_foundation.sql`

## Preferred rollback (production-safe)

1. Keep tables in place.  
2. Do **not** delete user journal data.  
3. Ensure App continues to ignore Prop OS tables (Phase 1A default).  
4. Disable any future feature flags that would read/write these tables (none in 1A).

This restores product behavior without destructive DDL.

## Emergency DDL rollback (empty / pre-activation only)

Only when tables contain **no** user-valued rows (or explicit ops approve):

```sql
-- Order respects FKs / restrict deletes
drop table if exists public.prop_correction_events cascade;
drop table if exists public.prop_data_quality_flags cascade;
drop table if exists public.prop_violation_records cascade;
drop table if exists public.prop_score_snapshots cascade;
drop table if exists public.prop_engine_snapshots cascade;
drop table if exists public.prop_challenge_transitions cascade;
drop table if exists public.prop_account_events cascade;
drop table if exists public.prop_executions cascade;
drop table if exists public.prop_trade_assignments cascade;
drop table if exists public.prop_challenge_rule_snapshots cascade;
drop table if exists public.prop_challenges cascade;
drop table if exists public.prop_accounts cascade;

drop function if exists public.prop_os_forbid_mutation() cascade;
drop function if exists public.prop_os_forbid_delete() cascade;
drop function if exists public.prop_os_enforce_challenge_account_owner() cascade;
drop function if exists public.prop_os_enforce_assignment_owner() cascade;
drop function if exists public.prop_os_enforce_challenge_no_silent_overwrite() cascade;
```

**Never** drop or truncate `trade_journal`, `prop_firms`, `user_firm_settings`, `risk_snapshots`, or media tables as part of Prop OS rollback.

## What rollback must not do

- Delete or rewrite journal trades  
- Auto-unassign by destroying audit history without replacement  
- Remove auth users  
- Rely on “delete everything new” once real accounts exist — prefer flag disable

## Apply policy

- Local / preview: allowed after PO review of Phase 1A  
- Production: **not** in this phase’s agent workflow — requires explicit ops approve
