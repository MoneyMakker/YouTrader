import { useYdlReduceMotion } from "../accessibility";
import { ydlMotionDurationToken, type YdlMotionDurationName } from "./tokens";

export { useYdlReduceMotion as useYdlMotionReduceMotion };

/**
 * Resolve a duration token against Reduce Motion.
 * When enabled → 0 (instant). Essential state still updates; travel is removed.
 */
export function resolveYdlMotionMs(
  token: YdlMotionDurationName | number,
  reduceMotion: boolean,
): number {
  if (reduceMotion) return 0;
  if (typeof token === "number") return Math.max(0, token);
  return ydlMotionDurationToken[token];
}

/** Stagger step under Reduce Motion is always 0. */
export function resolveYdlStaggerMs(stepMs: number, reduceMotion: boolean): number {
  return reduceMotion ? 0 : Math.max(0, stepMs);
}
