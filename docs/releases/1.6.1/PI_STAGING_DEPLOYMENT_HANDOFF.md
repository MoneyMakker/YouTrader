# PI / Edge — staging deployment handoff (non-secret)

**Status:** CODE PASS · LIVE staging deploy NOT RUN  
**Forbidden:** production Supabase (`izzrlsgumyabdvlmwlwn`) · build 114  
**Staging host category:** `zleojeqkzizeyerhjpur`

## Exact artifacts to deploy (staging only)

### Migration

- `supabase/migrations/20260731290000_prop_os_pi_timeout_reaper.sql`

### Edge functions (verified staging WIP commits)

- `prop-os-pi-processor`
- `prop-os-recalc-processor`
- `ai-coach` (if staging already serves it)
- `market-intelligence` (if staging already serves it)
- Shared: `_shared/aiProvider.ts`, `aiSchemas.ts`, `marketAi*`, `rateLimits.ts`, `revenueCatEntitlement.ts`

## Required secrets (names only)

| Name | Where |
|------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge / CI (staging) |
| `REVENUECAT_SECRET_KEY` | Edge entitlement helper (if used) |
| `REVENUECAT_ENTITLEMENT_ID` | optional; default `YouTrader Pro` |
| AI provider keys used by staging coach/intel | existing staging secret store |

Do not put values in git.

## Pre-deploy checks

```bash
node --import tsx scripts/pi-timeout-reaper-qa.ts
node --import tsx scripts/qa/piContract.selftest.ts
npm run typecheck
# Confirm CLI linked project ref is STAGING only
supabase projects list
```

Abort if linked ref is production.

## Deployment commands (staging)

```bash
# After confirming staging link:
supabase db push --linked
supabase functions deploy prop-os-pi-processor --project-ref <STAGING_REF>
supabase functions deploy prop-os-recalc-processor --project-ref <STAGING_REF>
# Optional, only if already part of staging surface:
# supabase functions deploy ai-coach --project-ref <STAGING_REF>
# supabase functions deploy market-intelligence --project-ref <STAGING_REF>
```

## Post-deploy verification

1. Queue a PI job as allowlisted staging user → state `queued`/`running`/`completed` or `failed` with timeout reason codes when forced.  
2. Duplicate request → rejected/deduped.  
3. Stale assignment revision → conflict.  
4. Second user cannot read first user’s PI row (RLS).  
5. Direct client DML on PI calc table denied for authenticated.  
6. Completed snapshot immutable under stale write.

## Local contracts already green

- timeout/reaper memory QA  
- duplicate / poll-cancel / cross-user cache isolation (`piContract.selftest`)

## Rollback

1. Redeploy previous function versions from git tag/commit before `cec49fe`/`763b61b`.  
2. Do **not** drop columns casually in production; staging may keep `processing_started_at` if already applied.  
3. Re-run PI contract tests after rollback.

## Security

- No production commands in this handoff.  
- No service-role in Expo client.  
- Never log full journal/PI payloads.
