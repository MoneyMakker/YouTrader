# Codex Handoff File Inventory — 2026-08-02

Redacted classification of dirty working-tree items at cleanup start (HEAD `2c6cd5b`).
Secret values are never included.

Inventory source: `/tmp/youtrader-handoff-inventory-20260802/inventory.json` (outside repo).

## Summary

| Metric | Value |
|--------|-------|
| Untracked files at start | 354 |
| Sensitive content markers | 20 fail / 3 review |
| Total untracked bytes | ~136 MB |
| Modified tracked files | 0 |
| Staged files | 0 |

## Actions taken

| Action | Detail |
|--------|--------|
| Moved | All untracked `docs/releases/1.6.1/**` dirty QA dumps → `artifacts/local-qa-handoff-20260802/` (gitignored via `artifacts/`) |
| Deleted | None beyond empty leftover directories after move |
| Committed | Sanitized handoff docs + evidence index + narrow `.gitignore` rules |
| Sensitive | Device-id / account-adjacent logs moved out of worktree tracked paths; not staged |

## Classification table (representative; full list in external inventory)

| Relative path (pattern) | Classification | Action | Reason | Referenced by handoff | Sensitive review |
|-------------------------|----------------|--------|--------|----------------------|------------------|
| `docs/releases/1.6.1/PHASE4F_LIVE_E2E_RUN_*.md` | LOCAL_QA_ARTIFACT | move→artifacts | Transient live E2E run reports | no | pass |
| `docs/releases/1.6.1/PHYSICAL_*` | LOCAL_QA_ARTIFACT / SENSITIVE_OR_PRIVATE | move→artifacts | Device diagnostics; may include UDID | no | fail→removed from worktree root |
| `docs/releases/1.6.1/SIMULATOR_SERVICE_RECOVERY_*.md` | LOCAL_QA_ARTIFACT | move→artifacts | Simulator recovery dumps | no | fail→removed |
| `docs/releases/1.6.1/YT3_LIVE_E2E_CONTINUATION_REPORT_*.md` | LOCAL_QA_ARTIFACT | move→artifacts | Abandoned continuation report | no | fail→removed |
| `docs/releases/1.6.1/YT3_PHASE4F_STALE_PHYSICAL_ARTIFACT_*.md` | TEMPORARY | move→artifacts | Explicit stale-artifact note | no | pass |
| `docs/releases/1.6.1/evidence-sim-*.png` | LOCAL_QA_ARTIFACT | move→artifacts | Local simulator screenshots | no | pass |
| `docs/releases/1.6.1/evidence/build115-20260801/` | LOCAL_QA_ARTIFACT | move→artifacts | Premature/local 115 attempt dumps | no | pass |
| `docs/releases/1.6.1/evidence/build115-physical-20260801/` | LOCAL_QA_ARTIFACT | move→artifacts | Physical logs / maestro | no | fail→removed |
| `docs/releases/1.6.1/evidence/build115-release-20260801/` | LOCAL_QA_ARTIFACT | move→artifacts | Superseded by `build115-release-20260802` | no | pass |
| `docs/releases/1.6.1/evidence/phase4f-*/` | LOCAL_QA_ARTIFACT | move→artifacts | Phase4F poll/capture/maestro dumps | no | fail on some logs→removed |
| `docs/releases/1.6.1/evidence/settings-cleanup-uiqa-20260802/` | LOCAL_QA_ARTIFACT | move→artifacts | Settings UIQA screenshots/json | no | pass |
| `docs/releases/1.6.1/evidence/phase4f-capture-backends-*/oslog.pid` | TEMPORARY | move→artifacts | Process pid scratch | no | pass |
| `docs/releases/1.6.1/evidence/build115-release-20260802/*` (already tracked) | COMMIT_REQUIRED | keep | Final TF upload + smoke screens | yes | pass |
| `docs/releases/1.6.1/evidence/deletion-smoke-20260802/*` (tracked) | COMMIT_REQUIRED | keep | Google delete PASS + Apple operator | yes | pass |
| `docs/handoff/CODEX_HANDOFF_2026-08-02.md` (tracked) | COMMIT_REQUIRED | update | Primary Codex entry | yes | pass |
| `.env*` / `*.p8` / IPA / `build/` | SENSITIVE_OR_PRIVATE / LOCAL | already ignored | Secrets & binaries | no | N/A (ignored) |
| `docs/releases/**/phase4f-screenshots/` | LOCAL_QA_ARTIFACT | already ignored | Physical screenshot trees | was yes → corrected to optional | N/A |

## UNKNOWN

None remaining after inspection of all `git status --short` paths.

## Notes

- Absolute inventory with sizes lives outside Git under `/tmp/youtrader-handoff-inventory-20260802/`.
- Optional local copy of moved dumps: `artifacts/local-qa-handoff-20260802/` (ignored; not required for Codex).
