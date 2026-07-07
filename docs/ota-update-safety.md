# OTA Update Safety

This document is a safety guide only. Do not deploy an OTA update from this checklist.

## Current Context

YouTrader has Expo update configuration in `app.json`. The current native build target is:

- Version: `1.5.8`
- Build: `91`

OTA updates can be useful for small JavaScript fixes, but they cannot replace every native build.

## Usually Safe With OTA

- Copy changes.
- i18n text fixes.
- Small UI layout fixes.
- JavaScript-only bug fixes.
- Lightweight animation tuning.
- Non-native paywall presentation copy or spacing.
- Defensive handling for failed API responses.

## Needs A New Native Xcode Build

- New native modules.
- Pod changes.
- `app.json` plugin changes.
- Bundle identifier changes.
- Associated domains or auth deep link native configuration changes.
- Push notification entitlement changes.
- RevenueCat native SDK changes.
- Sentry native SDK changes.
- Changes to permissions, Info.plist keys, icons, splash screen, or build settings.
- Any change that requires `pod install` to alter native dependencies.

## RevenueCat Safety

- Product IDs and entitlement IDs must be treated carefully.
- Do not change product IDs through OTA unless the native build already supports the expected RevenueCat SDK and storefront behavior.
- Purchase and restore logic changes should be tested in TestFlight before release.

## Auth Safety

- JavaScript copy or UI around auth can usually be OTA.
- Apple/Google sign-in native configuration changes need a new build.
- Deep link or callback URL native config changes need a new build.

## Practical Rule

If the change is only JavaScript UI/copy and works with the already-installed native binary, OTA can be considered.

If the change touches native modules, pods, app config plugins, permissions, deep links, or native SDK setup, make a new local Xcode build.
