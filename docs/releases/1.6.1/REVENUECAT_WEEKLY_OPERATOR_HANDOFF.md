# RevenueCat Weekly — operator handoff (non-secret)

**Status:** RC offering **LIVE PASS** (`package_count=3`) · ASC Weekly **submitted** · Monthly ASC trial replace **blocked by Apple API** · Phase 4F still FAILED / OPEN / NO-GO  
**Build:** 1.6.1 (113) · Do **not** use public SDK (`appl_`) for writes.

## Resolved in autonomous session (2026-08-01)

| Item | State |
|------|--------|
| Offering | `default` |
| Entitlement | `YouTrader Pro` |
| `$rc_weekly` → `youtrader_pro_weekly` | **Attached** |
| `$rc_monthly` → `youtrader_pro_monthly` | Present |
| `$rc_annual` → `youtrader_pro_yearly__` | Present |
| Empty `$rc_lifetime` on `default` | **Removed** |
| Public SDK audit `package_count` | **3 PASS** |

### Mismatch explanation (2 vs 4)

Dashboard counted 4 package **rows** (including empty Weekly + empty Lifetime). Public offerings API only returned packages with attached store products (Monthly + Annual = 2). Weekly product had to be **created** in RC catalog then attached.

## ASC / trial contract

| Plan | StoreKit (local) | App Store Connect (via RC) |
|------|------------------|----------------------------|
| Weekly | $4.99 / no trial | Created, equalized, **submitted**; no trial |
| Monthly | $12.99 / **P3D** trial | Approved; intro remains **ONE_WEEK** (API cannot replace) |
| Annual | $99.99 / **P1W** trial | Approved; intro set to **ONE_WEEK** |

## Remaining

1. Wait for Apple to process Weekly submission for sandbox.  
2. ASC UI required to change Monthly intro ONE_WEEK → THREE_DAYS (API refused).  
3. Live StoreKit → CustomerInfo matrix still NOT RUN until UI automation / unlocked device.

## Verification

```bash
node --import tsx scripts/qa/revenuecat-offering-audit-staging.ts
```

Expect `package_count: 3` and all three `*_in_offering: true`.
