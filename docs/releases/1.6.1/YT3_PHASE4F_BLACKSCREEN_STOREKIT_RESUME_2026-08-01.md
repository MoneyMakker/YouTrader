# YT3 Phase 4F — Black-screen disambiguation + StoreKit/RC resume (2026-08-01)

**Phase 4F:** **FAILED / OPEN / NO-GO**  
**Build:** 1.6.1 (113) · Release-Staging · Metro OFF · no 114 · production Supabase untouched  
**Tooling commit prior:** `8c212f0`

---

## 1. Black UI vs black screenshot

| Hypothesis | Result |
|------------|--------|
| A. UI rendered, capture black | **REJECTED as primary** — same DVT backend captures full YouTrader UI after paint |
| B. App always renders black | **REJECTED** — valid Journal UI captured |
| C. Primary scene inactive | **PARTIAL** — cold `devicectl launch` can sit on near-black frames for ≥8s |
| D. Capture-protection overlay | **REJECTED** — no `isCaptured` / ScreenShield / capture libs in repo; only `secureTextEntry` on password fields |
| E. Screenshot before first stable frame | **CONFIRMED contributor** — cold launch 1/3/5/8s all mean≈0.43; after `youtrader://qa/reset-fresh` mean≈9–10 with nonblack≈35% |

**Verdict:** Not a DVT-only defect. YouTrader **does** render. Cold launch without a QA reset can produce invalid near-black evidence; prove path must wait for non-black paint (now implemented).

Valid physical evidence:

- `docs/releases/1.6.1/evidence/phase4f-capture-backends-20260801-161708/A-pmd-after-reset.png` — Journal empty state, Synced, tabs visible
- `physical-device-tool.sh prove` → **PASS** (`mean_luma=9.377`) after reset-fresh wait loop

---

## 2. Capture-protection audit

Searched app + native sources: **no intentional screenshot blockers**.  
No staging bypass added (not required). Production security unchanged.

---

## 3. Capture backends

| Backend | SpringBoard | YouTrader | Notes |
|---------|-------------|-----------|-------|
| pymobiledevice3 10.3.0 `developer dvt screenshot` | PASS (mean≈40) | PASS after paint; FAIL near-black on cold | Supported path |
| `idevicescreenshot` | FAIL | FAIL | `screenshotr` Invalid service on iOS 26.6 |
| `xcrun devicectl … screenshot` | N/A | N/A | **No screenshot subcommand** on this toolchain |
| XCTest device screenshot | NOT RUN | NOT RUN | No YouTrader UITest target wired yet |

---

## 4. Release-Staging installed binary

Archive `.app` checks:

- `main.jsbundle` present (~11MB)
- staging host marker present
- production host absent
- installed identity **1.6.1 (113)**

Cold-launch black frames remain a **runtime paint/startup concern** for automation timing, not an embedded-bundle miss.

---

## 5–6. Simulator StoreKit

Root cause (confirmed): `simctl install` + `simctl launch` never attaches scheme `StoreKitConfigurationFileReference`.

`ios/YouTraderStaging.storekit` contract:

| Product | Period | Intro | Price |
|---------|--------|-------|-------|
| `youtrader_pro_weekly` | P1W | none | 4.99 |
| `youtrader_pro_monthly` | P1M | P3D | 12.99 |
| `youtrader_pro_yearly__` | P1Y | P1W | 99.99 |

Attached on `YouTrader-Staging` + `YTStoreKitQA` schemes.

New helper: `scripts/qa/launch-simulator-with-storekit.sh` (Release-Staging + Xcode Run for StoreKit attach).

**YTStoreKitQA local StoreKit tests:** **4/4 PASS** (monthly/annual purchase, failure, expiration/renewal).  
Label: **STOREKIT LOCAL E2E PASS** (YTStoreKitQA scope) — does **not** replace physical Sandbox + CustomerInfo.

Maestro RS paywall without StoreKit attach remains PARTIAL (“Plans temporarily unavailable”).

---

## 7. Weekly ASC audit

RevenueCat → App Store product `proddfff152547` / `youtrader_pro_weekly`:

- duration ONE_WEEK · US $4.99 · trial_offer null · localization en-US present
- privacy URL present · review screenshot attached
- `store_status.raw_store_status` = **READY_TO_SUBMIT**
- `store_status.status` = **needs_action**

Not auto-classified as permanent blocker until physical Sandbox product lookup is executed on paywall. Actionable ASC clearance still outstanding for Weekly.

---

## 8. RevenueCat three-package reconciliation

Live Management API offering `default` (`ofrngbb124c8022`, current):

| Package | lookup_key | Product | Entitlement |
|---------|------------|---------|-------------|
| Weekly | `$rc_weekly` | `youtrader_pro_weekly` | YouTrader Pro |
| Monthly | `$rc_monthly` | `youtrader_pro_monthly` | YouTrader Pro |
| Annual | `$rc_annual` | `youtrader_pro_yearly__` | YouTrader Pro |

**2 vs 4 vs 3 explanation (closed):**

| Layer | Count | Why |
|-------|-------|-----|
| Old dashboard | 4 | Weekly+Monthly+Annual+empty Lifetime row |
| Old public SDK | 2 | Weekly had no attached product; Lifetime empty → not returned |
| Current runtime | **3** | Weekly product attached; Lifetime removed from `default` |

Fourth package (`$rc_lifetime`) was empty / not customer-visible — removed from current offering intentionally after verification.

---

## 9–10. Live purchase / auth matrix

| Gate | Status |
|------|--------|
| Weekly/Monthly/Annual CustomerInfo | **NOT RUN** |
| Email / Apple / Google auth E2E | **NOT RUN** |
| Physical navigation / Journal / Prop Pass / … | **NOT RUN** (screenshot gate unblocked; functional matrix next) |

---

## 11. Commits (this session)

Pending commit for:

- `physical-device-tool.sh` prove wait-for-paint + reset-fresh
- `launch-simulator-with-storekit.sh`
- this report

---

## 12. Remaining blockers

1. Physical paywall + Sandbox purchases + CustomerInfo chain not yet executed  
2. Weekly ASC still `READY_TO_SUBMIT` / `needs_action`  
3. Simulator Maestro paywall needs StoreKit session via new harness (Xcode Run)  
4. Cold-launch near-black until QA reset — automation must use prove wait loop  
5. Auth E2E + isolation outstanding  

**Final Phase 4F status: FAILED / OPEN / NO-GO**
