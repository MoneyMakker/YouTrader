/**
 * YouTrader Design Language (YDL) — public API.
 * Phase 1 tokens + Motion Foundation (configs only; screens not wired).
 */

import { ydlBorder } from "./border";
import { ydlColor, ydlCore, ydlLegacy } from "./color";
import { ydlElevation, ydlShadowColor, ydlToneBorder } from "./elevation";
import { ydlHapticPresets, runYdlHaptic } from "./haptics";
import { ydlIconRules, ydlLucideToSfSymbol } from "./icon";
import {
  getYdlPressForControl,
  ydlControlChrome,
  ydlControlState,
  ydlTouchTarget,
} from "./interaction";
import { ydlLayout } from "./layout";
import { ydlMaterial } from "./material";
import {
  Motion,
  ydlDuration,
  ydlEasingName,
  ydlMotion,
  ydlSpring,
} from "./motion";
import { ydlRadius, ydlRadiusScale } from "./radius";
import { ydlSpace, ydlSpaceStep } from "./space";
import { ydlStatus } from "./status";
import { ydlFontSize, ydlTypography } from "./typography";

export {
  ydlColor,
  ydlCore,
  ydlLegacy,
  ydlLegacyGraphite,
  type YdlColorToken,
} from "./color";

export { ydlSpace, ydlSpaceStep, type YdlSpaceToken } from "./space";

export { ydlRadius, ydlRadiusScale, type YdlRadiusToken } from "./radius";

export {
  ydlElevation,
  ydlShadowColor,
  ydlToneBorder,
  type YdlElevationToken,
} from "./elevation";

export { ydlBorder, ydlBorderWidth } from "./border";

export { ydlMaterial, type YdlMaterialTint } from "./material";

export {
  ydlTypography,
  ydlFontSize,
  type YdlTypographyToken,
} from "./typography";

export {
  ydlMotion,
  ydlDuration,
  ydlSpring,
  ydlEasingName,
  ydlEasingBezier,
  Motion,
  ydlStagger,
  ydlTransitions,
  getYdlTransition,
  ydlPress,
  ydlHover,
  ydlGesture,
  getYdlGesture,
  ydlCardInteraction,
  getYdlCardInteraction,
  ydlMotionHaptics,
  runYdlMotionHaptic,
  formatYdlNumber,
  getYdlNumberMotionConfig,
  interpolateYdlNumber,
  getYdlProgressMotionConfig,
  buildYdlTimingFromPrimitive,
  buildYdlSpringFromToken,
  buildYdlSequence,
  resolveYdlReduceMotion,
  getYdlReduceMotionCached,
  type YdlDurationToken,
  type YdlSpringToken,
  type YdlMotionPrimitive,
  type YdlTransitionKind,
  type YdlNumberKind,
  type YdlPressToken,
  type YdlPressInteraction,
} from "./motion";

export {
  ydlHapticPresets,
  runYdlHaptic,
  type YdlHapticPreset,
} from "./haptics";

export {
  ydlTouchTarget,
  ydlControlState,
  ydlControlChrome,
  getYdlPressTokenForControl,
  getYdlPressForControl,
  type YdlControlKind,
} from "./interaction";

export {
  ydlStatus,
  ydlStatusSpinner,
  ydlStatusLoadingBar,
  ydlStatusSkeleton,
  ydlStatusBlock,
  ydlStatusInline,
  ydlSpinnerSizeMap,
  getYdlSpinnerColor,
  type YdlStatusKind,
  type YdlSpinnerSize,
  type YdlSpinnerVariant,
} from "./status";

export { ydlIconRules, ydlLucideToSfSymbol } from "./icon";

export { ydlLayout } from "./layout";

/** Convenience namespace for `import { ydl } from "../ydl"`. */
export const ydl = {
  color: ydlColor,
  core: ydlCore,
  legacy: ydlLegacy,
  space: ydlSpace,
  spaceStep: ydlSpaceStep,
  radius: ydlRadius,
  radiusScale: ydlRadiusScale,
  elevation: ydlElevation,
  shadowColor: ydlShadowColor,
  toneBorder: ydlToneBorder,
  border: ydlBorder,
  material: ydlMaterial,
  typography: ydlTypography,
  fontSize: ydlFontSize,
  motion: ydlMotion,
  Motion,
  duration: ydlDuration,
  spring: ydlSpring,
  easing: ydlEasingName,
  haptic: ydlHapticPresets,
  runHaptic: runYdlHaptic,
  icon: ydlIconRules,
  lucideToSf: ydlLucideToSfSymbol,
  layout: ydlLayout,
  touch: ydlTouchTarget,
  control: {
    chrome: ydlControlChrome,
    state: ydlControlState,
    press: getYdlPressForControl,
  },
  status: ydlStatus,
} as const;
