# YouTrader iOS Prompt

Use this prompt when changing iOS, Expo, native config, TestFlight, App Store, build, export, permissions, or device behavior.

## Context

You are continuing the existing YouTrader app in `/Users/valentynborovyk/Projects/youtrader-final`.

- Current target version/build: `1.5.8 (90)`.
- React Native + Expo + TypeScript.
- Expo compatibility is required.
- Existing architecture must be preserved.
- Do not change bundle id, app scheme, EAS project id, version, or build number unless explicitly requested.
- Do not start from scratch or create a new app.

## Rules

- Reuse existing components and utilities.
- Do not duplicate UI logic.
- Keep animations 60 FPS and avoid layout-heavy animation on critical paths.
- Do not add heavy native dependencies without explicit approval.
- Preserve current iOS permissions and App Store privacy posture unless the task is specifically about them.
- Maintain i18n for user-facing text.
- Do not change backend logic, auth, RevenueCat, or Supabase schema unless explicitly requested.

## Required QA

Run before final status:

```bash
npm run typecheck
npm run translations:check
expo export --platform ios
```
