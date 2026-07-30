# Prop OS — Controlled Activation (Phase 1E)

**Status:** READY FOR REVIEW  
**Package:** `src/propOs/activation/`  
**Contract:** `prop-os-activation-v0`  
**Production App:** unchanged (activation defaults to `off`; App.tsx not wired)

## Goal

Dormant, reversible, observable activation layer for local/staging Prop OS validation without changing production App behavior.

## Activation modes

| Mode | Behavior |
|---|---|
| `off` | Zero Prop OS DB/calc calls; identical App behavior |
| `shadow` | Isolated runner may persist shadow results; App-invisible |
| `internal_read_only` | Allowlisted users may retrieve read model; no Prop Pass UI / mutations |
| `staging_preview` | Staging harness may inspect full read model |

Unknown / missing / malformed → `off`. No public production mode.

## Architecture

```text
App or internal harness
  → Activation policy (resolve + kill switch)
  → Eligibility gates (allowlist, schema)
  → Prop OS read service
  → Account read model
```

Engine, account domain, and repositories remain flag-unaware.

## App boundary

`createPropOsAppGateway` is the only typed App-facing service.

Phase 1E **does not** import it from `App.tsx` / `YouTraderApp.tsx` (schema static QA + activation QA enforce disconnection).

When wired later:

* default `off`
* no Prop Pass navigation
* no screen → domain imports
* service-role impossible in bundle
* `off` → zero Prop OS store calls
* failures fall back to existing experience
* startup not blocked on Prop OS checks (`peekAvailability` is sync / local)

## Default-account preference (Option A)

Migration (file only — **not applied to production**):

`supabase/migrations/20260730210000_prop_os_controlled_activation_read.sql`

Creates `prop_os_user_preferences` (owner-scoped). Default account is preference only — never authorization.

QA-only `prop_os_internal_prefs` is removed as a dependency; local PG account store uses `prop_os_user_preferences`.

## Freshness policy

A snapshot is current only when:

* `input_revision` matches current revision (when provided)
* `calculation_version` ∈ allowlist
* `confidence_policy_version` ∈ allowlist
* `rule_set_version` matches current rule snapshot (when provided)
* optional `maxAgeMs` not exceeded

Time alone never proves freshness.

## Read-model gates

`available` | `activation_off` | `ineligible` | `missing_user` | `no_account` | `no_active_challenge` | `multiple_active_challenges` | `missing_rule_snapshot` | `no_shadow_snapshot` | `stale_snapshot` | `incomplete_data` | `unsupported_calculation` | `integrity_mismatch` | `repository_unavailable` | `schema_incompatible` | `evaluation_error`

Multiple active challenges **require explicit resolution** — no silent pick.

Archived accounts remain historically readable to the owner.

## Fallback matrix

| Condition | Mode/Gate | App effect |
|---|---|---|
| Missing/invalid config | `off` / `activation_off` | Existing journal UX |
| Kill switch | `off` | Immediate stop of new reads |
| Ineligible / missing user | `ineligible` / `missing_user` | Existing UX |
| Repo/schema/integrity failures | corresponding gate | Existing UX |
| Evaluation throw | `evaluation_error` | Existing UX |

Failures must not block startup, auth, navigation, or journal.

## Kill switch / rollback

1. Set `EXPO_PUBLIC_PROP_OS_KILL_SWITCH=true` or `PROP_OS_KILL_SWITCH=true`, **or** set mode to `off`.
2. New Prop OS reads/calculations stop immediately at the activation boundary.
3. No data deletion; historical snapshots untouched.
4. No App release required when config is remotely controlled.

Phase 1E ships env/local kill-switch contract only (no new vendor).

See `PROP_OS_PHASE_1E_ROLLBACK.md`.

## Observability events

Safe structured events:

* `activation_mode_resolved`
* `user_eligible`
* `schema_compatible`
* `read_model_available`
* `fallback_activated`
* `snapshot_stale`
* `integrity_mismatch`
* `kill_switch_used`
* `repository_latency`
* `unexpected_activation_error`

Never log: service keys, tokens, private notes, full executions, raw rule snapshots, complete user ids (use `redactId`).

## Env (dormant defaults)

```bash
# Absent → off
EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE=off
EXPO_PUBLIC_PROP_OS_KILL_SWITCH=false
EXPO_PUBLIC_PROP_OS_ALLOWLIST=
# EXPO_PUBLIC_PROP_OS_MAX_SNAPSHOT_AGE_MS=
```

## QA

```bash
npm run test:prop-os-activation
npm run test:prop-os-activation-pg
npm run test:prop-os-activation-secrets
npm run test:prop-os-phase1e
```

## Forbidden (still)

Prop Pass UI, production migration apply, public rollout, Edge/Cron, readiness/confidence scores in UI, auto legacy assign, broker, AI explain, Performance Intelligence.

## Waiting for

Product Owner approval.
