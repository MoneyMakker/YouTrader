import { PixelRatio } from "react-native";
import { YDL_FONT_SCALE_DENSE_UI_MAX } from "./constants";

/**
 * Current font scale from PixelRatio (system accessibility text size).
 * Do not disable allowFontScaling globally.
 */
export function getYdlFontScale(): number {
  try {
    return PixelRatio.getFontScale();
  } catch {
    return 1;
  }
}

/**
 * Optional dense-UI clamp. Call only with an explicit justification in the
 * component that needs it (e.g. fixed chart chrome). Prefer layout that wraps.
 */
export function clampYdlFontScaleForDenseUi(
  scale: number = getYdlFontScale(),
  max: number = YDL_FONT_SCALE_DENSE_UI_MAX,
): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(scale, max);
}

/**
 * Documented constraint helper — returns whether content should prefer
 * multiline / flexible height over fixed clipping heights.
 */
export function ydlPreferFlexibleTextLayout(fontScale: number = getYdlFontScale()): boolean {
  return fontScale > 1.05;
}
