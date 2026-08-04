# PPOS-117 — Production processor deployment result

**Date:** 2026-08-04  
**PO processor approval:** YES (explicit coordinated authorization)  
**Starting HEAD:** `ea87337`  
**Final HEAD:** see tip after evidence commit  
**Production project:** `izzrlsgumyabdvlmwlwn`  
**Function:** `prop-pass-runtime-processor`  
**Package fingerprint:** `f213f54587aa9ce6c35da1bb16ad704750ffcfd1490a630f0309e72e40b87020`  
**Deployed:** ACTIVE v1  
**verify_jwt:** **true**  
**ezbr_sha256:** `12e7468fde8443bf44c339cf4ec7bbeb8126fe8fdf40ef436673b44f8116d893`  

Approval packet: `docs/releases/1.6.1/PPOS-117_RUNTIME_PROCESSOR_DEPLOYMENT_APPROVAL.md`

Not deployed: `prop-os-pi-processor`, `prop-os-recalc-processor`.

---

## Activation state

| Control | State |
|---|---|
| Client wake-ups | **OFF** |
| Real-user Build 117 activation | **NOT AUTHORIZED** |
| Allowlist | **0 rows** |
| Open queue after cleanup | **0** |

Disposable QA invoked the Edge function directly. Production Store clients remain Build 116 / non-staging env and do not wake the processor.

---

## Required secret / env names (values not recorded)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Present on the production Edge runtime (names verified via `supabase secrets list`).

---

## Production vertical slice

Evidence: `docs/releases/1.6.1/evidence/RUNTIME_STATE_PRODUCTION_LATEST.json` — **PASS**

Journal save → event → Edge claim → runtime write → hard rooms → Risk Meter → Challenge/Live → Session Cockpit read → reload → edit → delete → RLS denial → cleanup.

## Retry / concurrency / recovery

Evidence: `docs/releases/1.6.1/evidence/RUNTIME_PROCESSOR_PRODUCTION_REHEARSAL_LATEST.json` — **PASS**

Includes concurrent claim protection, malformed terminal fail, stuck-`processing` ops reset, disable-by-stop-invoke + resume.

### Stale `processing` recovery (no TTL reaper)

Build 117 minimal set has **no** automatic journal-queue TTL reaper (PI reaper not authorized).

Operational recovery for synthetic/prod ops events stuck in `processing`:

1. Keep client wake-ups OFF.  
2. Identify stuck rows (`processing_state = 'processing'`) for disposable/ops scope only.  
3. Service-role update: set `processing_state = 'pending'` (or fail via `prop_os_processor_fail_journal_event` when appropriate).  
4. Re-invoke `prop-pass-runtime-processor` with a disposable authenticated user JWT.  
5. Confirm convergence; no permanent claim lock remains after ops reset.

---

## Cleanup

Mutable synthetic leftovers: **0** after scrub.  
Immutable daily-plan / rule-snapshot residuals may remain under scrubbed auth ids (DELETE blocked by prop_os immutability) — documented as expected append-only residual.

---

## Remaining blockers before real-user activation

1. Explicit **PO activation approval**.  
2. Do not enable client wake-ups until that approval.  
3. Ops awareness of manual stale-`processing` recovery.

PRODUCTION RUNTIME PROCESSOR: PASS  
CLIENT WAKE-UPS: OFF  
REAL-USER BUILD 117 ACTIVATION: NOT AUTHORIZED  
EXPLICIT PO ACTIVATION APPROVAL REQUIRED: YES
