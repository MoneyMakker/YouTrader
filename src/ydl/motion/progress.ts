import { ydlDuration } from "./tokens";
import { ydlMotionDuration, getYdlReduceMotionCached } from "./accessibility";

export type YdlProgressKind = "linear" | "circular" | "segmented" | "buffer";

export type YdlProgressMotionConfig = {
  kind: YdlProgressKind;
  durationMs: number;
  useNativeDriver: false;
  /** 0–1 normalized. */
  from: number;
  to: number;
};

export function getYdlProgressMotionConfig(
  kind: YdlProgressKind,
  to = 1,
  from = 0,
  reduceMotion = getYdlReduceMotionCached(),
): YdlProgressMotionConfig {
  return {
    kind,
    durationMs: ydlMotionDuration(ydlDuration.Progress, reduceMotion),
    useNativeDriver: false,
    from: Math.min(1, Math.max(0, from)),
    to: Math.min(1, Math.max(0, to)),
  };
}

export function clampYdlProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Map 0–1 progress to a display percent integer. */
export function ydlProgressToPercent(value: number): number {
  return Math.round(clampYdlProgress(value) * 100);
}
