# Post-115 Codex Status — 2026-08-02

## Scope

Working branch: `codex/yt3-post115-polish` from release commit `99e66c7`.
Product code commit: `92261e5` (`fix(prop-pass): honor production entitlement states`).

This work preserves public version `1.6.1`, advances only to build `116`, and leaves `testflight-1.6.1-115` on `2c6cd5b`. No build `117`, App Store metadata update, review submission, external testing, or public release was performed.

## Implemented fixes

1. **Prop Pass P0:** active RevenueCat CustomerInfo entitlement now controls product access. Production no longer turns a paying user's normal screen into `Prop Pass unavailable` merely because the dormant staging-only Prop OS gateway is off or not allowlisted.
2. **Production state contract:** no entitlement → locked preview; entitled + remote dashboard model → dashboard; entitled + no configured account/read-gateway activation off in production → setup; remote outage → recoverable error; unsupported/integrity conditions remain explicit.
3. **CustomerInfo lifecycle:** the existing listener/foreground/restore flows are retained; Settings and Prop Pass focus now request a fresh CustomerInfo snapshot.
4. **Calendar:** unselected month and year labels now use the semantic high-contrast dark-theme text token.
5. **Stats:** the learning card reports feature-specific threshold progress, avoiding a misleading six-trade implication for the five-trade Performance Radar.
6. **Release gate:** `release:stability` correctly checks immutable native metadata for build 115.
7. **Google OAuth PKCE:** production browser OAuth now preserves the opaque verifier in the secure session adapter and reads SecureStore first. Previously the adapter treated it as a malformed JSON session, removed it, and Supabase rejected the code exchange.

## Local verification

| Gate | Result |
|---|---|
| Typecheck / translations | PASS |
| Email-password / RevenueCat identity / entitlement | PASS |
| Prop Pass production / lifecycle / presentation contracts | PASS |
| Add Trade contract / calendar contrast / Stats thresholds | PASS |
| Release stability / iOS export | PASS |
| Security check / Gitleaks / Semgrep | PASS (0 leaks, 0 blocking) |
| npm audit | PASS: 0 high, 0 critical; 3 moderate existing dependency findings |
| Expo Doctor | 16/18 known non-blocking config findings |

## External and physical QA

Physical iPhone QA was completed on signed production build `1.6.1 (116)`: five-tab navigation, Calendar contrast, signed Add Trade controls, Stats, Futures, entitled Prop Pass setup, fresh install/cold launch and foreground return all rendered without a black screen or permanent loader. Production Apple SIWA received its authorization code, `store-apple-auth-token` v3 returned 200 and created one encrypted token row; confirmed account deletion returned the normal success path, invoked the revoke branch, removed the Supabase user and reduced Apple token rows to zero. Weekly/Email, Monthly/Apple, and Yearly/Google sandbox purchases succeeded; Google OAuth was fixed and retested after the PKCE repair. Sandbox cross-grade CustomerInfo continued to report the current Monthly entitlement while the Yearly receipt succeeded; this is recorded as the StoreKit current-period state rather than a UI-derived claim.

Signed archive/export passed twice after the final repair: `build/YouTrader-1.6.1-116.xcarchive` and `build/YouTrader-1.6.1-116.ipa`. Final build fingerprint evidence is under `evidence/build116-release-20260802/`.

## Delivery status

Build 116 is authorized, archived, device-validated and ready for TestFlight upload. Upload, Apple processing confirmation and existing internal-group assignment remain the next external steps.
