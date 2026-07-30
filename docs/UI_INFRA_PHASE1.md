# UI Infrastructure — Phase 1

Storybook, Reanimated, and Expo Haptics for YouTrader (Expo SDK 54).

## Installed

| Package | Role |
|---|---|
| `react-native-reanimated` (~4.1.1) | UI animations |
| `react-native-worklets` (0.5.1) | Reanimated 4 peer |
| `expo-haptics` (~15.0.8) | Native haptics |
| `react-native-gesture-handler` | Required by Reanimated / Storybook |
| `@storybook/react-native` + addons (dev) | On-device component catalog |

## Production safety

- Storybook uses entry-point swapping via `@storybook/react-native/withStorybook`.
- Normal `expo start` / EAS builds do **not** set `STORYBOOK_ENABLED`, so Storybook is a Metro no-op and is not bundled.
- App entry is `index.js` (gesture-handler + `App`). Storybook entry is `.rnstorybook/index.ts` only when enabled.

## Run Storybook

```bash
npm run storybook:start
# or
npm run storybook:ios
npm run storybook:android
```

Open **YouTrader / Phase1 / MotionDemo** to verify Reanimated spring + haptics.

## Haptics API

Existing UI helpers in `src/components/ui/haptics.ts` still work.

YDL presets in `src/ydl/haptics.ts` now prefer `expo-haptics` with `Vibration` fallback (web / errors).

## Notes

- `.npmrc` sets `legacy-peer-deps=true` because Storybook 10 optionally peers Reanimated 4.5.x while Expo SDK 54 pins ~4.1.x.
- `@gorhom/bottom-sheet` is present as a Storybook UI peer (devDependency only in Phase 1). Production Bottom Sheet integration is Phase 2.
- Babel uses `babel-preset-expo`, which auto-wires the Reanimated plugin when the package is installed.
