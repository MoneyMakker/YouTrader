# YouTrader Automation Stack

This file documents local/self-hosted automation options for YouTrader. These tools are developer/backend infrastructure only. They must not be bundled into the Expo mobile app and must never receive mobile runtime secrets through `EXPO_PUBLIC_*` variables.

## Recommendation Summary

| Tool | Use now? | Best role in YouTrader | Notes |
| --- | --- | --- | --- |
| n8n | Later, when lifecycle automations are ready | RevenueCat/Supabase webhooks, email lifecycle flows, push-notification orchestration, weekly report delivery | Strong fit for business workflows, but keep it server-side and private. |
| Windmill | Later for internal ops | Admin scripts, safe back-office tools, report regeneration, support utilities | Better for typed scripts and internal tools than user-facing app features. |
| Activepieces | Optional later | Lightweight no-code workflow builder / Zapier alternative | Use only if the team wants a simpler workflow UI than n8n. |
| Huginn | Optional later | Monitoring public sources: prop firm rule changes, market/news source health, App Store/competitor changes | Useful for watchers and alerts; not needed for core app runtime. |

## n8n

### What it is for
n8n is a self-hostable workflow automation platform. For YouTrader, it is best suited for lifecycle automation and webhook-driven operations:

- RevenueCat webhook intake and routing to support/internal logs.
- Supabase webhook or scheduled workflow triggers.
- Email sequences for onboarding, failed payment reminders, and Pro education.
- Push-notification orchestration when backend token storage is fully ready.
- Weekly AI report delivery after server-side report generation.

### Use now or later
Use later. The current app already keeps RevenueCat, Supabase, and AI quota logic server-side. n8n should be introduced only after the production webhook strategy is finalized.

### Connections
- Supabase: use service role only in the private n8n server environment, never in Expo.
- RevenueCat: receive webhooks, verify source/signature where supported, and keep sandbox/production separated.
- Email: connect to a transactional email provider after domain verification.
- Push: call a backend push sender only after Expo push tokens are stored safely.
- AI reports: trigger Supabase Edge Functions or server jobs; never put AI provider keys in workflow steps visible to untrusted users.

### Docker setup notes
```bash
docker volume create n8n_data
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```
For production, put it behind HTTPS, enable authentication, restrict IP access, and store secrets in the host secret manager.

### Security risks
- Workflow credentials can become a secret vault. Limit who can edit workflows.
- Webhook endpoints must validate payloads and reject test/sandbox events in production.
- Do not let n8n write directly to user-owned tables without RLS-aware server logic.

### What not to use it for
- Do not run per-user paid AI generation from mobile app taps.
- Do not store Supabase service role or AI keys in public/mobile config.
- Do not bypass RevenueCat entitlement logic.

## Windmill

### What it is for
Windmill is a self-hostable platform for scripts, workflows, and internal apps. For YouTrader, it fits internal admin and operations tasks:

- Re-run a failed report generation for a user after support review.
- Inspect safe aggregate metrics without exposing private journal notes.
- Backfill cached market intelligence rows from public sources.
- Run maintenance scripts with explicit approvals.

### Use now or later
Use later for admin tooling. Do not add it to the mobile runtime.

### Connections
- Supabase: connect with least-privilege service credentials in server-only environment.
- RevenueCat: read webhook logs or entitlement summaries, not product configuration.
- Email/push: trigger admin-approved messages only.
- AI reports: queue server-side jobs, not direct client calls.

### Docker setup notes
Use the official Windmill Docker Compose template from Windmill docs. Keep Postgres, worker, and app containers on a private network and put the UI behind authentication.

### Security risks
- Internal scripts can be destructive. Require code review and production approval.
- Keep production and sandbox credentials separate.
- Log metadata only; avoid dumping full journal content.

### What not to use it for
- Do not expose it to users.
- Do not use it as the mobile app API.
- Do not run schema migrations without review.

## Activepieces

### What it is for
Activepieces is an open-source workflow builder and Zapier alternative. It is useful if YouTrader needs a simpler automation UI for non-engineering workflows.

Recommended use cases:

- Simple notification workflows.
- Support ops tasks.
- Low-risk marketing automations.
- Prototype webhook flows before moving critical logic into audited backend code.

### Use now or later
Optional later. n8n is the stronger first choice for YouTrader lifecycle automation.

### Connections
Same rules as n8n: server-only secrets, webhook validation, sandbox/production separation, no mobile runtime credentials.

### Docker setup notes
Use the official Activepieces Docker Compose instructions. Enable HTTPS, authentication, backups, and secret rotation.

### Security risks
- Connector permissions can become too broad.
- No-code workflows can hide business logic from code review.
- Production writes require strict ownership and entitlement checks.

### What not to use it for
- Do not let it replace Supabase RLS or Edge Function security.
- Do not trigger unmetered paid AI.
- Do not store user screenshots, voice notes, or private trade content in workflow logs.

## Huginn

### What it is for
Huginn is a self-hosted agent system for monitoring and event creation. It is useful for public-source monitoring:

- Prop firm rule changes.
- Market/news source availability.
- App Store review/status pages.
- Competitor website changes.
- Public economic calendar source changes.

### Use now or later
Optional later. It is not needed for the current mobile app release, but it can support Market Intelligence monitoring without paid APIs.

### Connections
- Supabase: write only to cached public market-intelligence staging tables through reviewed server scripts.
- Email/push: alert the team, not end users, unless the content has been validated.
- AI reports: provide public context to server-side summaries only after deduplication and source checks.

### Docker setup notes
Use the official Huginn Docker image or compose setup. Run it on a private host with persistent database storage and authenticated access.

### Security risks
- Scrapers can break or collect noisy/incorrect data.
- Public source terms must be respected.
- Never scrape private user data or authenticated financial accounts.

### What not to use it for
- Do not use it for trading signals or market predictions.
- Do not let public scraped content write directly into user-facing tables without review/deduplication.
- Do not store credentials for broker/prop accounts.

## YouTrader Security Rules For Automation Tools

- Service-role keys, RevenueCat secrets, AI provider keys, webhook secrets, and email credentials stay server-side only.
- No automation tool may bypass Supabase RLS for user-owned data without a reviewed backend function.
- Production workflows require human approval before destructive actions.
- Sandbox and production webhooks must be separate.
- Logs must not include screenshots, voice notes, private notes, full trade entries, tokens, or PII-heavy payloads.
- Automation tools should trigger cached/shared jobs, not per-user paid AI from free users.
- Backups and restore tests are required before relying on self-hosted workflow state.
