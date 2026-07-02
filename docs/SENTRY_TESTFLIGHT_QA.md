# Sentry TestFlight QA

YouTrader Sentry is env-gated and must not break builds when Sentry secrets are missing.

## Required Runtime Env

- `EXPO_PUBLIC_SENTRY_DSN` or `SENTRY_DSN` - Sentry project DSN.
- `EXPO_PUBLIC_APP_ENV` or `APP_ENV` - recommended values: `development`, `testflight`, `production`.

The DSN is not a server secret, but it should still be scoped to the correct project and environment.

## Optional Source Map Upload Secrets

Use these only in EAS/CI secrets when source map upload is intentionally enabled:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Do not commit these values. Do not paste them into AI chats. Do not require them for normal local builds.

## Verify DSN Is Active

1. Set `EXPO_PUBLIC_SENTRY_DSN` for a TestFlight/internal build.
2. Set `EXPO_PUBLIC_APP_ENV=testflight`.
3. Build and install through TestFlight or a local release-style device build.
4. Open the app and perform normal flows: Journal, Stats, News, Paywall preview, and export preview.
5. Confirm Sentry shows sessions/events for the `testflight` environment.

## Safe Test Error

Do not add a crash button to production UI.

For a development-only smoke test, call the monitoring helper from a temporary local-only branch or a dev console path that is not shipped:

```ts
captureAppError(new Error("Sentry TestFlight smoke test"), {
  feature: "qa",
  test: true,
});
```

Remove the temporary trigger before release. The app should send the error without logging secrets or private journal content.

## Avoid Source Map Upload Failures

- Runtime crash reporting needs only the DSN.
- Source map upload should run only when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are all present.
- If those secrets are missing, disable upload rather than failing the App Store/TestFlight build.
- Keep Sentry auth tokens in EAS/CI secret storage only.

## TestFlight Checklist

- Sentry DSN configured for the correct project.
- Environment label is `testflight`.
- App opens when DSN is missing.
- App opens when DSN is present.
- Safe test error appears in Sentry.
- No private notes, screenshots, voice notes, auth tokens, receipts, or full trade payloads are attached to events.
- Source map upload is either fully configured or intentionally disabled.

