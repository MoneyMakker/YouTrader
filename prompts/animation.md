# YouTrader Animation Prompt

Use this prompt when adding or changing animations, transitions, gestures, loading states, cards, share visuals, or high-frequency UI updates.

## Animation Rules

- Keep animations 60 FPS.
- Prefer opacity and transform animations.
- Avoid heavy layout animation, expensive shadows, excessive blur, repeated timers, and JS-thread-heavy loops.
- Keep interactions responsive on real iPhones, not only simulators.
- Preserve the existing premium dark fintech feel.
- Do not add heavy animation/native dependencies without explicit approval.

## App Rules

- Preserve the existing React Native + Expo + TypeScript architecture.
- Reuse existing components and animation patterns.
- Do not duplicate UI logic.
- Maintain Expo compatibility.
- Maintain i18n for user-facing text.
- Do not change backend logic, auth, RevenueCat, or Supabase schema unless explicitly requested.

## Required QA

Run before final status:

```bash
npm run typecheck
npm run translations:check
expo export --platform ios
```
