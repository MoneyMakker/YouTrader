# YouTrader 3.0 — Phase 4F Physical Device QA Report

**Date:** 2026-07-31  
**Branch:** `fix/yt3-device-regression-recovery`  
**Device:** iPhone 4S — iPhone 14 Pro Max — UDID `00008120-00046D54219B401E` — **Connected**  
**Scheme / config:** `YouTrader-Staging` / `Release-Staging`  
**Metro:** OFF · embedded `main.jsbundle` (~11 MB) · build **113**  
**Build 114:** NOT prepared / NOT uploaded  
**Production Supabase:** untouched  

**Evidence dir:** `docs/releases/1.6.1/phase4f-screenshots/qa-captures-auto/`  
(in-app `react-native-view-shot` → `Documents/qa-captures` → `devicectl device copy from`)

---

## Verdict

# FAILED / NO-GO

Infrastructure + visual recovery are **partially proven** with physical screenshots.  
Interactive auth (Apple/Google) and allowlisted Prop Pass content are **not** PASS.

Do **not** call this PARTIAL PASS for release. Do **not** start build 114.

| Gate | Result |
| --- | --- |
| Release-Staging rebuild 1.6.1 (113) + embed | **PASS** |
| Install + launch Metro OFF | **PASS** |
| Cold/warm process launches | **PASS** |
| In-app screen captures (bypass broken screenshotr) | **PASS** (see evidence) |
| Tab IA: no AI Analytics primary tab | **PASS** (Journal / Stats / Calculator / News / Calendar / Settings) |
| Journal empty copy (no AI coaching CTA) | **PASS** |
| Paywall “AI Trading Coach” → Performance Coach | **PASS** (latest capture) |
| Dark theme / readable primary titles | **PASS** on Journal / Settings / Paywall |
| Stats “Stats Dashboard” section title contrast | **CONCERN** (low-contrast grey on black) |
| Acquisition onboarding screen | **NOT PROVEN** (Keychain session restored → skipped) |
| Auth screen + Apple CTA physical | **NOT PROVEN** (session restored; Apple provider still disabled) |
| Apple Sign-In E2E | **FAIL** — staging `provider_disabled`; Dashboard enable blocked (API 403) |
| Google Sign-In E2E | **NOT PROVEN** (interactive) |
| Prop Pass primary tab (allowlisted) | **NOT PROVEN** — restored user not on allowlist; tab correctly hidden |
| Prop Pass non-allowlisted deny | **PASS** (tab absent for this account) |
| Screenshots via `idevicescreenshot` | **FAIL** — screenshotr Invalid service (iOS 26.6) |
| Maestro 2.8.0 iOS driver | **FAIL** — missing `MaestroDriverLib/Info.plist` |
| Aikido scan | **BLOCKED** — invalid auth token |

---

## Evidence inventory

| File | What it proves |
| --- | --- |
| `STATUS.txt` | Auto walk: paywall → main → journal/stats/calc/news/calendar/settings |
| `phase_paywall.png` | Paywall readable; Performance Coach copy; Pro packaging |
| `phase_main.png` / `tab_journal.png` | Journal empty state + Prop Pass mention; Sync pill; 6-tab shell |
| `tab_stats.png` | Stats empty + overview cards; **section title contrast concern** |
| `tab_calc.png` | Calculator reachable |
| `tab_news.png` | News reachable |
| `tab_calendar.png` | Calendar reachable |
| `tab_settings.png` | Authenticated account UI; Cloud Sync; Sign Out |

Restored session account visible on Settings: authenticated staging user (Keychain survived reinstall).

---

## Unblockers still required

1. **Enable Apple** on Supabase Staging Auth (Dashboard only) — Client ID `com.youtrader.pro` + secret.  
2. Sign out / clear Keychain session, then capture **onboarding + Auth** with Apple/Google CTAs.  
3. Sign in as allowlisted UUID `41abedc1-b17b-416a-8b18-4e0bdd348a02` and capture Prop Pass tab + home.  
4. Optional: fix Stats section-title contrast.  
5. Re-auth Aikido for SAST on changed files.

Until then Phase 4F stays **FAILED**. Build stays **113**. No 114 / no TF upload.
