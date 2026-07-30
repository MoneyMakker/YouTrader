# Prop Pass — Internal Read-Only Foundation (Phase 2A)

**Status:** FINAL APPROVED (Phase 2A)  
**Remediation:** live authenticated vertical slice (`b072f52`)  
**Next:** Phase 2B — Internal Account & Challenge Setup (`docs/architecture/PROP_OS_PHASE_2B.md`)  
**Package:** `src/propPass/`  
**Activation:** Phase 1E gateway (`createPropOsAppGateway`)  
**App entry:** Settings → Prop Pass (Internal) — only when env is local/staging **and** mode is `internal_read_only` | `staging_preview`

## Read-model remediation

`getAccountReadModel` no longer picks the first active challenge by array order.

| `challengeSelectionState` | `activeChallenge` | Notes |
|---|---|---|
| `none` | `null` | Zero active-like challenges |
| `resolved` | non-null | Exactly one active, or explicit `selectedChallengeId` |
| `selection_required` | `null` | Multiple actives; no silent pick |

Historical / breached attempts are never promoted to active by fallback. Selection is not an authorization boundary.

## Live authenticated factory (remediation)

Client-safe SELECT-only path for local/staging proof:

```text
YouTraderApp → registerPropPassSupabaseClient(supabase)
  → getPropPassGateway
  → tryCreatePropPassAccountsFactory (env + mode gated)
  → createSupabasePropOsReadTransport | injected PropOsReadTransport
  → createAuthenticatedPropOsReadStore (mutations forbidden)
  → AccountManagementService.getAccountReadModel
  → activation freshness / integrity
  → PropPassUiState.available
```

Factory returns `null` in production / `off` / kill-switch / missing client. Never bundles service-role. Domain/UI stay transport-unaware.

Isolated live QA DB: `prop_os_live2a` on local Postgres `:55432` only — not production.

## Architecture

```text
Settings (gated entry)
  → PropPassInternalScreen
  → usePropPassAvailability
  → getPropPassGateway (lazy)
  → activation policy / eligibility / freshness
  → AccountReadModel
  → PropPassUiState / PropPassViewModel
```

React components must not import `calculateChallenge`, account stores, or shadow runners.

## UI states

Discriminated `PropPassUiState` — every activation gate maps to exactly one kind. Unavailable states never become score `0`.

## Staging selection

Temporary challenge preview lives in screen/controller local state only — non-persistent, non-production.

## QA

```bash
npm run test:prop-pass-phase2a
npm run test:prop-pass-live-slice
npm run test:prop-os-accounts
npm run test:prop-os-activation
```

Structured captures: `.tmp/prop-pass-live-captures/`

## Forbidden (still)

Production navigation, mutations, Pass Probability, AI, public rollout, production DB apply.

## Waiting for

Product Owner FINAL approval.
