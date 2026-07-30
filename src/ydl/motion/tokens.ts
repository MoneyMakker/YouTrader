/**
 * YDL Motion — semantic duration + spring/easing tokens.
 * Feature code must use these names, not raw milliseconds.
 *
 * Timing (opacity / number / fades): use duration tokens + standard easing.
 * Spring (press / small spatial): use spring presets. Avoid bounce for
 * financial numbers, warnings, destructive, and serious analytics.
 */

/** Semantic durations (ms). */
export const ydlMotionDurationToken = {
  instant: 0,
  fast: 120,
  standard: 220,
  emphasized: 320,
  slow: 420,
} as const;

/**
 * Legacy aliases kept for config helpers / Storybook demos.
 * Prefer ydlMotionDurationToken in new production code.
 */
export const ydlDuration = {
  ...ydlMotionDurationToken,
  Fast: ydlMotionDurationToken.fast,
  Normal: ydlMotionDurationToken.standard,
  Slow: ydlMotionDurationToken.slow,
  Hero: 480,
  Modal: 280,
  Button: 160,
  Card: 240,
  Toast: 200,
  Tooltip: 140,
  Chart: 640,
  Number: ydlMotionDurationToken.emphasized,
  Progress: 480,
  Stagger: 48,
} as const;

export const ydlEasingName = {
  standard: "standard",
  enter: "enter",
  exit: "exit",
  press: "press",
  number: "number",
  sheetAdjacent: "sheetAdjacent",
  softOut: "softOut",
  emphasized: "emphasized",
  decelerate: "decelerate",
  accelerate: "accelerate",
  linear: "linear",
} as const;

/** Cubic-bezier documentation values for timing curves. */
export const ydlEasingBezier = {
  standard: [0.2, 0, 0, 1] as const,
  enter: [0.16, 1, 0.3, 1] as const,
  exit: [0.3, 0, 1, 0.45] as const,
  press: [0.2, 0, 0, 1] as const,
  number: [0.25, 0.1, 0.25, 1] as const,
  sheetAdjacent: [0.2, 0, 0, 1] as const,
  softOut: [0.16, 1, 0.3, 1] as const,
  emphasized: [0.2, 0, 0, 1] as const,
  decelerate: [0, 0, 0, 1] as const,
  accelerate: [0.3, 0, 1, 1] as const,
  linear: [0, 0, 1, 1] as const,
} as const;

/**
 * Springs — restrained damping. No playful bounce.
 * number / analytics: prefer timing, not spring.
 */
export const ydlSpring = {
  /** Default UI spring */
  standard: { damping: 22, stiffness: 260, mass: 0.9 },
  enter: { damping: 24, stiffness: 220, mass: 1 },
  exit: { damping: 26, stiffness: 280, mass: 0.9 },
  press: { damping: 28, stiffness: 420, mass: 0.7 },
  gentle: { damping: 26, stiffness: 160, mass: 1.05 },
  responsive: { damping: 24, stiffness: 340, mass: 0.8 },
  sheetAdjacent: { damping: 24, stiffness: 240, mass: 0.95 },
  // Legacy keys
  Fast: { damping: 22, stiffness: 320, mass: 0.8 },
  Normal: { damping: 20, stiffness: 220, mass: 1 },
  Slow: { damping: 24, stiffness: 140, mass: 1.1 },
  Spring: { damping: 22, stiffness: 200, mass: 1 },
  Hero: { damping: 22, stiffness: 180, mass: 1 },
  Modal: { damping: 24, stiffness: 260, mass: 0.95 },
  Button: { damping: 28, stiffness: 400, mass: 0.7 },
  Card: { damping: 22, stiffness: 200, mass: 1 },
  Glass: { damping: 26, stiffness: 180, mass: 1 },
  Chart: { damping: 24, stiffness: 180, mass: 1 },
} as const;

export type YdlMotionDurationName = keyof typeof ydlMotionDurationToken;
export type YdlDurationToken = keyof typeof ydlDuration;
export type YdlSpringToken = keyof typeof ydlSpring;
export type YdlEasingToken = keyof typeof ydlEasingName;
