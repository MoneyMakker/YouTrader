# Build 117 — Runtime Processor Update Classification

**Date:** 2026-08-04  
**Committed application HEAD (after rebuild/cockpit commit):** see git tip after this packet lands.  
**Installed production processor fingerprint:** `f213f54587aa9ce6c35da1bb16ad704750ffcfd1490a630f0309e72e40b87020`  
**Local package fingerprint (rebuild bundle only):** `67e7b5c1f18e4dd64bcad1be8fb6422342779deafff1e360a59efa5eae6bc122`

## Classification

**OPTIONAL_UI_ENRICHMENT**

The final Build 117 client does **not** require a production processor redeploy.

### Why optional

- Only `supabase/functions/_shared/propPassRuntime.bundle.js` changed (regenerated from `runtimeRebuild.ts`).
- `prop-pass-runtime-processor/index.ts` and `processor.ts` are unchanged.
- Queue claim/retry, JWT (`verify_jwt: true`), auth, and DB objects are unchanged.
- Calculation version string is unchanged (`build117.pipeline.v2`).
- New optional projection fields (payout / withdrawal / scaling / progression inputs) are additive.
- When the installed processor omits those fields, Session Cockpit shows explicit `needs_input` / Missing lists and does not fabricate values.
- Build 116 journal paths remain compatible (production B116 compat smoke PASS; allowlist 0; wake-ups OFF).

### Semantic delta (bundle only)

| Area | Change |
| --- | --- |
| Functions | None in entry/processor; rebuild helper enrichment only |
| Persisted payload | May populate optional readiness/scaling/progression when facts exist |
| Schema / migrations | None |
| Queue / concurrency | None |
| Auth / JWT | None |
| B116 compatibility | Unchanged |
| Old B117 client | Compatible (extra fields ignored or unused) |
| New B117 client | Compatible with installed processor via honest withhold |

### Production serving verdict

Current production processor **can safely serve** the final Build 117 client.

Production redeploy of fingerprint `67e7b5c1…` would improve persisted projections for allowlisted QA later, but is **not required** to ship the clean local candidate or keep activation OFF.

## Decision

| Item | Value |
| --- | --- |
| PRODUCTION PROCESSOR UPDATE REQUIRED | **NO** |
| PRODUCTION PROCESSOR UPDATE READY | **NOT REQUIRED** |
| EXPLICIT PO PROCESSOR UPDATE APPROVAL REQUIRED | **NO** (unless PO later wants enrichment deploy) |

Do not deploy the updated production processor without a separate explicit PO approval if enrichment is desired later.
