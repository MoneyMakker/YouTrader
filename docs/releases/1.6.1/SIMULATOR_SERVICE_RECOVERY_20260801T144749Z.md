# Simulator service recovery — 20260801T144749Z

## Host
- date_utc: 20260801T144749Z
- xcode-select: /Applications/Xcode.app/Contents/Developer
- xcodebuild version: Xcode 26.6 Build version 17F113 

## Disk
/dev/disk3s3s1   926Gi    12Gi   132Gi     9%    459k  1.4G    0%   /
- available_gi: 131

## Runtimes
2026-08-01 10:47:50.047 simctl[86568:4626218] CoreSimulatorService connection became invalid.  Simulator services will no longer be available.
2026-08-01 10:47:50.047 simctl[86568:4626219] Logging connecton invalid: <OS_xpc_error: <dictionary: 0x1f389d5f0> { count = 1, transaction: 0, voucher = 0x0, contents =
	"XPCErrorDescription" => <string: 0x1f389d730> { string cache = 0x0, length = 18, contents = "Connection invalid" }
}>
2026-08-01 10:47:50.048 simctl[86568:4626219] Error opening log file (/Users/valentynborovyk/Library/Logs/CoreSimulator/CoreSimulator.com.apple.CoreSimulator.simctl.log): Operation not permitted
[-[SimServiceContext sendRequest:]:1751] ERROR : Unable to deliver request ({
    "developer_dir" = "/Applications/Xcode.app/Contents/Developer";
    request = "set_developer_dir";
}) because we are not connected to CoreSimulatorService.
[-[SimServiceContext initWithDeveloperDir:connectionType:error:]:432] WARN  : Unable to discover any Simulator runtimes. Developer Directory is /Applications/Xcode.app/Contents/Developer.
[-[SimDiskImageManager init]:175] ERROR : Could not kickstart simdiskimaged; SimDiskImageManager services will not be available: Error Domain=NSPOSIXErrorDomain Code=53 "Software caused connection abort" UserInfo={NSLocalizedDescription=Error returned in reply from CoreSimulatorService: Connection invalid}
[-[SimDiskImageManager _onQueue_checkConnection:]:239] ERROR : simdiskimaged returned error (invalid), marking disconnected.
[-[SimDiskImageManager _onQueue_checkConnection:]:239] ERROR : simdiskimaged returned error (invalid), marking disconnected.
[-[SimServiceContext initWithDeveloperDir:connectionType:error:]_block_invoke:468] ERROR : Could not get list of trusted mount directories: Error Domain=com.apple.CoreSimulator.SimError Code=410 "The service used to manage runtime disk images (simdiskimaged) crashed or is not responding" UserInfo={NSLocalizedDescription=The service used to manage runtime disk images (simdiskimaged) crashed or is not responding}
[-[SimServiceContext sendRequest:reply:error:]:1771] ERROR : Unable to deliver request ({
    request = "notification_subscription";
    "set_path" = "/Users/valentynborovyk/Library/Developer/CoreSimulator/Devices";
}) because we are not connected to CoreSimulatorService.
2026-08-01 10:47:50.184 simctl[86568:4626214] Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}
Unable to locate device set: Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedFailureReason=Failed to subscribe to notifications from CoreSimulatorService., NSLocalizedDescription=Failed to initialize simulator device set., NSUnderlyingError=0xa711bc960 {Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}}}

## Devices (attempt list)
### Attempt 1
```
2026-08-01 10:47:50.225 simctl[86573:4626236] CoreSimulatorService connection became invalid.  Simulator services will no longer be available.
2026-08-01 10:47:50.226 simctl[86573:4626238] Logging connecton invalid: <OS_xpc_error: <dictionary: 0x1f389d5f0> { count = 1, transaction: 0, voucher = 0x0, contents =
	"XPCErrorDescription" => <string: 0x1f389d730> { string cache = 0x0, length = 18, contents = "Connection invalid" }
}>
2026-08-01 10:47:50.226 simctl[86573:4626238] Error opening log file (/Users/valentynborovyk/Library/Logs/CoreSimulator/CoreSimulator.com.apple.CoreSimulator.simctl.log): Operation not permitted
[-[SimServiceContext sendRequest:]:1751] ERROR : Unable to deliver request ({
    "developer_dir" = "/Applications/Xcode.app/Contents/Developer";
    request = "set_developer_dir";
}) because we are not connected to CoreSimulatorService.
[-[SimServiceContext initWithDeveloperDir:connectionType:error:]:432] WARN  : Unable to discover any Simulator runtimes. Developer Directory is /Applications/Xcode.app/Contents/Developer.
[-[SimDiskImageManager init]:175] ERROR : Could not kickstart simdiskimaged; SimDiskImageManager services will not be available: Error Domain=NSPOSIXErrorDomain Code=53 "Software caused connection abort" UserInfo={NSLocalizedDescription=Error returned in reply from CoreSimulatorService: Connection invalid}
[-[SimDiskImageManager _onQueue_checkConnection:]:239] ERROR : simdiskimaged returned error (invalid), marking disconnected.
[-[SimDiskImageManager _onQueue_checkConnection:]:219] ERROR : simdiskimaged connection is currently unavailable because connection became invalid
[-[SimServiceContext initWithDeveloperDir:connectionType:error:]_block_invoke:468] ERROR : Could not get list of trusted mount directories: Error Domain=com.apple.CoreSimulator.SimError Code=409 "Cannot talk to the service used to manage runtime disk images (simdiskimaged) because its launchd job is not registered or was unloaded" UserInfo={NSLocalizedDescription=Cannot talk to the service used to manage runtime disk images (simdiskimaged) because its launchd job is not registered or was unloaded}
[-[SimServiceContext sendRequest:reply:error:]:1771] ERROR : Unable to deliver request ({
    request = "notification_subscription";
    "set_path" = "/Users/valentynborovyk/Library/Developer/CoreSimulator/Devices";
}) because we are not connected to CoreSimulatorService.
2026-08-01 10:47:50.286 simctl[86573:4626235] Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}
Unable to locate device set: Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedFailureReason=Failed to subscribe to notifications from CoreSimulatorService., NSLocalizedDescription=Failed to initialize simulator device set., NSUnderlyingError=0xb5f130810 {Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}}}
```
Could not find service "com.apple.CoreSimulator.CoreSimulatorService" in domain for user gui: 501
### Attempt 2
```
2026-08-01 10:47:52.464 simctl[86586:4626288] CoreSimulatorService connection became invalid.  Simulator services will no longer be available.
2026-08-01 10:47:52.466 simctl[86586:4626288] Logging connecton invalid: <OS_xpc_error: <dictionary: 0x1f389d5f0> { count = 1, transaction: 0, voucher = 0x0, contents =
	"XPCErrorDescription" => <string: 0x1f389d730> { string cache = 0x0, length = 18, contents = "Connection invalid" }
}>
2026-08-01 10:47:52.467 simctl[86586:4626290] Error opening log file (/Users/valentynborovyk/Library/Logs/CoreSimulator/CoreSimulator.com.apple.CoreSimulator.simctl.log): Operation not permitted
[-[SimServiceContext sendRequest:]:1751] ERROR : Unable to deliver request ({
    "developer_dir" = "/Applications/Xcode.app/Contents/Developer";
    request = "set_developer_dir";
}) because we are not connected to CoreSimulatorService.
[-[SimServiceContext initWithDeveloperDir:connectionType:error:]:432] WARN  : Unable to discover any Simulator runtimes. Developer Directory is /Applications/Xcode.app/Contents/Developer.
[-[SimDiskImageManager init]:175] ERROR : Could not kickstart simdiskimaged; SimDiskImageManager services will not be available: Error Domain=NSPOSIXErrorDomain Code=53 "Software caused connection abort" UserInfo={NSLocalizedDescription=Error returned in reply from CoreSimulatorService: Connection invalid}
[-[SimDiskImageManager _onQueue_checkConnection:]:239] ERROR : simdiskimaged returned error (invalid), marking disconnected.
[-[SimDiskImageManager _onQueue_checkConnection:]:239] ERROR : simdiskimaged returned error (invalid), marking disconnected.
[-[SimServiceContext initWithDeveloperDir:connectionType:error:]_block_invoke:468] ERROR : Could not get list of trusted mount directories: Error Domain=com.apple.CoreSimulator.SimError Code=410 "The service used to manage runtime disk images (simdiskimaged) crashed or is not responding" UserInfo={NSLocalizedDescription=The service used to manage runtime disk images (simdiskimaged) crashed or is not responding}
[-[SimServiceContext sendRequest:reply:error:]:1771] ERROR : Unable to deliver request ({
    request = "notification_subscription";
    "set_path" = "/Users/valentynborovyk/Library/Developer/CoreSimulator/Devices";
}) because we are not connected to CoreSimulatorService.
2026-08-01 10:47:52.529 simctl[86586:4626287] Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}
Unable to locate device set: Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedFailureReason=Failed to subscribe to notifications from CoreSimulatorService., NSLocalizedDescription=Failed to initialize simulator device set., NSUnderlyingError=0x9814f4810 {Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}}}
```
Could not find service "com.apple.CoreSimulator.CoreSimulatorService" in domain for user gui: 501
### Attempt 3
```
2026-08-01 10:47:54.697 simctl[86608:4626368] CoreSimulatorService connection became invalid.  Simulator services will no longer be available.
2026-08-01 10:47:54.697 simctl[86608:4626369] Logging connecton invalid: <OS_xpc_error: <dictionary: 0x1f389d5f0> { count = 1, transaction: 0, voucher = 0x0, contents =
	"XPCErrorDescription" => <string: 0x1f389d730> { string cache = 0x0, length = 18, contents = "Connection invalid" }
}>
2026-08-01 10:47:54.698 simctl[86608:4626369] Error opening log file (/Users/valentynborovyk/Library/Logs/CoreSimulator/CoreSimulator.com.apple.CoreSimulator.simctl.log): Operation not permitted
[-[SimServiceContext sendRequest:]:1751] ERROR : Unable to deliver request ({
    "developer_dir" = "/Applications/Xcode.app/Contents/Developer";
    request = "set_developer_dir";
}) because we are not connected to CoreSimulatorService.
[-[SimServiceContext initWithDeveloperDir:connectionType:error:]:432] WARN  : Unable to discover any Simulator runtimes. Developer Directory is /Applications/Xcode.app/Contents/Developer.
[-[SimDiskImageManager init]:175] ERROR : Could not kickstart simdiskimaged; SimDiskImageManager services will not be available: Error Domain=NSPOSIXErrorDomain Code=53 "Software caused connection abort" UserInfo={NSLocalizedDescription=Error returned in reply from CoreSimulatorService: Connection invalid}
[-[SimDiskImageManager _onQueue_checkConnection:]:239] ERROR : simdiskimaged returned error (invalid), marking disconnected.
[-[SimDiskImageManager _onQueue_checkConnection:]:239] ERROR : simdiskimaged returned error (invalid), marking disconnected.
[-[SimServiceContext initWithDeveloperDir:connectionType:error:]_block_invoke:468] ERROR : Could not get list of trusted mount directories: Error Domain=com.apple.CoreSimulator.SimError Code=410 "The service used to manage runtime disk images (simdiskimaged) crashed or is not responding" UserInfo={NSLocalizedDescription=The service used to manage runtime disk images (simdiskimaged) crashed or is not responding}
[-[SimServiceContext sendRequest:reply:error:]:1771] ERROR : Unable to deliver request ({
    request = "notification_subscription";
    "set_path" = "/Users/valentynborovyk/Library/Developer/CoreSimulator/Devices";
}) because we are not connected to CoreSimulatorService.
2026-08-01 10:47:54.760 simctl[86608:4626367] Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}
Unable to locate device set: Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedFailureReason=Failed to subscribe to notifications from CoreSimulatorService., NSLocalizedDescription=Failed to initialize simulator device set., NSUnderlyingError=0x7f94085d0 {Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}}}
```
Could not find service "com.apple.CoreSimulator.CoreSimulatorService" in domain for user gui: 501

## Result
ENVIRONMENT BLOCKER — CORESIMULATOR SERVICE UNAVAILABLE

stderr:
```
2026-08-01 10:47:54.797 simctl[86612:4626383] CoreSimulatorService connection became invalid.  Simulator services will no longer be available.
2026-08-01 10:47:54.798 simctl[86612:4626385] Logging connecton invalid: <OS_xpc_error: <dictionary: 0x1f389d5f0> { count = 1, transaction: 0, voucher = 0x0, contents =
	"XPCErrorDescription" => <string: 0x1f389d730> { string cache = 0x0, length = 18, contents = "Connection invalid" }
}>
2026-08-01 10:47:54.798 simctl[86612:4626385] Error opening log file (/Users/valentynborovyk/Library/Logs/CoreSimulator/CoreSimulator.com.apple.CoreSimulator.simctl.log): Operation not permitted
[-[SimServiceContext sendRequest:]:1751] ERROR : Unable to deliver request ({
    "developer_dir" = "/Applications/Xcode.app/Contents/Developer";
    request = "set_developer_dir";
}) because we are not connected to CoreSimulatorService.
[-[SimServiceContext initWithDeveloperDir:connectionType:error:]:432] WARN  : Unable to discover any Simulator runtimes. Developer Directory is /Applications/Xcode.app/Contents/Developer.
[-[SimDiskImageManager init]:175] ERROR : Could not kickstart simdiskimaged; SimDiskImageManager services will not be available: Error Domain=NSPOSIXErrorDomain Code=53 "Software caused connection abort" UserInfo={NSLocalizedDescription=Error returned in reply from CoreSimulatorService: Connection invalid}
[-[SimDiskImageManager _onQueue_checkConnection:]:239] ERROR : simdiskimaged returned error (invalid), marking disconnected.
[-[SimDiskImageManager _onQueue_checkConnection:]:239] ERROR : simdiskimaged returned error (invalid), marking disconnected.
[-[SimServiceContext initWithDeveloperDir:connectionType:error:]_block_invoke:468] ERROR : Could not get list of trusted mount directories: Error Domain=com.apple.CoreSimulator.SimError Code=410 "The service used to manage runtime disk images (simdiskimaged) crashed or is not responding" UserInfo={NSLocalizedDescription=The service used to manage runtime disk images (simdiskimaged) crashed or is not responding}
[-[SimServiceContext sendRequest:reply:error:]:1771] ERROR : Unable to deliver request ({
    request = "notification_subscription";
    "set_path" = "/Users/valentynborovyk/Library/Developer/CoreSimulator/Devices";
}) because we are not connected to CoreSimulatorService.
2026-08-01 10:47:54.858 simctl[86612:4626382] Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}
Unable to locate device set: Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedFailureReason=Failed to subscribe to notifications from CoreSimulatorService., NSLocalizedDescription=Failed to initialize simulator device set., NSUnderlyingError=0xa5f1307e0 {Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}}}
```
