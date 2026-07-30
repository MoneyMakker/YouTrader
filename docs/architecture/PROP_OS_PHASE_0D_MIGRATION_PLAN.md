# Phase 0D — Prop OS Migration Plan

**Status:** READY FOR PRODUCT OWNER REVIEW  
**Parent:** Phase 0 — Prop Domain Architecture  
**Depends on:**  
- [`PROP_OS_PHASE0_DATA_AUDIT.md`](./PROP_OS_PHASE0_DATA_AUDIT.md) — FINAL APPROVED  
- [`PROP_OS_PHASE_0A_DOMAIN_SPEC.md`](./PROP_OS_PHASE_0A_DOMAIN_SPEC.md) — APPROVED WITH SPEC CONDITIONS  
- [`PROP_OS_PHASE_0B_CALC_ENGINE_SPEC.md`](./PROP_OS_PHASE_0B_CALC_ENGINE_SPEC.md) — APPROVED WITH IMPLEMENTATION CONDITIONS  
- [`PROP_OS_PHASE_0C_FIXTURES.md`](./PROP_OS_PHASE_0C_FIXTURES.md) — **FINAL APPROVED** (`cece87a`, `e4976e4`)  

**Date:** 2026-07-30  
**Scope:** Safe, reversible plan from today’s journal model to Prop OS aggregates.  
**Out of scope (forbidden in this phase):** applying SQL migrations; changing deployed Supabase schema; wiring `src/propOs` into App; production repositories; Prop Pass UI; deleting AI Analytics; navigation changes; backfill execution; feature-flag activation; new packages; probability surfaces; production calculation engine.

**Plan version:** `migration-plan-v0`  
**Proposed schema version (not applied):** `prop-os-schema-v0`  
**Backfill version (not executed):** `backfill-v0`

---

## 0. Governing principles

1. **Facts first** — `trade_journal` remains the journal of record until a later activation gate.  
2. **No silent attribution** — legacy trades stay `unassigned` unless the user (or a verified import) assigns them.  
3. **Snapshots over templates** — challenge history freezes `rule_set_snapshot`; catalog edits never rewrite past attempts.  
4. **Dual-path rollout** — schema → shadow → opt-in → controlled activation → retirement. Never a big-bang cutover.  
5. **Rollback without data deletion** — new rows may be retained while product read path reverts.  
6. **Status > score** and versioned engine envelopes from 0B/0C remain binding when engine is later activated.

```text
TODAY                         TARGET
User → trade_journal          User
(+ single firm overlay)         → PropAccount[]
                                  → PropChallenge[]
                                    → Executions / Trades
                                    → Account Events
                                    → Engine Snapshots
```

---

## 1. Current-to-target schema map

### 1.1 `trade_journal` (active journal of record)

| Aspect | Detail |
|---|---|
| **Current purpose** | Per-user trade journal; cloud sync via `(user_id, client_id)`; soft-delete |
| **Target entity** | `prop_trade_links` + optional `prop_executions` overlay; journal row remains authoritative trade fact in v1 |
| **Reuse** | `id` / `client_id`, `user_id`, symbol, direction, contracts, prices, `pnl`, notes, tags, media URLs, timestamps, `deleted_at` |
| **Deprecated for Prop calc** | Treating all user trades as one firm attempt; float `pnl` as sole limit truth without minor-unit conversion policy |
| **Cannot safely migrate** | Automatic `account_id` / `challenge_id`; fees; HWM; firm trading-day; fill-level partials; broker sequence |
| **User action required?** | Yes for Prop assignment; journal continues without assignment |

**Key columns today:** `id`, `user_id`, `client_id`, `trade_date`, `symbol`, `direction`, `entry_time`, `exit_time`, `contracts`, `entry`, `exit`, `stop_loss`, `take_profit`, `pnl`, `mood`, `notes`, `screenshot_url`, `voice_url`, `tags`, `created_at`, `updated_at`, `deleted_at`.

### 1.2 `prop_firms` (catalog)

| Aspect | Detail |
|---|---|
| **Current purpose** | Read-only firm templates (`slug`, sizes, limits, `rules` jsonb) |
| **Target entity** | `PropFirmCatalogEntry` — remains reference data; seeds **templates**, not live account state |
| **Reuse** | `slug` → `firm_key`; name; account size presets; limit fields; `rules` as template source |
| **Deprecated** | Using template as mutable “current user rules”; numeric floats without snapshot freeze |
| **Cannot safely migrate** | Per-user balances / HWM / challenge status (never belonged here) |
| **User action required?** | No for catalog; yes when creating an account from a template |

### 1.3 `user_firm_settings` (single overlay)

| Aspect | Detail |
|---|---|
| **Current purpose** | One firm settings row per user (`unique(user_id)`); evaluation/live mode + overrides |
| **Target entity** | Informational seed for **suggesting** a first `prop_accounts` + challenge — **not** 1:1 overwrite |
| **Reuse** | Selected firm, mode/phase hint, account size, limit overrides, alerts flag |
| **Deprecated** | Single-settings-as-truth model; auto-creating one challenge for all history |
| **Cannot safely migrate** | Identity of which historical trades belonged to that overlay |
| **User action required?** | Confirm suggested account/challenge; may discard or edit |

**Note:** Client cloud sync for this table is weak/absent in current app paths — treat rows as **best-effort hints**, confidence `low` / limitation `settings_unsynced_or_stale` when provenance unclear.

### 1.4 `risk_snapshots`

| Aspect | Detail |
|---|---|
| **Current purpose** | Daily risk/coach metrics per user/firm; **no active TypeScript owner** |
| **Target entity** | Replace conceptually with versioned `prop_engine_snapshots` + `prop_score_snapshots` |
| **Reuse** | Possibly archival export only; do not treat as calc-spec-v0 truth |
| **Deprecated** | Coach message + recommendation family as engine outputs; unversioned buffers |
| **Cannot safely migrate** | Pass odds / readiness equivalence; HWM state machine fidelity |
| **User action required?** | No; quarantine from Prop Pass UI |

### 1.5 Media (`upload_files` + denormalized journal URLs)

| Aspect | Detail |
|---|---|
| **Current purpose** | Secure upload metadata; screenshot/voice URLs on journal |
| **Target entity** | Remain user-owned media; Prop entities reference trade `client_id` / journal id |
| **Reuse** | Ownership folder model; category; hash; MIME |
| **Deprecated** | None required for Prop OS v1 |
| **Cannot safely migrate** | Deleted media recovery |
| **User action required?** | No for Prop assignment |

### 1.6 Stats consumers

| Consumer | Path (representative) | Migration stance |
|---|---|---|
| Unified stats | `src/app/utils/stats.ts`, `src/components/stats/*` | Continue reading **full journal** until Prop-scoped Stats is an explicit product gate |
| Prop Risk Coach | `src/propFirm/propRiskEngine.ts`, `PropFirmRiskCoachScreen` | Shadow-compare vs `calc-spec-v0`; do not silently replace; quarantine heuristics |
| Local overrides | firm override storage keys | Map into account/challenge creation UX later; keep dual-read during rollout |

### 1.7 AI Analytics consumers

| Consumer | Path (representative) | Migration stance |
|---|---|---|
| AI Analysis screen | `YouTraderApp.tsx` / analysis payload builders | Soft-retire later; until then explain **legacy** stats only, or engine snapshots when activated — never invent readiness |
| AI context / coach | `src/analytics/aiContextBuilder.ts`, `src/api/aiCoach.ts`, `supabase/functions/ai-coach` | Must not become Prop OS write path; may later **read** versioned engine envelopes |
| Pass probability heuristics | `calculatePassProbability` family | Quarantine; forbidden in Prop Pass |

### 1.8 Map summary

| Current | Future | Auto? |
|---|---|---|
| `trade_journal` row | Trade fact + optional assignment link | Assignment **manual / verified import only** |
| `prop_firms` | Catalog templates | Read-only reuse |
| `user_firm_settings` | Suggested account seed | Confirm with user |
| `risk_snapshots` | Quarantine / replace | No migration as truth |
| Media | Unchanged ownership | Keep |
| Stats | Dual-read journal | No Prop filter until opted-in UX |
| AI Analytics | Soft-retire path | No hard delete in 0D+ first impl |

---

## 2. Proposed database schema (`prop-os-schema-v0`, not applied)

All money fields in **minor units** (`bigint`) unless noted. All user-owned tables include `user_id` matching `auth.uid()` under RLS (see §6). Timestamps: `timestamptz` UTC.

### 2.1 Entity overview

```text
prop_firm_catalog              (evolves from prop_firms; reference)
prop_rule_templates            (mutable templates → versioned rows)
prop_accounts                  (user seats)
prop_challenges                (attempts; frozen snapshot)
prop_challenge_rule_snapshots  (immutable JSON + version)
prop_trade_assignments         (journal ↔ challenge; nullable → unassigned)
prop_executions                (optional fill-level; v1 may be sparse)
prop_account_events            (equity marks, day boundaries, corrections)
prop_challenge_transitions     (append-only lifecycle audit)
prop_engine_snapshots          (calc-spec outputs)
prop_score_snapshots           (readiness + drivers envelope)
prop_violation_records         (breach / warn facts)
prop_data_quality_flags        (confidence / limitations metadata)
prop_correction_events         (void / correct / official clear)
```

### 2.2 Table specifications

#### `prop_accounts`

| Item | Spec |
|---|---|
| PK | `id uuid` |
| Ownership | `user_id uuid not null → auth.users` |
| FK | optional `firm_key text` → catalog |
| Fields | `label`, `account_size_minor`, `currency`, `firm_timezone` (IANA), `status` (`active\|archived\|closed`), `created_at`, `archived_at`, `source` (`user_created\|settings_seed\|import`) |
| Nullable | `archived_at` null while active |
| Unique | none beyond PK; multiple accounts per user allowed |
| Indexes | `(user_id, status)`, `(user_id, firm_key)` |
| Mutability | Mutable label/status; **not** rewrite of historical challenges |
| Archive | Soft `archived` / `closed`; no hard delete of accounts with challenges |

#### `prop_challenges`

| Item | Spec |
|---|---|
| PK | `id uuid` |
| Ownership | `user_id` denormalized + FK `account_id → prop_accounts` |
| Fields | `phase`, `status`, `rule_set_version`, `starting_balance_minor`, `started_at`, `ended_at`, `reset_of_challenge_id`, `breach_locked bool`, `created_at` |
| Nullable | `ended_at`, `reset_of_challenge_id` |
| Unique | none; concurrent actives **allowed** by 0A (product UX may still recommend one default) |
| Indexes | `(account_id, status)`, `(user_id, status)`, `(reset_of_challenge_id)` |
| Mutability | Status transitions append-audited; **never overwrite** a completed attempt in place — new attempt = new row |
| Archive | Retain forever for audit; UI may hide abandoned |

#### `prop_challenge_rule_snapshots`

| Item | Spec |
|---|---|
| PK | `id uuid` |
| FK | `challenge_id` **unique** (1:1) |
| Fields | `rule_set_version text`, `snapshot jsonb not null`, `captured_at`, `template_key`, `template_version_at_capture` |
| Mutability | **Append-only / immutable** after insert (no update policy for clients) |
| Indexes | `(rule_set_version)` |

Snapshot MUST include: firm TZ, rollover hour, profit target, daily loss limit + **basis** + policy version, drawdown kind/amount, min days, max contracts, `intraday_requires_equity_stream`, currency, monetary scale.

#### `prop_trade_assignments`

| Item | Spec |
|---|---|
| PK | `id uuid` |
| Ownership | `user_id` |
| FK | `trade_client_id` + `user_id` → journal identity; optional `account_id`, `challenge_id` |
| Fields | `assignment_state` (`unassigned\|manual\|verified_import\|excluded\|invalid`), `assigned_at`, `assigned_by` (`user\|system_import\|admin_correction`), `provenance jsonb`, `updated_at` |
| Nullable | `account_id` / `challenge_id` when `unassigned` or `excluded` |
| Unique | `(user_id, trade_client_id)` |
| Indexes | `(challenge_id)`, `(user_id, assignment_state)` |
| Mutability | Reassignment requires `prop_correction_events` row; engine uses latest non-voided assignment |

#### `prop_executions` (fill-level; optional in wave 1)

| Item | Spec |
|---|---|
| PK | `id uuid` / stable text id |
| FK | `challenge_id` nullable; `trade_client_id` |
| Fields | `occurred_at`, `broker_sequence`, `realized_pnl_minor`, `fees_minor`, `contracts`, `voided`, `corrects_event_id`, `source` |
| Unique | `(user_id, id)` |
| Indexes | `(challenge_id, occurred_at)`, `(trade_client_id)` |
| Mutability | Corrections via void/correct pattern (0C F13/F14/F29) — not silent overwrite |

#### `prop_account_events`

| Item | Spec |
|---|---|
| PK | `id` |
| Kinds | `equity_mark`, `day_boundary`, `challenge_reset`, `official_correction`, future broker sync marks |
| Indexes | `(challenge_id, occurred_at)` |
| Mutability | Append-only |

#### `prop_challenge_transitions`

| Item | Spec |
|---|---|
| PK | `id` |
| Fields | `challenge_id`, `from_status`, `to_status`, `reason_code`, `evidence jsonb`, `at`, `actor` |
| Mutability | **Append-only** audit trail (breach irreversible unless official correction / reset / new attempt) |

#### `prop_engine_snapshots` / `prop_score_snapshots`

| Item | Spec |
|---|---|
| PK | `id` |
| Fields | Full versioned envelope: `calculation_version`, `rule_set_version`, `input_revision`, `calculated_at`, `status`, payload jsonb, `confidence`, `evidence`, `limitations`, `readiness_*` versions |
| Unique | `(challenge_id, calculated_at, calculation_version, input_revision)` recommended |
| Mutability | Append-only; new calc = new row |
| Archive | Retain for mismatch debugging; TTL optional only after retirement gate |

#### `prop_violation_records`

| Item | Spec |
|---|---|
| Fields | `challenge_id`, `code`, `at`, `trade_client_id?`, `severity`, `irreversible bool`, `cleared_by_event_id?` |
| Mutability | Insert on breach; clear only via linked correction event |

#### `prop_data_quality_flags`

| Item | Spec |
|---|---|
| Fields | `subject_type`, `subject_id`, `flag`, `severity`, `details`, `detected_at`, `backfill_version?` |
| Purpose | `fees_missing`, `inferred_*`, `stale_account`, `incomplete_equity_stream`, etc. |

#### `prop_correction_events`

| Item | Spec |
|---|---|
| Fields | `kind` (`void_trade\|correct_trade\|clear_breach\|reassign`), `payload`, `reason`, `at`, `actor` |
| Mutability | Append-only |

### 2.3 Non-executable schema diagram (design artifact)

```text
auth.users
   │
   ├─ prop_accounts ──────────────┐
   │       │                      │
   │       └─ prop_challenges ────┼── prop_challenge_rule_snapshots (1:1 immutable)
   │               │              │
   │               ├─ prop_trade_assignments ←── trade_journal (user_id, client_id)
   │               ├─ prop_executions
   │               ├─ prop_account_events
   │               ├─ prop_challenge_transitions
   │               ├─ prop_violation_records
   │               ├─ prop_engine_snapshots
   │               └─ prop_score_snapshots
   │
   └─ prop_data_quality_flags / prop_correction_events (cross-cutting)

prop_firms / prop_rule_templates ──(capture)──► rule snapshots only
```

**No migration file in this phase applies the above.**

---

## 3. Legacy trade migration

### 3.1 Assignment states

| State | Meaning | In Prop engine |
|---|---|---|
| `unassigned` | Default for all existing journal rows | **Excluded** from challenge calcs |
| `manual` | User explicitly assigned | Included |
| `verified_import` | Broker/CSV import with account context proven | Included |
| `excluded` | User/system marked out of Prop scope | Excluded |
| `invalid` / `incomplete` | Missing critical fields / bad timestamps | Excluded + quality flag |

### 3.2 Rules

1. Backfill **must not** set `challenge_id` for historical rows automatically.  
2. Creating an account from `user_firm_settings` does **not** assign trades.  
3. Bulk-assign tools (future UX) require confirmation + audit event; still not silent.  
4. Soft-deleted journal rows (`deleted_at`) never enter Prop calcs.  
5. Media deletion does not change assignment state; limitation `media_missing` optional.

### 3.3 UX-compatible migration contract (no screen in 0D)

Future UI must be able to express:

- “These trades are not linked to a prop challenge.”  
- “Link selected trades to Challenge X.”  
- “Exclude from Prop.”  
- “Data incomplete — not used in readiness.”  

API/repository contract (later): list unassigned counts; assign; unassign with reason; never lose journal row.

---

## 4. Dual-read / dual-write strategy

| Step | Name | App behavior | Prop OS |
|---|---|---|---|
| 1 | Schema exists | Unaffected | Tables empty / feature flag off |
| 2 | Domain repositories | Unused by UI | Interfaces only; tests against fixtures |
| 3 | Shadow calculations | Old Risk Coach unchanged | Server or local shadow job writes snapshots offline |
| 4 | Compare old/new | Logging only | Mismatch metrics (§9) |
| 5 | Internal fixtures/accounts | Dev/TestFlight internal | Seed from 0C scenarios |
| 6 | Opt-in assignment | Journal unchanged | Users who create accounts may assign |
| 7 | New Prop OS read path | Gated screen / flag | Read snapshots + assignments |
| 8 | Controlled activation | Flag per user/cohort | Engine becomes authority for Prop surfaces |
| 9 | Legacy read retirement | Risk Predictor / old overlays hidden by soft-nav | After evidence window |
| 10 | Cleanup | Optional | Drop unused columns/tables only with separate approve |

**Hard rule:** Do not skip to step 7/8 without mismatch + fixture evidence.

Dual-write (when introduced): journal write remains primary; assignment/execution writes are additive. Never block journal save on Prop failure.

---

## 5. Backfill strategy (`backfill-v0`, not executed)

### 5.1 Derivable from existing trades

| Field | Derivable? | Notes |
|---|---|---|
| Realized PnL (gross-ish) | Yes | From `pnl`; treat as major units → minor via explicit scale |
| Symbol / direction / contracts | Yes | |
| Trade date | Partial | Date only; times often text / incomplete |
| Fees | **No** | Flag `fees_missing` |
| Account / challenge | **No** | Stay `unassigned` |
| HWM / equity stream | **No** | |
| Firm TZ trading day | Only after account exists | |
| Rule snapshot | Only at challenge creation | From template + user confirm |

### 5.2 Provenance & inferred marking

- Every backfilled field stores `provenance`: `source=journal|settings|template|inferred`.  
- Inferred values **never** silently upgrade to verified.  
- `prop_data_quality_flags` records inferred usage.  
- Engine limitations[] must surface inferred/missing (aligned with 0B/0C).

### 5.3 Idempotency & rollback

- Backfill job key: `(backfill_version, user_id, entity_key)`.  
- Re-run updates only rows with same `backfill_version` marker or creates new versioned rows.  
- Rollback = mark backfill batch `reverted`, hide from read path; **do not** DELETE journal facts.  
- Erroneous assignments: correction events + revert to `unassigned`.

---

## 6. RLS and security plan (specification only — no live policies)

### 6.1 Ownership model

| Entity | Client access | Service role |
|---|---|---|
| Catalog / templates | SELECT active | Manage catalog |
| Accounts / challenges / assignments / events / snapshots | CRUD **own** `user_id` only (writes constrained by step flags) | Backfill, shadow jobs, admin corrections |
| Immutable snapshots | SELECT own; **no UPDATE/DELETE** for authenticated | Break-glass only with audit |
| `trade_journal` | Existing owner policies unchanged | Unchanged |

### 6.2 Threat analysis

| Threat | Mitigation |
|---|---|
| Assign trade to another user’s challenge | RLS on `user_id`; challenge must belong to same `user_id`; DB check constraint / trigger |
| Rewrite historical rule snapshot | No update policy; revoke update |
| Forge breach clear | Only `official_correction` path with audit; client cannot clear `breach_locked` directly |
| Cross-account leakage in aggregates | Snapshots keyed by `user_id` + `challenge_id`; no shared reads |
| Service-role backfill abuse | Job scoped allow-list; idempotent keys; no client exposure of service key |
| Snapshot tampering to inflate readiness | Append-only; UI reads latest with version; integrity hash optional later |

### 6.3 Correction permissions

- User: void/correct **own** trades; reassign **own** unassigned/manual trades.  
- User: **cannot** clear breach without product-defined official correction flow.  
- Service role: backfill + shadow only under feature flags.

---

## 7. Versioning strategy

Independent version axes (store on every engine/score snapshot):

| Axis | Example | Changes when |
|---|---|---|
| Schema | `prop-os-schema-v0` | Table shape |
| Rule snapshot | `rs-ftmo-50k-eval-2026.07` | Challenge capture |
| Calculation | `calc-spec-v0` | Formula suite |
| Readiness policy | `readiness-v0` | Weights/gates |
| Confidence policy | `confidence-policy-v0` | Confidence rules |
| Fixture contract | 0C catalog / QA | Golden behavior |
| Backfill | `backfill-v0` | Migration transforms |
| Migration plan | `migration-plan-v0` | This document |

Historical outputs **must** retain the versions used at calculation time. Replaying with a new calc version produces a **new** snapshot row.

---

## 8. Rollback strategy

| Rollout step | Feature flag (planned name) | Trigger | Action | Keep new data? | Old UI path |
|---|---|---|---|---|---|
| 1 Schema | `prop_os_schema` | N/A | Tables unused | Yes | Default |
| 2 Repos | `prop_os_repos` | Test fail | Disable repo injection | Yes | Default |
| 3–4 Shadow | `prop_os_shadow` | Mismatch spike | Stop shadow writers | Keep snapshots | Default |
| 6 Opt-in assign | `prop_os_assignment` | UX/support | Disable assign UI | Keep assignments | Journal only |
| 7–8 Read/activate | `prop_os_read` / `prop_os_engine` | Breach disagreements / readiness reconcile fail | Force legacy read | Keep all Prop rows | Restore Risk Coach / journal stats |
| 9 Retirement | `prop_os_retire_legacy` | Regressions | Re-enable legacy soft-nav | Keep | Temporary restore |

**Never rollback by physically deleting** accounts, challenges, snapshots, or journal rows. Tombstone or flag batches instead.

What cannot be undone by delete: user-visible assignments they confirmed; treat as data to preserve and correct forward.

---

## 9. Observability plan (no new analytics SDK)

Emit structured logs / existing telemetry counters (Sentry breadcrumbs or internal counters already in app — **no new package**):

| Signal | Why |
|---|---|
| Assignment failures | Integrity of Prop scope |
| Calculation failures | Engine reliability |
| Unsupported rule sets | Catalog gaps |
| Insufficient data gates | Honesty of readiness |
| Old/new metric mismatch | Shadow validation |
| Snapshot latency | Perf budget |
| Duplicate events | Import quality |
| Out-of-order corrections | Replay correctness |
| Breach disagreements | Safety |
| Readiness reconciliation failures | F27-class driver integrity |

Alert thresholds and dashboards are an implementation-phase detail; 0D only requires these signals to be **named and mandatory** before activation (step 8).

---

## 10. Production integration boundary for `src/propOs`

| Gate | `src/propOs` status |
|---|---|
| Now (through 0D approve) | Fully isolated; excluded from app `tsconfig.json`; `tsconfig.prop-os.json` only |
| After 0A–0D FINAL + **Implementation Phase 1 approve** | May add production repository **interfaces** (still no App import) |
| After dual-read shadow gate | May be included in app typecheck as `src/domain/propOs` or re-export; still flag-gated |
| After opt-in assignment | May **read** assignments + journal; write assignments only behind flag |
| After controlled activation | May **write** engine/score snapshots; UI may consume envelopes |
| Prop Pass UI gate | Separate approve; still after domain activation evidence |

**Until the matching gate:** production import of `src/propOs` from `App.tsx` / `YouTraderApp.tsx` / navigation **remains forbidden**.

0D requires a future task to define the **safe merge** into the main TypeScript graph (path alias, package boundary, or move under `src/domain/` with eslint no-restricted-imports until flag).

---

## 11. Migration validation matrix

| # | Scenario | Expectation |
|---|---|---|
| M01 | New user, no trades | Empty accounts; journal empty; no forced challenge |
| M02 | User without firm settings | Catalog browse only; no auto account |
| M03 | User with one firm setting | Suggest one account; trades remain unassigned |
| M04 | Multiple presumed accounts | No merge; user creates N accounts explicitly |
| M05 | Legacy trades without fees | Assignable later; `fees_missing` limitation |
| M06 | Invalid timestamps | `invalid` assignment blocked; quality flag |
| M07 | Duplicate journal client_ids | Unique preserved; Prop dedupe per 0C |
| M08 | Deleted media | Trade remains; media limitation optional |
| M09 | Challenge reset | New challenge row; old retained; `reset_of` link |
| M10 | Historical failed attempt | Remains `breached`/`failed`; not overwritten |
| M11 | Active challenge | Status active; snapshots versioned |
| M12 | Funded account | Separate challenge/phase row |
| M13 | Rollback after shadow | Flag off; legacy UI; snapshots retained |
| M14 | Rule template update | New challenges get new snapshot; old unchanged |
| M15 | Partial migration failure | Idempotent resume; no half-assigned silent bulk |

Executable proof for calc behavior remains `npm run test:prop-os-fixtures` (0C). Migration matrix above is validated in later implementation phases with dry-run scripts — **not in 0D**.

---

## 12. Product decisions (cannot be solved by engineering alone)

| # | Question | Notes / constraint |
|---|---|---|
| P1 | How does a user create a Prop account? | From catalog template + confirm; settings seed optional |
| P2 | Multiple concurrent active challenges? | **Allowed** technically (0A); UX default still open |
| P3 | Default account selection | Needs PO rule (last active / explicit pin) |
| P4 | Manual assignment of old trades? | **Allowed** by domain; UX copy/risk open |
| P5 | Show inferred metrics? | Must be labeled; preference open |
| P6 | How to denote incomplete data? | Limitations[] + UI pattern (YDL) — exact copy open |
| P7 | Soft-retire AI Analytics timing | After consumer audit; not in 0D |
| P8 | When Risk Predictor leaves navigation | Soft-nav after Prop activation evidence |
| P9 | First-wave prop firms | Subset of catalog; list TBD by PO |
| P10 | When to merge `src/propOs` into app TS graph | After Implementation Phase gate (§10) |

Locked already (do not reopen without PO): legacy `unassigned`; no probability until calibration; status > score; firm TZ; snapshot immutability; AI explains only.

---

## 13. Explicit non-goals (reaffirm)

- No applied SQL / no remote schema change in this commit.  
- No `src/propOs` App wiring.  
- No Prop Pass UI.  
- No AI Analytics deletion.  
- No navigation change.  
- No backfill execution.  
- No feature flag activation.  
- No new npm dependencies.  
- No production engine shipping.  
- No probability %.

---

## 14. Recommended first implementation phase (after 0A–0D FINAL)

Only after Product Owner FINAL APPROVE of 0A–0D:

1. Additive schema migration PR (empty tables, RLS specs from §6) — still no UI.  
2. Repository interfaces + shadow runner against 0C fixtures.  
3. Opt-in account creation without trade auto-bind.  

Prop Pass UI remains a **later** gate.

---

## 15. Deliverables checklist (0D)

- [x] Current-to-target schema map (§1)  
- [x] Proposed schema + diagram (§2)  
- [x] Legacy trade assignment states (§3)  
- [x] Dual-read / dual-write steps (§4)  
- [x] Backfill / provenance / idempotency (§5)  
- [x] RLS + threat analysis (§6)  
- [x] Version axes (§7)  
- [x] Rollback matrix (§8)  
- [x] Observability signals (§9)  
- [x] `src/propOs` integration boundary (§10)  
- [x] Validation matrix (§11)  
- [x] Open product decisions (§12)  

**Not done (by design):** applying migrations, code wiring, UI, backfill jobs.

---

## 16. STOP / next gate

**Awaiting Product Owner FINAL review of Phase 0D.**

```text
APPROVE PHASE 0D — then compose Implementation Phase 1
(schema additive + repos/shadow — still no Prop Pass UI)
```

Until FINAL APPROVE of **0A + 0B + 0C + 0D**, do not start production schema application or App integration.
