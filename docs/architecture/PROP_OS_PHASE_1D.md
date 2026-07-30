# Prop OS — Internal Account Management (Phase 1D)

**Status:** FINAL APPROVED  
**Package:** `src/propOs/accounts/`  
**Version:** `account-mgmt-v0`  
**Engine:** remains `calculateChallenge` (no App wiring)

## Boundary

```text
Commands
  → ownership + lifecycle validation
  → AccountManagementStore
  → Prop OS tables (service-role / memory)
  → AccountReadModel (production-neutral)
```

Forbidden until Phase 1E App enablement: Prop Pass UI, navigation, production apply, auto legacy assignment, backfill.

## Commands

| API | Behavior |
|---|---|
| `createPropAccount` | Creates active account |
| `createChallengeAttempt` | New attempt + immutable rule snapshot |
| `createRuleSnapshot` | Only if missing; never mutate existing |
| `setDefaultAccount` | Preference only — not ownership boundary |
| `assignTrade` | Explicit manual / verified_import only |
| `unassignTrade` | unassigned / excluded / invalid + provenance |
| `transitionChallenge` | Allowed lifecycle edges; no breach revive |
| `archiveAccount` | Soft archive; clears default if needed |
| `getAccountReadModel` | Future UI shape; App must not import yet |
| `listActiveChallengesForAccount` | Activation gate helper — no silent multi-pick |

## Assignment states

Domain → DB:

| Domain | DB `assignment_state` |
|---|---|
| `unassigned` | `unassigned` |
| `assigned_manual` | `manual` |
| `assigned_verified_import` | `verified_import` |
| `excluded` | `excluded` |
| `invalid` | `invalid` |

No `assigned_inferred` as verified source.

## QA

```bash
npm run test:prop-os-accounts      # memory contract scenarios
npm run test:prop-os-accounts-pg   # isolated PG (:55432)
npm run test:prop-os-phase1d
```

Default-account preference: production-intended table is `prop_os_user_preferences` (Phase 1E migration file). Local PG QA uses that table after migrations apply. Do not treat `prop_os_internal_prefs` as a production dependency.

## Next

Phase 1E Controlled Activation — [`PROP_OS_PHASE_1E.md`](./PROP_OS_PHASE_1E.md).
