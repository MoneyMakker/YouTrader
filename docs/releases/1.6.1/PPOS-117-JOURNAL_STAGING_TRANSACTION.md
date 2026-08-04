# PPOS-117 — Journal staging transaction + remote retry proof

## Scope

Remote staging proof for Journal ↔ Prop Pass synchronization on YouTrader Staging
(`zleojeqkzizeyerhjpur` only). Production (`izzrlsgumyabdvlmwlwn`) was not touched.

## Runner

```bash
npm run test:prop-pass-journal-staging-transaction
```

Sanitized evidence:

- `docs/releases/1.6.1/evidence/JOURNAL_STAGING_TRANSACTION_LATEST.json`

## Results (latest green run)

| Gate | Result |
| --- | --- |
| Journal save synchronization | PASS |
| Journal edit synchronization | PASS |
| Journal delete synchronization | PASS |
| Remote network retry (lost response / duplicate event key) | PASS |
| Duplicate event protection | PASS |
| Reload convergence | PASS |
| Cross-user denial | PASS |
| Multi-account isolation | PASS |
| Staging cleanup (mutable rows + scrubbed disposable identities) | PASS |

Additional remote assertions: timeline idempotency, frozen Daily Plan unchanged
after trade/edit, edit/delete retry idempotency, direct protected write denial,
provider-token read denial, runtime processor retry on pending events.

## Cleanup policy

Prop OS accounts, challenges, executions, daily plans, timeline events, and
decision replays are append-only / mutation-forbidden. Disposable auth users
cannot always be hard-deleted while those FK residuals remain.

Permitted cleanup therefore:

1. Deletes mutable synthetic rows (`trade_journal`, assignments, processed
   journal events, runtime settings).
2. Archives accounts and abandons active challenges when updates are allowed.
3. Voids leftover active executions.
4. Bans + anonymizes disposable auth users (`@youtrader.qa.invalid`).

Append-only residuals under scrubbed identities are expected and recorded in
evidence (`appendOnlyResidualExpected: true`).

## Production

PRODUCTION MIGRATION READY: NO  
EXPLICIT PO APPROVAL REQUIRED: YES
