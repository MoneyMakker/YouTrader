# Agent-007 product analytics

The iOS client sends a small allowlisted product-event taxonomy through the authenticated `agent-analytics-proxy` Edge Function. The proxy validates the Supabase session, removes prohibited properties, signs the normalized batch with a server-only HMAC secret, and forwards it to Agent-007.

No Agent-007 signing secret, service-role credential, customer email, phone, name, private note, screenshot, audio, brokerage credential, account number, payment data, or RevenueCat subscriber payload is sent from the mobile client.

Delivery is non-blocking. Events are bounded in local storage, sent only while the app is active, retried at most three times, and deduplicated by an idempotency key. Analytics transport failure never blocks a trade, journal, authentication, purchase, or restore flow.

The mobile client records pseudonymous installation and session identifiers. Agent-007 hashes the subject identifier server-side before storage. The server-only Edge Function requires a valid authenticated user session and rejects invalid, oversized, or PII-bearing batches.
