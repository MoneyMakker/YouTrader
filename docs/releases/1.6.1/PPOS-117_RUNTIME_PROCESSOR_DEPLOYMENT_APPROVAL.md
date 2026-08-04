# PPOS-117 — Runtime processor deployment approval packet

**Date:** 2026-08-04  
**Branch:** `feature/prop-pass-trading-os-build117`  
**Source commit (packet tip):** see tip after this commit lands (parent `4041598`)  
**Production project:** `izzrlsgumyabdvlmwlwn`  
**Staging project:** `zleojeqkzizeyerhjpur`  
**Production modified:** NO  
**Scope:** Edge/server only — separate from SQL migrations  

Do **not** deploy to production without explicit PO processor approval.

---

## Required component

| Field | Value |
|---|---|
| Classification | **REQUIRED** for Journal→runtime after minimal SQL set |
| Function name | `prop-pass-runtime-processor` |
| Source directory | `supabase/functions/prop-pass-runtime-processor/` |
| Entry point | `index.ts` (`Deno.serve`) |
| Shared modules | `./processor.ts`, `../_shared/propPassRuntime.bundle.js` |
| Deno / runtime | Supabase Edge (Deno); `npm:@supabase/supabase-js@2.75.0`; `jsr:@supabase/functions-js/edge-runtime.d.ts` |
| Source commit baseline | `4041598` (+ this packet commit) |
| SHA-256 `index.ts` | `f55b6e77b2f6663aa34c8b71f6e7ff4f80e582f6dc64a6d239b5b2ac5bcedaae` |
| SHA-256 `processor.ts` | `8af2ae6b7a09f270498d8bf39bccc564c98095693c73b5611809b995be08f0b9` |
| SHA-256 `propPassRuntime.bundle.js` | `fb63a05a6930bceb072df87e9bf5636f6095b5ae59c0be31ba85a27270597c95` |
| Package fingerprint (paths+bytes) | `f213f54587aa9ce6c35da1bb16ad704750ffcfd1490a630f0309e72e40b87020` |
| Staging deploy | ACTIVE v9 (`zleojeqkzizeyerhjpur`); Management API `ezbr_sha256` `12e7468fde8443bf44c339cf4ec7bbeb8126fe8fdf40ef436673b44f8116d893` |
| Staging `verify_jwt` | **true** (restored via Management API PATCH after CLI deploy) |
| Production today | ABSENT |
| Auth / JWT | Gateway JWT verification **ON**; handler also validates Bearer user JWT via `admin.auth.getUser(token)` |
| Service-role | Uses env `SUPABASE_SERVICE_ROLE_KEY` for admin client **after** user auth |
| Queue claim | `prop_os_processor_claim_pending_journal_events(uuid, int)` (`FOR UPDATE SKIP LOCKED`); batch default **4** (max **20**) |
| Fail path | `prop_os_processor_fail_journal_event` |
| Complete path | `prop_os_processor_complete_journal_event` |
| Ops | `process_pending`, `save_live_settings`, `activate_session_lock` |
| Retry | Client/harness re-invoke; empty claim is no-op; unique event keys; failed events re-claimable |
| Timeout behavior | **No automatic Build 117 TTL reaper** (PI reaper excluded). Stuck `processing` requires ops reset → `pending`/`failed`, then resume |
| Concurrency | SKIP LOCKED; concurrent Edge wake-ups do not double-apply |
| Disable / kill | Stop invoking Edge; revoke `EXECUTE` on claim RPC; undeploy/disable function; leave SQL intact |
| Rollback | Disable invoke; leave tables; forward-fix code |

### Required secret / env names only

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- (callers use user JWT + publishable/anon apikey; **no secret values recorded**)

### Deployment command structure (no secrets)

```bash
# Staging rehearsal (done)
supabase functions deploy prop-pass-runtime-processor \
  --project-ref zleojeqkzizeyerhjpur
# Ensure gateway JWT remains enabled (CLI may not flip a prior false):
# PATCH /v1/projects/zleojeqkzizeyerhjpur/functions/prop-pass-runtime-processor
# body: {"verify_jwt": true}

# Future production (DO NOT RUN without PO processor approval)
supabase functions deploy prop-pass-runtime-processor \
  --project-ref izzrlsgumyabdvlmwlwn
# Then confirm verify_jwt:true via Management API GET
```

---

## Optional / excluded processors

| Component | Classification | Reason |
|---|---|---|
| `prop-os-recalc-processor` | OPTIONAL | Assignment recalc path; not required for Journal→runtime vertical slice |
| `prop-os-pi-processor` | **NOT_USED_BY_BUILD117** (minimal set) | PI SQL excluded; do not deploy for Build 117 minimal path |

PI migrations / PI timeout-reaper: **NOT REQUIRED** for Build 117.

---

## SQL-before-processor classification (proven)

**`SQL_SAFE_BEFORE_PROCESSOR`**

Evidence:

1. Journal sync (`20260802225538`) enqueues only when a Prop Pass assignment exists — **no** activation-preference gate in the trigger.
2. `prop_os_user_preferences` is UX default-account only — not a Build 117 runtime kill switch.
3. `prop_os_command_gate.commands_enabled` defaults **true**, but command RPCs also require **allowlist** membership; existing users are not auto-allowlisted.
4. There is **no cron** for `prop-pass-runtime-processor`; processing is pull via authenticated Edge `op: process_pending`.
5. Pending events wait without data loss; Build 116 Journal CRUD remains intact.
6. Queue growth after SQL-only apply is limited to users with Prop Pass assignments; events remain `pending` until a processor claims them.

Operational note: deploy the processor **immediately after** SQL verification so assigned-trade queues do not accumulate unnoticed. Activation of client wake-ups for real users remains a separate PO decision.

---

## Staging remote Edge rehearsal results

| Gate | Result | Evidence |
|---|---|---|
| Processor deployed to Staging | **PASS** | v9 ACTIVE, `verify_jwt:true` |
| Fingerprint / deploy | **PASS** | package `f213f545…`; staging ezbr `12e7468f…` |
| Auth / JWT gateway + handler | **PASS** | 401 without/invalid JWT; invalid `op` → 400 |
| Activation default verified | **PASS** | gate readable; journal enqueue independent of prefs |
| Journal save / edit / delete | **PASS** | `RUNTIME_STATE_STAGING_LATEST.json` |
| Queue claim | **PASS** | real Edge claim path |
| Concurrent claim protection | **PASS** | `RUNTIME_PROCESSOR_REMOTE_REHEARSAL_LATEST.json` |
| Duplicate delivery / network retry | **PASS** | empty re-claim; no revision drift |
| Timeout recovery (ops reset) | **PASS** | stuck `processing` → ops `pending` → resume |
| Malformed-event handling | **PASS** | terminal `failed` + sanitized digest |
| Runtime / hard rooms / Risk Meter | **PASS** | Challenge + Live slices |
| Challenge / Live projection | **PASS** | |
| Session Cockpit persisted read | **PASS** | owner SELECT; reload identical |
| Cross-user / direct-write denial | **PASS** | |
| Processor disable + recovery | **PASS** | stop invoke preserves pending; resume drains |
| Synthetic cleanup | **PASS** | 0 active disposable users; mutable leftovers 0; immutable plan/rule residuals expected |
| Production modified | **NO** | |

Harnesses:

- `npm run test:prop-pass-runtime-state-staging`
- `node … scripts/prop-pass-runtime-processor-remote-rehearsal-qa.ts`

---

## Coordinated future production order (DO NOT EXECUTE)

1. Confirm Build 117 client wake-ups / feature surfacing remain OFF for real users.  
2. Apply SQL migrations **1–13** to `izzrlsgumyabdvlmwlwn` (separate SQL packet + PO SQL approval).  
3. Verify schema, RLS, and claim RPC.  
4. Deploy **only** `prop-pass-runtime-processor` with **`verify_jwt: true`**.  
5. Processor smoke (unauthorized reject + disposable `process_pending`).  
6. Disposable production vertical slice (Challenge + Live).  
7. Confirm cleanup.  
8. Enable client activation / wake-ups only when PO authorizes.

Do **not** deploy PI processor or optional recalc processor as part of this packet.

---

## Compatibility

- Build 116 clients do not call this Edge function → idle-safe after SQL-only deploy.  
- Must not be required for Build 116 Journal CRUD.  
- Stuck-`processing` ops runbook is required until a Build 117-native lease reaper (if ever) is separately approved — **do not** reuse PI reaper.

---

## Remaining blockers before production processor deploy

1. Explicit **PO processor approval** of this packet.  
2. Explicit **PO SQL approval** of the 13-file SQL packet (prerequisite).  
3. Production deploy still **not** performed.  
4. Ops awareness: no automatic journal-queue TTL reaper in the minimal set.

**Processor packet status:** READY for PO review  
**Production processor deployment ready:** **YES** (staging remote Edge rehearsal PASS; still requires explicit PO approval before production deploy)

## Explicit PO processor approval required: YES

Do not deploy with the SQL packet unless PO separately authorizes this processor packet.
