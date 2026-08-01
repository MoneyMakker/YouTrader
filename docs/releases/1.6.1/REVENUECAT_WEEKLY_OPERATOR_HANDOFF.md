# RevenueCat Weekly — operator handoff (non-secret)

**Status:** EXTERNAL ACCESS BLOCKER — REVENUECAT WRITE ACCESS REQUIRED  
**Build:** 1.6.1 (113) · Phase 4F FAILED / OPEN / NO-GO  
**Do not** use the public SDK (`appl_`) key for writes. **Do not** mutate production RC if a separate prod project exists — staging iOS project only.

## Current live state (read-only audit)

| Item | State |
|------|--------|
| Offering | `default` |
| Entitlement | `YouTrader Pro` |
| `$rc_monthly` → `youtrader_pro_monthly` | Present |
| `$rc_annual` → `youtrader_pro_yearly__` | Present |
| Weekly package / `youtrader_pro_weekly` | **Missing** |
| `package_count` | **2** |

## Exact missing relationship

Product `youtrader_pro_weekly` is not attached as a Weekly package on offering `default` (and/or not linked to entitlement `YouTrader Pro`) in the staging iOS RevenueCat project.

## Expected final state

| Package | Product ID | Price (USD) | Intro offer |
|---------|------------|-------------|-------------|
| Weekly (`$rc_weekly` or custom) | `youtrader_pro_weekly` | $4.99/week | **none** |
| Monthly (`$rc_monthly`) | `youtrader_pro_monthly` | $12.99/month | **3-day free** (preserve) |
| Annual (`$rc_annual`) | `youtrader_pro_yearly__` | $99.99/year | **7-day free** (preserve) |

- Entitlement: `YouTrader Pro` on all three  
- Offering: `default`  
- `package_count`: **3**

## Operator checklist

1. Open staging YouTrader iOS RevenueCat project (same project as the staging public iOS SDK key).
2. Confirm products exist: `youtrader_pro_weekly`, `youtrader_pro_monthly`, `youtrader_pro_yearly__`.
3. Attach all three to entitlement **YouTrader Pro**.
4. On offering **default**, add Weekly → `youtrader_pro_weekly` without deleting Monthly/Annual.
5. Confirm App Store Connect / StoreKit intros: Weekly null, Monthly P3D, Yearly P1W.
6. Save / publish offering if required by RC UI.

## Post-change verification (read-only)

```bash
node --import tsx scripts/qa/revenuecat-offering-audit-staging.ts
```

Expect:

- `weekly_in_offering: true`
- `monthly_in_offering: true`
- `yearly_in_offering: true`
- `package_count: 3`

Then re-run paywall matrix on simulator/device (when services available).

## Rollback

1. Remove only the Weekly package from `default` if it was added incorrectly.  
2. Do **not** detach Monthly/Annual.  
3. Re-run the audit script; expect `package_count: 2` again if rolled back.  
4. App client already handles missing Weekly without fake purchase cards.

## Secrets

None in this document. Never paste API keys into tickets, commits, or screenshots.
