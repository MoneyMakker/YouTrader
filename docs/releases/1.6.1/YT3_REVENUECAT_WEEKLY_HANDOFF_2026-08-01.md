# RevenueCat Weekly configuration handoff (non-secret)

Status: **EXTERNAL ACCESS BLOCKER — REVENUECAT WRITE ACCESS REQUIRED**

Do not retry with the public SDK (`appl_`) key.

## Target project category

- Platform: iOS App Store / StoreKit Testing
- Environment: staging YouTrader iOS public SDK key project
- Offering identifier: `default`
- Entitlement: `YouTrader Pro`

## Required products (preserve existing)

| Package | Store product ID | Price (USD) | Introductory offer |
|---------|------------------|-------------|--------------------|
| `$rc_weekly` (or custom Weekly) | `youtrader_pro_weekly` | $4.99/week | **none** |
| `$rc_monthly` | `youtrader_pro_monthly` | $12.99/month | 3-day free (preserve) |
| `$rc_annual` | `youtrader_pro_yearly__` | $99.99/year | 7-day free (preserve) |

## Current live read

- Monthly: present
- Annual: present
- Weekly: **missing**
- `package_count`: **2**
- Expected after fix: **3**

## Attachments required

1. Product `youtrader_pro_weekly` exists in RevenueCat.
2. Attached to entitlement `YouTrader Pro`.
3. Added to offering `default` as Weekly package.
4. App Store Connect / StoreKit intro: Weekly null; Monthly P3D; Yearly P1W.

## Verification command (read-only)

```bash
node --import tsx scripts/qa/revenuecat-offering-audit-staging.ts
```

Expect: `weekly_in_offering: true`, `package_count: 3`.
