# Prop Pass — Internal Read-Only Foundation (Phase 2A)

**Status:** READY FOR REVIEW  
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
npm run test:prop-os-accounts
npm run test:prop-os-activation
```

## Forbidden (still)

Production navigation, mutations, Pass Probability, AI, public rollout, production DB apply.

## Waiting for

Product Owner approval.
