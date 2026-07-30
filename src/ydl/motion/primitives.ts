import { ydlDuration, ydlEasingName, type YdlDurationToken, type YdlSpringToken } from "./tokens";

/**
 * Named motion primitives — config only (no JSX, no screen wiring).
 * Future phases map these onto Animated / Reanimated call sites.
 */
export type YdlMotionPrimitiveConfig = {
  durationKey: YdlDurationToken;
  durationMs: number;
  springKey: YdlSpringToken;
  easing: keyof typeof ydlEasingName;
  /** Opacity / scale / translate defaults for the primitive. */
  from: { opacity?: number; scale?: number; translateY?: number; translateX?: number };
  to: { opacity?: number; scale?: number; translateY?: number; translateX?: number };
  useNativeDriver: boolean;
  notes?: string;
};

function prim(
  durationKey: YdlDurationToken,
  springKey: YdlSpringToken,
  easing: keyof typeof ydlEasingName,
  from: YdlMotionPrimitiveConfig["from"],
  to: YdlMotionPrimitiveConfig["to"],
  useNativeDriver: boolean,
  notes?: string,
): YdlMotionPrimitiveConfig {
  return {
    durationKey,
    durationMs: ydlDuration[durationKey],
    springKey,
    easing,
    from,
    to,
    useNativeDriver,
    notes,
  };
}

export const Motion = {
  Card: prim("Card", "Card", "softOut", { opacity: 0, scale: 0.98, translateY: 8 }, { opacity: 1, scale: 1, translateY: 0 }, true),
  Button: prim("Button", "Button", "emphasized", { scale: 1 }, { scale: 0.975 }, true, "press scale target"),
  ListItem: prim("Normal", "Normal", "standard", { opacity: 0, translateY: 6 }, { opacity: 1, translateY: 0 }, true),
  Modal: prim("Modal", "Modal", "decelerate", { opacity: 0, scale: 0.96, translateY: 16 }, { opacity: 1, scale: 1, translateY: 0 }, true),
  Screen: prim("Normal", "Normal", "standard", { opacity: 0 }, { opacity: 1 }, true),
  Hero: prim("Hero", "Hero", "softOut", { opacity: 0, scale: 0.94, translateY: 20 }, { opacity: 1, scale: 1, translateY: 0 }, true),
  Number: prim("Number", "Slow", "decelerate", {}, {}, false, "value interpolation — native driver off"),
  Progress: prim("Progress", "Normal", "standard", {}, {}, false, "width/progress — native driver off"),
  Fade: prim("Normal", "Normal", "standard", { opacity: 0 }, { opacity: 1 }, true),
  Scale: prim("Card", "Card", "softOut", { scale: 0.92, opacity: 0.9 }, { scale: 1, opacity: 1 }, true),
  Spring: prim("Normal", "Spring", "emphasized", { scale: 0.96 }, { scale: 1 }, true),
  Glass: prim("Card", "Glass", "softOut", { opacity: 0 }, { opacity: 1 }, true),
  Scroll: prim("Fast", "Fast", "linear", {}, {}, true, "scroll-linked; pair with gesture helpers"),
  Tooltip: prim("Tooltip", "Fast", "softOut", { opacity: 0, scale: 0.96, translateY: 4 }, { opacity: 1, scale: 1, translateY: 0 }, true),
  Toast: prim("Toast", "Modal", "decelerate", { opacity: 0, translateY: 12 }, { opacity: 1, translateY: 0 }, true),
  Chart: prim("Chart", "Chart", "decelerate", { opacity: 0 }, { opacity: 1 }, true),
  Calendar: prim("Card", "Card", "standard", { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1 }, true),
  Radar: prim("Chart", "Chart", "softOut", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1 }, true),
  Heatmap: prim("Chart", "Slow", "standard", { opacity: 0 }, { opacity: 1 }, true),
} as const;

export type YdlMotionPrimitive = keyof typeof Motion;
