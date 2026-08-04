# PPOS-117-19 — Persistence / migration / RLS readiness

**Status:** Staging schema + static gates READY; journal remote sync/retry PASS; runtime-state projection PASS (`prop_account_runtime_states` via real processor); **expanded production migration set identified but PRODUCTION MIGRATION READY = NO** until clean prod-baseline staging rehearsal + explicit PO auth for all 16 files  
**Reconciled HEAD:** see latest commit on `feature/prop-pass-trading-os-build117`  
**Date:** 2026-08-04  
**Checkpoint:** see `docs/releases/1.6.1/PPOS-117_EXPANDED_PRODUCTION_MIGRATION_APPROVAL.md`  
**Prior narrow apply:** BLOCKED — `PPOS-117_PRODUCTION_MIGRATION_RESULT.md`  
**Runtime proof:** `npm run test:prop-pass-runtime-state-staging`  
**Build 116 compat (live staging):** `npm run test:prop-pass-build116-compat-staging`

This note reconciles Build 117 additive persistence work. It does **not** authorize production migration apply, Edge deploy, or App Store / external TestFlight.

## Expanded migration set (exact; see approval doc)

Production lacks Prop OS foundation. The complete ordered set is **16 exact filenames**
documented with SHA-256 in
`docs/releases/1.6.1/PPOS-117_EXPANDED_PRODUCTION_MIGRATION_APPROVAL.md`
(Prop OS `20260730190000` … `20260731290000` + Prop Pass `20260802212828` …
`20260802235500`). Do not use wildcards. Do not re-apply production
`auth_provider_tokens` (production stamp `20260802001324`).

## Build 117 child-task delta (additive after foundation)

| File | Role |
|---|---|
| `supabase/migrations/20260802212828_prop_pass_trading_os_persistence.sql` | Core Prop Pass Trading OS tables + owner RLS |
| `supabase/migrations/20260802223818_prop_pass_build117_persistence_hardening.sql` | Hardening tables, processor grants, identity/digest guards |
| `supabase/migrations/20260802225538_prop_pass_journal_automatic_sync.sql` | Journal → Prop Pass sync triggers |
| `supabase/migrations/20260802232311_prop_pass_pipeline_v2_runtime.sql` | `build117.pipeline.v2` stamp |
| `supabase/migrations/20260802233700_prop_pass_runtime_processing_queue.sql` | Processor claim queue (`SKIP LOCKED`) |
| `supabase/migrations/20260802235500_prop_pass_settings_recalculation_events.sql` | Settings-change recalculation events |

Predecessor Prop OS foundation migrations (`20260730*` / `20260731*`) are **in-scope
prerequisites for production** and are listed individually in the expanded approval.

## Local / static verification (no remote apply)

| Gate | Path / command | Result expected |
|---|---|---|
| Schema + grant/RLS static assertions | `npm run test:prop-pass-persistence-schema` | PASS |
| Adapter contract | `npm run test:prop-pass-persistence-adapter` | PASS |
| Consolidated Trading OS gate (includes both above) | `npm run test:prop-pass-trading-os` | PASS |
| Journal automatic sync QA | `npm run test:prop-pass-journal-sync` (in trading-os gate) | PASS |
| Challenge + Live lifecycle QA | `npm run test:prop-pass-lifecycle` + challenge/live integration (in trading-os gate) | PASS |
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

## Rollback and cleanup plan (document only — do not execute without PO)

### Principles

- Prefer **App/config kill-switch first** over database surgery.
- Prefer **forward-fix** migrations over dropping applied production objects.
- Never delete user journal rows, `prop_accounts`, or historical append-only events as a “cleanup”.
- Never leave synthetic RLS-proof users/rows (proof SQL must end in `rollback`).
- Production drop/alter of Build 117 objects requires a separate PO-authorized ops window.

### Immediate client / edge containment (safe first response)

1. Disable Prop Pass / Prop OS activation path via existing kill-switch / activation mode (`off`) so new reads stop.
2. Stop processor Edge Functions / cron that claim `prop_processed_journal_events` if they were deployed with this set.
3. Leave applied tables intact; do not rewrite migration history or force-push tags.

### Staging / local SQL rollback (non-production only)

Use only after kill-switch and only on **non-production**. Order is reverse of apply:

1. Drop journal sync triggers/functions from `20260802225538_*` (`prop_pass_journal_*`, assignment ledger trigger).
2. Drop pipeline stamp trigger/function from `20260802232311_*`.
3. Revoke/drop processor claim helpers from `20260802233700_*` / `20260802235500_*` / hardening processor RPCs.
4. Drop Build 117 tables created by hardening then base persistence (owner-scoped):
   - hardening: `prop_instrument_spec_versions`, `prop_intervention_overrides`, `prop_decision_replays`, `prop_processed_journal_events`, `prop_account_runtime_states`
   - base: `prop_daily_plan_snapshots`, `prop_pre_trade_assessments`, `prop_rule_templates`, `prop_intervention_events`, `prop_timeline_events`, `prop_live_risk_settings`, `prop_payout_withdrawal_settings`, `prop_kill_switch_settings`, `prop_position_size_progressions`, `prop_recovery_mode_states`
5. Drop shared helpers only if unused (`prop_os_enforce_trading_os_owner`, append-only forbid helper).
6. Re-run `npm run test:prop-pass-persistence-schema` expectations against the **remaining** schema; do not claim PASS if SQL files still expect dropped objects.

Do **not** reverse Prop OS foundation (`20260730*` / `20260731*`) as part of this child task.

### Production rollback posture

If Build 117 migrations were applied to production and a defect appears:

1. Kill-switch / disable processors immediately.
2. Keep tables and RLS; quarantine writes via processor stop + client off.
3. Ship a **new additive** forward-fix migration (PO-approved) rather than DROP TABLE in place.
4. DROP TABLE on production is last resort, PO-only, with backup verification and restore drill evidence.

### Cleanup after failed or aborted apply

| Situation | Cleanup |
|---|---|
| Migration partially applied on staging | Fix forward or reverse-drop only the new objects listed above; re-apply cleanly |
| RLS proof interrupted mid-transaction | Rely on transaction abort/`rollback`; verify no synthetic emails `@example.invalid` remain |
| Staging seed / remote slice leftovers | Use staging-only seed/reset scripts; refuse non-staging hosts |
| Client caches after schema abort | Explicit logout / local Prop Pass cache clear paths already used by auth logout hardening |

## Intentionally out of scope here

- Capital preservation **persisted** component wiring (PPOS-117-13 remainder) — requires real compliance facts, not invented scores.
- Archive 117, TestFlight, Apple `stored:true`, subscription matrix, App Store Review.
- Production `supabase db push` / dashboard apply from this agent session.

## Next recommended step

After **complete Aikido PASS** on latest HEAD, mandatory security gates PASS, staging RLS proof PASS, journal + Challenge/Live lifecycle integration complete, and **explicit PO authorization**: apply production migrations with this rollback plan in hand, record evidence path + commit hash, then continue PPOS-117-20 / device QA blockers.
