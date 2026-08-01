# CoreSimulator blocker report — 2026-08-01

**Status:** ENVIRONMENT BLOCKER — CORESIMULATOR SERVICE UNAVAILABLE  
**Harness:** `scripts/qa/recover-apple-simulator-services.sh` (exit **10**)  
**Detail report:** `SIMULATOR_SERVICE_RECOVERY_20260801T144749Z.md`

## Category

Agent/host session cannot talk to `CoreSimulatorService` / `simdiskimaged` (connection invalid; log file Operation not permitted; LaunchServices open of Simulator.app failed with `kLSNoExecutableErr` in prior attempts).

## Observed facts (non-personal)

| Item | Result |
|------|--------|
| `xcode-select -p` | `/Applications/Xcode.app/Contents/Developer` |
| Simulator.app present under Xcode | Yes |
| `simctl list devices available` | Fails / empty usable device set from agent |
| `bootstatus` | Not reached healthily |
| Disk free | ~131Gi available (not disk pressure) |
| Bounded recovery attempts | kickstart CoreSimulator + retry list (≤3) — failed |
| Mass erase | **Not performed** |

## Error category

**Host sandbox / session isolation from Apple simulator services** (not an app code defect).

## Resume recipe (future session)

1. Run outside restricted agent sandbox if needed (local Terminal / Xcode).  
2. `bash scripts/qa/recover-apple-simulator-services.sh`  
3. Expect exit 0 before any Maestro/screenshot matrix.  
4. Prefer devices: iPhone 16, iPhone 16e, Pro Max.  
5. Launch Debug-Staging or Release-Staging **113** with StoreKit config attached.

## Non-goals

- Do not erase all simulators automatically.  
- Do not sudo.  
- Do not treat this as product FAIL.
