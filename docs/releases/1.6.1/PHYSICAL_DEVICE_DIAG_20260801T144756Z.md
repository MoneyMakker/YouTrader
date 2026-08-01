# Physical device diagnostic — 20260801T144756Z

## Policy
- required version: 1.6.1
- required build: 113
- required profile: Release-Staging
- Metro: OFF
- never install 114

## xcodebuild destinations (snippet)
```
2026-08-01 10:47:57.493 xcodebuild[86640:4626494]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-08-01 10:47:58.309 xcodebuild[86640:4626495] CoreSimulatorService connection became invalid.  Simulator services will no longer be available.
2026-08-01 10:47:58.309 xcodebuild[86640:4626515] Logging connecton invalid: <OS_xpc_error: <dictionary: 0x1f389d5f0> { count = 1, transaction: 0, voucher = 0x0, contents =
	"XPCErrorDescription" => <string: 0x1f389d730> { string cache = 0x0, length = 18, contents = "Connection invalid" }
}>
2026-08-01 10:47:58.309 xcodebuild[86640:4626515] Error opening log file (/Users/valentynborovyk/Library/Logs/CoreSimulator/CoreSimulator.com.apple.dt.xcodebuild.log): Operation not permitted
[-[SimServiceContext sendRequest:]:1751] ERROR : Unable to deliver request ({
    "developer_dir" = "/Applications/Xcode.app/Contents/Developer";
    request = "set_developer_dir";
}) because we are not connected to CoreSimulatorService.
Command line invocation:
    /Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild -showdestinations -scheme YouTrader

[-[SimDiskImageManager init]:175] ERROR : Could not kickstart simdiskimaged; SimDiskImageManager services will not be available: Error Domain=NSPOSIXErrorDomain Code=53 "Software caused connection abort" UserInfo={NSLocalizedDescription=Error returned in reply from CoreSimulatorService: Connection invalid}
[-[SimServiceContext initWithDeveloperDir:connectionType:error:]:432] WARN  : Unable to discover any Simulator runtimes. Developer Directory is /Applications/Xcode.app/Contents/Developer.
[-[SimDiskImageManager _onQueue_checkConnection:]:239] ERROR : simdiskimaged returned error (invalid), marking disconnected.
[-[SimServiceContext initWithDeveloperDir:connectionType:error:]_block_invoke:468] ERROR : Could not get list of trusted mount directories: Error Domain=com.apple.CoreSimulator.SimError Code=410 "The service used to manage runtime disk images (simdiskimaged) crashed or is not responding" UserInfo={NSLocalizedDescription=The service used to manage runtime disk images (simdiskimaged) crashed or is not responding}
[-[SimDiskImageManager _onQueue_checkConnection:]:239] ERROR : simdiskimaged returned error (invalid), marking disconnected.
2026-08-01 10:47:58.403 xcodebuild[86640:4626514] Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}
[-[SimServiceContext sendRequest:reply:error:]:1771] ERROR : Unable to deliver request ({
    request = "notification_subscription";
    "set_path" = "/Users/valentynborovyk/Library/Developer/CoreSimulator/Devices";
}) because we are not connected to CoreSimulatorService.
2026-08-01 10:47:58.404 xcodebuild[86640:4626514]  iOSSimulator: [SimServiceContext defaultDeviceSetWithError:] returned nil (Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedFailureReason=Failed to subscribe to notifications from CoreSimulatorService., NSLocalizedDescription=Failed to initialize simulator device set., NSUnderlyingError=0x8c5750300 {Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}}}). Simulator device support disabled.
2026-08-01 10:47:58.406 xcodebuild[86640:4626494] Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused" UserInfo={NSLocalizedDescription=CoreSimulatorService connection became invalid.  Simulator services will no longer be available.}
2026-08-01 10:47:58.406 xcodebuild[86640:4626494]  IDESimulatorAvailability: startObservingSimulatorUpdates() FAILED to register SimDeviceSet observer
[-[SimServiceContext sendRequest:reply:error:]:1771] ERROR : Unable to deliver request ({
    request = "notification_subscription";
    "set_path" = "/Users/valentynborovyk/Library/Developer/CoreSimulator/Devices";
}) because we are not connected to CoreSimulatorService.
2026-08-01 10:47:58.488 xcodebuild[86640:4626493] [MT] DVTAssertions: Warning in DVTFrameworks/DVTFoundation/FileTypes/DVTFileDataTypeDetection.m:80
Details:  detectedTypeIdentifier (com.apple.xml-property-list) does not conform to matchedTypeIdentifier in MagicFileDataTypeDetector extenson com.apple.property-list. When both are specified, this conformance is required unless overridden by setting allowNonInheritance. extension.identifier:Xcode.MagicFileDataTypeDetector.XMLPlist
Object:   <DVTFileDataTypeDetectionMagicCache: 0x8c615da40>
Method:   -initWithExtension:
Thread:   <_NSMainThread: 0x10345dd90>{number = 1, name = main}
Please file a bug at https://feedbackassistant.apple.com with this warning message and any useful information you can provide.
2026-08-01 10:47:58.490 xcodebuild[86640:4626493] [MT] DVTAssertions: Warning in DVTFrameworks/DVTFoundation/FileTypes/DVTFileDataTypeDetection.m:80
Details:  detectedTypeIdentifier (com.apple.binary-property-list) does not conform to matchedTypeIdentifier in MagicFileDataTypeDetector extenson com.apple.property-list. When both are specified, this conformance is required unless overridden by setting allowNonInheritance. extension.identifier:Xcode.MagicFileDataTypeDetector.BinaryPlist
Object:   <DVTFileDataTypeDetectionMagicCache: 0x8c615e700>
Method:   -initWithExtension:
Thread:   <_NSMainThread: 0x10345dd90>{number = 1, name = main}
Please file a bug at https://feedbackassistant.apple.com with this warning message and any useful information you can provide.
2026-08-01 10:47:58.500 xcodebuild[86640:4626493] Writing error result bundle to /var/folders/rp/306yryt96gl0m93bsstqy5sw0000gn/T/ResultBundle_2026-01-08_10-47-0058.xcresult
xcodebuild: error: The directory /Users/valentynborovyk/Projects/youtrader-final does not contain an Xcode project, workspace or package.

```

## devicectl list
```
Failed to load provisioning parameter list due to error: XPCError(errorCode: 1001, errorUserInfo: ["NSLocalizedDescription": "The connection was invalidated.", "XPCConnectionDescription": "<SystemXPCPeerConnection 0x101e4a7e0> { <connection: 0x101e4a960> { name = com.apple.CoreDevice.CoreDeviceService, listener = false, pid = 0, euid = 4294967295, egid = 4294967295, asid = 4294967295 } }"]).
`devicectl manage create` may support a reduced set of arguments.
ERROR: Timed out waiting for CoreDeviceService to fully initialize. This is likely a bug in CoreDevice. Please file a bug report against CoreDevice | X. (com.apple.coredevice.devicectl error 1 (0x01))
```

## Result
ENVIRONMENT BLOCKER — COREDEVICE SERVICE UNAVAILABLE
```
Failed to load provisioning parameter list due to error: XPCError(errorCode: 1001, errorUserInfo: ["XPCConnectionDescription": "<SystemXPCPeerConnection 0x9d4c580c0> { <connection: 0x1048092c0> { name = com.apple.CoreDevice.CoreDeviceService, listener = false, pid = 0, euid = 4294967295, egid = 4294967295, asid = 4294967295 } }", "NSLocalizedDescription": "The connection was invalidated."]).
`devicectl manage create` may support a reduced set of arguments.
ERROR: Timed out waiting for CoreDeviceService to fully initialize. This is likely a bug in CoreDevice. Please file a bug report against CoreDevice | X. (com.apple.coredevice.devicectl error 1 (0x01))
```
