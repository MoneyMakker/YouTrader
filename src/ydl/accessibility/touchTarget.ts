import type { AccessibilityRole } from "react-native";
import { YDL_MIN_TOUCH_TARGET } from "./constants";

export type YdlTouchTargetStyle = {
  minWidth: number;
  minHeight: number;
};

/** Style helper for interactive controls targeting ≥ 44×44 pt. */
export function ydlMinTouchTargetStyle(
  size: number = YDL_MIN_TOUCH_TARGET,
): YdlTouchTargetStyle {
  const edge = Math.max(YDL_MIN_TOUCH_TARGET, size);
  return { minWidth: edge, minHeight: edge };
}

/** HitSlop that expands a smaller visual control to an effective 44×44 target. */
export function ydlHitSlopForVisualSize(visualSize: number): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const pad = Math.max(0, Math.ceil((YDL_MIN_TOUCH_TARGET - visualSize) / 2));
  return { top: pad, right: pad, bottom: pad, left: pad };
}

export function ydlAccessibilityRole(
  kind: "button" | "link" | "header" | "image" | "text" | "adjustable" | "summary",
): AccessibilityRole {
  return kind;
}
