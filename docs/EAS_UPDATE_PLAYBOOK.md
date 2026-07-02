# EAS Update Playbook

Last updated: 2026-07-02

YouTrader uses EAS Update readiness for safe JavaScript, asset, copy, and styling fixes after a compatible native build is released. OTA updates must be small, reviewed, and tested before production.

## Current Configuration

- `app.json` uses `runtimeVersion.policy = appVersion`.
- `app.json` has `updates.url = https://u.expo.dev/02ed40d6-5ad8-4a6d-9716-5ba40ec714c6`.
- `eas.json` maps the `preview` build profile to the `preview` update channel.
- `eas.json` maps the `production` build profile to the `production` update channel.
- Current production baseline remains YouTrader `1.5.7` build `72`.

The `appVersion` runtime policy means updates for `1.5.7` should only target compatible `1.5.7` native builds. If native code, native config, permissions, plugins, or SDK versions change, create a new App Store/TestFlight build instead of publishing an OTA update.

## What Can Ship OTA

Safe candidates:

- JavaScript-only bug fixes.
- UI copy changes.
- Styling/layout fixes that do not require native modules.
- Existing image/asset changes bundled by Expo export.
- Analytics event wiring that uses already-installed packages.
- Safe local default copy/flag changes that do not change native behavior.

## What Cannot Ship OTA

Do not publish OTA for:

- New native dependencies or removed native dependencies.
- Expo SDK upgrades.
- Changes to `ios/`, Android native folders, entitlements, capabilities, permissions, URL schemes, or plugins.
- RevenueCat product IDs, entitlement IDs, subscription IDs, or purchase logic changes that require native/store QA.
- Supabase schema/security changes.
- App Store privacy label changes.
- New camera/photo/microphone/push permission behavior.
- Anything that should go through TestFlight/App Review.

## Channels

- `preview` - internal QA / TestFlight-style validation channel.
- `production` - App Store production channel.

Never publish directly to `production` before the same update has been tested on `preview`.

## Safe OTA Process

1. Start clean:

```bash
git status
npm run typecheck
npm run security:check
npm audit
```

2. Confirm the change is OTA-safe:

- No native dependency changes.
- No `ios/` or Android native changes.
- No permission/plugin/config changes that require a new build.
- No RevenueCat/Supabase schema/security changes.
- No secrets or `.env` changes.

3. Publish to preview:

```bash
npx eas update --channel preview --message "Describe the safe OTA change"
```

4. Manual QA preview:

- Install/open a preview build that points at the `preview` channel.
- Force close and reopen the app twice.
- Verify Journal, Stats, AI Analytics, News, exports, paywall preview, and affected screen.
- Verify Sentry/PostHog still work when configured.
- Verify no private data is logged.

5. Publish to production only after QA:

```bash
npx eas update --channel production --message "Describe the production OTA change"
```

If using EAS environments in the dashboard, add the matching environment flag:

```bash
npx eas update --channel preview --message "Describe the safe OTA change" --environment preview
npx eas update --channel production --message "Describe the production OTA change" --environment production
```

## Rollback Strategy

Preferred rollback:

1. Identify the last known-good update in the EAS dashboard.
2. Republish the known-good code to the affected channel.
3. Confirm the app receives the rollback after force close/reopen.
4. If the issue is native/config related, stop OTA attempts and ship a new build.

Emergency rule:

- If an OTA update affects purchases, login, data loss, Journal persistence, exports, or app startup, pause production updates and create a native build fix if rollback is not immediate.

## Manual QA Before Production OTA

- App opens cold.
- Journal add/edit/delete still works.
- Calendar P&L and Stats still derive correctly.
- Exports/share/PDF still render.
- News opens source links.
- AI features fail gracefully if server keys are missing.
- Paywall opens and Restore Purchases remains visible.
- No new console logs with sensitive data.
- No screenshots, voice notes, private notes, or full trade payloads are sent to analytics.

## Commands

Check EAS login:

```bash
npx eas whoami
```

Build preview channel binary:

```bash
npx eas build --profile preview --platform ios
```

Build production channel binary:

```bash
npx eas build --profile production --platform ios
```

Publish preview OTA:

```bash
npx eas update --channel preview --message "Preview OTA"
```

Publish production OTA:

```bash
npx eas update --channel production --message "Production OTA"
```

