# YouTrader 1.6.0 build 107 reconciliation

## Purpose

This branch is a controlled reconciliation of the real 1.6.0 product line. It
starts from `da55c5b` rather than the obsolete `origin/main` compatibility line
(`800d635`, 1.5.8 / build 83). The source worktree remains untouched.

## Reviewed source changes

| Area | Files | Decision |
| --- | --- | --- |
| Native release metadata | `app.json`, `Info.plist`, Xcode project | Keep 1.6.0 / build 107 consistently. |
| AI Coach and Trade Vision | `App.tsx`, `src/api/aiCoach.ts`, AI provider/schema/rate-limit files, local cache | Keep. The feature is an educational review only, has bounded image size, and does not record image data as analytics. |
| Market intelligence | market client, card, provider/schema, function | Keep. It uses visible supplied headlines when available and makes sparse evidence explicit. |
| Trading behavior | revenge detector | Keep. It applies recent-trade context when a selected date has no trades. |
| Entitlement lookup | shared RevenueCat helper and its two consumers | Keep with privacy remediation: no raw user identifier or provider error text is logged. |
| Session cache cleanup | user cache | Keep. Local AI cache keys do not persist a raw user identifier. |

## Agent-007 overlay

The validated analytics integration adds the allowlisted, authenticated,
non-blocking event transport and its Edge proxy. It also adds the first journal
entry/value-moment events and makes release checks derive their version/build
from the current project metadata.

## Intentionally excluded

- `.env` files, credentials, private keys, local Supabase state, and iOS local
  environment files.
- `node_modules`, Pods, IPA files, build outputs, Expo artifacts, logs,
  backups, recovery directories, temporary swap files, and generated reports.
- Any code from the 1.5.8 compatibility line that is not already present in
  the 1.6.0 base or a reviewed overlay.

## Release constraints

- Version remains `1.6.0`; iOS build remains `107`.
- No TestFlight or App Store upload is part of this branch.
- RevenueCat products, offerings, entitlements, purchase flow, restore flow,
  Supabase RLS, and authentication contracts are not changed.
