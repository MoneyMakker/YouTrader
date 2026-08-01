# YT3 Recovery Continuation — Session 9 (2026-07-31)

Build: **113** (`1.6.1`) — build 114 not prepared.  
Phase 4F: **FAILED / OPEN / NO-GO**  
Production Supabase: **untouched**

---

## 1. `qa/reset-auth` root cause

**Root cause (confirmed):** acquisition resolver returns **onboarding** when `onboardingCompleted=false`.  
Previous `stagingQaResetAcquisitionUi()` wiped both flags to `false` → phase=onboarding, not Auth. Maestro looked for Google CTA → **QA HARNESS FAIL — AUTH CTA PRECONDITION NOT REACHED** (not a Google product failure).

**Secondary race (this session):** in-process reset while session still hot could leave **Main/Journal** until process terminate. Contract now requires:

1. wipe tokens **before** `signOut`
2. persist mode acquisition flags
3. **`stopApp` + cold relaunch** so Auth is deterministic

Evidence: `docs/releases/1.6.1/phase4f-screenshots/s9_manual_after_reset_cold.png`, `s9_auth_ready.png`  
Log: `docs/releases/1.6.1/qa-logs/lane_b_auth_ready_s9c.log`

---

## 2. Explicit reset-mode implementation

| Deep link | Expected phase |
|-----------|----------------|
| `youtrader://qa/reset-fresh` | onboarding |
| `youtrader://qa/reset-paywall` | paywall |
| `youtrader://qa/reset-auth` | **auth** |
| `youtrader://qa/reset-returning-allow` | main (chains email-login allow) |
| `youtrader://qa/reset-returning-deny` | main (chains email-login deny) |

Files: `src/qa/stagingQaResetModes.ts`, `src/qa/stagingQaReset.ts`, `YouTraderApp` deep-link handler (silent, no Alert).

Selftest: `scripts/qa/stagingQaResetModes.selftest.ts` → **PASS**

---

## 3. Auth readiness marker

- Pure evaluator: `src/auth/authScreenReadiness.ts`
- A11y IDs: `auth.screen`, `auth.loading`, `auth.configuration-banner`, `auth.apple`, `auth.google`, `auth.email`, `auth.ready`
- Maestro polls state (`extendedWaitUntil` on IDs), not fixed sleep

---

## 4. Auth CTAs after reset

| Check | Result |
|-------|--------|
| `qa/reset-auth` + cold relaunch | PASS |
| `auth.screen` | PASS |
| `auth.google` / `auth.email` / `auth.apple` | PASS |
| `auth.ready` | PASS |

Log: `lane_b_auth_ready_s9c.log`

---

## 5. Stale OAuth cleanup

- `src/auth/clearPendingOAuth.ts` + `pendingOAuthKeys.ts`
- Staging reset: dismiss ASWebAuth, clear PKCE verifier keys (AsyncStorage + SecureStore)
- Production `signOut`: same app-owned clear only
- Scenario matrix covered in pure selftest (sheet open / cancel / invalid / success / repeat)

---

## 6. Google callback / session

| Step | Status |
|------|--------|
| AUTH SCREEN PRECONDITION | **PASS** (bootstrap `scripts/qa/bootstrap-auth-ready-staging.sh`, sleep 8 before terminate) |
| OAUTH CTA TAP (`auth.google`) | **PASS** |
| ASWebAuth system sheet (`Wants to Use zleojeqkzizeyerhjpur.supabase.co`) | **PASS** |
| Tap Continue on system sheet | **PASS** |
| Google account chooser | **NOT REACHED** |
| Provider page after Continue | **Staging Supabase Error 400** `validation_failed` / `Unsupported provider: missing OAuth secret` |
| Callback / PKCE / session exchange | **NOT PROVEN** |
| Overall | **AUTH INTEGRATION PARTIAL** — Auth harness fixed; Google session blocked by **staging Google OAuth secret** (dashboard), not by Auth CTA precondition |

Screenshots: `s9_google_precondition.png`, `s9_google_after_tap.png`, `s9_google_aswebauth.png`, `s9_google_after_continue.png`  
Logs: `bootstrap_auth_ready_s9.log`, `lane_b_google_from_auth_s9.log`

Do **not** classify Google product auth as FAIL solely from the old Auth CTA miss — that harness bug is fixed. Session E2E remains open until staging provider secret is configured (production untouched).


---

## 7–9. Calculator

| Layer | Status | Evidence |
|-------|--------|----------|
| SCREEN OPEN | PASS | prior + this session |
| Valid max risk UI `$500.00` (50k × 1%) | PASS | equals unit |
| Valid result UI `$25.00` (20 × $1.25 × 1 MES) | PASS | equals unit |
| Zero stop / invalid `abc` / reset restore `$25.00` | PASS | Maestro matrix |
| UNIT BOUNDARIES | PASS | selftest |
| UI FUNCTIONAL MATRIX | **PARTIAL → core path PASS** (full matrix not every edge in UI; units cover edges) |
| PRODUCT FUNCTIONAL | **PASS** for valid path + reset + invalid input smoke (UI↔unit agree on `$500` / `$25`) |

Files: `src/calc/riskCalculator.ts`, CalcScreen wired + a11y IDs  
Logs: `calculator_matrix_s9e.log`, `reset_modes_selftest_s9_final.log`  
Screenshots: `s9_calc_valid_maxrisk.png`, `s9_calc_valid_result.png`, `s9_calc_zero_stop.png`, `s9_calc_invalid_amount.png`, `s9_calc_after_reset.png`

---

## 10. Remaining objective blockers

1. **Staging Google OAuth secret** missing (`Unsupported provider: missing OAuth secret`) — blocks account chooser / session; production Supabase must stay untouched.
2. **Distinct Google iOS client** still missing (browser OAuth fallback; QA banner visible).
3. Maestro-only reset without real sleep is flaky — use `bootstrap-auth-ready-staging.sh` (8s wipe window).
4. **News offline/Retry, Settings entitlement isolation, PI timeout deploy, RC CustomerInfo** — still open (Lane A parallel).
5. **Stats/Calendar exact deltas** — still PARTIAL historically.
6. **Aikido MCP** unavailable — `/aikido:setup` needed.
7. Phase 4F remains **NO-GO** until remaining gates close.

---

## QA gates (local)

- `npm run typecheck` — PASS  
- `npm run translations:check` — PASS  
- Reset/calc/auth selftest — PASS  
- `expo export --platform ios` — PASS (`expo_export_s9.log`, staging host)

---

## Status language (canonical)

**Calculator**
- SCREEN OPEN: PASS  
- UI FUNCTIONAL MATRIX: PARTIAL (core valid/invalid/reset PASS; not every boundary in UI)  
- UNIT BOUNDARIES: PASS  
- Valid UI↔unit agreement: PASS → product calc path PASS for exercised cases  

**Google**
- AUTH SCREEN PRECONDITION: **PASS** (was FAIL)  
- OAUTH CTA TAP: PASS  
- ASWebAuth system sheet + Continue: PASS  
- Provider secret / account chooser: **BLOCKED** (staging `missing OAuth secret`)  
- Supabase session: NOT PROVEN  
- overall: **AUTH INTEGRATION PARTIAL** / Auth harness contract fixed  

**Phase 4F:** FAILED / OPEN / NO-GO  
**Build:** 113 only  
