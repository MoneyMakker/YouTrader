# Aikido PASS — Build 117 full rescan

**Status:** PASS  
**Date:** 2026-08-03  
**HEAD scanned:** `ba46be4` (`feature/prop-pass-trading-os-build117`)  
**Auth:** Browser OAuth after revoked-token cache/keychain clear; `aikido_login` confirmed signed in; revoked chat token not reused.

## PASS criteria (all met)

| Criterion | Evidence |
|---|---|
| Every full-scan batch completed | 63 / 63 mini batches (`mini-000` … `mini-062`) |
| No blocking application-owned findings | 0 blocking |
| No scan failed on authentication | `auth_ok: true`; 0 Unauthorized/sign-in errors in batch results |
| Revoked token no longer accepted | Prior keychain/cache cleared; fresh OAuth credential used |
| Scan ran against latest Build 117 HEAD | Progress + results recorded for `ba46be4` |

Local artifacts (not committed): `.tmp/aikido-scan/progress.json`, `.tmp/aikido-scan/results/mini-*.json`.

## Non-blocking finding (mitigated)

| Rule | File | Verdict |
|---|---|---|
| `AIK_supabase_sdk_storage_path_traversal` | `src/app/YouTraderApp.tsx:725` | Mitigated — `parseStorageRef` rejects `..` / control chars; `cloudSafeAssetUrlForUser` requires `${userId}/` prefix and expected bucket; client uses user JWT (not service role). No code change required for PASS. |

Prior prototype-pollution finding in `supabase/functions/_shared/aiPlatform/config.ts` remains fixed at `1a3a49a`; focused rescan of that file reported 0 SAST issues.

## Explicit non-claims

- This PASS does **not** authorize production migration apply.
- This PASS does **not** authorize App Store Review, external TestFlight, metadata changes, or public release.
- Build 116 remains immutable; build 118 is not authorized.
