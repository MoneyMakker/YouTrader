# PPOS-117-19 — Persistence / migration / RLS readiness

**Status:** Staging schema + static gates READY; production apply PENDING explicit PO authorization  
**Reconciled HEAD:** `eccd5e9` (`feature/prop-pass-trading-os-build117`)  
**Date:** 2026-08-03

This note reconciles Build 117 additive persistence work. It does **not** authorize production migration apply, Edge deploy, or App Store / external TestFlight.

## Migration set (additive, ordered)

| File | Role |
|---|---|
| `supabase/migrations/20260802212828_prop_pass_trading_os_persistence.sql` | Core Prop Pass Trading OS tables + owner RLS |
| `supabase/migrations/20260802223818_prop_pass_build117_persistence_hardening.sql` | Hardening tables, processor grants, identity/digest guards |
| `supabase/migrations/20260802225538_prop_pass_journal_automatic_sync.sql` | Journal → Prop Pass sync triggers |
| `supabase/migrations/20260802232311_prop_pass_pipeline_v2_runtime.sql` | `build117.pipeline.v2` stamp |
| `supabase/migrations/20260802233700_prop_pass_runtime_processing_queue.sql` | Processor claim queue (`SKIP LOCKED`) |
| `supabase/migrations/20260802235500_prop_pass_settings_recalculation_events.sql` | Settings-change recalculation events |

Predecessor Prop OS foundation migrations (`20260730*` / `20260731*`) remain prerequisites and are out of this child-task delta.

## Local / static verification (no remote apply)

| Gate | Path / command | Result expected |
|---|---|---|
| Schema + grant/RLS static assertions | `npm run test:prop-pass-persistence-schema` | PASS |
| Adapter contract | `npm run test:prop-pass-persistence-adapter` | PASS |
| Consolidated Trading OS gate (includes both above) | `npm run test:prop-pass-trading-os` | PASS |
| Transactional RLS proof (synthetic users; **rollback**) | `supabase/tests/prop_pass_trading_os_persistence_rls.sql` | Run only on local/staging after migrations; never leave fixtures |

Static schema QA asserts: RLS enable/force, owner `user_id = auth.uid()`, revoke from `public`/`anon`/`authenticated` where required, append-only / idempotency keys, processor functions **not** granted to `authenticated`, no provider/identity tokens in SQL.

## Staging evidence (claimed by backlog; not re-applied here)

- Additive Build 117 persistence migrations are described as **staging-verified** in `docs/BACKLOG.md` (PPOS-117-19).
- RLS proof is designed to create synthetic `auth.users` / rows inside a single transaction and `rollback`.
- Remote staging helpers (`scripts/prop-pass-staging-remote-slice.mjs`, `scripts/prop-pass-staging-full-vertical-slice.ts`) refuse non-staging hosts (`zleojeqkzizeyerhjpur`). Credentials must come from env only.

This reconciliation does **not** re-run remote staging apply. Re-proof staging only when schema files change or PO requests a fresh evidence run.

## Production blockers (explicit)

1. **PO authorization** to apply the migration set to production Supabase (not granted by this doc).
2. Confirm production has Prop OS foundation migrations already applied (pre-Build-117 prerequisites).
3. Apply Build 117 additive set in order; do not rewrite history or squash applied migrations.
4. Re-run transactional RLS proof on a **non-production** clone or staging after any SQL change; production RLS proof must use disposable synthetic users only if PO authorizes — prefer staging.
5. Edge / processor deploy is a separate gate; do not bundle with silent migration apply.
6. App identity remains **1.6.1 / build 116** until archive bump to **117** is explicitly authorized later in the epic.

## Intentionally out of scope here

- Capital preservation **persisted** component wiring (PPOS-117-13 remainder) — requires real compliance facts, not invented scores.
- Archive 117, TestFlight, Apple `stored:true`, subscription matrix, App Store Review.
- Production `supabase db push` / dashboard apply from this agent session.

## Next recommended step

After PO green-light for **staging re-proof** (optional if files unchanged) or **production apply**: record evidence path + commit hash, then mark PPOS-117-19 production deployment DONE and continue PPOS-117-20 final gates / device QA blockers.
