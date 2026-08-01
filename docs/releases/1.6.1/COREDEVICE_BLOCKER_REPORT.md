# CoreDevice blocker report — 2026-08-01

**Status:** ENVIRONMENT BLOCKER — COREDEVICE SERVICE UNAVAILABLE  
**Harness:** `scripts/qa/recover-physical-device-services.sh` (exit **20**)  
**Detail report:** `PHYSICAL_DEVICE_DIAG_20260801T144756Z.md`

## Category

`xcrun devicectl list devices` / CoreDeviceService initialization timed out or connection invalidated from the agent host session.

## QA requirements when services return

| Check | Required |
|-------|----------|
| App version | **1.6.1** |
| Build | **113** only |
| Configuration | Release-Staging |
| Bundle | embedded `main.jsbundle` |
| Metro | **OFF** |
| Host | staging (`zleojeqkzizeyerhjpur`) |
| Production host | **absent** |

## Explicit prohibitions

- Do **not** install, upload, or prepare **build 114**.  
- Do **not** erase or unpair the iPhone.  
- Do **not** modify production configuration.

## Resume recipe

1. Open Xcode → Window → Devices; confirm device paired.  
2. `bash scripts/qa/recover-physical-device-services.sh`  
3. If app wrong build: remove wrong install → install Release-Staging **113** only.  
4. Capture version/build evidence before Phase 4F matrix.  
5. Continue via `scripts/qa/run-phase4f-live-e2e.sh`.

## Privacy

This report intentionally omits UDIDs, phone numbers, and Apple ID emails.
