# UI Infrastructure — Phase 4

**Status: READY FOR REVIEW**

Motion Production Foundation + one polished production interaction (Trading Radar metric sheet).

**Baseline commit (Phase 3 docs close):** `5216974`  
**Immediate Phase 3 code baseline:** `ffbbd8e`  
**Phase 3 Hermes iOS baseline (pre–Phase 4 code):** `10,747,140` bytes

## Installed packages

**None.** Reuses already installed:

| Package | Version |
|---|---|
| `react-native-reanimated` | 4.1.7 |
| `react-native-worklets` | 0.5.1 |
| YDL accessibility / haptics / symbols / sheets | Phase 2–3 |

**Not installed:** Skia, Rive, Unistyles, additional animation/gesture/state libraries.

## Architecture

Canonical motion layer: `src/ydl/motion/` (+ thin barrel `src/ydl/motion.ts`).

| Module | Role |
|---|---|
| `tokens.ts` | Semantic durations + springs + easing beziers |
| `reduceMotion.ts` | Duration/stagger resolution via `useYdlReduceMotion` |
| `performance.ts` | Documented budget + soft DEV warns |
| `number.ts` | Locale-aware formatters + metric string parse |
| `YdlAnimatedPressable.tsx` | Press scale/opacity + optional YDL haptic |
| `YdlAnimatedNumber.tsx` | Timing-only number presentation |
| `YdlStagger.tsx` | Small-group entrance |
| `YdlFade.tsx` | Opacity enter/exit + pointerEvents gate |
| Config helpers (`press.ts`, `stagger.ts`, `builders.ts`, …) | Non-Reanimated policy objects for future/legacy consumers |

**Import rule:** new production UI must not import `react-native-reanimated` directly. Use `src/ydl/motion`. Exception: documented specialist visualization components (none added in Phase 4). Storybook demos under `.rnstorybook` may import Reanimated for infra smoke only.

This is **not** a full Reanimated API wrapper.

## Motion tokens

### Durations (`ydlMotionDurationToken`)

| Token | Intent |
|---|---|
| `instant` | Reduce Motion / no travel |
| `fast` | Micro feedback |
| `standard` | Default enter/opacity |
| `emphasized` | Numbers / slightly longer emphasis |
| `slow` | Rare, deliberate transitions |

### Springs / easing

| Preset | Use |
|---|---|
| `standard` / `enter` / `exit` | Spatial UI (small travel) |
| `press` | Pressable spring |
| `number` (easing) | Number timing — **never spring overshoot** |
| `sheetAdjacent` | Sheet-adjacent content |
| `gentle` / `responsive` | Soft vs snappy springs |

**Policy:** timing for numbers, fades, analytics figures. Springs only for restrained press/spatial. Avoid bounce. Avoid overshoot for financial numbers, warnings, destructive, serious analytics.

## Reduce Motion

Integrated with `useYdlReduceMotion` from `src/ydl/accessibility`.

| Primitive | Reduce Motion behavior |
|---|---|
| Pressable | Opacity flash / immediate; no scale travel |
| Number | Immediate final value |
| Stagger | Immediate render, 0 delay, 0 offset |
| Fade | Instant opacity |
| Decorative footer icon in sheet | Omitted (Phase 3) |

Essential state changes remain. No continuous background motion.

## Public APIs

```ts
YdlAnimatedPressable
YdlAnimatedNumber
YdlStagger
YdlFade
ydlMotionDurationToken / ydlSpring / ydlEasingBezier
formatYdlNumber / parseYdlMetricDisplay / getYdlNumberMotionConfig
resolveYdlMotionMs / resolveYdlStaggerMs
ydlMotionPerfBudget / YDL_MOTION_PERFORMANCE_RULES
```

## Production reference

**Trading Radar metric interaction**

- `StatsPerformanceRadar`: axis triggers use `YdlAnimatedPressable` + optional `selection` haptic (once per intentional press).
- `MetricExplanationSheet`: `YdlFade` + `YdlStagger` (value / explanation / target) + `YdlAnimatedNumber` when the existing display string parses to a number.
- Metric values, targets, explanations unchanged (presentation only).
- Sheet open/close architecture unchanged (still `YdlBottomSheetModal`).
- Reopening / switching metrics intentionally replays a short entrance via `entranceKey={content.label}` / remount key — documented.
- Close / pan-down / backdrop remain interactive; motion does not block dismiss.
- App background cancels in-flight number animation and settles on latest value.

**Animated elements in reference (max):** press feedback on trigger; sheet content fade; ≤4 staggered children; one number. **No** continuous chart/radar animation.

## Accessibility

- Pressable: role/label/hint/disabled passthrough; optional 44×44 for icon controls.
- Number: `accessibilityLabel` = final readable value (original metric string preferred); VoiceOver does not chase intermediate frames.
- Sheet announcements unchanged (`announceYdlAccessibility` on open/content).
- Dynamic Type: `allowFontScaling` retained; no fixed clipping heights.

## Performance budget

See `performance.ts` / `YDL_MOTION_PERFORMANCE_RULES`. Highlights:

1. Prefer opacity + transform.
2. Avoid layout dimension animation.
3. Avoid JS animation loops / per-frame React state floods (number updates are stepped).
4. Avoid shared-value realloc every render.
5. No simultaneous large-list animation; stagger budget ≤5.
6. No continuous dashboard motion.
7. Target older supported iPhones.

## Import boundaries

ESLint (`eslint.ui-infra-imports.config.mjs`) bans direct `react-native-reanimated` outside `src/ydl/motion/**` (plus existing symbol/sheet/lottie/haptics bans).

## Bundle impact

| Metric | Value |
|---|---|
| Phase 3 baseline Hermes iOS | `10,747,140` B |
| Phase 4 Hermes iOS | `10,766,186` B |
| JS delta (iOS Hermes) | **+19,046 B (~+18.6 KiB)** |
| Phase 4 Hermes Android | `10,780,133` B |
| Native dependency delta | **none** (Reanimated/Worklets already present) |
| Storybook exclusion | Stories under `.rnstorybook`; production `index.js` only swaps when `STORYBOOK_ENABLED=true` |
| Continuous animation | **none** introduced |
| New permissions / entitlements | **none** |

## Validation commands

```bash
npm install
npm ls react-native-reanimated react-native-worklets
npm run typecheck
npm run lint:ui-infra
npm run test:ui-infra-phase4
npx expo-doctor
npx expo install --check
npx expo export --platform ios
npx expo export --platform android
npx expo run:ios -d "iPhone 17"
```

## When not to animate

- Entire analytics dashboards
- Long journal lists
- Background / decorative loops
- Financial figure “bounce”
- Anything that delays reading a number
- Chart calculations or live tick streams as continuous motion

## Migration guidance

1. Replace ad-hoc `Pressable` press polish with `YdlAnimatedPressable` where justified.
2. Animate **presentation** of existing numbers with `YdlAnimatedNumber` — do not change calculation sources.
3. Use `YdlStagger` only for small explanation groups (≤5).
4. Never import Reanimated in feature screens — extend `src/ydl/motion` instead.

## Known limitations

- Authenticated Trading Radar device smoke may remain blocked by Sign In (Maestro + `secureTextEntry` / Apple ID). Residual checks stay in `docs/TESTFLIGHT_PREPARATION.md`.
- `YdlAnimatedNumber` steps visual updates (~16) for performance; SR still gets final label only.
- Metric strings that do not parse remain static `Text`.
