# Maestro Smoke Tests

Last updated: 2026-07-02

YouTrader now has an organized Maestro suite under `.maestro/`. Maestro is developer tooling only and is not bundled into the Expo mobile app.

## Installation Status

Installed locally:

- Homebrew cask `maestro` for Maestro desktop app.
- Maestro CLI via official installer at `$HOME/.maestro/bin/maestro`.
- OpenJDK via Homebrew because Maestro CLI requires Java.

Use this PATH in terminals that have not loaded the new shell profile yet:

```bash
export PATH="/opt/homebrew/opt/openjdk/bin:$HOME/.maestro/bin:$PATH"
```

Verify:

```bash
java -version
maestro --version
```

## Folder Structure

```text
.maestro/
  config.yaml
  _shared/
  login/
  trades/
  stats/
  analytics/
  calendar/
  news/
  subscriptions/
  settings/
  screenshots/
```

- `_shared/` contains reusable launch/navigation commands.
- `login/` covers Login and Logout smoke checks.
- `trades/` covers Create/Edit/Delete trade navigation and no-crash checks.
- `stats/` covers Statistics and Share Report actions.
- `analytics/` covers AI Analytics, scroll all sections, Achievement detail, Trading DNA, Daily Mission, Weekly Report.
- `calendar/` covers Calendar navigation.
- `news/` covers News navigation.
- `subscriptions/` covers Pro sandbox entry, Restore Purchases, locked/unlocked Pro surfaces.
- `settings/` covers Settings navigation and critical labels.

## Run

Run all flows:

```bash
export PATH="/opt/homebrew/opt/openjdk/bin:$HOME/.maestro/bin:$PATH"
maestro test .maestro
```

Run one area:

```bash
maestro test .maestro/analytics
maestro test .maestro/trades
```

Run one flow:

```bash
maestro test .maestro/analytics/scroll_sections.yaml
```

## Current Flows

### Login

- `.maestro/login/login.yaml`
- `.maestro/login/logout.yaml`

### Trades

- `.maestro/trades/create_trade.yaml`
- `.maestro/trades/edit_trade.yaml`
- `.maestro/trades/delete_trade.yaml`

### Stats

- `.maestro/stats/open_statistics.yaml`
- `.maestro/stats/share_report.yaml`

### Calendar / News

- `.maestro/calendar/open_calendar.yaml`
- `.maestro/news/open_news.yaml`

### AI Analytics

- `.maestro/analytics/open_ai_analytics.yaml`
- `.maestro/analytics/scroll_sections.yaml`
- `.maestro/analytics/open_achievement_detail.yaml`
- `.maestro/analytics/open_trading_dna.yaml`
- `.maestro/analytics/open_daily_mission.yaml`
- `.maestro/analytics/open_weekly_report.yaml`

### Subscriptions

- `.maestro/subscriptions/purchase_pro_sandbox.yaml`
- `.maestro/subscriptions/restore_purchases.yaml`
- `.maestro/subscriptions/locked_pro_screens.yaml`
- `.maestro/subscriptions/unlocked_pro_screens.yaml`

### Settings

- `.maestro/settings/open_settings.yaml`

## Screenshot Policy

Each flow calls `takeScreenshot` after the main navigation/assertion checkpoint. Maestro stores screenshots in its run output location.

## Safety

- Purchase flow stops before confirming App Store sandbox payment.
- Delete trade flow is a safe smoke check and does not intentionally confirm destructive deletion.
- Camera, microphone, Photos, share sheet and real purchase confirmation remain manual iPhone QA unless dedicated test fixtures are added.
- Flows currently use visible text selectors because production code was not modified to add `testID` selectors.

## Last Local Run

Command executed:

```bash
maestro test .maestro
```

Result:

```text
You have 0 devices connected, which is not enough to run 1 shards.
```

The suite is configured and Maestro starts, but a Simulator or physical iPhone with YouTrader installed is required to complete execution.

## Recommended Next Step

Start Simulator and install a preview build:

```bash
open -a Simulator
npx expo run:ios
maestro test .maestro
```

For TestFlight/device QA, install the latest preview/TestFlight build on the iPhone, connect it, then run the same command.
