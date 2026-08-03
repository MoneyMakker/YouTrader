# Credential Incident — 2026-08-03

## Classification

- Affected tracked path: `docs/app-review-auth.md`
- Credential categories: email/username; password
- Intended use: disposable App Review test account
- Authoritative identity provider indicated by repository metadata: Supabase Auth
- Apple and Google credentials detected in the affected fields: no
- API keys, tokens, recovery codes, or sandbox tester credentials detected: no
- Placeholder/example status: not proven
- Active status: unknown
- Rotation status: `BLOCKED_BY_INTERACTIVE_AUTH`
- Revocation status: `BLOCKED_BY_INTERACTIVE_AUTH`
- Old-session invalidation: `BLOCKED_BY_INTERACTIVE_AUTH`

No credential values, identifiers, fragments, hashes, lengths, screenshots, or
recovery material are recorded in this report.

## Exposure Scope

- First commit containing the exact affected credential fields:
  `0d2c1cc`
- Last commit introducing those exact values:
  `0d2c1cc`
- Current tracked tree before remediation: affected
- Other current tracked paths containing the exact credential values: none
- Generated/release evidence containing the exact credential values: none found
- Current CI configuration containing the exact credential values: none found
- Local ignored artifacts containing the exact credential values: none found
- Earlier reachable Git history: affected
- Other branches: affected through shared ancestry
- Tags: affected through shared ancestry, including immutable release provenance

Remote CI log retention cannot be proven from repository contents and remains
an external audit item. No CI log content was downloaded or exposed.

## Current-Tree Remediation

- Unsafe tracked document: removed
- Safe tracked replacement: `docs/app-review-auth.template.md`
- Optional local operational path: `docs/app-review-auth.local.md`
- Local operational path tracked by Git: prohibited
- Replacement credentials committed to Git: prohibited
- Automated tracked-document guard: required and included with this incident

The targeted guard is defense in depth. It rejects tracked App Review
authentication documents other than the approved placeholder template, but it
does not replace provider-side rotation, reachable-history scanning, or the
repository-wide secret scanners.

## History Decision

Decision: `REQUIRES_AUTHORIZATION`.

History must not be rewritten until the old credential is rotated, revoked,
and verified inactive. A purge would rewrite shared branches and immutable
TestFlight source provenance, require force-pushes, invalidate collaborator
clones, and require coordinated release-provenance repair. No history rewrite,
force-push, tag movement, or Gitleaks allowlist for the credential is authorized
by this remediation.

If provider verification proves the old credential inactive and repository
policy permits retention of revoked material, rotation plus current-tree
removal may be sufficient. Otherwise a separately authorized purge plan is
required.

## Verification

Safe checks do not print credential contents:

```bash
npm run security:app-review-credentials
npm run security:check
npm run security:audit
npm run security:gitleaks
npm run security:gitleaks:history
npm run security:semgrep
```

Required provider-side records use status labels only:

- `ROTATED`
- `REVOKED`
- `VERIFIED_INACTIVE`
- `BLOCKED_BY_INTERACTIVE_AUTH`
- `NOT_A_REAL_CREDENTIAL`

## Release Gate

Build 117 remains blocked until rotation, revocation, old-session invalidation,
and inactive-login verification are complete. Aikido is also unavailable due
to authentication failure and must not be reported as passed.
