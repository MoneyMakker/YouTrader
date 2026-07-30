# UI Infrastructure — Phase 3

Symbols Foundation + Accessibility Foundation + one controlled production reference.

## Installed

| Package | Version | Scope |
|---|---|---|
| `expo-symbols` | ~1.0.8 | production (Expo SDK 54 pin via `npx expo install`) |

Preserved from Phase 2:

- `@gorhom/bottom-sheet` ^5.2.14
- `lottie-react-native` ~7.3.1
- Reanimated / Storybook / YDL haptics

**Not installed in this phase:** Skia, Rive, Unistyles, CodeQL, Trivy, MobSF.

## Architecture

### Symbols (`src/ydl/symbols`)

All direct `expo-symbols` imports live here.

| Export | Role |
|---|---|
| `YdlSymbol` | semantic SF Symbol / Android Lucide fallback |
| `YdlSymbolUnsafe` | **internal** escape hatch for raw SF names |
| `YDL_SYMBOL_MAP` | typed semantic → SF map |
| `resolveYdlSymbol` | safe unknown → `info` fallback |

Production components must use semantic names (`close`, `settings`, …), not raw SF strings.

### Accessibility (`src/ydl/accessibility`)

Lightweight helpers only (RN / Expo APIs). No global store, no event bus, no new a11y dependency.

| API | Role |
|---|---|
| `useYdlReduceMotion` | local Reduce Motion subscription |
| `useYdlScreenReaderEnabled` | local screen-reader state |
| `announceYdlAccessibility` | short async outcome announcements |
| `ydlMinTouchTargetStyle` / `YDL_MIN_TOUCH_TARGET` | ≥44×44 guidance |
| `ydlCombinedAccessibilityLabel` | VoiceOver-friendly combined labels |
| `getYdlFontScale` / `clampYdlFontScaleForDenseUi` | scale helpers; **no global cap** |

### Shared primitives (`src/ydl/components`)

| Component | Notes |
|---|---|
| `YdlIconButton` | `YdlSymbol` + 44×44 + role/label + optional YDL haptic |
| `YdlActionRow` | leading symbol, title/subtitle, trailing/chevron, multiline-safe |
| `YdlSectionHeader` | optional header for sheets / sections |

No direct `expo-symbols` / `expo-haptics` imports in these primitives.

## Semantic symbol map

`back`, `close`, `add`, `edit`, `delete`, `search`, `settings`, `calendar`, `chart`, `journal`, `trade`, `profit`, `loss`, `warning`, `success`, `lock`, `unlock`, `share`, `info`, `notification`, `chevronRight`

Policy: map real YouTrader concepts only. Do not grow speculative aliases. Unknown names fall back to `info` without throwing.

## Android fallback

On Android / web, `SymbolView` receives a Lucide vector `fallback` (never emoji). Mapping lives in `AndroidSymbolFallback.tsx` inside the symbols adapter.

## Accessibility standards

1. Interactive controls target **≥ 44×44 pt** effective area (`YdlIconButton`, `YdlActionRow` minHeight).
2. Decorative symbols: `decorative` / hidden from SR when adjacent text already describes the control.
3. Meaningful icon-only controls: require `accessibilityLabel` on the button.
4. Do **not** set `allowFontScaling={false}` globally; do **not** cap scale without an explicit dense-UI justification.
5. Sheets: modal accessibility label + pan-down close; Lottie continuous playback still respects Reduce Motion (Phase 2).
6. Announcements are opt-in for important async outcomes only.

## Production reference integration

**Selected:** Trading Radar metric explanation sheet in Stats.

- New: `src/components/stats/MetricExplanationSheet.tsx`
- Wired from: `StatsPerformanceRadar.tsx` (replaces local `BottomSheetPanel` usage for this sheet only)
- Behavior: read-only metric label / value / explanation / target
- Uses: `YdlBottomSheetModal`, `YdlIconButton`, `YdlSymbol`, `YdlSectionHeader`, a11y announce + Reduce Motion
- **No** Lottie (symbol-only is enough)
- Removable without touching trade create/delete, auth, paywall, AI, or analytics semantics
- No new navigation routes / no global state

## Direct-import boundaries

`npm run lint:ui-infra` runs:

1. Adapter / Storybook lint (`eslint.ui-infra.config.mjs`)
2. Production import ban (`eslint.ui-infra-imports.config.mjs`) for:

- `expo-symbols`
- `@gorhom/bottom-sheet`
- `lottie-react-native`
- `expo-haptics`

Allowed only in: `src/ydl/symbols/**`, `src/ydl/sheets/**`, `src/ydl/lottie/**`, `src/ydl/haptics.ts`.

Focused audit also in `npm run test:ui-infra-phase3`.

## Bundle impact

Measured production Hermes (Storybook disabled):

| Platform | Size |
|---|---|
| iOS `.hbc` | **10,747,998 bytes (~10.75 MB)** |
| Android `.hbc` | **10,762,111 bytes (~10.76 MB)** |

Phase 2 baseline (pre–expo-symbols, approximate from prior export): ~10.49 MB iOS Hermes.  
Phase 3 delta ≈ **+0.25 MB** JS Hermes (plus native `ExpoSymbols` pod).

- Storybook demos remain under `.rnstorybook/**` (entry-swapped; **absent** from production Hermes).
- No new demo Lottie assets in this phase.
- No new permissions / entitlements for symbols.
- Production bundle contains `MetricExplanationSheet` / `YdlSymbol` (reference integration); does **not** contain `expo-symbols` string (adapter compiles through native module).

## Validation commands

```bash
npm install
npm ls
npm run typecheck
npm run lint:ui-infra
npm run test:ui-infra-phase3
npx expo-doctor
npx expo install --check
npx expo export --platform ios
npx expo export --platform android
npx expo run:ios -d "iPhone 17"
```

## Known limitations

- Most production icons still use Lucide directly; this phase does **not** replace them wholesale.
- `YdlSymbolUnsafe` exists for rare migration / Storybook cases — do not use from feature screens.
- Existing `BottomSheetPanel` remains for other call sites.
- Motion Reduce Motion cache in `src/ydl/motion/accessibility.ts` remains for Lottie/sheets; new UI should prefer `useYdlReduceMotion` (local hook state).

## Migration guidance

1. Prefer `YdlSymbol` semantic names over raw SF / new Lucide one-offs in new UI.
2. Icon buttons / settings rows: `YdlIconButton` / `YdlActionRow`.
3. Sheets: `src/ydl/sheets` only.
4. Haptics: `runYdlHaptic` only.
5. Keep business logic unchanged when swapping chrome.
