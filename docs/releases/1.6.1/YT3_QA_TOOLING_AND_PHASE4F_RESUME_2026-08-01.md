# YT3 QA tooling + Phase 4F resume (2026-08-01)

**Phase 4F:** **FAILED / OPEN / NO-GO**  
**Build:** 1.6.1 (113) only · Metro OFF · Release-Staging · no 114

## Required report fields

| # | Item | Result |
|---|------|--------|
| 1 | JDK 17 path | `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home` (`java_home -v 17` / Homebrew) · OpenJDK 17.0.20 |
| 2 | Maestro env | **PASS** — Maestro 2.8.0 with JDK 17 (`scripts/qa/lib/resolve-jdk17.sh` + `run-maestro-staging.sh`) · `doctor` N/A on 2.8.0 |
| 3 | QA venv | **PASS** — `~/.youtrader-qa-tools/pyvenv` · Python 3.14.6 |
| 4 | pymobiledevice3 | **10.3.0** (venv only) |
| 5 | physical wrapper | `scripts/qa/physical-device-tool.sh` (+ JDK lib) — see commit |
| 6 | CoreDevice visibility | **PASS** — iPhone 14 Pro Max `6FCFF771-…` connected/paired |
| 7 | Lock detection | **PASS** — `DEVICE_UNLOCKED` via Preferences launch probe |
| 8 | Screenshot proof | **PARTIAL** — SpringBoard PNG OK (mean≈40); YouTrader foreground **near-black rejected** (mean≈0.39) exit 26 |
| 9 | Build 113 verify | **PASS** — installed 1.6.1/113 · embedded jsbundle · staging host · Metro OFF |
| 10 | Simulator Maestro | **PARTIAL** — JDK17 Maestro 2.8.0: onboarding Screen1 OK → paywall shows plans unavailable (no StoreKit attach via simctl) · `maestro_exit=1` |
| 11 | RC inventory | **PASS** — package_count=3 Weekly/Monthly/Annual |
| 12–14 | CustomerInfo W/M/A | **NOT RUN** (physical UI evidence gap) |
| 15–17 | Email/Apple/Google | **NOT RUN** |
| 18 | Product matrix | **NOT RUN** |
| 19 | Evidence dir | `docs/releases/1.6.1/phase4f-screenshots/physical/` |
| 20 | Remaining blockers | YouTrader black DVT screenshot on physical; sim paywall needs StoreKit LaunchAction; Weekly ASC READY_TO_SUBMIT |
| 21 | Final Phase 4F | **FAILED / OPEN / NO-GO** |

Orchestrator run: `docs/releases/1.6.1/PHASE4F_LIVE_E2E_RUN_20260801T201030Z.md`  
first_incomplete: `physical_screenshot_proof:LIVE_FAIL`
