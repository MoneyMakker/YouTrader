# Prop Pass — Trade Assignment UX (Phase 2C)

**Status:** READY FOR REVIEW  
**Depends on:** Phase 2B FINAL APPROVED (`932e9e9`, `f835995`)  
**Package:** `src/propOs/assignments/`, Prop Pass assignment UI  
**Mutation boundary:** `prop_os_cmd_assign_trades` / `reassign_trades` / `remove_trade_assignments`

## Boundary

```text
YouTrader trade (immutable facts)
  → Prop OS assignment event (append-only)
  → current projection (prop_trade_assignments)
  → optional immutable execution refs for engine input
  → shadow recalculation (assignmentRevision)
  → versioned snapshots
  → Prop Pass read model
```

Original journal P&L / timestamps / instruments are never mutated by assignment.

## Consistency model

1. Assignment command commits first (events + projection + revision bump + recalc `queued`).
2. Recalculation runs deterministically for affected challenge(s).
3. UI shows `recalculation_pending` / `snapshot_outdated` until a compatible snapshot exists for the current assignment revision.
4. Previous valid snapshot may remain visible but must be marked outdated — never silently current.

Mid-flight kill-switch / allowlist: same Phase 2B policy (authorize once at entry; atomic commit or full rollback).

## Lifecycle rules

| Challenge status | New assignment |
| --- | --- |
| `active`, `at_risk` | allowed |
| `breached`, `passed`, `funded`, `reset`, `abandoned` | rejected |
| account `archived` / `closed` | rejected |

Reassignment: supersede prior event, append new `assigned`, recalc both challenges when destinations differ.

Removal: append `removed` (or supersede + removed); trade untouched; history preserved.

## Migrations (prepare only)

`supabase/migrations/20260730240000_prop_os_trade_assignment_commands.sql` — **do not apply to production** without Ops approval.

## Forbidden (still)

Public nav, auto-assign, legacy bulk backfill, brokers, Performance Intelligence, Pass Probability, Decision Replay, Smart Intervention, production rollout.

## Waiting for

Product Owner review.
