# Capture YDL visual baselines (Phase 6)

## Canonical environment

| Setting | Value |
|---|---|
| Simulator | iPhone 17 |
| Orientation | portrait |
| Locale | English |
| Appearance | Dark or Light per flow |
| Dynamic Type | Standard (or `accessibility-extra-extra-extra-large` for large-text flow) |
| Reduce Motion | Off (or On via Accessibility defaults for reduce-motion flow) |
| Entry | Storybook (`STORYBOOK_ENABLED=true`) |
| Story | `YouTrader/Phase6/VisualRegressionGallery` |
| Capture env | `EXPO_PUBLIC_YDL_VR_STORY=<story-id>` (hides on-device chrome) |

## Automated

```bash
./scripts/capture-phase6-visual-baselines.sh
```

Story ids:

- `youtrader-phase6-visualregressiongallery--dark-gallery`
- `youtrader-phase6-visualregressiongallery--light-gallery`
- `youtrader-phase6-visualregressiongallery--large-text-gallery`
- `youtrader-phase6-visualregressiongallery--reduce-motion-gallery`

## Manual

1. `STORYBOOK_ENABLED=true EXPO_PUBLIC_YDL_VR_STORY=youtrader-phase6-visualregressiongallery--dark-gallery npm run storybook:ios`
2. Wait for gallery (`testID` `ydl-visual-gallery`).
3. Run the matching Maestro flow:

```bash
maestro test .maestro/ydl/visual_regression_dark.yaml
maestro test .maestro/ydl/visual_regression_light.yaml
maestro test .maestro/ydl/visual_regression_large_text.yaml
maestro test .maestro/ydl/visual_regression_reduce_motion.yaml
```

4. Copy PNG from Maestro `--test-output-dir` / `screenshots/` into `.maestro/ydl/baselines/`.
5. Commit baselines only when the visual change is intentional.

## Update policy

- Intentional DS visual change → re-capture affected screenshots only.
- Copy/layout tweak in Storybook gallery → update gallery baselines.
- Business logic / metric values → no screenshot update if presentation unchanged.
- Do not fail CI solely on status-bar clock differences — human review.
- Radar fixture is an **inline** token-faithful surface (same Win Rate fixture as MetricExplanationSheet) so capture does not depend on modal `present()`.

## Comparison

Manual Git image diff. No heavy visual-diff SaaS in Phase 6.
