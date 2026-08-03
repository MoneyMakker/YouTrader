# Credential Incident — 2026-08-03

## Classification

- Affected tracked path: `docs/app-review-auth.md`
- Credential categories: email/username; password
- Intended use: disposable App Review test account
- Authoritative identity provider indicated by repository metadata: Supabase Auth
- Apple and Google credentials detected in the affected fields: no
- API keys, tokens, recovery codes, or sandbox tester credentials detected: no
- Placeholder/example status: not proven
- Active credential rotated: `PASS`
- Old password rejected: `PASS`
- Replacement credential verified: `PASS`
- Replacement stored outside Git and Cursor: `PASS`
- Rotation status: `ROTATED`
- Revocation status: `VERIFIED_INACTIVE`
- Old-session invalidation: `PASS`

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
- Replacement credential detected in Git or Cursor: no
- Automated tracked-document guard: required and included with this incident

The targeted guard is defense in depth. It rejects tracked App Review
authentication documents other than the approved placeholder template, but it
does not replace provider-side rotation, reachable-history scanning, or the
repository-wide secret scanners.

## History Decision

Decision: `NO_HISTORY_REWRITE`.

The old credential is rotated, rejected by the provider, and verified inactive.
The repository security policy requires immediate rotation after exposure but
does not require rewriting shared history after verified revocation. The
remaining reachable value is therefore classified as revoked historical
material. No Gitleaks allowlist was added.

A purge would rewrite shared branches and immutable TestFlight source
provenance, require force-pushes, invalidate collaborator clones, and require
coordinated release-provenance repair. Per release-owner instruction, no history
rewrite, force-push, or tag movement will be performed.

## Verification

Manual provider verification, completed outside Git and Cursor:

- Old password authentication: rejected
- Replacement password authentication: successful
- Replacement storage: approved password manager only

Server-side production verification used the explicit project reference and
returned one matching disposable account. It found zero sessions created before
the latest successful replacement authentication and zero unrevoked refresh
tokens belonging to previous sessions. One current session and one current
unrevoked refresh token were expected from replacement-credential verification.
No account identifier, session identifier, token, email, or credential was
printed or retained.

Local verification after rotation:

- Credential-document guard: `PASS`
- Current tracked-tree Gitleaks scan: `PASS`
- Semgrep blocking findings: `0`
- Dependency audit: `0` high, `0` critical, `3` moderate
- Reachable-history Gitleaks finding: known revoked historical material
- Aikido: `BLOCKING` — authenticated scan still rejects the cached token

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

Credential rotation, inactive-login verification, and previous-session
invalidation are complete. Build 117 remains blocked until the authenticated
Aikido scan completes successfully; the login flow currently reports an invalid
cached token and must not be reported as passed.
