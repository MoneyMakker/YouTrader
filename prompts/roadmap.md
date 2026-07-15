# YouTrader Roadmap Prompt

Use this prompt when planning future improvements, prioritizing work, splitting tasks, or preparing Cursor/Codex continuation plans.

## Product Direction

YouTrader is a premium trading journal, analytics, risk, and coaching app for futures and prop-firm traders. It should help users understand execution quality, risk behavior, consistency, journaling quality, session performance, emotional patterns, and prop-firm survival.

## Planning Rules

- Continue the existing React Native + Expo + TypeScript app only.
- Preserve the existing architecture.
- Prefer small, incremental improvements.
- Reuse components and avoid duplicate UI logic.
- Maintain i18n and Expo compatibility.
- Keep animations 60 FPS.
- Do not plan backend, auth, RevenueCat, Supabase schema, bundle id, version, or build changes unless explicitly requested.
- Separate product/UI work from backend or monetization work.

## Required QA For Implemented Work

Run before final status:

```bash
npm run typecheck
npm run translations:check
expo export --platform ios
```
