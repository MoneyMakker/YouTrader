# Post-115 Codex Status — 2026-08-02

## Scope

Working branch: `codex/yt3-post115-polish` from release commit `99e66c7`.
Product code commit: `92261e5` (`fix(prop-pass): honor production entitlement states`).

This work preserves public version/build `1.6.1 (115)` and leaves `testflight-1.6.1-115` on `2c6cd5b`. No archive, TestFlight upload, App Store metadata update, review submission, or public release was performed.

## Implemented fixes

1. **Prop Pass P0:** active RevenueCat CustomerInfo entitlement now controls product access. Production no longer turns a paying user's normal screen into `Prop Pass unavailable` merely because the dormant staging-only Prop OS gateway is off or not allowlisted.
2. **Production state contract:** no entitlement → locked preview; entitled + remote dashboard model → dashboard; entitled + no configured account/read-gateway activation off in production → setup; remote outage → recoverable error; unsupported/integrity conditions remain explicit.
3. **CustomerInfo lifecycle:** the existing listener/foreground/restore flows are retained; Settings and Prop Pass focus now request a fresh CustomerInfo snapshot.
4. **Calendar:** unselected month and year labels now use the semantic high-contrast dark-theme text token.
5. **Stats:** the learning card reports feature-specific threshold progress, avoiding a misleading six-trade implication for the five-trade Performance Radar.
6. **Release gate:** `release:stability` correctly checks immutable native metadata for build 115.

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

No new physical-device screenshots were captured. The required interactive Apple stored:true/revoke proof is **BLOCKED_BY_2FA** until an operator uses a disposable Apple identity on a production-pointing iOS build. The reusable sanitized procedure is `evidence/deletion-smoke-20260802/APPLE_STORED_TRUE_OPERATOR.md`.

## Delivery status

The fix needs a new, separately authorized TestFlight build to reach production devices. Build 116 is **not authorized** and was not created.
