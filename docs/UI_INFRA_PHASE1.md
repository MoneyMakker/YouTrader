# UI Infrastructure — Phase 1

Storybook, Reanimated, and Expo Haptics for YouTrader (Expo SDK 54).

## Installed

| Package | Role |
|---|---|
| `react-native-reanimated` (~4.1.1) | UI animations (Expo SDK 54 pin) |
| `react-native-worklets` (0.5.1) | Reanimated 4 peer |
| `expo-haptics` (~15.0.8) | Native haptics |
| `react-native-gesture-handler` | Required by Reanimated / Storybook |
| `@storybook/react-native` **10.5.1** + addons (dev) | On-device component catalog |

## Peer dependency resolution

**Root cause:** `@storybook/react-native@10.5.2+` (and nested
`@storybook/react-native-ui@10.5.2+`) declare an exact peer
`react-native-reanimated@4.5.1`. Expo SDK 54 requires `~4.1.1`.
Even with `@storybook/react-native@10.5.1`, the nested range
`@storybook/react-native-ui@^10.5.1` floated to `10.5.4`.

**Resolution:**
1. Pin Storybook RN packages + `storybook` to **10.5.1** (Reanimated peers `>=2` / `>=3`).
2. Narrow `package.json` overrides for nested Storybook packages only:
   `@storybook/react-native-ui`, `-ui-common`, `-theming`,
   `@storybook/react`, `@storybook/react-dom-shim` → `10.5.1`.
3. Do **not** use global `legacy-peer-deps`.
4. Do **not** force Expo Reanimated to 4.5.1.

## Production safety

- Storybook uses entry-point swapping via `@storybook/react-native/withStorybook`.
- Normal `expo start` / EAS builds do **not** set `STORYBOOK_ENABLED`, so Storybook is a Metro no-op and is not bundled.
- App entry is `index.js` (`react-native-gesture-handler` first, then Expo `registerRootComponent(App)`).

## Run Storybook

```bash
npm run storybook:start
# or
npm run storybook:ios
npm run storybook:android
```

Open **YouTrader / Phase1 / MotionDemo** to verify Reanimated spring + haptics.

## Haptics API

Canonical implementation: `src/ydl/haptics.ts` (semantic intents + `expo-haptics`).

- Unavailable haptics **no-op** (no `Vibration` fallback).
- `src/components/ui/haptics.ts` **re-exports only**.

```ts
import { runYdlHaptic } from "../ydl/haptics";
runYdlHaptic("impactLight");
```

## Lint (UI infra only)

```bash
npm run lint:ui-infra
```

Scoped to `.rnstorybook/**`, YDL/UI haptics, and `index.js` — not the whole repo.

## Notes

- `@gorhom/bottom-sheet` remains a Storybook UI peer (devDependency). Production Bottom Sheet integration is Phase 2.
- Babel uses `babel-preset-expo`, which auto-wires the Reanimated plugin when the package is installed.
- `react-native.config.js` disables autolinking for Storybook-only native peers
  (`@react-native-community/datetimepicker`, `@react-native-community/slider`) so they are not linked into production iOS/Android binaries.
