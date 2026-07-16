# App Review credential handoff — owner-only template

Do not commit this record with values. Keep the current values only in the approved release secret manager or the owner-controlled App Store Connect review-note process.

```text
APP_REVIEW_TEST_EMAIL=<stored securely>
APP_REVIEW_TEST_PASSWORD=<stored securely>
```

Before a submission, the release owner confirms that the account is active, email-confirmed, least-privileged, and has only the required demo access. After a rotation, update App Store Connect App Review Information outside Git and verify sign-in on a clean device. Do not put account credentials in CI logs, screenshots, tickets, issues, or chat.

## Mandatory next-build App Review gate

For the next eligible App Store submission, the release owner must:

1. Replace the App Review username in App Store Connect with the current approved account from the owner-only credential record.
2. Enter its password only in the protected App Store Connect password field; never place it in review notes.
3. Update the review notes without disclosing credentials outside their dedicated fields.
4. Verify sign-in and the required demo flow on a clean installation.

Block App Store submission until all four checks pass. This gate applies to a new build only; it does not require changing immutable App Review information for an already-created build.
