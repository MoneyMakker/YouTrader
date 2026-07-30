/**
 * YDL Motion — public barrel.
 * Production UI imports motion only through this module (or named files under src/ydl/motion).
 * Do not import react-native-reanimated from feature screens.
 */

export {
  ydlMotionDurationToken,
  ydlDuration,
  ydlEasingName,
  ydlEasingBezier,
  ydlSpring,
  type YdlMotionDurationName,
  type YdlDurationToken,
  type YdlSpringToken,
  type YdlEasingToken,
} from "./tokens";

export {
  useYdlMotionReduceMotion,
  resolveYdlMotionMs,
  resolveYdlStaggerMs,
} from "./reduceMotion";

export {
  YDL_MOTION_PERFORMANCE_RULES,
  ydlMotionPerfBudget,
  ydlMotionPerfWarn,
  ydlMotionAssertStaggerCount,
} from "./performance";

export {
  formatYdlNumber,
  getYdlNumberMotionConfig,
  interpolateYdlNumber,
  parseYdlMetricDisplay,
  type YdlNumberKind,
  type YdlNumberFormatOptions,
  type YdlNumberMotionConfig,
} from "./number";

export {
  YdlAnimatedPressable,
  type YdlAnimatedPressableProps,
} from "./YdlAnimatedPressable";

export {
  YdlAnimatedNumber,
  type YdlAnimatedNumberProps,
} from "./YdlAnimatedNumber";

export {
  YdlStagger,
  ydlStaggerPresets,
  type YdlStaggerProps,
  type YdlStaggerPreset,
} from "./YdlStagger";

export { YdlFade, type YdlFadeProps } from "./YdlFade";

// Config helpers (non-Reanimated) — preserved for existing YDL consumers
export {
  getYdlReduceMotionCached,
  resolveYdlReduceMotion,
  subscribeYdlReduceMotion,
  ydlMotionDuration,
  ydlNativeDriverDefault,
} from "./accessibility";

export {
  Motion,
  type YdlMotionPrimitive,
  type YdlMotionPrimitiveConfig,
} from "./primitives";

export {
  ydlStagger,
  buildYdlStaggerDelays,
  ydlStaggerDelay,
  type YdlStaggerToken,
} from "./stagger";

export {
  ydlTransitions,
  getYdlTransition,
  type YdlTransitionKind,
  type YdlTransitionPreset,
} from "./transitions";

export { ydlPress, type YdlPressToken, type YdlPressInteraction } from "./press";

export { ydlHover, type YdlHoverToken, type YdlHoverInteraction } from "./hover";

export { ydlGesture, getYdlGesture, type YdlGestureToken } from "./gestures";

export {
  buildYdlTimingFromPrimitive,
  buildYdlSpringFromToken,
  buildYdlSequence,
  getYdlPrimitive,
  type YdlTimingBuilderConfig,
  type YdlSpringBuilderConfig,
} from "./builders";

export {
  getYdlProgressMotionConfig,
  clampYdlProgress,
  ydlProgressToPercent,
  type YdlProgressKind,
  type YdlProgressMotionConfig,
} from "./progress";

export {
  ydlCardInteraction,
  getYdlCardInteraction,
  type YdlCardInteractionState,
  type YdlCardInteractionConfig,
} from "./card";

export {
  ydlMotionHaptics,
  runYdlMotionHaptic,
  type YdlMotionHapticToken,
} from "./haptics";

import { Motion } from "./primitives";
import {
  ydlDuration,
  ydlEasingBezier,
  ydlEasingName,
  ydlSpring,
  ydlMotionDurationToken,
} from "./tokens";
import { ydlStagger } from "./stagger";
import { ydlTransitions, getYdlTransition } from "./transitions";
import { ydlPress } from "./press";
import { ydlHover } from "./hover";
import { ydlGesture, getYdlGesture } from "./gestures";
import {
  buildYdlTimingFromPrimitive,
  buildYdlSpringFromToken,
  buildYdlSequence,
  getYdlPrimitive,
} from "./builders";
import {
  formatYdlNumber,
  getYdlNumberMotionConfig,
  interpolateYdlNumber,
  parseYdlMetricDisplay,
} from "./number";
import {
  getYdlProgressMotionConfig,
  clampYdlProgress,
  ydlProgressToPercent,
} from "./progress";
import { ydlCardInteraction, getYdlCardInteraction } from "./card";
import { ydlMotionHaptics, runYdlMotionHaptic } from "./haptics";
import {
  getYdlReduceMotionCached,
  resolveYdlReduceMotion,
  ydlMotionDuration,
} from "./accessibility";

/** Namespace used as `ydl.motionFoundation` / `Motion` consumers. */
export const ydlMotion = {
  duration: ydlDuration,
  durationToken: ydlMotionDurationToken,
  spring: ydlSpring,
  easing: ydlEasingName,
  easingBezier: ydlEasingBezier,
  primitives: Motion,
  Motion,
  stagger: ydlStagger,
  transitions: ydlTransitions,
  getTransition: getYdlTransition,
  press: ydlPress,
  hover: ydlHover,
  gesture: ydlGesture,
  getGesture: getYdlGesture,
  card: ydlCardInteraction,
  getCard: getYdlCardInteraction,
  haptics: ydlMotionHaptics,
  runHaptic: runYdlMotionHaptic,
  buildTiming: buildYdlTimingFromPrimitive,
  buildSpring: buildYdlSpringFromToken,
  buildSequence: buildYdlSequence,
  getPrimitive: getYdlPrimitive,
  number: {
    format: formatYdlNumber,
    config: getYdlNumberMotionConfig,
    interpolate: interpolateYdlNumber,
    parseMetricDisplay: parseYdlMetricDisplay,
  },
  progress: {
    config: getYdlProgressMotionConfig,
    clamp: clampYdlProgress,
    toPercent: ydlProgressToPercent,
  },
  a11y: {
    getReduceMotion: getYdlReduceMotionCached,
    resolveReduceMotion: resolveYdlReduceMotion,
    duration: ydlMotionDuration,
  },
} as const;
