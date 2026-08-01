# YouTrader 3.0 — Paid-only access recovery (build 113)

**Date:** 2026-08-01  
**Build:** 113 (unchanged)  
**Phase 4F:** FAILED / OPEN / NO-GO  

## Authoritative product model

YouTrader is a paid-subscription application.

Removed:
- Free plan / Free Journal / guest Main App access
- Continue without an account
- Continue with Free Journal
- `guestContinued` routing to Main App

Required funnel:
Onboarding 1–4 → Paywall (purchase) → Auth (Apple/Google/Email) → Main App

Main App requires **entitlement + authenticated session**.

## Commits (this session)

See `git log` for YT3-PAID-* commits on this branch.

## State machine

```
!hydrated → loading
!onboardingCompleted → onboarding
!isPremium → paywall (wait RC ready)
isPremium && !session → auth
isPremium && session → main
```

## Guards

`scripts/qa/forbiddenFreeAccessCopy.selftest.ts` fails on user-facing free/guest phrases.

## Remaining

- Weekly product live in RevenueCat/ASC (StoreKit local exists)
- Purchase E2E → mandatory auth → Main App device proof
- Allowlisted Prop Pass tab after entitled+auth (no guest path)
- Physical device on build 113
- Phase 4F blockers unchanged
