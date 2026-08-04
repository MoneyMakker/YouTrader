# PPOS-117 — Final staging migration readiness checkpoint

**Reconciled HEAD:** `cbc75ac` (`feature/prop-pass-trading-os-build117`)  
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

Primary journal sync migration for this checkpoint:  
`20260802225538_prop_pass_journal_automatic_sync.sql`  
SHA-256: `f7ca73e3ba681c898ada9529674598f9190b4b2e013b815e5d14eaf0d66947fe`

## Additive / destructive assessment

- Additive-only Build 117 Prop Pass persistence set: **YES**
- Destructive `DROP TABLE` / `TRUNCATE` / `DELETE FROM` / column drops in `202608022*` Prop Pass set: **NONE found**
- Indexes / unique idempotency keys / owner RLS / processor grant denials: asserted by `npm run test:prop-pass-persistence-schema` → **PASS**

## Gate results

| Gate | Result |
|---|---|
| Capital Preservation persisted evidence | PASS (`aeb1fd0` + cockpit wiring `cbc75ac`) |
| Journal remote staging save/edit/delete | PASS |
| Remote network retry / duplicate delivery | PASS |
| Reload convergence | PASS |
| Cross-user denial | PASS |
| Multi-account isolation | PASS |
| Staging cleanup (mutable + scrubbed identities) | PASS |
| Challenge lifecycle | PASS |
| Live lifecycle | PASS |
| Session Cockpit real pipeline + insufficient evidence UI | PASS |
| Logout → auth chooser (never paywall) | PASS |
| Trading-day / timezone engine | PASS |
| Staging RLS (owner isolation / direct write denial / token read denial) | PASS |
| Old-user compatibility | PASS (additive schema; no rewrite of existing journal columns beyond nullable-safe `prop_pass_revision` default) |
| Hard risk rooms / Risk Meter / Challenge-Live runtime projection on disposable staging users | **SKIP** (processor returned 200; no `prop_account_runtime_states` row for disposable non-allowlisted users) |

Sanitized journal evidence:  
`docs/releases/1.6.1/evidence/JOURNAL_STAGING_TRANSACTION_LATEST.json`

## Rollback plan (document only)

1. Client/edge kill-switch first; stop processors.
2. Prefer forward-fix migrations over DROP on production.
3. Staging reverse-drop order documented in `PPOS-117-19_MIGRATION_READINESS.md`.
4. Never delete real user journal rows or append-only Prop OS history as cleanup.

## Synthetic production QA / cleanup plan (do not execute without PO)

1. Disposable synthetic users only; refuse non-staging hosts in scripts.
2. Prove save/edit/delete + retry + RLS on staging clone of final SQL.
3. Scrub disposable identities; accept append-only residuals under scrubbed users.
4. Confirm 0 active disposable emails, 0 mutable synthetic trades/events/assignments.
5. Production apply only after PO; then synthetic QA on production only if PO authorizes a separate window.

## Remaining blocker before READY = YES

Remote staging must prove `prop_account_runtime_states` (hard rooms / risk meter /
challenge-live projection) for the Journal sync path, not only execution/event
idempotency. Until that projection is PASS on staging, production apply stays blocked.

---

PRODUCTION MIGRATION READY: NO  
EXPLICIT PO APPROVAL REQUIRED: YES
