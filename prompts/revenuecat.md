# YouTrader RevenueCat Prompt

Use this prompt when a task mentions subscriptions, Pro access, paywall, purchases, restore, entitlements, or RevenueCat.

## Hard Boundaries

- Do not change RevenueCat product IDs, entitlement IDs, offering logic, purchase logic, restore logic, or subscription state handling unless explicitly requested.
- Do not change backend entitlement logic unless explicitly requested.
- Do not change Supabase schema or auth while working on RevenueCat unless explicitly requested.
- Do not change version/build or bundle id.

## App Rules

- Preserve the existing React Native + Expo + TypeScript architecture.
- Reuse existing purchase and entitlement helpers.
- Keep free users able to see useful app value.
- Keep advanced AI, advanced analytics, exports, sync, and other existing Pro-gated features gated as designed.
- Maintain i18n for paywall, purchase, restore, and error strings.
- Maintain Expo compatibility.

## Required QA

Run before final status:

```bash
npm run typecheck
npm run translations:check
expo export --platform ios
```
