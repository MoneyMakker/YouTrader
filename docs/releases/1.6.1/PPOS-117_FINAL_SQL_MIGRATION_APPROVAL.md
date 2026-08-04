# PPOS-117 — Final SQL migration approval packet

**Date:** 2026-08-04  
**Branch:** `feature/prop-pass-trading-os-build117`  
**Document HEAD:** see tip after this commit lands  
**Pre-checkpoint:** `1fbed10` / expanded checkpoint `477706a`  
**Production project:** `izzrlsgumyabdvlmwlwn`  
**Production modified:** NO  

This packet authorizes **SQL only** (separate from Edge processor).  
Do **not** apply to production without explicit PO SQL approval.

---

## Minimal ordered migration count

**13** (Performance Intelligence migrations removed)

### Removed optional migrations

| Filename | Classification | Proof |
|---|---|---|
| `20260730270000_prop_os_performance_intelligence.sql` | REQUIRED_ONLY_IF_PI_ENABLED | No refs from migrations 11–16 / Prop Pass set; runtime processor has 0 PI refs; PI UI adapters optional |
| `20260730280000_prop_os_performance_intelligence_remediation.sql` | REQUIRED_ONLY_IF_PI_ENABLED | same |
| `20260731290000_prop_os_pi_timeout_reaper.sql` | REQUIRED_ONLY_IF_PI_ENABLED | same |

Journal → assignment → event → claim → runtime path does **not** require PI SQL.

---

## Exact ordered SQL table

| order | filename | full SHA-256 | purpose | prerequisite | additive | destructive | B116 compatible |
|---:|---|---|---|---|---|---|---|
| 1 | `20260730190000_prop_os_database_foundation.sql` | `5ca0845a6f9fca338381be902675e9e8246bfc6b5925205b5c00064048b25f7f` | Prop OS core tables | prod baseline | YES | NO | YES |
| 2 | `20260730210000_prop_os_controlled_activation_read.sql` | `055e3a0a91f86a2b9733c059d45768bc47ac51f39e319a6e4621b06f599f3f54` | activation prefs | 1 | YES | NO | YES |
| 3 | `20260730220000_prop_os_internal_commands.sql` | `eae741e9852c76c981a3960561a2f76178668fb951b2530d34a5f48010ded425` | account/challenge cmds | 1–2 | YES | NO | YES |
| 4 | `20260730230000_prop_os_command_boundary_hardening.sql` | `5efa8e3e04aec573af3b4ed3b180ebf280254fce1b689f89f58c58247fc4ae96` | command gate + allowlist | 3 | YES | NO | YES |
| 5 | `20260730240000_prop_os_trade_assignment_commands.sql` | `5e092feabb349246bd17438c0107a87cbbbfafe51bffd54f46ad86644b48179d` | assignment + revision helpers | 4 | YES | NO | YES |
| 6 | `20260730250000_prop_os_assignment_recalc_hardening.sql` | `d17eaecc0804bd9fd48b7f9d1dfe65d4c718f2ee6eb976051a4bd344e4070469` | recalc hardening | 5 | YES | NO | YES |
| 7 | `20260730260000_prop_os_assignment_identity_invariant.sql` | `12e960caf36d32865038ee935236c8e0788b3bca90d46b7bcde02126b1fe5230` | identity invariant | 6 | YES | NO | YES |
| 8 | `20260802212828_prop_pass_trading_os_persistence.sql` | `9b0edf1b2eab15201c17806a93a7a0a17e026433cb1718e4011c06e3b14f2059` | Daily Plan / Timeline / settings | 1–7 | YES | NO | YES |
| 9 | `20260802223818_prop_pass_build117_persistence_hardening.sql` | `d1a4037e60a18fb80c7f5c3d775788fdcde24a83d58bcda536411690c8eb19fe` | runtime + processed events | 8 | YES | NO | YES |
| 10 | `20260802225538_prop_pass_journal_automatic_sync.sql` | `f7ca73e3ba681c898ada9529674598f9190b4b2e013b815e5d14eaf0d66947fe` | journal revision + sync | 5,9 | YES | NO | YES |
| 11 | `20260802232311_prop_pass_pipeline_v2_runtime.sql` | `bac3bca3951bbab11848a8bcd38bd1ed272b479f20b6390ff809364f43b6ea6d` | pipeline stamp | 10 | YES | NO | YES |
| 12 | `20260802233700_prop_pass_runtime_processing_queue.sql` | `ecd79a18e68fef367a176cb08d602b237f6b4d2cf2cd5172affdf62e1fa5e09c` | claim pending queue | 9–11 | YES | NO | YES |
| 13 | `20260802235500_prop_pass_settings_recalculation_events.sql` | `724672da606c1aab21bba7b5b9f2e11113b80c4ad1a52f01edfe356dca5c3e9a` | settings recalc events | 12 | YES | NO | YES |

Static gate: `npm run test:prop-pass-minimal-migration-set-static` → PASS

---

## Dependency graph (topo)

`1→2→3→4→5→6→7→8→9→10→11→12→13`

Creates/alters of note:

- `prop_accounts` / `prop_challenges` / `prop_challenge_rule_snapshots` / `prop_trade_assignments` / `prop_executions` → #1  
- `prop_os_assignment_bump_revision` / `prop_os_assignment_queue_recalc` → #5 (hardened #6)  
- Daily Plan / Timeline → #8  
- `prop_processed_journal_events` / `prop_account_runtime_states` → #9  
- `trade_journal.prop_pass_revision` → #10  
- claim queue → #12  

No cycles. PI not in graph.

---

## Migration 4 allowlist evidence

- Apply-time `DELETE FROM prop_os_command_allowlist`: **NONE** (only inside admin remove function).  
- Production baseline: table **absent** (count query on `izzrlsgumyabdvlmwlwn` → 0).  
- Clean rehearsal A (absent/empty): **PASS**  
- Clean rehearsal B (unexpected row → STOP): **PASS**  
- Preflight helper: `scripts/prop-pass-migration4-allowlist-preflight.sh`  
- Migration hash unchanged.

---

## Clean baseline method

| Field | Value |
|---|---|
| Environment | local ephemeral PostgreSQL 17 (`yt_b117_clean_rehearsal`) |
| Region | local |
| Why not Supabase branch | Branching requires Pro plan |
| Why not new project | Free project limit (2) reached |
| Why not PR Agent restore | Restore would exceed free limit / blocked |
| Baseline method | Schema-only apply of production ledger-equivalent migrations to tip `20260802001324` |
| Stamp remaps (content from local files) | `20260709003519`←`20260709203000`; `20260726003000`←`20260726002015`; `20260802001324`←`20260802001141` |
| Production data copied | NO |
| Evidence | `docs/releases/1.6.1/evidence/CLEAN_BASELINE_REHEARSAL_LATEST.json` |

---

## Rehearsal results

| Gate | Result |
|---|---|
| Production baseline equivalence (schema/ledger tip) | PASS |
| Clean first apply (13 steps verified) | PASS |
| Duplicate apply | PASS |
| Interrupt / resume | PASS |
| Build 116 remote/local post-migrate | PASS |
| Build 117 SQL vertical slice | PASS |
| RLS / direct write denial | PASS |
| Retry/idempotency (duplicate apply + claim) | PASS |
| Failure recovery (txn abort + claim revoke kill-switch) | PASS |
| Cleanup (scrub + DROP DATABASE) | PASS |

---

## Exact future production SQL order (DO NOT EXECUTE)

Target **only** `izzrlsgumyabdvlmwlwn`:

1. Preflight ledger tip `20260802001324` + Prop OS objects absent  
2. Migration4 allowlist preflight (absent or empty; STOP if rows > 0)  
3. Apply #1 … verify  
4. Apply #2 … verify  
5. Apply #3 … verify  
6. Apply #4 … verify allowlist empty  
7. Apply #5 … verify  
8. Apply #6 … verify  
9. Apply #7 … verify  
10. Apply #8 … verify  
11. Apply #9 … verify  
12. Apply #10 … verify `prop_pass_revision`  
13. Apply #11 … verify  
14. Apply #12 … verify claim fn  
15. Apply #13 … verify  
16. Schema + RLS verification  
17. Disposable Build 116 smoke (PO)  
18. Sanitized evidence commit  

Do not apply PI migrations in this packet.  
Do not deploy Edge in this packet.

---

## Remaining SQL blockers before production apply

1. Explicit PO approval of this **13-file** set (not the prior 16-file or single-file auth).  
2. Prefer a disposable **remote** Supabase rehearsal when Pro branching or project slot is available (local PG lacks full Edge).  
3. Processor remains a **separate** authorization scope.

PRODUCTION SQL MIGRATION READY: YES (packet) — apply still requires PO  
EXPLICIT PO SQL APPROVAL REQUIRED: YES
