# UI Infrastructure — Phase 6

**Status: FINAL APPROVED** (conditional approval closed after PNG baselines)

Component Hardening + Visual Regression Foundation (UI infra — **not** AI Phase 6).

**Baseline HEAD (implementation):** `1e5e87b`  
**Baselines commit:** `test(ui): add Phase 6 visual baselines`  
**Phase 5 Hermes iOS / Android:** `10,800,599` / `10,814,641` B

## Scope

Harden YDL primitive APIs/a11y, Storybook state matrix, Maestro visual regression plumbing, adoption/drift policy, and polish the Trading Radar metric sheet reference. No Skia/Rive/Unistyles. No app-wide redesign.

## Primitive audit (summary)

| Primitive | Hardening |
|---|---|
| YdlText | Roles/colors unchanged; scaling on |
| YdlButton | loading⇒disabled; haptic gated; destructive label+warning icon; touch helper; layout-stable loading |
| YdlCard | static≠button; interactive requires label; disabled; selected text cue + border |
| YdlBadge | label+tone; decorative symbol |
| YdlChip | static vs button roles; selected glyph; 44×44 |
| YdlListItem | hint for chevron; summary when non-pressable |
| YdlActionRow | compatibility map only |
| YdlEmptyState | no empty action slots |
| YdlSkeleton | AppState stop; RM static; max 4 animated |
| YdlBanner | dismiss label; separate action |

## API / breaking

Mostly non-breaking. Interactive `YdlCard` now expects `accessibilityLabel` (DEV warn). Selected cards show a small “Selected” caption (a11y + non-color cue). Static chips no longer use `button` role.

## Accessibility / touch / RM

See `src/ydl/components/contracts.ts` (`YDL_A11Y_MATRIX`, `YDL_REDUCE_MOTION_MATRIX`, `YDL_TOUCH_TARGET_MIN`).  
Canonical touch helper: `ydlMinTouchTargetStyle` / `ydlHitSlopForVisualSize`.

## Visual regression

- Gallery: `.rnstorybook/stories/Phase6VisualRegressionGallery.tsx`
- Flows: `.maestro/ydl/visual_regression_*.yaml`
- Baselines: `.maestro/ydl/baselines/` — **14/14 PNG present**
- Capture: `scripts/capture-phase6-visual-baselines.sh` + `scripts/ui-infra-phase6-visual-capture.md`
- Simulator: **iPhone 17**, Storybook capture mode (`EXPO_PUBLIC_YDL_VR_STORY`)
- Maestro flows: dark / light / large-text / reduce-motion — **all passed** on capture
- PNG artifact size (sum): **2,156,963 bytes** (~2.1 MiB)
- Radar fixture: inline token surface (no auth, no modal dependency for capture)

## Production migration

**Trading Radar `MetricExplanationSheet`** — a11y/testIDs/token polish; copy/values unchanged.  
VR gallery embeds a **token-faithful inline Radar fixture** with `PHASE6_METRIC_FIXTURE` (no auth) for deterministic screenshots.

## Drift

- Hex banned in YDL primitive component files (tokens allowed)
- Third-party import boundaries unchanged
- Adoption: `docs/YDL_ADOPTION_POLICY.md`

## Validation

```bash
npm run typecheck
npm run lint:ui-infra
npm run test:ui-infra-phase3
npm run test:ui-infra-phase4
npm run test:ui-infra-phase5
npm run test:ui-infra-phase6
# Storybook + Maestro capture (device)
maestro test .maestro/ydl/visual_regression_dark.yaml
```

## Known limitations

- Authenticated Radar production smoke remains in TestFlight checklist.
- Status-bar clock / transient Expo “Refreshing…” chrome is human-reviewed, not auto-failed.
- Modal bottom-sheet capture is out of scope for VR gallery (inline fixture instead).

## Bundle

| Metric | Value |
|---|---|
| Phase 5 iOS / Android Hermes | `10,800,599` / `10,814,641` B |
| Phase 6 iOS / Android Hermes | `10,804,550` / `10,818,560` B |
| JS delta iOS / Android | **+3,951 / +3,919 B** (~+3.9 KiB) |
| Native dependency delta | none |
| Screenshot PNG artifact size | **2,156,963 bytes** (14 PNG) |
| Storybook exclusion | gallery under `.rnstorybook` only |
