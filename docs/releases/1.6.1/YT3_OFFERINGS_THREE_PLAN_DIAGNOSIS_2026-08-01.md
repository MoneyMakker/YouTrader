# YT3 Offerings / Three-Plan Paywall Diagnosis — 2026-08-01

Build: **113** (`1.6.1`). Phase 4F: **FAILED / OPEN / NO-GO**. No build 114.

## Symptom

Acquisition paywall often renders only:

- “Subscriptions temporarily unavailable”
- Retry
- Restore Purchases

That is the intentional **error shell**, not the final three-plan paywall.

## Local contract (verified in repo)

| Layer | Weekly | Monthly | Yearly |
|---|---|---|---|
| Product ID constant | `youtrader_pro_weekly` | `youtrader_pro_monthly` | `youtrader_pro_yearly__` |
| `ios/YouTraderStaging.storekit` | `$4.99` / `P1W` | `$12.99` / `P1M` | `$99.99` / `P1Y` + 7-day free intro |
| `YouTrader-Staging.xcscheme` StoreKit file | linked | linked | linked |
| Entitlement env | `YouTrader Pro` | same | same |
| Client API key env | present (`appl_…`) | — | — |
| `EXPO_PUBLIC_REVENUECAT_IOS_WEEKLY_PRODUCT_ID` | missing in `.env` (falls back to constant) | — | — |

Client path:

1. `Purchases.getOfferings()` → `offerings.current.availablePackages`
2. If empty → `Purchases.getProducts(YOU_TRADER_PRO_PRODUCT_IDS)` fallback
3. If both empty → unavailable UI (no fake purchasable cards)

## Root cause (most probable)

Unavailable state means **both** offerings packages and store-product fallback resolved empty at runtime.

Primary suspects (ordered):

1. **RevenueCat default offering** does not yet expose a Weekly package (`youtrader_pro_weekly`) and/or current offering is empty in the RC project tied to the staging iOS API key.
2. **StoreKit Configuration not active** for the process that launched the app (Maestro/`simctl launch` without the Xcode scheme’s StoreKit session) → `getProducts` returns `[]` even though the `.storekit` file exists in the repo.
3. Bundle / API key project mismatch: app uses staging RC iOS key; products must exist in that RC project and map to App Store / StoreKit IDs above.
4. Transient network / RC init race before first refresh (Retry should recover when catalog is healthy).

Not the cause:

- Missing weekly ID in app constants (present with default `youtrader_pro_weekly`).
- Paywall UI hard-coding only monthly/yearly (UI already selects Weekly/Monthly/Yearly from resolved packages/products).

## Required dashboard / StoreKit actions (manual — do not fake in UI)

1. RevenueCat → Products: ensure `youtrader_pro_weekly`, `youtrader_pro_monthly`, `youtrader_pro_yearly__`.
2. Attach all three to entitlement **YouTrader Pro**.
3. Default offering packages: Weekly + Monthly + Annual.
4. Launch Debug-Staging **from Xcode** with `YouTraderStaging.storekit` selected so StoreKit Testing session is live.
5. Confirm `billingDebugLog("offerings received" | "products fallback loaded")` shows three product IDs.
6. Screenshot matrix must use successful three-plan state; unavailable is a separate failure capture only.

## App hardening already in place

- Unavailable state preserves premium shell + Retry + Restore; no Main App access.
- No static fake purchasable plan cards when catalog is empty.
- CTA labels include selected plan price when catalog resolves.
- `.env.example` now documents weekly product ID.

## Status

| Item | Status |
|---|---|
| Weekly StoreKit local product | PASS (repo) |
| Weekly RC package on live offering | **PENDING / likely FAIL** (dashboard verify) |
| Three selectable plans in successful catalog | PASS (UI) |
| Normal screenshot with three plans | **PENDING** until catalog resolves on device |
| CustomerInfo after purchase | **PENDING** device E2E |
| Phase 4F | FAILED / OPEN / NO-GO |
