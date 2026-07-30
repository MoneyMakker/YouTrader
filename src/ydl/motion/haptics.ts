import { runYdlHaptic, type YdlHapticPreset } from "../haptics";
import { getYdlReduceMotionCached } from "./accessibility";

/**
 * Motion-linked haptic wrappers.
 * Skip haptics when Reduce Motion is enabled (calm / a11y).
 */
export const ydlMotionHaptics = {
  CardPress: "Selection",
  CardSelect: "Selection",
  ButtonPrimary: "ImpactLight",
  ButtonSecondary: "Selection",
  Success: "Success",
  Warning: "Warning",
  Error: "Error",
  Impact: "ImpactMedium",
  Selection: "Selection",
} as const satisfies Record<string, YdlHapticPreset>;

export type YdlMotionHapticToken = keyof typeof ydlMotionHaptics;

export function runYdlMotionHaptic(
  token: YdlMotionHapticToken,
  reduceMotion = getYdlReduceMotionCached(),
): void {
  if (reduceMotion) return;
  runYdlHaptic(ydlMotionHaptics[token]);
}
