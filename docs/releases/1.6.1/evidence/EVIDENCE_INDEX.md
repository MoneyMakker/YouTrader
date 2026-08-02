# Evidence Index — YouTrader 1.6.1

Committed, sanitized evidence only. Local QA dumps live under ignored `artifacts/` and are **not** required for Codex.

| Path | Purpose | Build | Environment | Result | Sanitized | Related gate |
|------|---------|-------|-------------|--------|-----------|--------------|
| `docs/releases/1.6.1/evidence/build115-release-20260802/UPLOAD.json` | TestFlight upload record (EAS Submit) | 1.6.1 (115) | production | UPLOADED / PROCESSING at handoff | yes | TestFlight upload |
| `docs/releases/1.6.1/evidence/build115-release-20260802/YouTrader.build-fingerprint.json` | Archive fingerprint metadata | 1.6.1 (115) | production Release | PASS | yes (no secrets; paths may be local absolute) | Production archive |
| `docs/releases/1.6.1/evidence/build115-release-20260802/300-cold-launch-115.png` | Cold launch Journal smoke | 1.6.1 (115) | production device | PASS | yes (no account UI) | Device smoke |
| `docs/releases/1.6.1/evidence/build115-release-20260802/301-journal.png` | Journal tab after QA deep-link policy | 1.6.1 (115) | production device | PASS (staging_only QA block) | yes | Diagnostics gating |
| `docs/releases/1.6.1/evidence/build115-release-20260802/302-stats.png` | Same session capture | 1.6.1 (115) | production device | PASS | yes | Diagnostics gating |
| `docs/releases/1.6.1/evidence/build115-release-20260802/303-prop.png` | Same session capture | 1.6.1 (115) | production device | PASS | yes | Diagnostics gating |
| `docs/releases/1.6.1/evidence/build115-release-20260802/304-settings.png` | Same session capture | 1.6.1 (115) | production device | PASS | yes | Diagnostics gating |
| `docs/releases/1.6.1/evidence/build115-release-20260802/305-futures.png` | Same session capture | 1.6.1 (115) | production device | PASS | yes | Diagnostics gating |
| `docs/releases/1.6.1/evidence/deletion-smoke-20260802/google-disposable-delete.json` | Google disposable account deletion smoke | n/a (API) | production Supabase | PASS | yes (user id prefix only) | Account deletion |
| `docs/releases/1.6.1/evidence/deletion-smoke-20260802/APPLE_STORED_TRUE_OPERATOR.md` | Operator steps for Apple stored:true/revoke | 1.6.1 (115) | production | NOT CLOSED | yes | Apple token lifecycle |
| `docs/releases/1.6.1/YT3_SCOPE_FREEZE_STATUS_2026-08-01.md` | Release status narrative | 1.6.1 (115) | mixed | status doc | yes | Scope freeze |

## Optional local-only (ignored — do not require)

- `artifacts/local-qa-handoff-20260802/` — relocated Phase4F / physical / simulator dumps from 2026-08-01–02 cleanup
- `docs/releases/**/phase4f-screenshots/` — ignored screenshot trees (including historical RS113 physical QA)

Regenerate physical screenshots with device tooling if needed; conclusions are already summarized in status + handoff docs.
