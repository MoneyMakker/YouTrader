# YouTrader App Store Release Checklist

Use this before every TestFlight/App Store upload. Do not paste secrets into chats, issues, screenshots, or commits.

## Build Identity

- App version is correct in `app.json`, `package.json`, and `ios/YouTrader/Info.plist`.
- iOS build number is higher than the last uploaded App Store Connect build.
- Bundle identifier remains `com.youtrader.pro`.
- EAS project ID is correct.
- No `.ipa`, `.env`, signing keys, `.p8`, `.mobileprovision`, or build artifacts are staged.

## TestFlight Checklist

- Build installs on a real iPhone.
- Build opens cold without crash.
- Existing local journal data loads.
- App works with observability env vars missing.
- App works with Supabase/cloud AI temporarily unavailable.
- Legal links open.
- No debug/internal secret text appears in UI.

## RevenueCat Checklist

- Monthly product: `youtrader_pro_monthly`.
- Yearly product: `youtrader_pro_yearly`.
- Both products unlock the same `pro` entitlement.
- Current/default offering contains monthly and yearly packages.
- 3-day trial is configured in App Store Connect and visible through RevenueCat if enabled.
- Sandbox purchase succeeds.
- Restore purchases succeeds for an active entitlement.
- Canceled/no-subscription restore shows a friendly message.
- Paywall has subscription terms, restore, and clear pricing.

## Supabase Checklist

- No service role key is in Expo public env.
- RLS remains enabled on user-owned tables.
- Market Intelligence cached tables remain read-only for app users.
- `ai-coach` Edge Function has required secrets only in Supabase dashboard.
- `secure-upload` remains deployed and private upload paths still work.
- Cloud sync remains disabled unless explicitly QA-tested end to end.

## Sentry Checklist

- Runtime DSN is set only if crash reporting should be live: `EXPO_PUBLIC_SENTRY_DSN` or `SENTRY_DSN`.
- Source map upload secrets are configured only in CI/EAS secrets: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
- App builds/runs without Sentry env vars.
- No Sentry auth token is committed.
- Verify one non-PII test error in Sentry before production release.

## PostHog Checklist

- `EXPO_PUBLIC_POSTHOG_API_KEY` is configured only for the intended PostHog project.
- `EXPO_PUBLIC_POSTHOG_HOST` is correct, default `https://us.i.posthog.com`.
- Autocapture and session replay remain disabled.
- Events contain only safe metadata/counts.
- No notes, screenshots, voice notes, full trade payloads, tokens, or PII-heavy data are captured.

## Microsoft Clarity Checklist

- Clarity is not installed in the mobile app unless explicitly approved after privacy/native-build review.
- If Clarity is ever used, it must be env-gated, disabled by default, and fully mask/exclude journal notes, screenshots, voice notes, trade details, PII, and payment surfaces.
- Clarity is currently recommended only for public web/landing pages, not the Expo mobile app.
- Prefer PostHog explicit safe events for mobile analytics.

## Expo Push Checklist

- Permission denied path does not crash.
- Permission allowed path schedules local reminders.
- Local notification use cases are QA-tested: log today's trade, weekly report ready, daily brief ready, risk limit close, prop daily buffer at risk.
- Remote push sending is not enabled until backend token storage is designed and RLS-reviewed.
- Expo push token is not stored unless a safe server path exists.
- Manual setup for remote push later: Apple push credentials in EAS/Expo, backend token table with RLS, server sender, unsubscribe/delete cleanup.

## Remote Config And A/B Testing Checklist

- App builds and runs when Firebase config is missing.
- Remote Config is used only for safe copy/flags, never secrets, prices, RevenueCat product IDs, entitlement IDs, security rules, or Supabase behavior.
- Safe keys are limited to paywall headline/CTA, upgrade button wording, `show_trial_offer`, `show_yearly_discount`, `show_locked_insight_after_7_trades`, `show_push_prompt`, and copy variants.
- A/B experiments preserve Restore Purchases, legal subscription disclosure, and current App Store pricing.
- Initial experiment ideas are documented in `docs/GROWTH_INFRASTRUCTURE.md`.
- No Firebase admin credentials or private files are committed.

## Expo Updates / OTA Checklist

- `runtimeVersion` remains configured with `policy: appVersion`.
- OTA is not used for native dependencies, RevenueCat IDs, entitlement changes, Info.plist permissions, Supabase schema/security, or legal/privacy changes.
- OTA candidates are limited to JavaScript-only fixes, copy, safe UI polish, and non-security bug fixes.
- Preview channel is tested before any production update.
- Rollback plan is documented before production OTA rollout.

## AI Provider Checklist

Server-only Supabase Edge Function secrets:

- `AI_PROVIDER` = `auto`, `openrouter`, `gemini`, `anthropic`, or `nvidia`.
- `OPENROUTER_API_KEY` for OpenRouter gateway.
- `GEMINI_API_KEY` for direct Gemini fallback/use.
- `ANTHROPIC_API_KEY` for direct Claude/Sonnet fallback/use.
- `AI_MODEL_FAST` for cheap/fast tasks, for example Gemini 2.5 Flash.
- `AI_MODEL_DEEP` for Pro deep analysis, for example Claude Sonnet through OpenRouter or Anthropic.
- Existing optional fallback: `NVIDIA_API_KEY`, `NVIDIA_MODEL`.

Rules:

- No paid/private AI keys in Expo public env.
- Free users must not trigger paid per-user AI unless quota rules explicitly allow it.
- Pro AI remains quota/cooldown protected.
- Missing keys return safe local fallback.
- AI must not provide financial advice or buy/sell/hold signals.
- Client AI calls must go through Supabase Edge Function `ai-coach`; no private provider key may exist in Expo public env.
- Free users must receive local preview/fallback only and must not trigger paid provider generation.

## Subscription Webhook Checklist

- Prefer RevenueCat webhooks over direct Apple App Store Server Notifications for subscription state.
- RevenueCat webhook authorization/HMAC signing is enabled before production use.
- Sandbox and production webhook handling are separated.
- Test webhook events must not grant production subscriptions.
- Direct Apple Server Notifications require v2 `signedPayload` JWS verification before any state change.
- Do not duplicate RevenueCat subscription state unless a reviewed backend requirement exists.

## Skia Phase 2

- React Native Skia is not required for this App Store release.
- Do not install `@shopify/react-native-skia` right before release unless compatibility is tested.
- Phase 2 candidates: premium charts, radar/heatmap visuals, export cards, achievement cards.

## Privacy Policy Checklist

- Describes journal data, screenshots, voice notes, CSV imports, purchases, crash analytics, product analytics, and notification permissions.
- Explains no financial advice and no broker/dealer role.
- Covers account deletion/export expectations.
- Links match App Store Connect metadata.

## Screenshots Checklist

- Screenshots use current UI.
- No real private journal data unless anonymized.
- Show Journal, Stats, AI Analytics, News, Calendar, Paywall/Pro value.
- Do not imply market prediction or guaranteed profits.

## Manual QA Matrix

- Maestro local smoke suite runs or is reviewed:
  - `npm run test:maestro:launch`
  - `npm run test:maestro`
  - See `docs/MAESTRO_SMOKE_TESTS.md`.
- App runs with Firebase config missing.
- Growth flags use safe local defaults.
- Remote Config variants do not change prices/product IDs.
- EAS Update/OTA is disabled or preview-tested before production.
- GitHub Actions QA passes.
- Expo Doctor may show the known non-CNG/native-folder warning; review it before native config changes.
- Free user basic journal add/edit/delete.
- Pro user unlocked flows.
- Trial user entitlement flow.
- 31 trades/month free limit.
- 5-trade First Insight.
- 7-10 trade locked insight.
- Share cards.
- Save image to Photos.
- Monthly PDF export/preview.
- Achievement cards.
- Long-press delete day.
- CSV import.
- Cloud sync disabled/enabled state messaging.
- News source link open.
- Cached Market Intelligence read-only display.
- AI Trade Analysis.
- Prop Firm Coach.
- Push permission denied.
- Push permission allowed.
- Paywall monthly purchase.
- Paywall yearly purchase.
- Restore purchase.
- App relaunch after purchase/restore.

## Apple Review Notes

- YouTrader is an educational trading journal, not a broker, signal app, or financial advisor.
- AI output is process/risk/journal coaching only.
- Market news and calendar are informational.
- Subscriptions unlock analytics, exports, AI coaching, and workflow tools.
- Restore purchases is visible.
- Privacy policy and terms links must be live.
