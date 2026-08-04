# PPOS-117 — Expanded production migration approval checkpoint

**Date:** 2026-08-04  
**Branch:** `feature/prop-pass-trading-os-build117`  
**Document HEAD:** `477706a` (`feature/prop-pass-trading-os-build117`)  
**Pre-checkpoint baseline:** `8c838e0` (legitimate ancestor)  
**Production project ref:** `izzrlsgumyabdvlmwlwn`  
**Staging project ref:** `zleojeqkzizeyerhjpur`  
**Production modifications:** NONE  
**Build 116:** immutable  
**Build 117:** authorized, not archived/uploaded  
**Build 118:** not authorized  

This checkpoint identifies the exact ordered migration set required for Build 117
Journal → runtime on production. **It does not apply any production migration.**

Previous narrow authorization covered only  
`20260802225538_prop_pass_journal_automatic_sync.sql` and was correctly **BLOCKED**
because production lacks Prop OS foundation and Build 117 persistence objects
(see `PPOS-117_PRODUCTION_MIGRATION_RESULT.md`).

---

## 1. Untracked `.cursor/settings.json` disposition

| Check | Result |
|---|---|
| Present in worktree | YES (untracked before ignore) |
| Size | 81 bytes |
| Structure | `plugins.aikido-cursor-plugin.enabled` (boolean) |
| Local MCP configuration | NO (MCP stays in `.cursor/mcp.json`, already ignored) |
| Tokens / credentials / secrets | NO |
| Machine-specific paths | NO |
| Safe repository-required settings | NO — local IDE plugin enablement only |

**Disposition:** keep outside Git. Narrow ignore rule added:

```text
.cursor/settings.json
```

Do not commit. Do not delete (local Aikido plugin enablement).

---

## 2. Production schema baseline (VERIFIED)

MCP/SQL against `izzrlsgumyabdvlmwlwn`:

| Item | State |
|---|---|
| Migration ledger tip | `20260802001324` (`auth_provider_tokens`) |
| Prop OS / Build 117 versions (`20260730*` … `202608022*`) | ABSENT |
| `prop_accounts` | missing |
| `prop_challenges` | missing |
| `prop_challenge_rule_snapshots` | missing |
| `prop_trade_assignments` | missing |
| `prop_executions` | missing |
| `prop_processed_journal_events` | missing |
| `prop_account_runtime_states` | missing |
| `prop_daily_plan_snapshots` / `prop_timeline_events` | missing |
| `trade_journal.prop_pass_revision` | missing |

**Excluded from this set (already on production under a different stamp):**  
`20260802001141_auth_provider_tokens.sql` (local) ↔ production version `20260802001324`.  
Do **not** re-apply.

Staging ledger already contains the exact 16 versions below (plus staging’s local
`20260802001141` auth tokens stamp).

---

## 3. Exact ordered migration set (16 files)

No wildcards. Filenames and SHA-256 recalculated from the repository.

| Order | Filename | SHA-256 | Purpose | Prerequisite |
|---|---|---|---|---|
| 1 | `20260730190000_prop_os_database_foundation.sql` | `5ca0845a6f9fca338381be902675e9e8246bfc6b5925205b5c00064048b25f7f` | Prop OS foundation tables | production baseline |
| 2 | `20260730210000_prop_os_controlled_activation_read.sql` | `055e3a0a91f86a2b9733c059d45768bc47ac51f39e319a6e4621b06f599f3f54` | Activation preferences / controlled read | 1 |
| 3 | `20260730220000_prop_os_internal_commands.sql` | `eae741e9852c76c981a3960561a2f76178668fb951b2530d34a5f48010ded425` | Account/challenge command RPCs | 1–2 |
| 4 | `20260730230000_prop_os_command_boundary_hardening.sql` | `5efa8e3e04aec573af3b4ed3b180ebf280254fce1b689f89f58c58247fc4ae96` | Command gate + allowlist hardening | 3 |
| 5 | `20260730240000_prop_os_trade_assignment_commands.sql` | `5e092feabb349246bd17438c0107a87cbbbfafe51bffd54f46ad86644b48179d` | Assignment commands + revision/recalc helpers | 4 |
| 6 | `20260730250000_prop_os_assignment_recalc_hardening.sql` | `d17eaecc0804bd9fd48b7f9d1dfe65d4c718f2ee6eb976051a4bd344e4070469` | Assignment/recalc processor hardening | 5 |
| 7 | `20260730260000_prop_os_assignment_identity_invariant.sql` | `12e960caf36d32865038ee935236c8e0788b3bca90d46b7bcde02126b1fe5230` | Assignment identity invariant | 6 |
| 8 | `20260730270000_prop_os_performance_intelligence.sql` | `498edccd1affa9b648bb7e1e5349bc8453a884b59f1f0c3dd34d1d7b115559b1` | PI tables + command RPCs (staging parity) | 7 |
| 9 | `20260730280000_prop_os_performance_intelligence_remediation.sql` | `240318734dd3574e7aea2753b11ac2560e575f4234eb785fbe56122ccfd3b020` | PI processor remediation | 8 |
| 10 | `20260731290000_prop_os_pi_timeout_reaper.sql` | `3dca310c03ee8d28459ada07b77766f3274d3c6574f32343f316893e6b112d48` | PI claim/reaper | 9 |
| 11 | `20260802212828_prop_pass_trading_os_persistence.sql` | `9b0edf1b2eab15201c17806a93a7a0a17e026433cb1718e4011c06e3b14f2059` | Daily Plan / Timeline / settings tables | 1–7 |
| 12 | `20260802223818_prop_pass_build117_persistence_hardening.sql` | `d1a4037e60a18fb80c7f5c3d775788fdcde24a83d58bcda536411690c8eb19fe` | Runtime state + processed journal events + processor RPCs | 11 |
| 13 | `20260802225538_prop_pass_journal_automatic_sync.sql` | `f7ca73e3ba681c898ada9529674598f9190b4b2e013b815e5d14eaf0d66947fe` | `trade_journal.prop_pass_revision` + sync triggers | 5, 12 |
| 14 | `20260802232311_prop_pass_pipeline_v2_runtime.sql` | `bac3bca3951bbab11848a8bcd38bd1ed272b479f20b6390ff809364f43b6ea6d` | Pipeline stamp `build117.pipeline.v2` | 13 |
| 15 | `20260802233700_prop_pass_runtime_processing_queue.sql` | `ecd79a18e68fef367a176cb08d602b237f6b4d2cf2cd5172affdf62e1fa5e09c` | Claim pending journal events (`SKIP LOCKED`) | 12–14 |
| 16 | `20260802235500_prop_pass_settings_recalculation_events.sql` | `724672da606c1aab21bba7b5b9f2e11113b80c4ad1a52f01edfe356dca5c3e9a` | Settings-change recalculation queue | 15 |

**Exact ordered migration count:** 16  

Categories covered: Prop OS foundation; account/challenge persistence; rule
snapshots + instrument/version columns; runtime-state; RLS/hardening; Journal
revision/assignment sync; automatic Journal sync; processor queue/runtime
projection; PI chain for staging/Build 117 schema parity.

---

## 4. Dependency graph (summary)

### Object ownership (create / alter)

| Object | Created / altered by |
|---|---|
| `prop_accounts`, `prop_challenges`, `prop_challenge_rule_snapshots`, `prop_trade_assignments`, `prop_executions`, `prop_account_events`, … | #1 foundation |
| `prop_os_user_preferences` | #2 |
| `prop_os_command_receipts` + `prop_os_cmd_*` | #3 (hardened in #4) |
| `prop_os_command_gate`, `prop_os_command_allowlist` | #4 |
| `prop_trade_assignment_events`, `prop_os_assignment_revisions`, `prop_os_challenge_recalc`, `prop_os_assignment_bump_revision`, `prop_os_assignment_queue_recalc` | #5 (hardened #6) |
| Assignment identity invariant | #7 |
| PI snapshots/current/calc/findings + PI commands | #8–#10 |
| Daily Plan / Timeline / kill / live / recovery / payout settings | #11 |
| `prop_processed_journal_events`, `prop_account_runtime_states`, instrument versions, processor claim/complete/fail | #12 |
| `trade_journal.prop_pass_revision` + journal sync triggers | #13 |
| Pipeline stamp trigger | #14 |
| `prop_os_processor_claim_pending_journal_events` | #15 |
| `prop_os_processor_queue_settings_recalculation` | #16 |

### Topological order

`1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16`

No circular dependencies. Journal/runtime vertical slice requires at least
`1–7` + `11–16`. PI (`8–10`) is included for full Build 117 / staging ledger
parity and Prop OS PI Edge compatibility; it is not on the Journal→runtime
hot path.

### Application adapters requiring the set

- Prop OS command client (`prop_os_cmd_*`)
- Assignment / Journal sync path
- Persistence adapters (Daily Plan, Timeline, runtime state)
- Edge `prop-pass-runtime-processor` (`loadBundle` needs rule snapshots + claim queue)
- Session Cockpit persisted read of `prop_account_runtime_states`

---

## 5. Classification matrix

Legend flags per file (all in set):

| Order | ADDITIVE | BACKWARD_COMPATIBLE | REQUIRES_BACKFILL | REQUIRES_LOCK | SECURITY_SENSITIVE | DESTRUCTIVE |
|---|---|---|---|---|---|---|
| 1–16 | YES | YES* | NO | LOW (DDL) | YES (DEFINER / grants) | NO |

\*Build 116 shared-path proof: staging live suite PASS (see §6).  

Notes:

- No `DROP TABLE` / `DROP COLUMN` / `TRUNCATE` in the 16-file set.
- #4 contains `DELETE FROM public.prop_os_command_allowlist` (allowlist reset only; empty on fresh production).
- #13 adds `prop_pass_revision bigint not null default 1` — safe for existing inserts that omit the column.
- SECURITY DEFINER functions present in command / sync / processor paths; grants revoke `authenticated` execute where required; owner RLS + SELECT-only client grants on Build 117 tables.
- Dynamic SQL uses `format('%I', …)` for identifier quoting in RLS bootstrap loops.
- No secrets/credentials in migration SQL.

**Destructive / unexplained operations:** NONE that keep readiness at NO by SQL content alone.  
**Clean-from-production staging rehearsal gap** keeps overall production readiness at NO (see §7).

---

## 6. Build 116 backward-compatibility proof

| Gate | Command / evidence | Result |
|---|---|---|
| Static hash + no-drop + revision default | `npm run test:prop-pass-build116-compat-static` | PASS |
| Live staging Journal CRUD without Prop Pass assignment | `npm run test:prop-pass-build116-compat-staging` | PASS |
| Evidence | `docs/releases/1.6.1/evidence/BUILD116_COMPAT_STAGING_LATEST.json` | recorded |

Live suite verified on fully migrated staging:

- Journal insert / update / delete still work
- `prop_pass_revision` defaults to `1`
- Cross-user Journal denial still works
- No automatic `prop_accounts` / challenges / assignments / executions / events / runtime / timeline / daily plans for legacy users
- `auth_provider_tokens` relation remains present
- Disposable cleanup to 0 users

Not claimed from SQL-additivity alone.

Auth / RevenueCat / account-deletion production flows are untouched by this SQL set
(no changes to those tables’ contracts beyond additive Prop Pass objects). Existing
Build 116 reads/writes of Journal remain valid; no production table rename/removal.

---

## 7. Clean staging rehearsal of the ordered set

| Requirement | Result |
|---|---|
| Fresh DB matching current production schema (pre–Prop OS) | **NOT AVAILABLE** this checkpoint |
| Apply exact 16 files in order once | NOT RUN (no clean baseline DB) |
| Second run idempotent / rejected by ledger | NOT RUN |
| Docker local Supabase | unavailable (`docker_no`) |
| Staging already fully migrated | YES (ledger contains all 16) |
| Ledger-equivalent staging vertical slice | PASS (prior evidence; see §8) |

**Staging clean rehearsal:** FAIL  

**Blocker:** cannot recreate production-baseline schema on Staging without a
disposable branch/DB restore that starts from production’s ledger tip
`20260802001324`, then applies only these 16 files. Creating a paid Supabase
branch from production was not executed (cost + “Staging only” constraint).  
Do not claim clean apply rehearsal PASS until that baseline exists.

---

## 8. Build 117 staging vertical slice

| Proof | Evidence | Result |
|---|---|---|
| Runtime-state full slice (save/edit/delete, rooms, Risk Meter, Challenge/Live, Cockpit, retry, isolation, RLS denials) | `evidence/RUNTIME_STATE_STAGING_LATEST.json` | PASS |
| Journal staging transaction (save/edit/delete, retry/idempotency, cross-user, multi-account) | `evidence/JOURNAL_STAGING_TRANSACTION_LATEST.json` | PASS |
| Persistence schema static | `npm run test:prop-pass-persistence-schema` | PASS |

Journal save/edit/delete: PASS  
Runtime-state projection: PASS  
Processor queue: PASS  
RLS (staging proofs): PASS  
Retry/idempotency: PASS  

Staging cleanup (runtime suite): leftover mutable trades/events/runtime/assignments = 0;
active disposable users = 0; append-only residuals expected for scrubbed identities.

This checkpoint re-ran Build 116 compat staging cleanup to 0 leftover
`yt-b116-compat-*` / `yt-b117-runtime-*` disposable users after a failed partial run.

---

## 9. Processor / server deployment requirements (NOT DEPLOYED)

SQL migrations alone do **not** complete Journal→runtime on production.

| Component | Kind | Staging | Production today | Required production | Relative order | B116 compat | Secrets (names only) | Kill / disable |
|---|---|---|---|---|---|---|---|---|
| `prop-pass-runtime-processor` | Edge Function | ACTIVE v5 | ABSENT | Deploy from Build 117 HEAD after migrations | After migrations #12–#16 | Idle if never invoked; B116 clients do not call it | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, processor shared secret if used by callers | Stop invoking / undeploy / deny cron |
| `prop-os-recalc-processor` | Edge Function | ACTIVE v6 | ABSENT | Deploy if assignment recalc required | After #5–#6 | Same | same family | Stop invoking |
| `prop-os-pi-processor` | Edge Function | ACTIVE v7 | ABSENT | Deploy if PI required | After #8–#10 | Same | same family | Stop invoking |
| DB functions / triggers | SQL | present | absent until migrations | via migrations #1–#16 | Migrations first | Additive | n/a | Disable triggers via forward-fix (PO) |
| Cron / queue workers | config | staging-only as configured | none for Prop Pass | Only if PO authorizes cron after Edge deploy | After Edge | n/a | cron secret names only | Disable cron |

**Distinguish clearly:**

1. **SQL migrations** — this 16-file set  
2. **Edge/server function deployments** — table above (not executed)  
3. **Configuration** — secrets/cron (not executed)

**Processor deployment plan:** READY (documented; not executed)

---

## 10. Failure and recovery plan

| Step failure | Stop condition | Recovery | Retry safe? | Prefer |
|---|---|---|---|---|
| Migration fails before commit | SQL error / transaction abort | Re-run same file after fix; ledger unchanged | YES | forward fix |
| Migration N succeeds, N+1 fails | Ledger shows N only | Keep N; fix N+1; do not DROP applied objects | YES for N+1 | forward fix |
| Processor deploy fails | Edge version missing/error | Kill invoke path; leave SQL intact | YES | redeploy |
| Processor errors / queue failures | rising `failed` events | Stop Edge invoke; inspect digests; forward-fix processor | YES after fix | kill then forward |
| RLS verification fails | policy/grant mismatch | STOP; forward-fix RLS; never weaken | after fix | forward |
| Build 116 compat fails | Journal CRUD or auto-prop seed | STOP production apply; revert Edge if any; keep SQL | n/a | forward |
| Synthetic cleanup fails | leftover disposable users | Delete disposable users by metadata/email prefix on staging only | YES | cleanup |

**Kill-switch (no DROP):** disable Prop OS activation / stop calling
`prop-pass-runtime-processor` / remove cron. Do not delete real user data.

**Recovery plan:** READY

---

## 11. Exact future production execution plan (DO NOT EXECUTE)

Target every command explicitly at project `izzrlsgumyabdvlmwlwn`.  
Do not rely on locally linked staging (`zleojeqkzizeyerhjpur`).

1. Final preflight — HEAD, hashes, production ref, additive re-scan, ledger tip `20260802001324`
2. Apply migration #1 … verify objects from foundation
3. Apply #2 … verify
4. Apply #3 … verify
5. Apply #4 … verify allowlist/gate
6. Apply #5 … verify assignment helpers
7. Apply #6 … verify
8. Apply #7 … verify
9. Apply #8 … verify PI tables
10. Apply #9 … verify
11. Apply #10 … verify
12. Apply #11 … verify Daily Plan/Timeline
13. Apply #12 … verify runtime + processed events
14. Apply #13 … verify `prop_pass_revision` + triggers
15. Apply #14 … verify pipeline stamp
16. Apply #15 … verify claim function
17. Apply #16 … verify settings recalculation
18. Deploy required Edge processors (separate PO auth)
19. Schema verification queries (all expected tables/functions present)
20. RLS verification (owner select; direct write denied; provider-token denial)
21. Build 116 smoke on production schema (disposable only if PO authorizes)
22. Disposable Build 117 production vertical slice (PO)
23. Retry/idempotency proof
24. Synthetic cleanup to zeros
25. Post-deployment automated gates
26. Sanitized evidence commit

Do not apply unrelated pending migrations.

---

## 12. Security gates

| Gate | Result |
|---|---|
| `npm run security:check` | PASS |
| `npm run security:audit` (high+) | PASS (0 high/critical; 3 moderate Storybook/valibot transitive) |
| `npm run security:gitleaks` | PASS (0 findings) |
| `npm run security:semgrep` | PASS (0 blocking) |
| Focused Aikido on new QA scripts | `issues: []` (Opengrep CLI exit 2 noise; no blocking issues returned) |
| Prior Build 117 full Aikido | PASS (`AIKIDO_PASS_BUILD117.md`) |
| Credentials in migrations / evidence / Cursor settings | NONE found |
| Historical revoked credential policy | unchanged |

**Security gates:** PASS

---

## 13. Remaining blockers

1. **Clean staging rehearsal from production baseline** not completed → keeps  
   `PRODUCTION MIGRATION READY: NO`.
2. Explicit PO authorization for the **full 16-file ordered set** (prior auth was file #13 only).
3. Separate PO authorization for Edge processor deploys after SQL.
4. Production disposable vertical slice only after apply authorization.

---

## 14. Canonical docs updated

- This file: `PPOS-117_EXPANDED_PRODUCTION_MIGRATION_APPROVAL.md`
- `PPOS-117-19_MIGRATION_READINESS.md` — pointer to expanded set
- `PPOS-117_MIGRATION_APPROVAL_CHECKPOINT.md` — pointer / readiness NO until clean rehearsal
- `docs/BACKLOG.md` Epic 10 note — expanded checkpoint recorded

---

## Checkpoint verdict

| Field | Value |
|---|---|
| EXPANDED MIGRATION SET IDENTIFIED | YES |
| ALL MIGRATION HASHES RECORDED | YES |
| MIGRATION ORDER VERIFIED | YES |
| BUILD 116 BACKWARD COMPATIBILITY | PASS |
| FULL STAGING REHEARSAL | FAIL |
| BUILD 117 STAGING VERTICAL SLICE | PASS |
| PROCESSOR DEPLOYMENT PLAN | READY |
| PRODUCTION RECOVERY PLAN | READY |
| PRODUCTION MIGRATION READY | NO |
| EXPLICIT PO APPROVAL REQUIRED | YES |

PRODUCTION TOUCHED: NO  
BUILD 116 MODIFIED: NO  
BUILD 118 CREATED: NO  
ARCHIVE / TESTFLIGHT / APP STORE / PUBLIC RELEASE: NOT PERFORMED
