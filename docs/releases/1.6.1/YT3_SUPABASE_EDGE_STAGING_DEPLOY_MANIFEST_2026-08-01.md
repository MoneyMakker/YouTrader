# Supabase Edge WIP — deploy-ready staging manifest (non-secret)

**Do not deploy to production.** Staging deploy only with authenticated CLI when available.

## Separated change sets

| Set | Paths | Purpose |
|-----|-------|---------|
| PI timeout/reaper | `supabase/migrations/20260731290000_prop_os_pi_timeout_reaper.sql`, `scripts/pi-timeout-reaper-qa.ts`, PI processor diffs | queue/processing timeouts, claim timestamps |
| Retry / stale rejection | `prop-os-pi-processor`, `prop-os-recalc-processor` | stale revision / failed retry paths |
| AI provider shared | `_shared/aiProvider.ts`, `aiSchemas.ts`, `ai-coach` | backend contract — not user-facing |
| Market intel | `market-intelligence`, `marketAi*` | backend |
| Entitlement helper | `_shared/revenueCatEntitlement.ts` (new) | server entitlement read |

## Local verification (this session)

- `scripts/pi-timeout-reaper-qa.ts` — memory contract
- `scripts/qa/piContract.selftest.ts` — duplicate/stale/poll cancel
- Typecheck of app (Edge Deno not fully typechecked in `tsc` exclude)

## Staging deploy commands (when CLI auth present)

```bash
# Confirm project ref is staging ONLY
supabase projects list
# Expected staging ref category: zleojeqkzizeyerhjpur
supabase db push --linked   # only if linked to staging
supabase functions deploy prop-os-pi-processor --project-ref <STAGING_REF>
# Deploy other verified functions one-by-one after review
```

## Status

- Migration + QA scripts: **deploy-ready CODE PASS** (commit)
- Large `aiProvider.ts` expansion: **PARTIAL** — commit as staging-only backend WIP; **LIVE deploy NOT RUN** if CLI blocked
- Production: **not touched**
