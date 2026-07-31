# Prop Pass — Trade Assignment UX (Phase 2C)

**Status:** READY FOR FINAL REVIEW (remediation)  
**Depends on:** Phase 2B FINAL APPROVED (`932e9e9`, `f835995`)  
**Baseline feature commit:** `edccec1`  
**Remediation:** trusted recalculation + canonical identity + consistency proofs  
**Package:** `src/propOs/assignments/`, Prop Pass assignment UI  
**Mutation boundary (App):** `prop_os_cmd_assign_trades` / `reassign_trades` / `remove_trade_assignments`  
**Trusted processor only:** `prop_os_cmd_complete_recalculation` / `prop_os_cmd_fail_recalculation` / `prop_os_cmd_processor_mark_recalc_running`

## Boundary

```text
YouTrader trade (immutable facts)
  → Prop OS assignment event (append-only)
  → current projection (prop_trade_assignments)
  → optional immutable execution refs for engine input
  → trusted recalculation processor (assignmentRevision)
  → versioned snapshots
  → Prop Pass read model
```

Original journal P&L / timestamps / instruments are never mutated by assignment.

## Canonical trade identity

| Layer | Field | Role |
| --- | --- | --- |
| DB PK | `trade_journal.id` (uuid) | Canonical journal trade primary key |
| Provenance alias | `trade_journal.client_id` | Owner-scoped UNIQUE; immutable after insert; App `Trade.id` for command payloads |
| Event FK | `prop_trade_assignment_events.journal_trade_id` | → `trade_journal.id` |
| Event FK | `(user_id, trade_client_id)` | → `trade_journal(user_id, client_id)` |

Soft-deleted (`deleted_at IS NOT NULL`) → unsupported for assignment.  
Cross-user `client_id` collision → owner-scoped lookup fails; no access grant.  
See `src/propOs/assignments/identityContract.ts`.

## Trusted recalculation processor

Roles permitted to complete/fail recalculation:

- `postgres`
- `service_role`
- `prop_os_recalc_processor`

`PUBLIC` / `anon` / App `authenticated` — **EXECUTE revoked**.  
React / App command gateway must not expose complete/fail.  
Owner id and assignment revision are derived from `prop_challenges` + `prop_os_challenge_recalc`; client claims must match server-owned revision. Completion requires engine + score snapshots with `input_revision` prefix `asg-rev-{N}:`. Failed recalculation does not promote snapshots. Prior snapshot while queued/running/failed is exposed as **outdated**, not current.

## Consistency model

1. Assignment command commits first (events + projection + revision bump + recalc `queued`) — one transaction.
2. Trusted processor reads exactly queued revision N, runs production `calculateChallenge`, writes versioned snapshots, completes N.
3. Completing N after N+1 is current → `stale_recalculation`.
4. Retry for the same assignment revision / request id is idempotent.
5. Projection rebuild: `prop_os_assignment_rebuild_projection` / parity via `prop_os_assignment_projection_parity`.

## Bulk semantics

- Max **50** selected trades per command (`ASSIGNMENT_BULK_MAX`).
- Valid bulk ops are **atomic** (all-or-nothing).
- No silent partial success; invalid trades rejected before mutate or whole command rolls back.
- Duplicate trade IDs in one request are normalized (`DISTINCT` ordered).
- Select-all operates only on the visible filtered result (UI).
- Double submission remains idempotent via command receipts.

## Migrations (prepare only)

- `supabase/migrations/20260730240000_prop_os_trade_assignment_commands.sql`
- `supabase/migrations/20260730250000_prop_os_assignment_recalc_hardening.sql`

**Do not apply to production** without Ops approval.

## Forbidden (still)

Public nav, auto-assign, legacy bulk backfill, brokers, Performance Intelligence, Pass Probability, Decision Replay, Smart Intervention, production rollout. App users must not receive recalculation-completion privileges.

## Waiting for

Product Owner FINAL review.
