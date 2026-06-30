# AI Coding Security Rules

Use these rules whenever YouTrader is edited with AI agents, automation, or external code-review tools.

## Never Share Secrets

- Never paste API keys, Supabase service role keys, Apple keys, RevenueCat secrets, webhook secrets, private tokens, or full `.env` files into AI chats.
- Never expose `.env` contents in screenshots, logs, prompts, tickets, or commits.
- Only commit `.env.example` placeholders. Real `.env` and `.env.*` files must stay ignored.
- Rotate any secret immediately if it was pasted into chat, logs, Git history, or a third-party tool.

## Deny By Default

- Treat every backend, database, storage, and worker path as denied until an explicit policy allows it.
- RLS must exist from day one for every user-owned Supabase table.
- Public reads are allowed only for intentional published cache tables such as Market Intelligence.
- Client apps must never receive `SUPABASE_SERVICE_ROLE_KEY` or private AI/provider keys.

## AI Agent Access

- Review agents should use read-only database access whenever possible.
- Sandbox first. Do not let an AI agent operate directly on production without a human-approved command and scope.
- No deploy to staging or production without manual review of the diff, migrations, secrets, and runtime target.
- A repository with AI hooks or generated scripts is executable code; inspect scripts before running them.
- Security review from an AI agent is not a replacement for `npm audit`, Supabase Security Advisor, App Store/RevenueCat dashboard review, and manual QA.

## Package And Code Safety

- Verify package names, maintainers, and install reason before adding dependencies.
- Prefer lightweight scripts over random heavy security packages.
- Do not run destructive database commands without a reviewed migration and rollback/recovery plan.
- Keep production logging structured and minimal. Do not log tokens, secrets, full journal payloads, screenshots, voice note contents, or payment payloads.

## Supabase And Edge Functions

- Use explicit `search_path` for SQL functions.
- Avoid `SECURITY DEFINER` unless needed; revoke direct `anon`/`authenticated` execute when helpers are backend-only.
- Storage buckets for user uploads must be private and paths must stay under `<user_id>/...`.
- CORS must use an allowlist. Do not ship wildcard CORS for production Edge Functions.
- Redirect URLs must be allowlisted.
- Webhook handlers must validate signatures before changing subscription or payment state.

## Environment Separation

- Keep local, staging/sandbox, and production credentials separate.
- Never point dev tools at production unless the exact action has human approval.
- GitHub Actions secrets should be set in Repository -> Settings -> Secrets and variables -> Actions.
- Production deploys and database pushes require a human check of branch, commit, environment, and migration contents.

## Backups And Recovery

- Confirm Supabase backups/PITR are enabled for production according to the plan level.
- Test restore procedures on a non-production project before relying on them.
- Keep Git commits small and reviewable before pushing release branches.
- Rotate production secrets every 90 days and immediately after any suspected leak.
