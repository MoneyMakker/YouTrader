# YouTrader Observability

YouTrader production observability is intentionally env-gated. The app must build and run when all observability keys are missing.

## Sentry

Runtime crash reporting is enabled only when a DSN is present.

Supported runtime env:

- `EXPO_PUBLIC_SENTRY_DSN` or `SENTRY_DSN` - Sentry project DSN. DSN is not a server secret, but still keep it scoped to the correct project/environment.
- `EXPO_PUBLIC_APP_ENV` or `APP_ENV` - optional environment label such as `production`, `preview`, or `development`.

Source map upload must only be enabled in CI/EAS when all build secrets exist:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Do not commit Sentry auth tokens. Do not paste them into AI chats.

## PostHog

PostHog product analytics is enabled only when a key is present.

Supported env:

- `EXPO_PUBLIC_POSTHOG_API_KEY` or `POSTHOG_API_KEY`
- `EXPO_PUBLIC_POSTHOG_HOST` or `POSTHOG_HOST` (defaults to `https://us.i.posthog.com`)

Autocapture and session replay are disabled. YouTrader only sends explicit safe events with metadata/counts. Do not track notes, screenshots, voice notes, full trade data, tokens, or sensitive payloads.

Recommended funnel setup lives in `docs/POSTHOG_FUNNELS.md`. Key production funnels:

- Activation: `app_opened` -> `trade_added` -> `first_insight_seen`.
- Monetization: `first_insight_seen` -> `locked_insight_seen` -> `paywall_viewed` -> `trial_started` / `pro_purchased`.
- Retention: `app_opened` -> `trade_added` -> `weekly_report_opened`.
- Export virality: `share_card_exported` / `pdf_exported`.
- News engagement: `news_opened` -> `market_intel_viewed`.

Do not enable mobile session replay/autocapture without a dedicated privacy review.

## TestFlight QA

Sentry TestFlight verification steps live in `docs/SENTRY_TESTFLIGHT_QA.md`.

Runtime crash reporting needs only `EXPO_PUBLIC_SENTRY_DSN` or `SENTRY_DSN`. Source map upload must remain optional and should only run when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are all available as CI/EAS secrets.

## Microsoft Clarity Evaluation

Microsoft Clarity has an official React Native SDK, but it depends on native code, requires a new EAS/native build, and does not run in Expo Go. Because YouTrader is a sensitive trading journal with notes, screenshots, voice notes, and trade records, Clarity is not installed in the Expo app at this time.

Reference:

- Microsoft Clarity React Native SDK docs: https://learn.microsoft.com/en-us/clarity/mobile-sdk/react-native-sdk

Current recommendation:

- Use Clarity only for marketing websites or landing pages where no private journal/trade data is rendered.
- Keep mobile product analytics in PostHog with explicit safe events and no autocapture/session replay.
- Re-evaluate Clarity only after a privacy review, native build QA, and proof that sensitive surfaces can be fully masked/excluded.

Do not capture:

- journal notes
- screenshots
- voice notes
- trade details
- account identifiers
- payment payloads
- personal data or PII-heavy screens

## Push Notifications

Expo local notification readiness exists for:

- Log today's trade
- Weekly report ready
- Daily brief ready
- Risk limit close
- Prop daily buffer at risk

Remote push token retrieval is helper-only and does not store tokens until backend storage is explicitly designed and RLS-reviewed.

Optional env for token retrieval:

- `EXPO_PUBLIC_EAS_PROJECT_ID`

Do not send real remote pushes until a safe backend path exists.
