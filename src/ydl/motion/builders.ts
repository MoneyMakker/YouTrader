import { ydlMotionDuration, getYdlReduceMotionCached, ydlNativeDriverDefault } from "./accessibility";
import { Motion, type YdlMotionPrimitive, type YdlMotionPrimitiveConfig } from "./primitives";
import { ydlSpring, type YdlSpringToken } from "./tokens";

export type YdlTimingBuilderConfig = {
  toValue: number;
  duration: number;
  useNativeDriver: boolean;
  delay?: number;
};

export type YdlSpringBuilderConfig = {
  toValue: number;
  damping: number;
  stiffness: number;
  mass: number;
  useNativeDriver: boolean;
  delay?: number;
};

/** Build RN Animated.timing-compatible options from a Motion primitive. */
export function buildYdlTimingFromPrimitive(
  primitive: YdlMotionPrimitive,
  toValue = 1,
  options?: { delay?: number; reduceMotion?: boolean },
): YdlTimingBuilderConfig {
  const cfg = Motion[primitive];
  const reduce = options?.reduceMotion ?? getYdlReduceMotionCached();
  return {
    toValue,
    duration: ydlMotionDuration(cfg.durationMs, reduce),
    useNativeDriver: cfg.useNativeDriver && ydlNativeDriverDefault(),
    delay: options?.delay ?? 0,
  };
}

export function buildYdlSpringFromToken(
  springKey: YdlSpringToken,
  toValue = 1,
  options?: { delay?: number; useNativeDriver?: boolean },
): YdlSpringBuilderConfig {
  const s = ydlSpring[springKey];
  return {
    toValue,
    damping: s.damping,
    stiffness: s.stiffness,
    mass: s.mass,
    useNativeDriver: options?.useNativeDriver ?? ydlNativeDriverDefault(),
    delay: options?.delay ?? 0,
  };
}

export function getYdlPrimitive(primitive: YdlMotionPrimitive): YdlMotionPrimitiveConfig {
  return Motion[primitive];
}

/**
 * Compose a sequence of timing steps (config only).
 * Consumers map to Animated.sequence later.
 */
export function buildYdlSequence(
  steps: Array<{ primitive: YdlMotionPrimitive; toValue?: number; delay?: number }>,
  reduceMotion = getYdlReduceMotionCached(),
): YdlTimingBuilderConfig[] {
  return steps.map((step) =>
    buildYdlTimingFromPrimitive(step.primitive, step.toValue ?? 1, {
      delay: step.delay,
      reduceMotion,
    }),
  );
}
