# PPOS-117 — Final staging migration readiness checkpoint

**Reconciled HEAD:**  ()  
**Date:** 2026-08-04  
**Production project ref:** `izzrlsgumyabdvlmwlwn`  
**Staging project ref:** `zleojeqkzizeyerhjpur`  
**Production touched:** NO  

This packet stops at the migration approval checkpoint. It does **not** authorize
production apply, Edge deploy, archive creation, TestFlight upload, or Build 118.

## Migration set (SHA-256)

| File | SHA-256 |
|---|---|
| `20260802212828_prop_pass_trading_os_persistence.sql` | `9b0edf1b2eab15201c17806a93a7a0a17e026433cb1718e4011c06e3b14f2059` |
| `20260802223818_prop_pass_build117_persistence_hardening.sql` | `d1a4037e60a18fb80c7f5c3d775788fdcde24a83d58bcda536411690c8eb19fe` |
| `20260802225538_prop_pass_journal_automatic_sync.sql` | `f7ca73e3ba681c898ada9529674598f9190b4b2e013b815e5d14eaf0d66947fe` |
| `20260802232311_prop_pass_pipeline_v2_runtime.sql` | `bac3bca3951bbab11848a8bcd38bd1ed272b479f20b6390ff809364f43b6ea6d` |
| `20260802233700_prop_pass_runtime_processing_queue.sql` | `ecd79a18e68fef367a176cb08d602b237f6b4d2cf2cd5172affdf62e1fa5e09c` |
| `20260802235500_prop_pass_settings_recalculation_events.sql` | `724672da606c1aab21bba7b5b9f2e11113b80c4ad1a52f01edfe356dca5c3e9a` |

Primary journal sync migration:  
`20260802225538_prop_pass_journal_automatic_sync.sql`  
SHA-256: `f7ca73e3ba681c898ada9529674598f9190b4b2e013b815e5d14eaf0d66947fe`  
**(unchanged)**

## Exact previous SKIP cause

**Classification:** disposable account missing required rule configuration.

The Journal staging harness intentionally omitted `prop_challenge_rule_snapshots`
so disposable cleanup would not hit `ON DELETE RESTRICT`. The real Edge
processor `loadBundle()` **requires** that snapshot (`rules_read_failed:not_found`
otherwise), so events could be claimed/failed but **`prop_account_runtime_states`
was never written**. Processor HTTP 200 with applied work was therefore not
sufficient without the rule fixture.

## Fixture requirements (verified repo shape)

- disposable owner + second user;
- Prop Pass account (`apex-demo` / America/Chicago);
- Challenge (`evaluation`) **and** Live (`funded`) contexts;
- immutable `prop_challenge_rule_snapshots` using the verified slice shape
  (`profitTargetMinor`, `dailyLossLimitMinor`, static `drawdown.amountMinor`, …);
- immutable Daily Plan snapshot where required;
- assigned Journal trade (`LONG` / MES) with material revision bump;
- Live risk settings for the funded account.

## Processor / runtime evidence

Rerun command:

```bash
npm run test:prop-pass-runtime-state-staging
```

Sanitized evidence:

- `docs/releases/1.6.1/evidence/RUNTIME_STATE_STAGING_LATEST.json`

| Check | Result |
|---|---|
| Processor execution | PASS |
| Event consumed exactly once | PASS |
| Runtime-state write | PASS |
| Runtime save projection | PASS |
| Runtime edit projection | PASS |
| Runtime delete projection | PASS |
| Hard risk rooms | PASS |
| Risk Meter projection | PASS |
| Challenge lifecycle projection | PASS |
| Live lifecycle projection | PASS |
| Session Cockpit persisted read (owner JWT select) | PASS |
| Network retry / empty re-claim | PASS |
| Duplicate delivery no digest drift | PASS |
| Reload convergence | PASS |
| Cross-user runtime denial | PASS |
| Direct client write denial | PASS |
| Staging cleanup (mutable + scrubbed identities) | PASS |

## Additive / destructive assessment

- Additive-only Build 117 Prop Pass persistence set: **YES**
- Destructive `DROP TABLE` / `TRUNCATE` / `DELETE FROM` / column drops in `202608022*` Prop Pass set: **NO**
- Indexes / unique idempotency / owner RLS / processor grant denials: `npm run test:prop-pass-persistence-schema` → **PASS**

## Rollback plan

Documented in `PPOS-117-19_MIGRATION_READINESS.md` — kill-switch first, prefer
forward-fix, staging reverse-drop order for non-production only.
**READY** (document only; do not execute without PO).

## Synthetic production QA / cleanup

1. Disposable users only; refuse non-staging hosts.
2. Include rule snapshots; scrub auth identities when append-only residuals block delete.
3. Confirm 0 active disposable emails, 0 mutable trades/events/assignments/runtime rows.
4. Production apply only after explicit PO approval.

---

PRODUCTION MIGRATION READY: YES  
EXPLICIT PO APPROVAL REQUIRED: YES
