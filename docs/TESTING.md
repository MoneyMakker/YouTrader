# Testing Strategy

## Philosophy

Testing proves user trust flows, not merely isolated functions. A test is complete only when it covers expected behavior, failure behavior, and recovery where applicable.

## Test Layers

| Layer | Scope |
|---|---|
| Unit | Pure analytics, validation, parsing, quota, and storage adapters. |
| Integration | Supabase RLS, RPC, Edge Functions, Storage, entitlement, and migration behavior. |
| Regression | Previously fixed auth, rate-limit, export, usage, and release issues. |
| Negative | Cross-user access, invalid inputs, denied roles, malformed requests, duplicate requests. |
| Device QA | Native auth, SecureStore, purchases, camera/library, offline sync, notifications, accessibility. |
| Performance QA | Startup, chart/list rendering, memory/media handling, background behavior. |
| Release QA | Versioning, signing, preview/TestFlight, rollback, privacy, App Review requirements. |

## Current Commands

Use only applicable commands and report unavailable tooling honestly:

```text
npm run typecheck
npm run security:check
npm run security:gitleaks
npm run security:audit
npm run translations:check
npm run test:session-storage
npm run test:export-rate-limit
npm run test:email-password
npm run test:usage-limits
npm run test:maestro
npm run release:stability
```

## Manual Verification Checklist

- New and returning authentication flows.
- Trade create, edit, delete, import, export, and account switch.
- Offline create/update/delete followed by reconnect and restart.
- Screenshot/voice upload, protected read, retry, and failure.
- AI success, quota, timeout, fallback, and duplicate retry.
- Purchase, restore, cancellation, expired/grace entitlement states.
- Account export, logout, deletion confirmation, and recovery states.
- VoiceOver, Dynamic Type, dark mode, Reduce Motion, and real-device behavior.

## Test Completeness

Every task in [BACKLOG.md](./BACKLOG.md) identifies applicable unit/integration/regression/negative/device tests. Pending environment-dependent tests must be checked into the plan or test suite but must never be reported as passed. See [RELEASE.md](./RELEASE.md) for release gates.
