# Maestro Smoke Tests

Last updated: 2026-07-02

YouTrader has Maestro smoke-test readiness for critical App Store flows. These tests are local/device readiness checks and do not require paid Maestro Cloud.

## Current Status

- Maestro runtime is not bundled into the Expo app.
- No npm dependency was added.
- Smoke flows live in `.maestro/`.
- npm scripts call a locally installed Maestro CLI:
  - `npm run test:maestro`
  - `npm run test:maestro:launch`
- GitHub Actions does not run Maestro yet because the repo does not have a stable simulator/device job. Keep it manual until simulator setup is deliberate.

## Manual Setup

Install Maestro CLI on macOS:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Restart the terminal if needed, then verify:

```bash
maestro --version
```

Start an iOS Simulator or connect a device with YouTrader installed:

```bash
open -a Simulator
```

Build/install a safe test build first:

```bash
npx eas build --profile preview --platform ios
```

or run locally:

```bash
npx expo run:ios
```

## Run Tests

Run all flows:

```bash
npm run test:maestro
```

Run launch-only smoke:

```bash
npm run test:maestro:launch
```

Run one file:

```bash
maestro test .maestro/03_stats_exports.yaml
```

## Flow Inventory

### 1. App Launch

File: `.maestro/01_app_launch.yaml`

Checks:

- Launch app.
- Verify main bottom navigation appears.
- Verify Journal, Stats, Calculator, AI Analytics, News, Calendar, and Settings labels are visible.

### 2. Journal

File: `.maestro/02_journal_add_trade.yaml`

Checks:

- Open Journal.
- Open trade modal from the calendar.
- Save a simple MES test trade.
- Verify trade appears.
- Open trade details/edit.
- Close edit modal.

Safety:

- The flow does not delete trades automatically.
- Run only on a simulator, preview build, or test device data.
- If you need to verify delete manually, open the created trade and tap Delete Trade only on test data.

### 3. Stats And Exports

File: `.maestro/03_stats_exports.yaml`

Checks:

- Open Stats.
- Verify period selector renders.
- Verify Share P&L card and Monthly PDF actions appear.
- Scroll to Heatmap and verify it renders.

Safety:

- The flow does not complete a real share sheet or Photos write.
- Manual QA is still required for iOS share sheet, Photos permission, and PDF preview.

### 4. Paywall

File: `.maestro/04_paywall_locked_feature.yaml`

Checks:

- Open AI Analytics as a free user.
- Verify locked Pro surface appears.
- Tap See all features.
- Verify feature explainer alert appears.

Safety:

- The flow does not tap purchase buttons.
- Real RevenueCat sandbox purchase/restore remains manual QA.

### 5. News / AI Analytics

File: `.maestro/05_news_ai_analytics.yaml`

Checks:

- Open News.
- Wait for readable news or empty state without crash.
- Open AI Analytics.
- Verify cached/intelligence or locked state appears without crash.

## CI Safety

Do not add Maestro to GitHub Actions until all of these are true:

- A macOS runner and iOS Simulator strategy are selected.
- A deterministic preview build is available to install.
- Test data is isolated from production/private journals.
- The flow can run without real purchases, real sharing, camera, microphone, or Photos writes.
- The job is stable locally at least 5 times in a row.

Potential future CI shape:

```yaml
- name: Install Maestro
  run: curl -Ls "https://get.maestro.mobile.dev" | bash

- name: Run Maestro smoke tests
  run: maestro test .maestro
```

Keep it manual for now to avoid flaky release blockers.

## Known Limitations

- Some flows depend on visible text labels because the current app does not expose dedicated `testID` selectors everywhere.
- Journal add flow assumes the first visible calendar day can open the trade modal.
- Native permission flows, Photos, camera, microphone, share sheet, and RevenueCat purchases still need real iPhone/TestFlight QA.
- Maestro does not replace App Store release manual QA.

## Manual Attachment QA

Run these on a real iPhone/TestFlight build before release:

1. Create a trade with Upload Photo.
2. Create a trade with Take Picture.
3. Create a Pro trade with Record Voice.
4. Save each trade and confirm the media appears in the trade card.
5. Force close and reopen the app; confirm the media still appears.
6. Edit each trade; confirm the existing media remains attached after Save Trade.
7. With Pro cloud sync enabled, sign in on a second device and run sync; confirm screenshots and voice notes restore from private Supabase Storage.
8. Temporarily block network during sync; confirm the trade still saves locally and the app reports that cloud sync will retry attachments.

## References

- Maestro QuickStart: https://docs.maestro.dev/get-started/quickstart
- Maestro commands: https://docs.maestro.dev/reference/commands-available
