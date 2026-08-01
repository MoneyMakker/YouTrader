# YT3 Recovery Session 4 — Executed Results

Build: **113** only. Phase 4F: **FAILED / OPEN / NO-GO**. Production Supabase untouched.

Evidence root: `docs/releases/1.6.1/phase4f-screenshots/`, `docs/releases/1.6.1/qa-artifacts/`.

---

## 1. StoreKit scheme injection

**PASS (wiring)**

- `YouTrader-Staging.xcscheme` → `identifier = "../YouTraderStaging.storekit"` (Debug-Staging Run action)
- Production `YouTrader.xcscheme` → **no** StoreKit reference
- Product IDs match app/RC: `youtrader_pro_monthly` ($12.99 P1M), `youtrader_pro_yearly__` ($99.99 P1Y)
- Entitlement env quoted: `"YouTrader Pro"`
- Launch helper: `scripts/qa/launch-storekit-staging-sim.sh` (Xcode ⌘R required; `simctl launch` does **not** inject StoreKit)

## 2. Monthly local transaction

**FAIL / BLOCKED (runtime)**

- XCTest `SKTestSession.buyProduct(youtrader_pro_monthly)` → historically `SKInternalErrorDomain Code=3` on **iOS 26.5**
- Only installed runtime: iOS 26.5; iOS 26.2 **not downloadable**
- Tests now **XCTSkip** on iOS 26.3+ (no false PASS)
- Maestro paywall purchase without live StoreKit session → Apple Account sheet path still required
- **StoreKit local transaction: NOT PASS**

## 3. Annual local transaction

**FAIL / BLOCKED** — same iOS 26.5 StoreKit Testing regression as monthly.

## 4. RevenueCat entitlement mapping

**PASS (API + deterministic)**

| Field | Value |
|---|---|
| Offering | `default` |
| Entitlement | `YouTrader Pro` |
| Monthly package | `$rc_monthly` → `youtrader_pro_monthly` |
| Annual package | `$rc_annual` → `youtrader_pro_yearly__` |

- `scripts/entitlement-resolution-qa.ts` → PASS
- `scripts/qa/revenuecat-offering-audit-staging.ts` → PASS (quote-safe file load)
- **RevenueCat SDK customer-info after purchase:** NOT RUN (blocked by StoreKit)
- **Physical App Store Sandbox:** NOT YET RUN

## 5. PI semantic success

**PASS (backend + UI)**

- Seeded ≥5 assigned trades (`seed-prop-pass-staging.ts --pi-semantic`)
- Trusted complete via `prop-os-pi-processor` → engine `status: current`, snapshot `a79cc12b…`, projection `current`
- UI: **Snapshot current**, Closed trades **14**, Win rate **71.4%**, Profit factor **5.04x**
- Evidence: `phase4f-screenshots/pi_semantic_snapshot_current.png`
- Scripts: `scripts/qa/pi-semantic-complete-staging.ts`

## 6. PI failure / timeout / race matrix

| Item | Status |
|---|---|
| transport | PASS (prior + request RPC OK this session) |
| persistence | PASS (current projection present) |
| semantic success | PASS |
| failure | PASS (`--fail-only` → processor `fail` 200) |
| timeout | NOT RUN — no server TTL/reaper policy |
| retry | PARTIAL — UI Retry after fail not Maestro-proven |
| race protection | PASS (stale → `conflict/stale_assignment_revision`; idempotent complete OK) |
| user isolation | PASS prior (deny no Prop Pass); this session not re-run |

## 7. Journal CRUD

**PARTIAL**

- Populated journal/calendar home PASS (`journal_s4_home.png`: Jul 2026, trade days, month P&L)
- Create/edit/delete: FAIL — Add CTA not found when journal already populated; legacy `.maestro/trades/*` asserts removed `AI Analytics` tab
- Empty state / validation / offline / stale-write: NOT RUN

## 8. Stats populated interactions

**PARTIAL** — tab open + scroll screenshots PASS; period filters / mutation refresh / stale-user: NOT RUN

## 9. Calculator validation

**PARTIAL** — screen opens PASS; valid/invalid/reset/NaN: NOT RUN

## 10. News offline/error

**PARTIAL** — tab smoke PASS prior/this session; offline/unavailable/Retry: NOT RUN

## 11. Calendar interactions

**PARTIAL** — month view + populated trade days PASS (via Journal calendar); month nav / timezone / relaunch: NOT RUN

## 12. Settings / logout / restore

**PARTIAL** — Settings screen open PASS; logout blocked by stale Maestro shared launch (`AI Analytics`); restore: NOT RUN

## 13. Apple CLI credential-source diagnosis

**EXECUTED — Apple E2E remains BLOCKED**

- `SUPABASE_ACCESS_TOKEN` env: absent
- Credential source: macOS Keychain service **`Supabase CLI`**
- Management API works with `User-Agent: supabase/2.108.0` + Keychain token
- Staging Apple: `external_apple_enabled=true`, `client_id=com.youtrader.pro`, **`external_apple_secret` EMPTY (SET_LEN=0)**
- No local `AuthKey_*.p8`
- Missing external resource: **Apple Sign In private key (.p8) / Team ID / Key ID material to set staging secret**
- CTA kept visible
- Note: Cursor `user-supabase` MCP points at **production** (`izzrlsgumyabdvlmwlwn`) — do not use for staging writes

## 14. Google E2E result

**PARTIAL**

- CTA → system sheet: **“YouTrader Wants to Use accounts.google.com to Sign In”** (`google_s4_oauth_ui.png`)
- Full OAuth → Supabase session → relaunch/logout/switch: **NOT COMPLETED**
- Not yet classified as hard external blocker (consent/2FA not exhausted)

## 15. Physical harness result

**PASS (harness only)**

- Device `6FCFF771-…` connected, Developer Mode on, iOS 26.6
- App 1.6.1 (113) installed
- `physical-device-harness.sh cycle` → launch + process listed → `physical_cycle_ok`
- Full Phase 4F physical matrix: **NOT RUN** (sim StoreKit/core gates not green)

## 16. Remaining objective blockers

1. **iOS 26.5 StoreKit Testing broken** (Code=3); no 26.2 runtime → blocks monthly/annual local purchase proof + RC customer-info after purchase
2. **Apple Sign-In secret empty** + no `.p8` → Apple session E2E BLOCKED
3. **Google OAuth** started but interactive completion unfinished
4. **Journal Add CTA** undiscoverable in populated state / stale Maestro shared flows
5. **PI timeout** needs product/server policy (no lease/TTL)
6. **Aikido MCP unavailable** — CI still has `security:check|gitleaks|semgrep|audit` (not Aikido PASS)
7. Phase 4F physical matrix gated on above

Phase 4F remains **NO-GO**.
