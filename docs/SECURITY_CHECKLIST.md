# YouTrader Security Checklist

## Secret Handling Rules

- Never commit real `.env` files. Commit only `.env.example` templates.
- Never paste `SUPABASE_SERVICE_ROLE_KEY`, `NVIDIA_API_KEY`, RevenueCat webhook secrets, private Apple keys, `.p8`, `.pem`, or private API tokens into AI chats, issue trackers, logs, screenshots, or docs.
- Never put server secrets into `EXPO_PUBLIC_*` variables. Anything with `EXPO_PUBLIC_` can ship inside the mobile bundle.
- Use GitHub Actions repository secrets for backend workers: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `ECONOMIC_CALENDAR_JSON_URL`.
- Run `npm run security:check` before release or before handing code to another AI agent.

## Supabase RLS Rules

- Every user-owned table in `public` must have RLS enabled.
- User-owned rows must be protected by `(select auth.uid()) = user_id` in `USING` and `WITH CHECK` where writes are allowed.
- Market Intelligence tables are intentionally public read-only for `status = 'published'` rows.
- Mobile clients must not have insert/update/delete grants or policies on Market Intelligence tables.
- Backend workers write Market Intelligence rows only with `service_role` outside the Expo app.
- `SECURITY DEFINER` functions must have explicit `revoke execute` / `grant execute` statements and must not become broad public APIs.

## Worker Deployment Rules

- Run `scripts/market-intel-worker` only locally, on GitHub Actions, or another controlled server.
- The worker must refuse placeholder or publishable Supabase keys.
- `ENABLE_LOCAL_LLM_SUMMARIES=false` in GitHub Actions.
- The worker must not use OpenAI, Claude, Gemini, or paid hosted AI for shared cached Market Intelligence.
- The mobile app reads cached rows only and never starts crawlers, jobs, or per-user generation.

## GitHub Actions Secrets Setup

1. Open the GitHub repository.
2. Go to **Settings**.
3. Go to **Secrets and variables**.
4. Open **Actions**.
5. Click **New repository secret**.
6. Add required secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
7. Optional: `ECONOMIC_CALENDAR_JSON_URL`.

## Never Paste Into AI Chat

- Supabase service role keys.
- Supabase secret keys beginning with `sb_secret_`.
- NVIDIA/OpenAI/Anthropic/Gemini API keys.
- RevenueCat webhook secrets or private API keys.
- Apple `.p8`, certificates, provisioning profiles, private keys.
- Full `.env` files.
- Production database connection strings.

## Release Safety Checklist

- `git status` shows no `.env`, `.ipa`, certificates, provisioning profiles, or build artifacts staged.
- `npm run security:check` passes.
- `npm run typecheck` passes.
- Supabase migrations are reviewed before `supabase db push`.
- Edge Functions are deployed with secrets set through Supabase secrets, not Expo env.
- GitHub Actions secrets are configured in repository settings, not committed.

## Rotate A Leaked Supabase Secret Key

1. Treat the key as compromised immediately.
2. Remove it from git, logs, screenshots, chats, and CI output.
3. In Supabase Dashboard, rotate/regenerate the affected secret key.
4. Update GitHub Actions / server secret stores with the new key.
5. Redeploy Edge Functions/workers if needed.
6. Review `security_events`, API logs, and Storage/DB activity for suspicious access.
7. Run `npm run security:check` and confirm no tracked files contain the leaked value.

## Verify No Secrets Are Committed

```bash
git status --short
git ls-files | grep -E '(^|/)\.env|\.pem$|\.key$|\.p8$|\.ipa$|mobileprovision'
npm run security:check
```

Only `.env.example` files should appear from the `git ls-files` check.
