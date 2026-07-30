/**
 * YDL Motion performance budget (development guidance).
 * Prefer opacity + transform. No continuous dashboard motion.
 */

export const YDL_MOTION_PERFORMANCE_RULES = [
  "Prefer opacity and transform over layout dimensions.",
  "Avoid JS-thread animation loops and per-frame React setState.",
  "Do not allocate new shared values on every render.",
  "Do not animate large lists or many siblings simultaneously.",
  "Avoid blur/shadow intensity changes every frame.",
  "No continuous animation on analytics dashboards.",
  "No spring overshoot for financial numbers, warnings, or destructive UI.",
  "Target older supported iPhones — keep travel and duration restrained.",
] as const;

export type YdlMotionPerfBudget = {
  maxSimultaneousAnimatedChildren: number;
  maxStaggerItems: number;
  allowContinuous: false;
  preferNativeDriverProps: readonly ["opacity", "transform"];
};

export const ydlMotionPerfBudget: YdlMotionPerfBudget = {
  maxSimultaneousAnimatedChildren: 8,
  maxStaggerItems: 5,
  allowContinuous: false,
  preferNativeDriverProps: ["opacity", "transform"],
};

/** Dev-only soft assert — never throws in production. */
export function ydlMotionPerfWarn(message: string): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn(`[YdlMotion] ${message}`);
  }
}

export function ydlMotionAssertStaggerCount(count: number): void {
  if (count > ydlMotionPerfBudget.maxStaggerItems) {
    ydlMotionPerfWarn(
      `Stagger of ${count} exceeds budget (${ydlMotionPerfBudget.maxStaggerItems}). Prefer static layout.`,
    );
  }
}
