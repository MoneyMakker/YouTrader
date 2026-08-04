# PPOS-117 — Production SQL deployment result

**Date:** 2026-08-04  
**PO SQL approval:** YES (explicit coordinated authorization)  
**Starting HEAD:** `ea87337`  
**Final HEAD:** see tip after evidence commit  
**Production project:** `izzrlsgumyabdvlmwlwn`  
**Production modified:** YES (authorized SQL only)  
**PI migrations applied:** NO  

Approval packet: `docs/releases/1.6.1/PPOS-117_FINAL_SQL_MIGRATION_APPROVAL.md`

---

## Activation state (preserved OFF for real users)

| Control | State | Proof |
|---|---|---|
| Client wake-ups | **OFF** | Production app env not in Prop Pass staging envs; wake gated by `entryVisible` |
| Command allowlist | **empty (0)** | `prop_os_command_allowlist` count = 0 |
| Real-user Build 117 activation | **NOT AUTHORIZED** | Separate PO activation approval required |
| Open queue after cleanup | **0** | pending/processing/failed = 0 |

`commands_enabled` defaults true, but commands also require allowlist membership. Existing users are not allowlisted.

---

## Applied migrations (exact order + full SHA-256)

| # | Filename | SHA-256 | Ledger |
|---:|---|---|---|
| 1 | `20260730190000_prop_os_database_foundation.sql` | `5ca0845a6f9fca338381be902675e9e8246bfc6b5925205b5c00064048b25f7f` | APPLIED |
| 2 | `20260730210000_prop_os_controlled_activation_read.sql` | `055e3a0a91f86a2b9733c059d45768bc47ac51f39e319a6e4621b06f599f3f54` | APPLIED |
| 3 | `20260730220000_prop_os_internal_commands.sql` | `eae741e9852c76c981a3960561a2f76178668fb951b2530d34a5f48010ded425` | APPLIED |
| 4 | `20260730230000_prop_os_command_boundary_hardening.sql` | `5efa8e3e04aec573af3b4ed3b180ebf280254fce1b689f89f58c58247fc4ae96` | APPLIED |
| 5 | `20260730240000_prop_os_trade_assignment_commands.sql` | `5e092feabb349246bd17438c0107a87cbbbfafe51bffd54f46ad86644b48179d` | APPLIED |
| 6 | `20260730250000_prop_os_assignment_recalc_hardening.sql` | `d17eaecc0804bd9fd48b7f9d1dfe65d4c718f2ee6eb976051a4bd344e4070469` | APPLIED |
| 7 | `20260730260000_prop_os_assignment_identity_invariant.sql` | `12e960caf36d32865038ee935236c8e0788b3bca90d46b7bcde02126b1fe5230` | APPLIED |
| 8 | `20260802212828_prop_pass_trading_os_persistence.sql` | `9b0edf1b2eab15201c17806a93a7a0a17e026433cb1718e4011c06e3b14f2059` | APPLIED |
| 9 | `20260802223818_prop_pass_build117_persistence_hardening.sql` | `d1a4037e60a18fb80c7f5c3d775788fdcde24a83d58bcda536411690c8eb19fe` | APPLIED |
| 10 | `20260802225538_prop_pass_journal_automatic_sync.sql` | `f7ca73e3ba681c898ada9529674598f9190b4b2e013b815e5d14eaf0d66947fe` | APPLIED |
| 11 | `20260802232311_prop_pass_pipeline_v2_runtime.sql` | `bac3bca3951bbab11848a8bcd38bd1ed272b479f20b6390ff809364f43b6ea6d` | APPLIED |
| 12 | `20260802233700_prop_pass_runtime_processing_queue.sql` | `ecd79a18e68fef367a176cb08d602b237f6b4d2cf2cd5172affdf62e1fa5e09c` | APPLIED |
| 13 | `20260802235500_prop_pass_settings_recalculation_events.sql` | `724672da606c1aab21bba7b5b9f2e11113b80c4ad1a52f01edfe356dca5c3e9a` | APPLIED |

Method: `supabase db push --linked --include-all` against `izzrlsgumyabdvlmwlwn`, one migration released at a time after dry-run confirmed the exact 13-file set.  
Migration 4 allowlist preflight: table absent before apply; count **0** after apply.

Not applied: PI foundation / remediation / timeout-reaper.

---

## Schema / RLS

| Gate | Result |
|---|---|
| Required tables/functions | PASS |
| Journal `prop_pass_revision` | PASS |
| Claim / complete / fail / settings-queue RPCs | PASS |
| RLS enabled + forced on Prop Pass tables | PASS |
| Allowlist empty | PASS |

---

## Build 116 compatibility

Evidence: `docs/releases/1.6.1/evidence/B116_COMPAT_PRODUCTION_LATEST.json` — **PASS**

- Auth / Journal create-read-edit-delete  
- No fabricated Prop Pass account  
- No mandatory Build 117 queue for unassigned trades  
- Logout compatible  

---

## Remaining

- Explicit **PO activation approval** still required before client wake-ups / real-user Build 117 processing.  
- Processor result: see `PPOS-117_PRODUCTION_PROCESSOR_DEPLOYMENT_RESULT.md`.

PRODUCTION SQL MIGRATIONS: PASS
