# App Review credential handoff — owner-only template

Do not commit this record with values. Keep the current values only in the approved release secret manager or the owner-controlled App Store Connect review-note process.

```text
APP_REVIEW_TEST_EMAIL=<stored securely>
APP_REVIEW_TEST_PASSWORD=<stored securely>
```

Before a submission, the release owner confirms that the account is active, email-confirmed, least-privileged, and has only the required demo access. After a rotation, update App Store Connect App Review Information outside Git and verify sign-in on a clean device. Do not put account credentials in CI logs, screenshots, tickets, issues, or chat.
