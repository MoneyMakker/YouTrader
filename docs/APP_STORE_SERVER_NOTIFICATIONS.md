# App Store Server Notifications Readiness

Last updated: 2026-07-02

This document describes the safe subscription notification strategy for YouTrader. Do not build custom payment state unless RevenueCat cannot satisfy a specific reviewed requirement.

## Current Recommendation

Prefer RevenueCat webhooks as the primary server-side subscription event path.

References:

- RevenueCat webhooks: https://www.revenuecat.com/docs/integrations/webhooks
- Apple App Store Server Notifications: https://developer.apple.com/documentation/appstoreservernotifications

Why:

- The mobile app already uses RevenueCat for purchases, restore, products, offerings, and entitlement state.
- RevenueCat can receive store events and expose normalized subscription/customer state.
- A direct Apple App Store Server Notifications endpoint would duplicate payment state unless it has a narrow purpose.
- RevenueCat supports production/sandbox filtering, authorization headers, HMAC webhook signing, retries, and duplicate handling guidance.

## RevenueCat Webhook Readiness

Manual RevenueCat dashboard setup:

1. RevenueCat Dashboard -> Project -> Integrations -> Webhooks.
2. Add separate webhook configurations for sandbox and production if backend endpoints differ.
3. Set a strong authorization header.
4. Enable HMAC webhook signing if available for the integration.
5. Store the signing secret only in backend/server secrets.
6. Never put webhook secrets in Expo public env.
7. On webhook receipt, verify authorization/signature before any state change.
8. Use idempotency based on RevenueCat event IDs.
9. For subscription state sync, prefer fetching the canonical RevenueCat subscriber/customer state after webhook receipt.

Production safety:

- Sandbox events must not update production subscription rows.
- Test webhook events must not grant production access.
- Unknown event types should be logged safely and ignored.
- Webhook processing should respond quickly and defer heavier work.

## Direct Apple Notifications

Use direct App Store Server Notifications only if RevenueCat webhooks are insufficient.

Requirements before implementing a direct Apple endpoint:

- Verify App Store Server Notifications v2 `signedPayload` JWS signature.
- Validate Apple certificate chain and bundle ID.
- Validate environment: `Sandbox` vs `Production`.
- Validate notification type/subtype allowlist.
- Use idempotency for notification UUID / transaction IDs.
- Never trust unsigned JSON payloads.
- Never let a test endpoint mutate production subscription state.
- Keep Apple private keys and App Store Connect issuer/key IDs server-side only.

Recommended backend approach if direct Apple support is later required:

- Implement as a Supabase Edge Function or another reviewed backend endpoint.
- Keep raw request body available for verification.
- Do not process before JWS verification succeeds.
- Store only normalized, minimal subscription state.
- Preserve RevenueCat as the client-facing entitlement source unless a migration plan exists.

## Manual Apple Dashboard Setup Later

1. App Store Connect -> Apps -> YouTrader -> App Information / App Store Server Notifications.
2. Configure separate sandbox and production notification URLs.
3. Start with sandbox URL only.
4. Verify signed notification handling with Apple sandbox events.
5. Review logs for environment separation before enabling production.

## What Not To Do

- Do not build insecure custom subscription logic in the mobile app.
- Do not use Apple notifications to bypass RevenueCat entitlement checks.
- Do not accept unsigned webhook JSON.
- Do not put Apple private keys or shared secrets into Expo env.
- Do not update production subscriptions from sandbox/test events.
