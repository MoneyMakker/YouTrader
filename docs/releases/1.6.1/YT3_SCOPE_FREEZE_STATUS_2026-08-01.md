# YT3 Scope-Freeze Status — 2026-08-01 (updated)

Phase 4F status: **OPEN / NO-GO** (implementation advanced; physical build 115 + Restore Behavior confirmation still required)

## Freeze compliance

- No App Store screenshots deleted/replaced/uploaded
- No build uploaded to ASC/TestFlight
- No Add for Review / Submit for Review
- Build 115 not created yet (CURRENT_PROJECT_VERSION remains **113** until gates pass)
- Build 113 / 114 not modified as release artifacts
- No public listing AI metadata cleanup executed
- Production Supabase schema untouched (delete-account function added in repo; **not deployed** this run)
- Deferred backlog: `docs/releases/1.6.1/BACKLOG_ASC_METADATA_CLEANUP.md`

---

## Integration checkpoint (this run)

| Item | Value |
|------|-------|
| Starting worktree | `/Users/valentynborovyk/Projects/youtrader-final` |
| Starting branch / commit | `fix/yt3-autonomous-recovery` @ `ea084ca` (preserved) |
| Checkpoint branch | `checkpoint/yt3-phase4f-wip-20260801-ea084ca` @ `96fc790` |
| Release branch | `release/1.6.1-build-115` |
| Security Issue #8 | Cherry-picked as `c90838c` (content of `252a7ae`; high/critical audit = 0) |
| Billing commit | `253ab41` fix(billing): complete purchase-to-auth entitlement lifecycle |
| Account commit | `e91268e` fix(account): add secure account deletion lifecycle |

Dirty WIP preserved via checkpoint + `artifacts/checkpoints/20260801-yt3-115/` (local).

---

## Identifiers (unchanged)

| Item | Value |
|------|-------|
| Entitlement | `YouTrader Pro` (`EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` / `REVENUECAT_ENTITLEMENT_ID`) |
| Offering | `default` (`ofrngbb124c8022`) |
| Weekly | `$rc_weekly` → `youtrader_pro_weekly` |
| Monthly | `$rc_monthly` → `youtrader_pro_monthly` |
| Yearly | `$rc_annual` → `youtrader_pro_yearly__` |
| react-native-purchases | lock `9.15.2` |
| SDK key source | `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` (`appl_` present) |
| App scheme | `youtrader` |

## RevenueCat Restore Behavior

**BLOCKED — dashboard confirmation required**

MCP App Store app metadata does not expose Project Settings → Restore Behavior.
Required for purchase-before-login when an identified App User ID already exists:

1. Open RevenueCat → Project **YouTrader** → **Project settings → General**
2. Confirm Restore Behavior is **Transfer to new App User ID** (not Block Restore)
3. Reply with the exact selected value

Until confirmed, final GO for build 115 is withheld.

Note: anonymous → `Purchases.logIn(uuid)` aliases anonymous customers per RC docs; the app also runs **one** post-login `restorePurchases` fallback when pre-auth entitlement is lost after login.

---

## Implemented this run (code)

### Purchase → auth → identity → tabs

1. `RevenueCatIdentitySynchronizer` ported to `src/billing/` and wired in `YouTraderApp`
2. `Purchases.logIn` only via synchronizer with Supabase UUID (rejects email)
3. Waits for `revenueCatReady` before identity sync (fixes configure race)
4. In-memory `preAuthEntitledRef` + `decidePostLoginEntitlementReconcile` → one restore fallback
5. Anonymous restore (Path A) → entitlement → mandatory auth (no premature “Pro unlocked” alert)
6. Authenticated restore (Path B) → identity sync first → restore
7. Acquisition routing: authenticated without entitlement → **main** (4 tabs); Prop Pass only when `isPremium`
8. Trial copy gated by `checkTrialOrIntroductoryPriceEligibility` (unknown → no trial claim; weekly never)

### Account deletion

- Settings → Delete Account confirmation
- `supabase/functions/delete-account` (service-role server delete)
- Apple Subscriptions deep link
- **Deploy of Edge Function still required** before live deletion works

---

## Static verification

| Check | Result |
|-------|--------|
| `tsc --noEmit` | PASS |
| `security:audit` (high+) | PASS (0 high/critical; 3 moderate Storybook valibot only) |
| `security:check` | PASS |
| `translations:check` | PASS |
| `test:email-password` | PASS |
| `test:revenuecat-mobile-identity` | PASS (13 scenarios) |
| acquisition / reconcile / paywallPlanCopy / routing selftests | PASS |
| `test:revenuecat-entitlement` | FAIL env (`Deno is not defined` in shared helper under Node) — pre-existing runner limitation on this tree |
| Expo Doctor | pre-existing app.json / CNG / expo patch findings only (not re-run as blocking) |

---

## Physical QA / Build 115

| Item | Status |
|------|--------|
| Build number bump to 115 | **NOT DONE** (gates incomplete) |
| Physical install of 115 | **NOT DONE** |
| Weekly / Monthly / Yearly live purchase matrix | **NOT DONE** |
| Email / Apple / Google post-purchase auth | **NOT DONE** |
| Cold launch without Metro on device | **NOT DONE** |

---

## Remaining blockers (ordered)

1. **Confirm RevenueCat Restore Behavior** in dashboard (exact value).
2. Deploy `delete-account` Edge Function to the production Supabase project (human/CI deploy).
3. After (1): set version/build to **1.6.1 (115)**, build Release (production scheme, not Release-Staging), install on physical iPhone.
4. Run purchase matrix A/B/C with fresh sandbox testers + auth providers + navigation screenshots.
5. Monthly 3-day ASC window starts **2026-08-02** — re-verify Apple payment sheet says 3 days (not 1 week).

---

## Confirmations

- Public version target remains **1.6.1**
- Final local build number **115** not created yet
- Build **113** not modified as the release artifact
- Build **114** not reused
- Build **116** not created
- No TestFlight / ASC upload
- No App Store screenshots / listing changes
- Nothing added for review / submitted / published

**Decision: NO-GO for build 115 until Restore Behavior is confirmed and physical purchase→auth→logIn matrix passes.**
