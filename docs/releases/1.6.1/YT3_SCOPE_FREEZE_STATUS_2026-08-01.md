# YT3 Scope-Freeze Status — 2026-08-01 (updated)

Phase 4F status: **FAILED / OPEN / NO-GO**

## Freeze compliance

- No App Store screenshots deleted/replaced/uploaded
- No build uploaded to ASC/TestFlight
- No Add for Review / Submit for Review
- Build 115 not created
- No public listing AI metadata cleanup executed
- Production Supabase untouched
- Deferred backlog: `docs/releases/1.6.1/BACKLOG_ASC_METADATA_CLEANUP.md`

---

## 1. Weekly configuration — PASS (ASC + RC)

| Check | Result |
|-------|--------|
| Product ID | `youtrader_pro_weekly` |
| USD | $4.99 / week |
| ASC intro | **none** (empty “Set up Introductory Offer”) |
| RC `trial_offer` | `null` |
| ASC status | Waiting for Review (not submitted this phase) |
| Evidence | `evidence/phase4f-scopefreeze-20260801T213922Z/asc_weekly_no_trial.png` |

## 2. Monthly 3-day trial — ASC PASS / runtime PENDING

| Step | Result |
|------|--------|
| Deleted prior 1-week intro | DONE |
| Created Free · **3 Days** · No End Date | DONE |
| ASC readback | **Free for the first 3 days** · Aug 2, 2026 → No End Date · 175 countries |
| Evidence | `asc_monthly_3day_saved.png`, `asc_monthly_confirm_3day.png` |
| RC catalog `trial_duration` | still `P1W` (stale until store sync) |
| RC store-state `trial_offer` | still `ONE_WEEK` start `2026-07-30` (stale / current-window lag) |
| Effective window | **Upcoming Aug 2** — no active Monthly intro on Aug 1 (gap after delete) |
| Physical CTA eligibility today | **Cannot prove real 3-day** until Aug 2 + StoreKit/RC refresh |

## 3. Yearly 7-day trial — PASS

| Check | Result |
|-------|--------|
| Product ID | `youtrader_pro_yearly__` |
| ASC | **Free for the first week** · Aug 1, 2026 → No End Date (Current) |
| RC store-state | `ONE_WEEK` start `2026-08-01` |
| Physical CTA | `Start 7 Days Free` + `7 days free, then $99.99/year…` |
| Evidence | `asc_yearly_7day_verify.png`, paywall screenshots |

## 4. RevenueCat inventory — PASS

| Item | Result |
|------|--------|
| App | YouTrader App Store `appfa18518d16` |
| Entitlement | YouTrader Pro `entl5e95747df4` — Weekly + Monthly + Yearly attached |
| Offering `default` `ofrngbb124c8022` `is_current: true` | **3 packages** |
| Packages | `$rc_weekly` → weekly · `$rc_monthly` → monthly · `$rc_annual` → yearly__ |
| Duplicates created | None |
| API keys changed | No |

## 5–7. Physical paywall

### Before sticky fix (`6d6bba2`)

Sticky overlapped Monthly; Yearly off-screen; empty radios while Yearly CTA active.

### After sticky fix (`ea084ca` / `YT_BUILD_FP_v1:ea084ca:113:Release-Staging`)

| Plan | Visible | Price | Trial UI | CTA match | Notes |
|------|---------|-------|----------|-----------|-------|
| Weekly | prior shot YES $4.99 | $4.99/week | none | selection tap blocked (Maestro needs Apple Team ID) | off-screen after auto-scroll to Yearly |
| Monthly | YES | $12.99/month | **3 Days Free** badge | — | StoreKit eligibility shows 3-day; ASC start Aug 2 Upcoming |
| Yearly | YES selected ✓ | $99.99/year | **7 Days Free** + BEST VALUE + SAVE 61% + Only $1.92/week | sticky CTA `Start 7 Days Free` + renewal copy | sticky no longer covers Yearly |

Evidence after fix: `20260801T220757Z_paywall_sticky_fix_113.png`

Commit: `ea084ca` — *YT3 Phase4F: keep paywall plans clear of sticky CTA*

## 8–14. Purchase / CustomerInfo / Auth / logIn

**NOT RUN** — blocked by: Monthly 3-day not live until Aug 2; physical tap automation limited; live chain not executed.

## 15–16. Navigation 5-tab / 4-tab

**NOT PASS** — not captured this turn.

## 17–20. Journal / Prop Pass / Stats / Settings-More

**NOT RUN**

## 21. Live-defect work

- Reproduced: sticky CTA covers Monthly / Yearly not visible / selected radio off-screen
- Minimal fix in `src/app/startup/AcquisitionPaywall.tsx`: ScrollView `flex:1`, dynamic `stickyReserve` + safe-area, scroll-to-end for default Yearly
- Rebuild RS 113 in progress for physical retest
- Commit pending after rebuild verification + typecheck

## 22. Remaining blockers

1. Wait until **2026-08-02** (or Apple advances start) for Monthly 3-day to become Current; re-read RC store-state → expect THREE_DAYS / P3D
2. Physical live StoreKit purchases W/M/Y + CustomerInfo
3. Email → Apple → Google + Purchases.logIn + entitlement isolation
4. Eligible 5-tab + deny 4-tab screenshots
5. Product matrix on main screens
6. Physical retest of sticky CTA fix after RS rebuild install

## 23–24. Confirmations

- Screenshots: **untouched**
- Upload/submit: **none**
- Build 115: **not created**
