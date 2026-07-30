# Capture YDL visual baselines (Phase 6)

## Canonical environment

| Setting | Value |
|---|---|
| Simulator | iPhone 17 |
| Orientation | portrait |
| Locale | English |
| Appearance | Dark or Light per flow |
| Dynamic Type | Standard (or larger for large-text flow) |
| Reduce Motion | Off (or On for reduce-motion flow) |
| Entry | Storybook (`npm run storybook:ios`) |
| Story | `YouTrader/Phase6/VisualRegressionGallery` |

## Steps

1. `npm run storybook:ios` and wait for Storybook on iPhone 17.
2. Open **DarkGallery** (or Light / LargeText / ReduceMotion).
3. Run the matching Maestro flow:

```bash
maestro test .maestro/ydl/visual_regression_dark.yaml
maestro test .maestro/ydl/visual_regression_light.yaml
maestro test .maestro/ydl/visual_regression_large_text.yaml
maestro test .maestro/ydl/visual_regression_reduce_motion.yaml
```

4. Copy Maestro screenshot outputs into `.maestro/ydl/baselines/` using the same names as `takeScreenshot` ids (`.png`).
5. Commit baselines only when the visual change is intentional.

## Update policy

- Intentional DS visual change → re-capture affected screenshots only.
- Copy/layout tweak in Storybook gallery → update gallery baselines.
- Business logic / metric values → no screenshot update if presentation unchanged.
- Do not fail CI solely on status-bar clock differences — human review.

## Comparison

Manual Git image diff. No heavy visual-diff SaaS in Phase 6.
