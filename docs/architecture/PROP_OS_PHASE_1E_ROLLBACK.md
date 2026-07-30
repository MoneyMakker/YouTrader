# Prop OS Phase 1E — Deployment & Rollback Runbook

**Scope:** Controlled activation only. Production database apply is **out of scope** until separate Ops approval.

## Deploy (local / staging only)

1. Confirm target is **not** production Supabase.
2. Apply additive migrations in order (includes `20260730210000_prop_os_controlled_activation_read.sql`).
3. Leave activation env unset or `EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE=off`.
4. For staging preview only: set mode `staging_preview` + allowlist + confirm schema version.
5. For internal read: mode `internal_read_only` + allowlist.
6. Never enable a public production mode (not implemented).

## Prove off

```bash
npm run test:prop-os-activation   # scenario 3 zero-call
# App.tsx must not import propOs
```

## Kill switch (immediate)

| Action | Effect |
|---|---|
| `EXPO_PUBLIC_PROP_OS_KILL_SWITCH=true` | Forces `off` at policy boundary |
| `EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE=off` | Same |
| Remove/malform config | Resolves to `off` |

Expected:

* New Prop OS reads stop
* Existing App / journal unchanged
* No snapshot deletion or mutation
* No App store release required when config is remotely controlled

Remote config vendor is **not** added in 1E — implement adapters against `KillSwitchContract` / `RemoteKillSwitchSource` later.

## Rollback database (if staging applied)

1. Kill-switch / mode `off` first (App-safe).
2. Optionally drop authenticated SELECT policies + `prop_os_user_preferences` only on non-production after Ops review.
3. Do **not** delete historical `prop_engine_snapshots` as a rollback step.

## Production

Production remains untouched until a separate Ops approval for migration apply and activation enablement.
