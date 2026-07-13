# Agent-007 Product Analytics

The iOS client records a limited set of meaningful product events without collecting trade content or personal data. It reuses the existing `trackEvent` boundary, so normal UI work remains non-blocking.

## Privacy model

The client keeps a random installation identifier and session identifier locally. It strips prohibited property names before queueing, then sends a bounded batch only through the authenticated `agent-analytics-proxy` Supabase Edge Function. The app contains no Agent-007 service-role key or signing secret.

The proxy verifies the signed-in Supabase user, repeats property validation, and HMAC-signs its normalized payload for Agent-007. It does not forward the mobile user's identity, email, trade notes, screenshots, voice notes, broker data, payment data, or credentials.

## Reliability model

Events are buffered in AsyncStorage in batches of at most 25. Delivery is delayed until the app is active, retries are bounded to three attempts, and a stable idempotency key prevents replay from creating extra records. The queue, installation identifier, and session are cleared on sign-out to avoid cross-account delivery or cross-account correlation on a shared device.

## Taxonomy

The current first release maps existing meaningful events: account completion, authenticated app opening, journal entry creation, first trade/value moment, CSV import, paywall and purchase flow, AI analysis, news, and weekly reports. Not-yet-existing onboarding screens and controls are intentionally not fabricated as telemetry.

## Required deployment configuration

The `agent-analytics-proxy` Edge Function requires server-only Supabase secrets named `AGENT007_PRODUCT_ANALYTICS_INGEST_URL` and `AGENT007_PRODUCT_ANALYTICS_SIGNING_SECRET`. Do not add either to Expo or EAS public environment variables.
