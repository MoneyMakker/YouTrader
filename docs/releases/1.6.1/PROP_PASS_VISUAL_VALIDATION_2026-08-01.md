# Prop Pass Visual/Functional Validation — Session Report

Date: 2026-08-01  
Build: **113** (`1.6.1`)  
Phase 4F: **FAILED / OPEN / NO-GO**  
Build 114: **forbidden**

## Status vocabulary (authoritative)

| Gate | Status |
|------|--------|
| CODE IMPLEMENTATION | **PASS** |
| expo export | **PASS** |
| SIMULATOR VISUAL | **PARTIAL** |
| SIMULATOR FUNCTIONAL | **PARTIAL** |
| PHYSICAL VISUAL | **NOT RUN** |
| PHYSICAL FUNCTIONAL | **NOT RUN** |
| PRODUCT UX | **NOT PROVEN** |

## 1. expo export

- Command: `EXPO_PUBLIC_APP_ENV=staging npx expo export --platform ios --output-dir /tmp/yt-export-ios-113`
- Result: **PASS**
- Bundle: `_expo/static/js/ios/index-3694f87e0ef65afee5cfea5b404cea8e.hbc`
- SHA-256: `0fdcbb4c935f726718adc40057336a0411c84107f9b69153b8e26d20452c92b6`
- Staging host present: `zleojeqkzizeyerhjpur.supabase.co`
- Production host marker appears only as code guard string (`PRODUCTION_SUPABASE_HOST_MARKER`), not as configured API URL
- Build number remains **113**

## 2. Simulator devices

| Device | UDID | Used |
|--------|------|------|
| iPhone 16 (standard) | `71CCD561-2C03-4446-8354-DFCE17ED09A9` | **YES** — primary matrix |
| iPhone 16 Pro Max | `2D73245E-…` | **NOT COMPLETED** (boot/login hung) |
| iPhone 16e (smaller) | `CFDEA0D9-…` | **NOT COMPLETED** (Maestro hang) |

Metro: restarted via `./scripts/qa/start-metro-staging.sh clear` → pid listen `:8081`, staging host.

## 3–8. Screenshots (evidence dir)

Path: `docs/releases/1.6.1/prop-pass-redesign-evidence/`

| State | File | Visual verdict |
|-------|------|----------------|
| healthy | `iphone16_healthy_with_tabs.png`, `iphone16_healthy_v1.png` | PASS — ON TRACK, $1,250/$3,000, rooms, next action |
| caution | `iphone16_caution_tabs.png` | PASS — CAUTION yellow, $240 daily room, protective next |
| at risk | `iphone16_at_risk_tabs.png` | PASS — AT RISK red, $80 daily room, Stop trading now |
| insufficient data | `iphone16_insufficient_data_*` | PASS — Building profile / assign N trades |
| no account | `iphone16_no_account_*` | PASS — Track Your Prop Challenge + Connect Account |
| stale | `iphone16_stale_*` | PASS (card + Refresh) |
| offline cached | `iphone16_offline_cached_*` | PASS (stale banner path) |
| backend unavailable | `iphone16_backend_unavailable_*` | PASS |
| More + 5 tabs | `iphone16_healthy_5tabs.png` | **PASS** — Journal/Prop Pass/Stats/Calendar/More |
| non-allowlisted | `iphone16_nav_4tabs.png` / `iphone16_nav_no_prop_pass_*` | **PASS** — 4 tabs, no Prop Pass, no gap |

## 9. First-viewport comprehension (healthy/caution/at risk)

All seven questions answered without scrolling on hero + account switcher:

1. Account/challenge — Apex $50,000 · Phase 1  
2. Status — ON TRACK / CAUTION / AT RISK  
3. Progress — e.g. $1,250 of $3,000  
4. Remaining — e.g. $1,750 left  
5. Daily room — e.g. $780 / $240 / $80  
6. Max/trailing room — e.g. $1,420 / $1,100 / $450  
7. Next action — explicit Next row  

**Result: PASS (simulator, iPhone 16)**

## 10. Buffer Health numeric verification

- Healthy fixtures: used/available/percent from snapshot remaining/limit  
- Caution/danger threshold mapping selftest **PASS**  
- Defect found & fixed: unavailable buffers rendered raw key `"daily"` → now always uses i18n label keys (`BufferHealthSection.tsx`)

## 11–12. Today’s Plan / Prop Insights

- Staging fixtures: `populated_plan`, `empty_plan`, `insights_pending`, `insights_failed`  
- Deep link: `youtrader://qa/prop-pass-state?mode=…` (staging-only)  
- Interactive scroll-through of plan/insights on device: **PARTIAL** (screenshots of home hero prioritized; full scroll interaction not fully matrixed after LogBox dismiss)

## 13–14. Navigation

- Allowlisted five-tab: **PASS** (`iphone16_healthy_5tabs.png`)  
- Non-allowlisted four-tab: **PASS** (`iphone16_nav_4tabs.png`)

## 15. Dynamic Type / a11y

- **NOT RUN** as dedicated Dynamic Type matrix this session  
- Labels/testIDs present on redesigned components; a11y money formatter covered in selftest

## 16. Physical iPhone

- **NOT RUN**

## 17. Defects found and fixed

1. **LogBox overlays hide tab bar** during Debug-Staging — mitigated for evidence via Maestro force-tap dismiss; remains a staging-dev annoyance, not product Archive/diagnostics.  
2. **Unavailable buffer labels** showed `"daily"` — fixed to i18n labels.  
3. **Tiny progress fill** at 3% looked like a lone circle — min fill width applied.  
4. Email fixture missing blocked main initially — seeded via `staging-qa-seed-email-fixture.sh`.

## 18. Remaining Phase 4F blockers (unchanged OPEN)

1. Google OAuth redirect / session  
2. RevenueCat CustomerInfo / yearly / restore / isolation  
3. PI timeout/Retry staging lifecycle  
4. News offline/Retry Maestro  
5. Settings user-switch isolation  
6. Apple native physical E2E  
7. Prop Pass Pro Max + small-phone matrix completion  
8. Physical Prop Pass PRODUCT UX evidence  

## Deterministic QA injection (staging-only)

- Module: `src/qa/stagingQaPropPassState.ts`  
- Deep link: `youtrader://qa/prop-pass-state?mode=<mode>`  
- Production: `isStagingPropPassQaAllowed()` false → no override  
- Modes cover healthy/caution/at_risk/passed/violated/insufficient/no_account/stale/offline/backend/loading/plans/insights/non_allowlisted  

## Harness scripts

- `scripts/qa/prop-pass-screenshot-matrix.sh`  
- `.maestro/yt3/_dismiss_logbox_points.yaml`
