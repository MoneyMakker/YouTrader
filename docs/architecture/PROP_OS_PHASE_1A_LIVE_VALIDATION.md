# Phase 1A Live Database Validation Report

**Status:** READY FOR PRODUCT OWNER FINAL REVIEW  
**Starting commit:** `cc9ed42`  
**Environment:** Isolated local PostgreSQL (not production, not linked Supabase project)

## Environment

| Item | Value |
|---|---|
| Engine | PostgreSQL **17.10** (Homebrew) + **pgvector 0.8.6** |
| Supabase CLI | 2.108.0 (present; local stack unused — no Docker; branching requires Pro) |
| Cluster | `.tmp/prop-os-pg` on `localhost:55432` |
| DBs | `prop_os_clean1`, `prop_os_clean2`, `prop_os_upgrade` |
| Production `izzrlsgumyabdvlmwlwn` | **Untouched** |

## Results

### A. Clean apply (×2)

Command: `bash scripts/prop-os-phase1a-live-validate.sh`

- Full migration chain (15 files) applied to fresh DB twice → **PASS**
- 12/12 Prop OS tables present → **PASS**

### B. Existing-schema upgrade

- Pre-1A chain + seeded `trade_journal` row → apply `20260730190000_prop_os_database_foundation.sql` → **PASS**
- Legacy row intact; `prop_trade_assignments` count = 0 → **PASS**

### C–E. Live RLS / triggers / privileges

Command: `psql … -f supabase/tests/prop_os_phase1a_live_assertions.sql`

**Assertions: 29 PASS / 0 FAIL**

Includes: anon/authenticated denials, service_role write, cross-user FK rejection, immutable snapshots/transitions/corrections, void preserves execution, violation clear preserves row, FORCE RLS, function security.

### D. Function security matrix

All `prop_os_*` helpers: **SECURITY INVOKER**, `search_path=public`, execute granted only to `postgres,service_role`.

### F. Database-generated types

`DATABASE_URL=… npm run gen:prop-os-db-types:live` → `src/types/propOsDatabase.ts` from `information_schema` (**PASS**)

SQL parser generator remains as secondary drift aid (`npm run gen:prop-os-db-types`).

### G. Drift check

`npm run test:prop-os-schema-drift` → **PASS** (12 tables)

### H. Rollback rehearsal

Leaving Prop OS tables dormant; journal insert still succeeds on upgrade DB → **PASS**  
Primary rollback = do not wire App / leave tables unused (see `PROP_OS_PHASE_1A_ROLLBACK.md`).

## Commands also run

- `npm run test:prop-os-types` → PASS  
- `npm run test:prop-os-fixtures` → PASS (34)  
- `npm run typecheck` → PASS  
- `npm run test:ui-infra-phase6` → PASS  

## Confirmations

- No Phase 1B work  
- No App / `src/propOs` wiring  
- No backfill / legacy assignment  
- Production untouched  
