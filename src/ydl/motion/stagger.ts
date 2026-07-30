import { ydlDuration } from "./tokens";
import { ydlMotionDuration, getYdlReduceMotionCached } from "./accessibility";

export const ydlStagger = {
  /** Delay between consecutive list/card entrances (ms). */
  tight: 24,
  normal: ydlDuration.Stagger,
  relaxed: 72,
  hero: 96,
} as const;

export type YdlStaggerToken = keyof typeof ydlStagger;

/**
 * Build absolute delays for N items.
 * When Reduce Motion is on, all delays are 0.
 */
export function buildYdlStaggerDelays(
  count: number,
  preset: YdlStaggerToken = "normal",
  reduceMotion = getYdlReduceMotionCached(),
): number[] {
  const step = reduceMotion ? 0 : ydlStagger[preset];
  return Array.from({ length: Math.max(0, count) }, (_, i) => i * step);
}

export function ydlStaggerDelay(
  index: number,
  preset: YdlStaggerToken = "normal",
  reduceMotion = getYdlReduceMotionCached(),
): number {
  return ydlMotionDuration(index * ydlStagger[preset], reduceMotion);
}
