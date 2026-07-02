# YouTrader PostHog Funnels

YouTrader analytics must stay privacy-safe. Track product behavior and counts only. Never send private journal notes, screenshots, voice notes, full trade payloads, auth tokens, payment payloads, or API keys.

PostHog is optional and env-gated. If no key is configured, the app must continue to run normally.

## Required Event Coverage

These events should come from real user flows:

- `app_opened` - app mounted and observability initialized.
- `trade_added` - a trade was saved successfully.
- `trade_deleted` - a single trade was deleted successfully.
- `day_deleted` - a Journal day delete was confirmed and completed.
- `first_insight_seen` - the free deterministic First Insight became visible.
- `locked_insight_seen` - the locked hidden-leaks preview became visible.
- `paywall_viewed` - a Pro/paywall surface became visible.
- `trial_started` - purchase flow began with a trial-eligible RevenueCat package.
- `pro_purchased` - RevenueCat returned active Pro entitlement after purchase.
- `pro_restored` - restore purchases returned active Pro entitlement.
- `ai_analysis_opened` - user opened AI analysis from a real feature surface.
- `share_card_exported` - share/save card export completed.
- `pdf_exported` - monthly PDF export completed.
- `news_opened` - user opened a readable news card/source.
- `market_intel_viewed` - cached Market Intelligence screen/content was viewed.
- `weekly_report_opened` - report/export flow opened successfully.

## Recommended Funnels

### 1. Activation

`app_opened` -> `trade_added` -> `first_insight_seen`

Use this to measure whether a new user reaches the first value moment after journaling.

### 2. Monetization

`first_insight_seen` -> `locked_insight_seen` -> `paywall_viewed` -> `trial_started` or `pro_purchased`

Use this to verify the paywall appears after value, not before the user understands the journal.

### 3. Retention

`app_opened` -> `trade_added` -> `weekly_report_opened`

Use this to understand whether users keep logging and reviewing performance.

### 4. Export Virality

`share_card_exported` or `pdf_exported`

Break down by safe metadata such as period/action only. Do not include trade details.

### 5. News Engagement

`news_opened` -> `market_intel_viewed`

Use this to compare readable news engagement with cached intelligence engagement.

## Safe Metadata

Allowed examples:

- `screen`
- `reason`
- `period`
- `action`
- `trade_count`
- `is_pro`
- `source`
- `impact`
- `has_url`
- `pnl_result`

Do not send:

- notes or journal text
- screenshots or image/audio URIs
- voice note metadata
- full trade entries
- account identifiers
- tokens, secrets, keys, or payloads
- payment receipts or webhook bodies

## Dashboard Setup

1. Open PostHog.
2. Create each funnel from the recommended event sequence.
3. Set conversion window to 7 days for activation/monetization and 30 days for retention.
4. Add breakdowns only for safe metadata.
5. Keep session replay and autocapture disabled for the mobile app unless a separate privacy review approves them.

