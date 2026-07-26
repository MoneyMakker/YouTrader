# Release Process

```text
Development → Review → Testing → QA → Approval → TestFlight → Production
```

## Development and Review

Follow the one-task workflow in [AGENTS.md](../AGENTS.md) and execute tasks in
[BACKLOG.md](./BACKLOG.md): focused implementation, tests, self-review,
documentation, one commit, independent review, then Product Owner approval.

## Release Checklist

- Approved task commits only; clean reviewed diff.
- Typecheck, applicable tests, security checks, Gitleaks, translation checks, and release stability checks pass.
- Device QA covers auth, journal, sync, media, AI, subscriptions, settings, export, deletion, accessibility, and offline recovery.
- Privacy disclosures, permission strings, screenshots, support/legal URLs, and subscription metadata are accurate.
- Preview/TestFlight validation precedes production release.
- Rollback owner, release notes, and incident contacts are identified.
- The release-verification task in [BACKLOG.md](./BACKLOG.md) is approved and
  its pending environment-specific checks are explicitly recorded.

## Definition of Done

Release work is ready only when implementation, tests, documentation, independent review, and Product Owner approval are complete. Existing release reports and gates are retained in [PRODUCTION_READINESS_GATE.md](./PRODUCTION_READINESS_GATE.md), [RELEASE_COMMAND_CENTER.md](./RELEASE_COMMAND_CENTER.md), and [APP_STORE_RELEASE_CHECKLIST.md](./APP_STORE_RELEASE_CHECKLIST.md).

## Blocking Issues

Block release for authentication/authorization failures, data-loss risk, migration uncertainty, failed tests, broken subscription flows, inaccessible primary workflows, privacy disclosure gaps, or unverified rollback/recovery.

## Versioning and Rollback

Keep package, Expo, iOS build, runtime-version, and release documentation consistent. Preview first; production is an explicit approval. Roll back OTA changes through the documented EAS process; use a native fix when an OTA rollback cannot safely address the issue.

## Hotfix Process

1. Triage and reproduce.
2. Scope the smallest safe change.
3. Add regression coverage.
4. Run focused and release checks.
5. Obtain expedited approval.
6. Release through preview/TestFlight when feasible.
7. Document impact, rollback, and follow-up work.
