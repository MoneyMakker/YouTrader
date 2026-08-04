# PPOS-117 — Runtime processor deployment approval packet

**Date:** 2026-08-04  
**Branch:** `feature/prop-pass-trading-os-build117`  
**Production project:** `izzrlsgumyabdvlmwlwn`  
**Production modified:** NO  
**Scope:** Edge/server only — separate from SQL migrations  

Do **not** deploy to production without explicit PO processor approval.

---

## Required component

| Field | Value |
|---|---|
| Classification | **REQUIRED** for Journal→runtime after minimal SQL set |
| Function name | `prop-pass-runtime-processor` |
| Source paths | `supabase/functions/prop-pass-runtime-processor/index.ts`, `processor.ts` |
| Source commit (pre-packet tip) | `1fbed10` (update to packet commit on land) |
| SHA-256 `index.ts` | `f55b6e77b2f6663aa34c8b71f6e7ff4f80e582f6dc64a6d239b5b2ac5bcedaae` |
| SHA-256 `processor.ts` | `8af2ae6b7a09f270498d8bf39bccc564c98095693c73b5611809b995be08f0b9` |
| Staging version | ACTIVE v5 (`zleojeqkzizeyerhjpur`) |
| Production today | ABSENT |
| Auth / JWT | `verify_jwt: true` (staging); handler validates Bearer user JWT via `auth.getUser` |
| Service-role | Uses `SUPABASE_SERVICE_ROLE_KEY` for admin client after user auth |
| Queue claim | `prop_os_processor_claim_pending_journal_events(uuid, int)` (`SKIP LOCKED`) |
| Ops | `process_pending`, `save_live_settings`, `activate_session_lock` |
| Retry | Client/harness re-invoke; empty claim is no-op; unique event keys |
| Kill switch | Stop invoking function; revoke execute on claim RPC; undeploy/disable Edge |
| Rollback | Disable invoke; leave SQL tables intact; forward-fix code |

### Required secret / env names only

- `SUPABASE_URL`  
- `SUPABASE_SERVICE_ROLE_KEY`  
- (callers may use user JWT; no secret values recorded here)

### Deployment order relative to SQL

1. Apply final minimal SQL set (13 files) and verify claim RPC exists  
2. Deploy `prop-pass-runtime-processor` to target project  
3. Smoke: disposable claim → runtime write  
4. Kill-switch drill  

### Deployment command structure (no secrets)

```bash
# Explicit production ref only — do not rely on linked project
supabase functions deploy prop-pass-runtime-processor \
  --project-ref izzrlsgumyabdvlmwlwn
# secrets set separately via dashboard/CLI by name only
```

---

## Optional / excluded processors

| Component | Classification | Reason |
|---|---|---|
| `prop-os-recalc-processor` | OPTIONAL | Assignment recalc path; not required for Journal→runtime vertical slice |
| `prop-os-pi-processor` | NOT_USED_BY_BUILD117 (minimal set) | PI SQL excluded from minimal set; enable only with PI migrations |

---

## Isolated rehearsal result

| Item | Result |
|---|---|
| Disposable remote Edge deploy | **FAIL** |
| Reason | Supabase branching Pro-only; free project limit (2); PR Agent restore blocked by free limit |
| Local SQL claim/runtime simulation | PASS (clean baseline rehearsal) |
| Staging Edge vertical slice (prior) | PASS (`RUNTIME_STATE_STAGING_LATEST.json`) |

**Processor packet status:** READY for PO review  
**Production processor deployment ready:** NO until disposable remote Edge rehearsal PASSes or PO accepts staging+SQL evidence with explicit risk acknowledgment

---

## Compatibility

- Build 116 clients do not call this Edge function → idle-safe after SQL-only deploy  
- Must not be required for Build 116 Journal CRUD  

---

## Explicit PO processor approval required: YES

Do not deploy with the SQL packet unless PO separately authorizes this processor packet.
