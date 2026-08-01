# YouTrader 3.0 — Autonomous live E2E continuation (2026-08-01)

**Baseline tag (unchanged):** `yt3-phase4f-live-e2e-baseline-113` @ `2512c9a`  
**App identity:** 1.6.1 (113) — build 114 **not** prepared  
**Phase 4F:** **FAILED / OPEN / NO-GO**

---

## 1. Live RevenueCat dashboard / API package inventory

Project `proj240764f3` · App Store app `appfa18518d16` · bundle `com.youtrader.pro`

**Offering `default` (`ofrngbb124c8022`, current) — AFTER fixes:**

| Package | lookup_key | Product | Entitlement |
|---------|------------|---------|-------------|
| Weekly | `$rc_weekly` | `youtrader_pro_weekly` (`proddfff152547`) | YouTrader Pro |
| Monthly | `$rc_monthly` | `youtrader_pro_monthly` | YouTrader Pro |
| Annual | `$rc_annual` | `youtrader_pro_yearly__` | YouTrader Pro |

Empty **Lifetime** package `$rc_lifetime` removed from `default` after verifying no attached products.

Public SDK key for App Store app matches staging `appl_WMc…` (same project).

---

## 2. Why prior audit said `package_count=2` while dashboard showed 4

Not a wrong project/key.

| Layer | What it showed | Why |
|-------|----------------|-----|
| Dashboard | **4** package rows on `default` | Weekly + Monthly + Annual + **empty Lifetime** |
| Public offerings API (`appl_` SDK) | **2** packages | Only packages with an attached, SDK-resolvable store product are returned. Weekly package existed but had **zero products**. Lifetime empty. |
| Catalog | Weekly SKU **missing** | `youtrader_pro_weekly` was not registered in RC until this session |

So dashboard ≠ SDK package_count until products are attached.

---

## 3. Final `default` offering package set

**3 packages** (Weekly / Monthly / Annual) — confirmed via Management API `get-offering` and public SDK audit:

```text
[YTQA:rc] PASS three-plan offering
package_count: 3
weekly_in_offering / monthly_in_offering / yearly_in_offering: true
```

---

## 4–6. Runtime offering resolution (SDK audit)

| Plan | Runtime (public offerings API) |
|------|--------------------------------|
| Weekly | **LIVE PASS** — `$rc_weekly` → `youtrader_pro_weekly` |
| Monthly | **LIVE PASS** — `$rc_monthly` → `youtrader_pro_monthly` |
| Annual | **LIVE PASS** — `$rc_annual` → `youtrader_pro_yearly__` |

In-app StoreKit purchase → CustomerInfo chain: **NOT RUN** (UI automation blocked: Maestro needs Java; physical device locked).

---

## 7. PI shared-secret configuration

| Step | Result |
|------|--------|
| Generate 32-byte secret | Done (value never printed) |
| Local QA store | `~/.youtrader-qa-secrets/staging-processor.env` (0600) |
| Staging Edge secret | `supabase secrets set` on `zleojeqkzizeyerhjpur` only |
| Unauth POST | **LIVE PASS** — 403 |
| Trusted `op=ping` | **LIVE PASS** — 200 `pong` |

---

## 8. Staging PI live matrix

| Case | Result |
|------|--------|
| Normal / current / complete | **LIVE PASS** (`pi-semantic-complete-staging`) |
| Idempotent repeat | **LIVE PASS** |
| Fail path (`--fail-only`) | **LIVE PASS** |
| Stale worker (`--stale-only`) | **LIVE PASS** — `conflict` / `stale_assignment_revision` |
| Contracts reaper + piContract | **CONTRACT PASS** |
| Timeout/reaper unit | **CONTRACT PASS** |
| Logout cancel / user-switch UI | **NOT RUN** (device UI) |

---

## 9. JS bundle red-screen — root cause and fix

**Root cause (reproduced):** Debug-Staging binary installed on simulator **without** `main.jsbundle`, while `RCTBundleURLProvider` returned **null** script URL despite Metro later listening on 8081 → redbox *“No script URL provided… unsanitizedScriptURLString = (null)”*.

**Correct path for Release-Staging 113:**

1. Built `Release-Staging` for `iphonesimulator` with embedded `main.jsbundle` (~11.3MB).  
2. Installed on iPhone 16 / 16e / Pro Max.  
3. Metro **not** required; staging host present in bundle.  
4. Evidence: onboarding Screen 1 rendered (`evidence-sim-iphone16-release-staging-113.png`).

AppDelegate `e009c5a` Release-embedded behavior preserved. No AppDelegate change required.

**Physical:** unintended **build 114** was installed; replaced with archive **1.6.1 (113)** Release-Staging + embedded bundle. Launch blocked: device **Locked** (passcode/Face ID) — owner unlock required.

---

## 10. CoreSimulator recovery

Previous sandbox runs produced false ENVIRONMENT BLOCKER. On unrestricted host:

- iPhone 16, 16e, Pro Max **Booted**
- Recovery harness + `simctl` **LIVE PASS** (with `all` permissions)

---

## 11. CoreDevice recovery

- iPhone 14 Pro Max (`6FCFF771-…`, UI name “iPhone 4S”) **available (paired)**
- Install 113 **LIVE PASS**
- Launch **ENVIRONMENT BLOCKER / owner unlock** — device locked

---

## 12–14. CustomerInfo (Weekly / Monthly / Annual)

**NOT RUN** — no completed StoreKit → RevenueCat → CustomerInfo live chain yet.

ASC notes:

| Product | ASC trial / status |
|---------|-------------------|
| Weekly | Created + equalized + **submitted** (`READY_TO_SUBMIT` → submitted). `trial_offer: null` (correct). Sandbox availability may lag until Apple processes. |
| Monthly | ASC intro remains **ONE_WEEK** — API refused replace with THREE_DAYS on approved product. **StoreKit local = P3D** (contract for sim). |
| Annual | ASC intro set to **ONE_WEEK** with `start_date=2026-08-01` — **LIVE PASS** (API). |

---

## 15–18. Auth / isolation

| Gate | Status |
|------|--------|
| Email | **NOT RUN** |
| Apple | **NOT RUN** (needs unlocked physical) |
| Google | **NOT RUN** |
| Identity isolation | **NOT RUN** |

Maestro CLI present but **Java Runtime missing** → UI automation cannot execute.

---

## 19. Simulator matrix

| Item | Status |
|------|--------|
| Release-Staging 113 install (16 / 16e / Pro Max) | **LIVE PASS** |
| Red screen cleared (Release-Staging) | **LIVE PASS** |
| Onboarding Screen 1 evidence | **LIVE PASS** (screenshot) |
| Full funnel / paywall / purchases / tabs | **NOT RUN** (no Maestro/Java) |

---

## 20. Physical build 113 matrix

| Item | Status |
|------|--------|
| Removed 114 / installed 113 | **LIVE PASS** |
| Version/build verify | **LIVE PASS** — 1.6.1 / 113 |
| Embedded bundle in archive | **LIVE PASS** |
| Launch + UI matrix | **NOT RUN** — device locked |

---

## 21. Commits for real live defects

Orchestrator updated to continue independent gates (requested). Commit created only for that tooling fix if staged in this session; baseline tag **not** moved.

ASC / RC catalog writes were performed via authenticated RevenueCat API (not git).

---

## 22. Final Phase 4F status

**FAILED / OPEN / NO-GO**

Unblocked vs prior session: RC three-plan SDK offering, PI secret + trusted PI paths, CoreSimulator, CoreDevice install 113, Release-Staging sim boot without redbox.

Still required for PASS: live purchase CustomerInfo for all three plans, auth E2E, isolation, Maestro/Java or equivalent UI automation, physical unlock + matrix, ASC Weekly approval propagation, Monthly ASC 3-day trial (Apple API cannot replace existing ONE_WEEK intro).

---

## Owner interaction (only unavoidable)

**Physical iPhone unlock** (passcode / Face ID) so `devicectl` can launch `com.youtrader.pro` after 113 install.

Optional ASC: change Monthly intro from 1 week → 3 days in App Store Connect UI (API rejected replacement on approved subscription).

---

## Resume after unlock (2026-08-01 ~19:56–20:01 UTC) — required 20-field status

Evidence roots:

- `docs/releases/1.6.1/evidence/phase4f-unlock-poll-20260801-154912/`
- `docs/releases/1.6.1/evidence/phase4f-physical-resume-20260801-155834/`
- `docs/releases/1.6.1/evidence/phase4f-status-20260801-160103/`
- `docs/releases/1.6.1/evidence/phase4f-rc-inventory-20260801-1553/`
- `docs/releases/1.6.1/evidence/phase4f-sim-maestro-20260801-155127/`

| # | Gate | Result |
|---|------|--------|
| 1 | Physical unlock detection | **LIVE PASS** — CoreDevice poll attempt 28 @ 19:56:25Z `STATUS=UNLOCKED`; Preferences launch succeeded; subsequent YouTrader launch succeeded |
| 2 | Build 113 verification | **LIVE PASS** — installed `YouTrader` `1.6.1` / `113`; harness `physical_verify_ok`; Metro OFF; embedded `main.jsbundle` on local RS candidate; staging host in jsbundle |
| 3 | Live RevenueCat offering inventory | **CONTRACT PASS** (Management API) — offering `default` / `ofrngbb124c8022`, **3 packages**: `$rc_weekly`→`youtrader_pro_weekly`, `$rc_monthly`→`youtrader_pro_monthly`, `$rc_annual`→`youtrader_pro_yearly__`; entitlement `YouTrader Pro` has all three. ASC: Weekly **READY_TO_SUBMIT / needs_action** (US $4.99, no trial); Monthly **APPROVED** (US $12.99, trial ONE_WEEK); Annual **APPROVED** (US $99.99, trial ONE_WEEK from 2026-08-01). Lifetime not on `default`. |
| 4 | Weekly purchase → CustomerInfo | **NOT RUN** — physical UI black + Airplane Mode; sim paywall shows plans unavailable without attached StoreKit session; Weekly ASC not Approved |
| 5 | Monthly purchase/trial → CustomerInfo | **NOT RUN** (same blockers). ASC trial remains ONE_WEEK (not P3D) |
| 6 | Annual purchase/trial → CustomerInfo | **NOT RUN** (same blockers) |
| 7 | Email authentication | **NOT RUN** |
| 8 | Apple authentication | **NOT RUN** |
| 9 | Google authentication | **NOT RUN** |
| 10 | RevenueCat identity linking | **NOT RUN** |
| 11 | User isolation | **NOT RUN** |
| 12 | Physical navigation | **NOT RUN** — YouTrader foreground screenshots are solid black (Safari/SpringBoard screenshots OK) |
| 13 | Journal lifecycle | **NOT RUN** |
| 14 | Stats / Radar / Heatmap | **NOT RUN** |
| 15 | Prop Pass | **NOT RUN** |
| 16 | News | **NOT RUN** |
| 17 | Settings | **NOT RUN** |
| 18 | PI (physical UI) | **NOT RUN** — staging PI trusted path previously LIVE PASS separately |
| 19 | Reproduced-defect commits | **None this resume** — no product code change; reinstall of 113 deferred (binary identity still verifies 113; black UI under investigation / env) |
| 20 | Final Phase 4F status | **FAILED / OPEN / NO-GO** |

### Active blockers (physical)

1. **ENVIRONMENT BLOCKER — Airplane Mode ON** (status bar airplane + Wi‑Fi on SpringBoard and YouTrader screenshots). Cannot toggle Airplane Mode via CoreDevice/DVT without owner Control Center / Settings. Wi‑Fi appears connected but cellular is off.
2. **LIVE FAIL / evidence gap — YouTrader UI black in DVT screenshots** after unlock + relaunch (process PID present; Safari/SpringBoard capture non-black). Blocks clean physical gate evidence and Maestro-less UI matrix.
3. **EXTERNAL ACCESS BLOCKER — Weekly ASC `READY_TO_SUBMIT`** — physical StoreKit Weekly may not resolve until Apple clears Weekly for sale.
4. **Sim StoreKit attach** — Maestro RS funnel reaches paywall but shows **“Plans are temporarily unavailable”** when app is installed via `simctl` without Xcode LaunchAction StoreKitConfiguration. Local `YTStoreKitQA` StoreKit tests: **4/4 PASS**.

### Parallel progress while blocked

- Unlock poll autonomous resume: **PASS**
- Release-Staging sim build (YouTrader-Staging scheme) **113 + embedded**: **PASS**
- Maestro onboarding path to paywall: **PARTIAL** (onboarding copy OK; paywall offerings fail without StoreKit attach)
- RC/ASC inventory refreshed via MCP: **PASS** (3 packages; Weekly needs ASC action)

### Owner system action still required (not in-app navigation)

1. Disable **Airplane Mode** on the paired iPhone (Control Center). Keep device unlocked.
2. Later, only for StoreKit/Apple ID sheets: Face ID / passcode / Apple ID / 2FA as prompted.

Agent continues polling unlock/Airplane-clear signals and will resume the subscription matrix without asking for in-app navigation. Build **114** not prepared. Production Supabase untouched.

### Poll false-positive note (2026-08-01 20:04Z)

`phase4f-airplane-poll` reported `STATUS=UI_VISIBLE` (yt_mean=5.55) but the captured frame was **iOS Settings → Display & Brightness**, not YouTrader. Airplane Mode is now **OFF** (cellular bars visible). Clean YouTrader relaunch still yields **solid-black DVT screenshots** with process alive (PID present) through 15s — physical UI matrix remains blocked. Auto-Lock observed as **Never**.

