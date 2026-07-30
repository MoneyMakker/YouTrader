# UI Infrastructure — Phase 5

**Status: READY FOR REVIEW**

Design System Foundation: tokens, theme access, core primitives, Storybook, one production reference.

**Baseline:** `836693a` (Phase 4 motion)  
**Phase 4 Hermes iOS / Android:** `10,766,186` / `10,780,133` B  
**Phase 5 Hermes iOS / Android:** `10,800,599` / `10,814,641` B  
**JS delta (iOS):** **+34,413 B (~+33.6 KiB)**  
**Native dependency delta:** none  

## Existing UI audit (summary)

| Layer | Status |
|---|---|
| `src/app/theme.ts` `C` | Legacy terminal bridge — keep; do not mass-migrate |
| `src/theme/colors.ts` graphite `C` | Legacy premium/glass — keep |
| Draft `src/ydl/color|space|radius|…` | Folded into `src/ydl/tokens` with thin re-exports |
| `src/ydl/components` Phase 3 | IconButton / ActionRow / SectionHeader — extended |
| `src/components/ui/premium/*` | Legacy glass/skeleton — keep until consumers migrate |
| `app/styles.ts` | Unsafe to mass-rewrite |
| ThemeProvider | **None** in app — sheets use local `useColorScheme` |

**Canonical YDL now:** `src/ydl/tokens` + expanded `src/ydl/components`.  
**Unsafe this phase:** merging two `C` palettes, rewriting Stats radar SVG, deleting premium glass.

## Architecture

```
src/ydl/tokens/          # primitive + semantic tokens, themes, hooks
src/ydl/components/      # YdlText, Button, Card, Badge, Chip, ListItem, …
src/ydl/{color,space,…}.ts  # compatibility re-exports → tokens
```

## Theme / provider decision

**No app-wide ThemeProvider added.**  
Hooks: `useYdlTheme`, `useYdlColorScheme`, `resolveYdlTheme(appearance)`.  
Default product chrome remains dark terminal; light is explicit (system / sheet / Storybook override).  
Avoids a second competing global theme source.

## Tokens

### Spacing
`0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64` + aliases (`screenHorizontal`, `sectionGap`, `cardPadding`, `controlGap`, `inlineGap`).

### Radius
`none, small, medium, large, card, control, pill, modal`

### Typography roles (13)
`display, titleLarge, title, heading, body, bodyEmphasized, callout, label, labelEmphasized, caption, numericLarge, numeric, numericCompact`  
Financial numbers → `numeric*` (+ tabular). Soft lineHeights (~1.35×). No custom fonts. No global font-scale cap.

### Elevation
`none, subtle, card, floating, modal` — restrained; prefer borders/tonal surfaces.

### Semantic colors
Nested: `background.*`, `surface.*`, `text.*`, `border.*`, `icon.*`, `action.*`, `status.*`, `chart.*`  
Unknown paths → `text.primary` + DEV warn.

## Primitives (9 + compatibility)

| Component | Notes |
|---|---|
| `YdlText` | Semantic role + color path |
| `YdlButton` | primary/secondary/tertiary/destructive · sizes · loading/disabled · `YdlAnimatedPressable` |
| `YdlCard` | default/elevated/outlined/interactive/selected |
| `YdlBadge` | tone + required label + symbol (not color-only) |
| `YdlChip` | selectable / a11y selected state |
| `YdlListItem` | canonical list row |
| `YdlActionRow` | **thin wrapper** around `YdlListItem` (consolidation) |
| `YdlEmptyState` | symbol + title + description + optional actions |
| `YdlSkeleton` | static by default; optional RN Animated pulse; Reduce Motion → static |
| `YdlBanner` | info/success/warning/error; dismiss requires label |

## YdlActionRow / YdlListItem

**Decision:** `YdlListItem` is canonical. `YdlActionRow` remains as a compatibility wrapper — no duplicate implementations.

## Production reference

`MetricExplanationSheet` (Trading Radar metric explanation):

- `YdlText` / `YdlCard` / `YdlBadge` / token spacing
- Existing sheet / motion / icon button / animated number retained
- Metric label / value / target / explanation **unchanged**
- Approximate hard-coded values removed from sheet: padding `18/28/10`, fontSizes `28/16`, colors via sheet+theme instead of local StyleSheet numbers

## Import boundaries

Unchanged bans + Reanimated only in `src/ydl/motion`.  
Lint scope includes `src/ydl/tokens`.

## Migration policy

1. New screens → YDL tokens/primitives by default.  
2. Existing screens migrate only when actively touched.  
3. Do not mix redesign with business features.  
4. Do not delete legacy styles merely because tokens exist.  
5. Deprecate premium duplicates only after consumers migrate.

## When not to add a primitive

- One-off marketing layout  
- Chart-specific chrome  
- Domain form wizards  
- Anything that wraps the entire RN API  

## Validation

```bash
npm run typecheck
npm run lint:ui-infra
npm run test:ui-infra-phase3
npm run test:ui-infra-phase4
npm run test:ui-infra-phase5
npx expo-doctor
npx expo install --check
npx expo export --platform ios
npx expo export --platform android
npx expo run:ios -d "iPhone 17"
```

## Known limitations

- Authenticated Radar device smoke may remain blocked (auth / Maestro). Residual checklist in `docs/TESTFLIGHT_PREPARATION.md`.
- App-wide light mode is not rolled out — only theme tokens + sheet/reference support.
- Legacy `C` / premium glass unchanged.
