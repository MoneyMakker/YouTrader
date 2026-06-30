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
