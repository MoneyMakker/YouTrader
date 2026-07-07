# Local Xcode Build 1.5.8 (91)

Use these steps to archive YouTrader locally for App Store Connect or TestFlight.

Do not use EAS Build for this release.

## 1. Open The Project

```sh
cd /Users/valentynborovyk/Projects/youtrader-final
open ios/YouTrader.xcworkspace
```

## 2. Select Device Target

In Xcode, select:

```text
Any iOS Device (arm64)
```

## 3. Check Version And Build

Open:

```text
Target -> YouTrader -> General
```

Confirm:

```text
Version: 1.5.8
Build: 91
```

## 4. Check Signing

Open:

```text
Signing & Capabilities
```

Confirm:

```text
Team: BOROVIK GROUP INC
Automatically manage signing: ON
Bundle ID: com.youtrader.pro
```

## 5. Clean Build Folder

In Xcode:

```text
Product -> Clean Build Folder
```

## 6. Archive

In Xcode:

```text
Product -> Archive
```

## 7. Select The Archive

When Organizer opens, select:

```text
YouTrader 1.5.8 (91)
```

## 8. Upload

In Organizer:

```text
Distribute App -> App Store Connect -> Upload
```

## 9. Upload Warnings

If App Store Connect says:

```text
Upload completed with warnings
```

dSYM warnings are usually not blocking. The upload can still finish and process in App Store Connect.

Fix only warnings that prevent upload, break signing, or indicate a missing required entitlement.

## 10. Wait For Processing

After upload, wait for App Store Connect processing to finish before selecting the build for TestFlight or App Review.
