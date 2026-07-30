# Phase 1A — Additive Database Foundation · Migration Contract

**Status:** IMPLEMENTED — READY FOR PRODUCT OWNER REVIEW  
**Parent:** YouTrader 3.0 Implementation — after Phase 0 FINAL  
**Depends on:**  
- [`PROP_OS_PHASE_0D_MIGRATION_PLAN.md`](./PROP_OS_PHASE_0D_MIGRATION_PLAN.md) — **FINAL APPROVED** (`b740a9a`)  
- Phase 0A–0C FINAL APPROVED  
**Implementation report:** [`PROP_OS_PHASE_1A.md`](./PROP_OS_PHASE_1A.md)  
**Rollback:** [`PROP_OS_PHASE_1A_ROLLBACK.md`](./PROP_OS_PHASE_1A_ROLLBACK.md) 

**Date:** 2026-07-30  
**Schema version:** `prop-os-schema-v0`  
**Migration plan version:** `migration-plan-v0`  
**This contract version:** `phase-1a-contract-v0`

**Purpose:** Freeze the exact additive migration contract and pass the mandatory pre-SQL gate **before** any SQL is written or applied.

**Forbidden until this contract is FINAL APPROVED and Phase 1A implementation is explicitly started:** applying migrations; App reads of new tables; `src/propOs` production imports; backfill; shadow calc; Prop Pass UI; navigation changes; AI Analytics removal.

---

## 0. Phase 1 sequence (locked)

```text
Phase 1A — Additive Database Foundation     ← this contract / next implementation
Phase 1B — Production Domain Engine
Phase 1C — Shadow Calculation Pipeline
Phase 1D — Internal Account Management
Phase 1E — Controlled Product Activation
```

Prop Pass UI remains **after** 1A–1C evidence at minimum (per 0D dual-path).

---

## 1. Pre-SQL gate checklist (mandatory)

| # | Requirement | Contract decision | Status |
|---|---|---|---|
| 1 | All tables additive | New `prop_*` tables only; **no** ALTER that breaks `trade_journal` / `prop_firms` / `user_firm_settings` / `risk_snapshots` consumers | PASS (by design) |
| 2 | Old consumers unchanged | No App code in 1A reads/writes new tables; journal sync paths untouched | PASS (by design) |
| 3 | New FKs never required for legacy rows | Assignments optional; journal has **no** new NOT NULL FK | PASS (by design) |
| 4 | No auto-assignment of legacy trades | Migration SQL contains **zero** INSERT into `prop_trade_assignments` from journal | PASS (by design) |
| 5 | RLS deny-by-default | `ENABLE ROW LEVEL SECURITY` on all new user tables; no broad `USING (true)` write policies | PASS (spec below) |
| 6 | Rule snapshots immutable | No UPDATE/DELETE grants to `authenticated` on `prop_challenge_rule_snapshots` | PASS (spec below) |
| 7 | Engine snapshots not client-forgeable | No INSERT/UPDATE/DELETE for `authenticated` on engine/score snapshot tables; service-role / future edge only | PASS (spec below) |
| 8 | Corrections do not destroy originals | Void/correct = new events + flags; originals retained | PASS (spec below) |
| 9 | Verifiable rollback path | Documented down migration / disable path without deleting journal | PASS (§8) |
| 10 | App does not read new tables after apply | 1A ships schema only; eslint/architecture ban on imports until 1B/1D gates | PASS (by design) |

**Gate result:** Contract is ready for PO review. **SQL writing starts only after FINAL APPROVE of this contract / Phase 1A start.**

---

## 2. Additive table set (`prop-os-schema-v0`)

Create **only** these tables (names frozen):

| Table | Role | Client write (1A) | Client read (1A) |
|---|---|---|---|
| `prop_accounts` | User firm seats | **Denied** (empty until 1D) | **Denied** |
| `prop_challenges` | Attempts | Denied | Denied |
| `prop_challenge_rule_snapshots` | Immutable rule freeze | Denied | Denied |
| `prop_trade_assignments` | Journal ↔ challenge link | Denied | Denied |
| `prop_executions` | Fill-level events | Denied | Denied |
| `prop_account_events` | Equity marks / boundaries / corrections envelope | Denied | Denied |
| `prop_challenge_transitions` | Append-only status audit | Denied | Denied |
| `prop_engine_snapshots` | calc-spec outputs | Denied | Denied |
| `prop_score_snapshots` | Readiness envelopes | Denied | Denied |
| `prop_violation_records` | Breach/warn facts | Denied | Denied |
| `prop_data_quality_flags` | Confidence / limitations metadata | Denied | Denied |
| `prop_correction_events` | Void / correct / clear / reassign audit | Denied | Denied |

**Unchanged:** `trade_journal`, `prop_firms`, `user_firm_settings`, `risk_snapshots`, `upload_files`, storage buckets.

**Optional later (not 1A):** evolve `prop_firms` → richer catalog / `prop_rule_templates`. 1A may leave catalog as-is and store snapshot JSON only.

---

## 3. Exact column contract (SQL-ready)

Conventions: PK `uuid` default `gen_random_uuid()`; money `bigint` minor units; time `timestamptz`; enums as `text` + `CHECK` unless project standard prefers Postgres enums.

### 3.1 `prop_accounts`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | NO | → `auth.users(id)` ON DELETE CASCADE |
| `firm_key` | text | YES | Catalog slug; no hard FK required in 1A |
| `label` | text | NO | |
| `account_size_minor` | bigint | NO | CHECK > 0 |
| `currency` | text | NO | default `'USD'` |
| `firm_timezone` | text | NO | IANA |
| `status` | text | NO | `active\|archived\|closed` |
| `source` | text | NO | `user_created\|settings_seed\|import` |
| `schema_version` | text | NO | default `'prop-os-schema-v0'` |
| `created_at` | timestamptz | NO | default now() |
| `archived_at` | timestamptz | YES | |
| `updated_at` | timestamptz | NO | default now() |

Indexes: `(user_id, status)`, `(user_id, firm_key)`.

### 3.2 `prop_challenges`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | NO | denormalized owner |
| `account_id` | uuid | NO | → `prop_accounts(id)` ON DELETE RESTRICT |
| `phase` | text | NO | `evaluation\|funded` (+ extend later) |
| `status` | text | NO | matches 0C lifecycle set |
| `rule_set_version` | text | NO | |
| `starting_balance_minor` | bigint | NO | |
| `started_at` | timestamptz | NO | |
| `ended_at` | timestamptz | YES | |
| `reset_of_challenge_id` | uuid | YES | → `prop_challenges(id)` |
| `breach_locked` | boolean | NO | default false |
| `schema_version` | text | NO | |
| `created_at` | timestamptz | NO | |
| `updated_at` | timestamptz | NO | |

Constraint: `user_id` must equal parent account `user_id` (trigger or composite check via trigger in implementation).

Indexes: `(account_id, status)`, `(user_id, status)`, `(reset_of_challenge_id)`.

### 3.3 `prop_challenge_rule_snapshots` (immutable)

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | NO | |
| `challenge_id` | uuid | NO | UNIQUE → `prop_challenges(id)` |
| `rule_set_version` | text | NO | |
| `snapshot` | jsonb | NO | frozen RuleSet (0B/0C shape) |
| `template_key` | text | YES | |
| `template_version_at_capture` | text | YES | |
| `captured_at` | timestamptz | NO | |
| `schema_version` | text | NO | |

**Protection:** revoke UPDATE/DELETE from `authenticated` and `anon`. Prefer trigger `RAISE` on UPDATE/DELETE for defense in depth.

### 3.4 `prop_trade_assignments`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | NO | |
| `trade_client_id` | text | NO | journal identity; **no** FK force-fill |
| `account_id` | uuid | YES | |
| `challenge_id` | uuid | YES | |
| `assignment_state` | text | NO | `unassigned\|manual\|verified_import\|excluded\|invalid` |
| `assigned_at` | timestamptz | YES | |
| `assigned_by` | text | YES | `user\|system_import\|admin_correction` |
| `provenance` | jsonb | NO | default `{}` |
| `schema_version` | text | NO | |
| `created_at` | timestamptz | NO | |
| `updated_at` | timestamptz | NO | |

Unique: `(user_id, trade_client_id)`.  
CHECK: if `assignment_state = 'unassigned'` then `challenge_id IS NULL`; if `manual|verified_import` then `challenge_id IS NOT NULL`.

**1A migration must NOT insert rows for existing journal trades.**

### 3.5 `prop_executions`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text | NO | stable event id (PK with user_id) |
| `user_id` | uuid | NO | |
| `challenge_id` | uuid | YES | |
| `account_id` | uuid | YES | |
| `trade_client_id` | text | YES | |
| `occurred_at` | timestamptz | NO | |
| `broker_sequence` | bigint | YES | |
| `realized_pnl_minor` | bigint | YES | |
| `fees_minor` | bigint | YES | null → fees_missing semantics at engine |
| `contracts` | numeric | YES | |
| `voided` | boolean | NO | default false |
| `corrects_event_id` | text | YES | |
| `source` | text | NO | |
| `schema_version` | text | NO | |
| `created_at` | timestamptz | NO | |

PK/unique: `(user_id, id)`. Indexes: `(challenge_id, occurred_at)`, `(trade_client_id)`.

### 3.6 `prop_account_events`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text | NO | |
| `user_id` | uuid | NO | |
| `challenge_id` | uuid | NO | |
| `kind` | text | NO | `equity_mark\|day_boundary\|challenge_reset\|official_correction\|…` |
| `occurred_at` | timestamptz | NO | |
| `payload` | jsonb | NO | |
| `schema_version` | text | NO | |
| `created_at` | timestamptz | NO | |

Unique `(user_id, id)`. Append-oriented; client updates denied.

### 3.7 `prop_challenge_transitions`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | NO | |
| `challenge_id` | uuid | NO | |
| `from_status` | text | YES | |
| `to_status` | text | NO | |
| `reason_code` | text | NO | |
| `evidence` | jsonb | NO | default `{}` |
| `actor` | text | NO | |
| `at` | timestamptz | NO | |
| `schema_version` | text | NO | |
| `created_at` | timestamptz | NO | |

Append-only; no client UPDATE/DELETE.

### 3.8 `prop_engine_snapshots` / `prop_score_snapshots`

Shared envelope fields:

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | NO | |
| `challenge_id` | uuid | NO | |
| `calculation_version` | text | NO | e.g. `calc-spec-v0` |
| `rule_set_version` | text | NO | |
| `input_revision` | text | NO | |
| `calculated_at` | timestamptz | NO | |
| `status` | text | NO | lifecycle at calc time |
| `payload` | jsonb | NO | full envelope |
| `confidence` | jsonb | NO | |
| `limitations` | jsonb | NO | array |
| `readiness_model_version` | text | YES | score table |
| `confidence_policy_version` | text | NO | |
| `schema_version` | text | NO | |
| `created_at` | timestamptz | NO | |

Unique recommended: `(challenge_id, calculated_at, calculation_version, input_revision)`.

**Client:** no INSERT/UPDATE/DELETE for `authenticated`.

### 3.9 `prop_violation_records`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | NO | |
| `challenge_id` | uuid | NO | |
| `code` | text | NO | |
| `at` | timestamptz | NO | |
| `trade_client_id` | text | YES | |
| `severity` | text | NO | `warn\|hard` |
| `irreversible` | boolean | NO | default true |
| `cleared_by_event_id` | text | YES | links correction; does not delete row |
| `schema_version` | text | NO | |
| `created_at` | timestamptz | NO | |

### 3.10 `prop_data_quality_flags`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | NO | |
| `subject_type` | text | NO | |
| `subject_id` | text | NO | |
| `flag` | text | NO | |
| `severity` | text | NO | |
| `details` | jsonb | NO | |
| `backfill_version` | text | YES | |
| `detected_at` | timestamptz | NO | |
| `schema_version` | text | NO | |

### 3.11 `prop_correction_events`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | NO | |
| `kind` | text | NO | `void_trade\|correct_trade\|clear_breach\|reassign` |
| `payload` | jsonb | NO | references original ids; **does not delete** them |
| `reason` | text | NO | |
| `at` | timestamptz | NO | |
| `actor` | text | NO | |
| `schema_version` | text | NO | |
| `created_at` | timestamptz | NO | |

---

## 4. RLS contract (deny-by-default)

For every new table:

1. `ALTER TABLE … ENABLE ROW LEVEL SECURITY;`  
2. **No** policy that allows `anon` writes.  
3. Phase 1A default: **zero** policies for `authenticated` on Prop OS tables **or** SELECT-only own rows with writes still denied — prefer **zero client policies** so tables exist but are inert to the mobile client.  
4. Service role used later for shadow/backfill under flags (1C+).  
5. Immutable tables: additionally block UPDATE/DELETE via trigger.

**Cross-account isolation:** every policy (when added in 1D+) requires `user_id = auth.uid()` and challenge/account ownership checks.

---

## 5. What 1A implementation will deliver (after approve)

1. One (or few) additive migration file(s) under `supabase/migrations/`.  
2. RLS + immutability triggers as above.  
3. Generated TypeScript DB types (existing project pipeline).  
4. Schema-level tests / smoke SQL assertions (local).  
5. Rollback documentation companion (down steps: drop new tables only if empty / flag disable — **never** touch `trade_journal`).  

Still **not** in 1A: repositories in App, propOs import, UI, backfill, shadow, assignment UX.

---

## 6. Rollback documentation requirements (to ship with SQL)

| Action | Allowed? |
|---|---|
| Drop empty `prop_*` tables in emergency | Yes, with ops approve |
| DELETE journal / firm settings | **No** |
| Leave tables in place, unused | Preferred rollback |
| Revert App (no-op if App never read tables) | Automatic |

---

## 7. Verification plan for 1A SQL PR

After migrations exist (future):

```text
- migration applies on clean local Supabase
- trade_journal CRUD still works
- SELECT count(*) from prop_* = 0 for fresh DB
- authenticated JWT cannot INSERT engine snapshots
- authenticated JWT cannot UPDATE rule snapshots
- no rows auto-created in prop_trade_assignments
- typecheck / generated types compile
- App bundle has zero references to prop_accounts (rg gate)
```

---

## 8. STOP

**Contract implemented** — see [`PROP_OS_PHASE_1A.md`](./PROP_OS_PHASE_1A.md).

Awaiting Product Owner review of Phase 1A SQL foundation. Do not start Phase 1B until FINAL APPROVE.
