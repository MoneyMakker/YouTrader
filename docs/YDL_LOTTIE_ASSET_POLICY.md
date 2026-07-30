# YDL Lottie Asset Policy

Canonical adapter: `src/ydl/lottie`.

## Approved asset location

- Production assets: `assets/lottie/` (create when first production animation ships)
- Storybook / infra demos only: `.rnstorybook/assets/`

Never place demo-only assets under `assets/` if they are not used by production screens.

## File naming

```
yt-<surface>-<intent>[-<theme>].json
```

Examples:

- `yt-empty-journal-pulse-dark.json`
- `yt-goal-reached-once.json`

## Size

- Recommended maximum: **80 KB** JSON (`YDL_LOTTIE_MAX_JSON_BYTES`)
- Prefer optimized / simplified paths over high-fidelity illustration dumps

## Source rules

- **No remote URLs**
- **No network-based asset loading**
- Pass `require(...)` or an inlined `AnimationObject`
- No unreviewed third-party packs

## Licensing

- Only ship assets with clear redistribution rights for the YouTrader app
- Record license/source in the PR description when adding a production asset

## Optimization

- Run Lottie optimization (remove hidden layers, unused assets, round keyframes) before merge
- Prefer solid shapes over large embedded images

## Dark / light strategy

- Prefer a single neutral asset that works on dark UI
- If theme-specific art is required, ship `*-dark.json` / `*-light.json` pairs and select in the screen — not inside `YdlLottie`

## When not to use Lottie

- Simple opacity/scale feedback → Reanimated / existing YDL motion
- Continuous decorative loops on dense data screens
- Anything that fights Reduce Motion calm

## Fallback

- Reduce Motion: `YdlLottie` shows a static frame
- Missing/invalid source: do not crash; prefer omitting the visual in the calling screen

## Bundle-size review

Any new production Lottie asset requires:

1. byte-size note in the PR
2. confirmation it is not imported from Storybook-only paths
3. `expo export` check that the asset appears only when a production screen imports it
