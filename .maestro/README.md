# YouTrader Maestro Test Suite

This suite is organized by product area. It is intentionally stored outside app runtime code; Maestro is not bundled into the Expo app.

## Install

Maestro CLI is required locally:

```bash
brew install maestro
brew install openjdk
curl -Ls https://get.maestro.mobile.dev | bash
export PATH="/opt/homebrew/opt/openjdk/bin:$HOME/.maestro/bin:$PATH"
maestro --version
```

The Homebrew cask installs the desktop app. The official installer provides the `maestro` CLI used by these tests.

## Run

Run every flow:

```bash
maestro test .maestro
```

Run one product area:

```bash
maestro test .maestro/analytics
maestro test .maestro/trades
```

Run one flow:

```bash
maestro test .maestro/analytics/scroll_sections.yaml
```

Screenshots are captured with `takeScreenshot` after each flow/major checkpoint and stored by Maestro in its screenshot output location.

## Structure

- `_shared/` reusable launch/navigation commands.
- `login/` login/logout smoke coverage.
- `trades/` create/edit/delete trade navigation smoke coverage.
- `stats/` statistics and share/report actions.
- `analytics/` AI Analytics sections, achievements, DNA, mission and weekly report.
- `calendar/` calendar navigation.
- `news/` news navigation.
- `subscriptions/` sandbox purchase entry, restore, locked/unlocked Pro surfaces.
- `settings/` settings navigation and important labels.

## Coverage Rules

Each flow verifies:

- expected buttons/text exist,
- navigation works,
- important UI text is visible,
- the screen does not crash before screenshot capture.

Purchase flows are sandbox-safe smoke checks. They stop before confirming App Store payment unless a tester explicitly continues manually.

## Limitations

The app currently does not expose dedicated `testID` selectors on every screen. These flows use visible text selectors to avoid production-code changes. If flows become flaky, add stable `testID`/accessibility labels in a separate production-code task.

## Last Local Run

`maestro test .maestro` was executed after setup. The suite loaded, but execution stopped because no iOS Simulator or physical device was connected:

```text
You have 0 devices connected, which is not enough to run 1 shards.
```

Start Simulator or connect an iPhone with a preview/TestFlight build installed, then run again.
