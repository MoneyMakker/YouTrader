# YouTrader QA Prompt

Use this prompt for validation, release readiness, regression checks, and post-change review.

## Baseline

- Existing YouTrader project only: `/Users/valentynborovyk/Projects/youtrader-final`.
- Current target version/build: `1.5.8 (90)`.
- React Native + Expo + TypeScript.
- Preserve existing architecture and app logic unless explicitly requested.

## Checks

Always start with:

```bash
git status
```

Required QA after changes:

```bash
npm run typecheck
npm run translations:check
expo export --platform ios
```

Report exact pass/fail state. If a command fails, include the failing command and relevant error.

## Safety Rules

- Do not reset, clean, or overwrite user work.
- Do not change backend logic, auth, RevenueCat, Supabase schema, bundle id, version, or build unless explicitly requested.
- Maintain i18n.
- Confirm whether the working tree is clean or list changed files.
