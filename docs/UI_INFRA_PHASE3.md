# UI Infrastructure — Phase 3

**Status: FINAL APPROVED** (2026-07-30)  
Closing commit: `ffbbd8e36ef48129be962db7b73b48505a87cab9`

Symbols Foundation + Accessibility Foundation + one controlled production reference.

**Residual (not a Phase 3 blocker):** authenticated device/TestFlight smoke for Radar sheet (backdrop, pan-down, VoiceOver focus, Dynamic Type, stale content) — tracked in `docs/TESTFLIGHT_PREPARATION.md` → *UI Infra — Trading Radar metric sheet*.


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

Policy: map real YouTrader concepts only. Do not grow speculative aliases.

**Unknown semantic names:** the public `YdlSymbol` prop is typed as `YdlSemanticSymbol` (unknown values unreachable at compile time). Runtime `resolveYdlSymbol(string)` still accepts a string for safety and:

- falls back to `info` without throwing (production-safe)
- emits a **development-only** `console.warn` when `__DEV__` is true

## Android fallback

On Android / web, `YdlSymbol` renders `AndroidSymbolFallback` (Lucide vectors) instead of `SymbolView` (`Platform.OS === "ios"` gate). Mapping lives in `AndroidSymbolFallback.tsx` inside the symbols adapter — **never emoji**.

Focused QA (`npm run test:ui-infra-phase3`) asserts:

- non-iOS branch renders the Lucide fallback component
- `YDL_SYMBOL_ANDROID_FALLBACK` map exists
- no emoji fallback tokens in `YdlSymbol.tsx`

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

Comparable Hermes JS bundles (Storybook disabled):

| Baseline | Commit | iOS Hermes `.hbc` |
|---|---|---|
| Phase 2 | `dc121fa` | **10,723,913 B** |
| Phase 3 | `4b22c31` | **10,747,998 B** |

**Correct Phase 3 JS delta:** **+24,085 B** (≈ **+23.5 KiB**).

Android Hermes (Phase 3 export): **10,762,111 B** (not used for the Phase 2→3 JS delta above).

**Native (separate from Hermes JS delta):**

| Item | Notes |
|---|---|
| `ExpoSymbols` / `expo-symbols@1.0.8` | New native pod linked in `ios/Podfile.lock` |
| Native binary size delta | **Not** folded into the Hermes JS delta above unless measured from comparable built `.app` artifacts |

- Storybook demos remain under `.rnstorybook/**` (entry-swapped; **absent** from production Hermes).
- No new demo Lottie assets in this phase.
- No new permissions / entitlements for symbols.
- Production bundle contains `MetricExplanationSheet` / `YdlSymbol` (reference integration); does **not** contain `expo-symbols` string (adapter compiles through native module).

## Phase 3 remediation validation (post–conditional approval)

### Corrected Hermes baseline

| | Commit | iOS Hermes |
|---|---|---|
| Phase 2 | `dc121fa` | 10,723,913 B |
| Phase 3 | `4b22c31` | 10,747,998 B |
| **JS delta** | | **+24,085 B (~+23.5 KiB)** |

Native `ExpoSymbols` is tracked separately in Podfile.lock and is **not** included in the Hermes JS delta.

### Unknown semantic symbols

Typed `YdlSymbol` `name: YdlSemanticSymbol` makes unknown names unreachable at compile time. Runtime `resolveYdlSymbol(string)` still falls back to `info` and **`console.warn`s in `__DEV__` only**.

### Production Radar sheet smoke (iPhone 17)

| Check | Result | Notes |
|---|---|---|
| App launches | PASS | Dev client opens auth |
| Email modal opens | PASS | Maestro |
| Email field fill | PASS | Review account email |
| Password secure field fill | **BLOCKED** | Maestro `inputText` does not populate `secureTextEntry` on this sim/OS; password remains empty; Sign In cannot complete |
| Apple Sign In | **BLOCKED** | Routes to system Apple Account / Settings; no preconfigured sim Apple ID |
| Stats → Trading Radar | **BLOCKED** | Depends on authenticated session |
| Axis metric open/close / backdrop / pan-down / stale content | **BLOCKED** | Same auth gate |

Code-path guarantees for the reference (when authenticated):

- Axis `Pressable`: `accessibilityRole="button"` + meaningful `accessibilityLabel`
- Sheet: `YdlBottomSheetModal` with `accessibilityViewIsModal`, close `YdlIconButton` labeled `t("close")`
- Decorative `YdlSymbol` uses `decorative` / SR-hidden
- `selected` cleared on close → no stale metric between openings
- Flexible scroll content + `allowFontScaling` (no fixed clipping height on sheet body)

### VoiceOver / Dynamic Type / Reduce Motion / Appearance

| Surface | Result | Evidence |
|---|---|---|
| VoiceOver labels (triggers, close, decorative hide, modal) | **PASS (code)** / device VO after login **PENDING** | Radar + sheet + modal a11y props; `accessibilityViewIsModal` on modal sheet |
| Dynamic Type / no clip | **PASS (code)** / device **PENDING** | `allowFontScaling`; no fixed height on sheet body / action row |
| Reduce Motion | **PASS (code)** / device setting applied | Decorative footer chart omitted when `useYdlReduceMotion()`; sim `ReduceMotionEnabled=true` set during remediation |
| Light / dark | **PASS (code + sim chrome)** | Sheet `appearance` follows `useColorScheme` / prop; sim toggled `appearance dark` during remediation; `YDL_SHEET_COLORS` light+dark |

### Android fallback

| Check | Result |
|---|---|
| Focused QA proves non-iOS path uses Lucide `AndroidSymbolFallback` | **PASS** (`npm run test:ui-infra-phase3`) |
| Emulator runtime smoke | Not required when focused component/path proof passes |

### Remediation code changes (this follow-up)

- Radar axis triggers: button role + labels; child text `accessible={false}`
- `YdlBottomSheetModal`: `accessibilityViewIsModal`
- QA script: Android path + radar a11y + DEV warn assertions
- Docs: corrected bundle baseline + validation tables


## Migration guidance

1. Prefer `YdlSymbol` semantic names over raw SF / new Lucide one-offs in new UI.
2. Icon buttons / settings rows: `YdlIconButton` / `YdlActionRow`.
3. Sheets: `src/ydl/sheets` only.
4. Haptics: `runYdlHaptic` only.
5. Keep business logic unchanged when swapping chrome.
