# YDL Adoption Policy

**Status:** Phase 6 foundation  
**Applies to:** new YouTrader UI work after `40ac066` / Phase 5+

## 1. Default for new UI

New screens and new interactive controls use **YDL tokens** (`src/ydl/tokens`) and **YDL primitives** (`src/ydl/components`) by default.

## 2. Feature-specific composites

Allowed outside YDL when they encode domain layout (e.g. trade row with journal fields).  
Composites **must compose** YDL primitives/tokens — do not invent a second Button/Card system.

## 3. Do not duplicate generic primitives

Do not create another general-purpose:

`Button` · `Card` · `Badge` · `Chip` · `ListItem` · `EmptyState` · `Skeleton` · `Banner`

outside `src/ydl/components`.

## 4. Legacy migrate-when-touched

Existing `src/components/ui/premium/*`, dual `C` palettes, and `app/styles.ts` migrate only when that area is actively modified. Do not mix large visual migration with business feature PRs.

## 5. Reviewable and reversible

Each migration should be a focused commit/PR. Prefer compatibility wrappers over hard cuts.

## 6. Compatibility wrappers

Allowed temporarily (example: `YdlActionRow` → `YdlListItem`).  
Document mapping. Do not expand wrappers into parallel APIs.

## 7. Deprecation stages

1. Identify duplicate  
2. Stop new adoption (docs + lint where reliable)  
3. Migrate consumers  
4. Mark deprecated  
5. Remove only at **zero consumers**

## 8. Requesting a new token

Add to `src/ydl/tokens` with semantic intent. Prefer semantic colors over primitives. Keep the palette small. Document in the phase / ADR note if brand-changing.

## 9. Requesting a new primitive

Only when a pattern repeats across ≥2 surfaces and cannot be a feature composite. Requires Storybook states + a11y + (for visual changes) visual baseline review.

## 10. When not to add a primitive

One-off marketing layouts, chart-specific chrome, domain wizards, or wrapping the entire RN API.

## 11. Storybook

New reusable primitives need focused stories (not one mega playground).

## 12. Accessibility

Interactive controls: role, label, state, ≥44×44 effective target, Reduce Motion path, decorative icons hidden.

## 13. Visual regression

Meaningful reusable visual changes update `.maestro/ydl` baselines via documented capture flow.

## 14. Third-party UI

Libraries (`reanimated`, `expo-haptics`, `expo-symbols`, `@gorhom/bottom-sheet`, `lottie-react-native`) import only through YDL adapters.

## Current legacy status

| System | Status |
|---|---|
| Dual `C` (`app/theme` + `theme/colors`) | Keep; migrate when touched |
| Premium / glass components | Keep until consumers migrate |
| `app/styles.ts` | Keep; no mass rewrite |
| `YdlActionRow` | Compatibility wrapper only → prefer `YdlListItem` |
