# YouTrader Final Premium v5

## Spec-Driven Development

Level 2/3 work begins from a clean isolated worktree and a shared SDD specification. The executable contract is pinned under `specs/contract`; run `npm run spec:drift -- <agent-007-worktree>` before cross-repository work. This adds no mobile runtime dependency and does not change version or build metadata.

Stable Expo SDK 54 build. No push notifications capability, no dev-client dependency, no Expo SDK 55.

## Install on iPhone
1. Right click the project folder → Services → New Terminal at Folder.
2. Run commands one by one:

```bash
npm install
npx expo prebuild --clean
npx expo run:ios --device
```

Choose the connected iPhone.

## Notes
- OWNER_FULL_ACCESS is ON in `App.tsx` so your personal build has full access.
- Subscription UI/gating is prepared for $3.99/month. Real payments require App Store Connect products + RevenueCat/App Store In-App Purchases.
- Calculator remains free. Premium gates are prepared for Journal, News and Calendar when OWNER_FULL_ACCESS is turned off.
