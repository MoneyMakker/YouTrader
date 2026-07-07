# YouTrader Design Prompt

Use this prompt for premium UI, visual polish, layout, component, theme, animation, and screen work.

## Product Feel

YouTrader is a premium trading journal and analytics app for futures and prop-firm traders. The UI should feel like a calm iOS fintech terminal: dark, glassy, disciplined, readable, and information-dense.

## Rules

- Preserve the existing React Native + Expo + TypeScript architecture.
- Reuse current components, tokens, colors, gradients, spacing, typography, and layout patterns.
- Build reusable components only when they remove real duplication or match existing patterns.
- Do not duplicate UI logic across screens.
- Keep animations 60 FPS. Prefer transforms and opacity; avoid expensive layout recalculation.
- Maintain Expo compatibility.
- Maintain i18n for all user-facing text.
- Do not change backend logic, auth, RevenueCat, or Supabase schema unless explicitly requested.
- Do not make YouTrader feel like a game, signal app, crypto dashboard, or generic SaaS landing page.

## Required QA

Run before final status:

```bash
npm run typecheck
npm run translations:check
expo export --platform ios
```
