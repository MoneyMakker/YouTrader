# App Review Authentication

This tracked file contains placeholders only. Never store operational
credentials, realistic examples, recovery codes, tokens, or account identifiers
in Git.

Account email:
[Stored in approved secure credential manager]

Password:
[Stored in approved secure credential manager]

Credential owner:
[Authorized release owner or team role]

Last rotation:
[YYYY-MM-DD]

Secure location:
[Approved credential manager record name; no secret value]

## Before review submission

- Confirm the disposable App Review account is active.
- Confirm review access does not depend on interactive 2FA.
- Confirm the account contains no real customer or trading data.
- Confirm the current credential is stored outside Git.
- Confirm the previous credential is revoked and its sessions are invalidated.
- Run `npm run security:app-review-credentials`.
- Run the repository security and reachable-history scans.
