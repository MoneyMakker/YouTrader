/**
 * YouTrader Design Language — Loading / Empty / Error status system.
 * Tokens + recipes only. UI lives in `src/components/ui/premium`.
 * Does not change networking, retry, or business logic.
 */

import { ydlColor } from "./color";
import { ydlRadius } from "./radius";
import { ydlSpace } from "./space";
import { ydlTypography } from "./typography";
import { ydlTouchTarget } from "./interaction";
import { getYdlProgressMotionConfig } from "./motion/progress";

export type YdlStatusKind = "loading" | "empty" | "error" | "offline";

export type YdlSpinnerSize = "sm" | "md";
export type YdlSpinnerVariant = "default" | "muted" | "onLight";

/** ActivityIndicator size map (RN small/large). */
export const ydlSpinnerSizeMap: Record<YdlSpinnerSize, "small" | "large"> = {
  sm: "small",
  md: "large",
};

export const ydlStatusSpinner = {
  sizeDefault: "sm" as YdlSpinnerSize,
  color: ydlColor.Positive,
  colorMuted: ydlColor.TextMuted,
  colorOnLight: "#000000",
  marginBlock: ydlSpace.sm,
};

export const ydlStatusLoadingBar = {
  height: 4,
  heightEmphasized: 6,
  track: "rgba(255,255,255,0.075)",
  durationMs: getYdlProgressMotionConfig("linear").durationMs,
};

export const ydlStatusSkeleton = {
  rowHeight: 9,
  avatar: 44,
  gap: ydlSpace.sm,
  radius: ydlRadius.chip,
  baseFill: "rgba(255,255,255,0.055)",
};

/**
 * Shared hierarchy for empty / error / offline blocks:
 * Title → Explanation → Action
 */
export const ydlStatusBlock = {
  gap: ydlSpace.sm,
  paddingVertical: ydlSpace.md,
  paddingHorizontal: ydlSpace.md,
  iconShell: 48,
  iconRadius: ydlRadius.cardCompact,
  title: {
    ...ydlTypography.headline,
    textAlign: "center" as const,
    // RN Text defaults to black — must set explicit dark-terminal ink.
    color: ydlColor.TextPrimary,
  },
  body: {
    ...ydlTypography.footnote,
    textAlign: "center" as const,
    color: ydlColor.TextSecondary,
  },
  meta: {
    ...ydlTypography.caption,
    textAlign: "center" as const,
    color: ydlColor.TextMuted,
  },
  actionMinHeight: ydlTouchTarget.min,
};

/** Calm inline feedback — never full red surfaces. */
export const ydlStatusInline = {
  gap: ydlSpace.xxs,
  padding: ydlSpace.sm,
  borderRadius: ydlRadius.cardCompact,
  borderWidth: 1,
  error: {
    borderColor: ydlColor.Border,
    backgroundColor: ydlColor.SurfaceSecondary,
    titleColor: ydlColor.TextPrimary,
    bodyColor: ydlColor.TextSecondary,
    accent: ydlColor.Warning,
  },
  warning: {
    borderColor: ydlColor.Border,
    backgroundColor: ydlColor.SurfaceSecondary,
    titleColor: ydlColor.TextPrimary,
    bodyColor: ydlColor.TextSecondary,
    accent: ydlColor.Warning,
  },
  info: {
    borderColor: ydlColor.Border,
    backgroundColor: ydlColor.SurfaceSecondary,
    titleColor: ydlColor.TextPrimary,
    bodyColor: ydlColor.TextSecondary,
    accent: ydlColor.Accent,
  },
} as const;

export function getYdlSpinnerColor(variant: YdlSpinnerVariant = "default"): string {
  if (variant === "onLight") return ydlStatusSpinner.colorOnLight;
  if (variant === "muted") return ydlStatusSpinner.colorMuted;
  return ydlStatusSpinner.color;
}

export const ydlStatus = {
  spinner: ydlStatusSpinner,
  spinnerSizeMap: ydlSpinnerSizeMap,
  loadingBar: ydlStatusLoadingBar,
  skeleton: ydlStatusSkeleton,
  block: ydlStatusBlock,
  inline: ydlStatusInline,
  getSpinnerColor: getYdlSpinnerColor,
} as const;
