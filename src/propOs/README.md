# Prop OS domain package (Phase 1B–1D)

Production-grade **pure** calculation engine (`calculateChallenge`), isolated **shadow pipeline** (`src/propOs/shadow/`), and internal **account management** (`src/propOs/accounts/`).

No App UI, AI, or RevenueCat wiring until Phase 1E.

## Rules

- Do **not** import from `App.tsx` / navigation / screens until Phase 1E.
- Do **not** import deprecated `replayChallenge` in new code.
- Engine must not import Supabase / React / RevenueCat / AI / UI tokens.
- Account management uses service-role stores only in isolated harnesses.

## Layout

| Path | Role |
|---|---|
| `engine.ts` | Production `calculateChallenge` |
| `shadow/` | Phase 1C shadow runner + snapshots |
| `accounts/` | Phase 1D internal account/challenge/assignment commands |
| `fixtures/` | F01–F29 scenarios |

## Commands

```bash
npm run test:prop-os-engine
npm run test:prop-os-shadow
npm run test:prop-os-accounts
npm run test:prop-os-accounts-pg
npm run typecheck
```

See `docs/architecture/PROP_OS_PHASE_1B.md`, `PROP_OS_PHASE_1C.md`, `PROP_OS_PHASE_1D.md`.
