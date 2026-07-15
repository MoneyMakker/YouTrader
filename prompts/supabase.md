# YouTrader Supabase Prompt

Use this prompt when a task mentions Supabase, cloud sync, Edge Functions, database tables, migrations, RLS, quotas, AI routing, or server entitlement checks.

## Hard Boundaries

- Do not change Supabase schema unless explicitly requested.
- Do not change migrations, RLS, Edge Functions, quotas, or cloud sync behavior unless explicitly requested.
- Do not expose service role keys or private AI/API keys in the Expo app.
- Private AI provider calls must stay server-side through Supabase Edge Functions.
- Keep parameterized access and RLS-safe assumptions.

## App Rules

- Preserve the existing React Native + Expo + TypeScript architecture.
- Reuse existing Supabase client/helpers and app patterns.
- Do not duplicate backend access logic.
- Maintain i18n for user-facing errors and status messages.
- Maintain Expo compatibility.
- Do not change auth or RevenueCat unless explicitly requested.

## Required QA

Run before final status:

```bash
npm run typecheck
npm run translations:check
expo export --platform ios
```
