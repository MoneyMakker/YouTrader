# UI Infrastructure — Phase 2

Bottom Sheet + Lottie foundations for YouTrader (Expo SDK 54).

## Installed

| Package | Version | Scope |
|---|---|---|
| `@gorhom/bottom-sheet` | ^5.2.14 | **production** |
| `lottie-react-native` | ~7.3.1 | production (Expo SDK 54 pin) |

Preserved from Phase 1:

- `react-native-reanimated` ~4.1.1
- Storybook RN **10.5.1** + narrow `@storybook/*` overrides
- no global `legacy-peer-deps`

## Architecture

### Sheets (`src/ydl/sheets`)

All direct `@gorhom/bottom-sheet` imports live here.

| Export | Role |
|---|---|
| `YdlSheetRoot` | `GestureHandlerRootView` + `BottomSheetModalProvider` |
| `YdlBottomSheet` | standard sheet |
| `YdlBottomSheetModal` | modal sheet |
| `YdlSheetScrollView` / `YdlSheetTextInput` / `YdlSheetView` | content primitives |
| `YdlSheetHandle` | custom handle |
| `YdlSheetSizing` | explicit `fixed` \| `dynamic` (never silent defaults) |

Provider placement: wrapped once in `index.js` around `App`.

### Lottie (`src/ydl/lottie`)

All direct `lottie-react-native` imports live here.

| Export | Role |
|---|---|
| `YdlLottie` | semantic playback adapter |
| playback modes | `static` \| `once` \| `loop` \| `controlled` |

## Public sheet API (summary)

```ts
sizing:
  | { mode: "fixed"; snapPoints: YdlSheetSnapPoint[]; initialSnapIndex?: number }
  | { mode: "dynamic"; maxDynamicContentSize?: number }

ref: { open/close/snapToIndex } | { present/dismiss/snapToIndex }
```

Snap points: `number` (dp) or `` `${number}%` ``.

## Public Lottie API (summary)

```ts
<YdlLottie
  source={require("./local.json")} // or AnimationObject
  width={120}
  height={120}
  playback={{ mode: "once" }}
  accessibilityLabel="..."
/>
```

## Reduce Motion

- Sheets: near-zero duration animation configs; gestures still work.
- Lottie: continuous modes fall back to a static frame (`progress = 0`).

## Keyboard

Use `YdlSheetTextInput` / `YdlModalSheetTextInput` inside sheets (Gorhom keyboard-aware input). Prefer `YdlSheetScrollView` with `keyboardShouldPersistTaps="handled"`.

## Accessibility

- Sheet/handle/lottie accept `accessibilityLabel`.
- Handle is exposed as an adjustable control.
- Large-font Storybook story validates readable spacing.

## Haptics

Optional `hapticOnSettle` (default **false**) calls canonical YDL haptics on open/close settle only — never while dragging. No direct `expo-haptics` usage in sheets.

## Asset policy

See `docs/YDL_LOTTIE_ASSET_POLICY.md`.

Demo asset path (Storybook only):

`.rnstorybook/assets/ydl-pulse-demo.json`

## Bundle impact

- Production must not include `.rnstorybook/**` demo stories or demo Lottie JSON.
- Storybook remains entry-swapped via `STORYBOOK_ENABLED`.

## Validation commands

```bash
npm install
npm ls
npm run typecheck
npm run lint:ui-infra
npx expo-doctor
npx expo install --check
npx expo export --platform ios
npx expo export --platform android
npx expo run:ios -d "iPhone 17"
```

## Known limitations

- Existing production `BottomSheetPanel` (RN `Modal`) is unchanged in Phase 2.
- Existing `YouTraderLottie` placeholder is unchanged; migrate later via YDL adapter.
- Sheet state is local/controlled props only — not navigation/global store.

## Migration guidance (future screens)

1. Import from `src/ydl/sheets` / `src/ydl/lottie` only.
2. Never import `@gorhom/bottom-sheet` or `lottie-react-native` in feature screens.
3. Choose explicit `sizing.mode`.
4. Keep Reduce Motion defaults; do not force motion.
5. Keep haptics opt-in and rare.
