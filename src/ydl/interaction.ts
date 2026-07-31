/**
 * YouTrader Design Language — Interactive Components System.
 * Shared press / touch / chrome recipes for controls across the app.
 * Does not invent new widgets; standardizes existing interaction language.
 */

import { ydlColor } from "./color";
import { ydlRadius } from "./radius";
import { ydlSpace } from "./space";
import { ydlTypography } from "./typography";
import { getYdlCardInteraction } from "./motion/card";
import { ydlPress, type YdlPressInteraction, type YdlPressToken } from "./motion/press";

/** Minimum Apple HIG-aligned touch target. */
export const ydlTouchTarget = {
  min: 44,
  hitSlopSm: { top: 8, right: 8, bottom: 8, left: 8 },
  hitSlopMd: { top: 10, right: 10, bottom: 10, left: 10 },
  hitSlopLg: { top: 12, right: 12, bottom: 12, left: 12 },
} as const;

export const ydlControlState = {
  disabledOpacity: getYdlCardInteraction("disabled").opacity,
  pressedOpacity: ydlPress.listItem.opacityTo,
} as const;

/**
 * Semantic control kinds mapped onto Motion Foundation press tokens.
 * Use these names in UI code instead of inventing per-screen scales.
 */
export type YdlControlKind =
  | "buttonPrimary"
  | "buttonSecondary"
  | "ghost"
  | "icon"
  | "chip"
  | "pill"
  | "segment"
  | "row"
  | "card";

const CONTROL_TO_PRESS: Record<YdlControlKind, YdlPressToken> = {
  buttonPrimary: "buttonPrimary",
  buttonSecondary: "buttonSecondary",
  ghost: "buttonSecondary",
  icon: "icon",
  chip: "listItem",
  pill: "listItem",
  segment: "listItem",
  row: "listItem",
  card: "card",
};

export function getYdlPressTokenForControl(kind: YdlControlKind): YdlPressToken {
  return CONTROL_TO_PRESS[kind];
}

export function getYdlPressForControl(kind: YdlControlKind): YdlPressInteraction {
  return ydlPress[CONTROL_TO_PRESS[kind]];
}

/**
 * Shared chrome for existing control families (radius / padding / type).
 * Colors stay semantic: Positive for primary CTA legacy, Accent for interaction.
 */
export const ydlControlChrome = {
  button: {
    minHeight: ydlTouchTarget.min,
    borderRadius: ydlRadius.cardCompact,
    paddingVertical: ydlSpace.md,
    paddingHorizontal: ydlSpace.md,
    gap: ydlSpace.xs,
  },
  buttonLabel: {
    ...ydlTypography.callout,
    fontWeight: "700" as const,
  },
  secondaryLabel: {
    ...ydlTypography.callout,
    fontWeight: "600" as const,
    color: ydlColor.TextPrimary,
  },
  iconButton: {
    minHeight: ydlTouchTarget.min,
    minWidth: ydlTouchTarget.min,
    borderRadius: ydlRadius.pill,
  },
  pill: {
    borderRadius: ydlRadius.pill,
    paddingHorizontal: ydlSpace.xs,
    paddingVertical: ydlSpace.xxs + 1,
  },
  pillLabel: {
    ...ydlTypography.caption,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  chip: {
    borderRadius: ydlRadius.pill,
    paddingHorizontal: ydlSpace.sm,
    paddingVertical: ydlSpace.xs,
    minHeight: 36,
  },
  segment: {
    borderRadius: ydlRadius.control,
    paddingVertical: ydlSpace.sm,
    paddingHorizontal: ydlSpace.sm,
    minHeight: ydlTouchTarget.min,
  },
  segmentLabel: {
    ...ydlTypography.callout,
    fontWeight: "600" as const,
    color: ydlColor.TextPrimary,
  },
  /** Interaction accent (purple). Outcome colors stay Positive/Negative. */
  interactionBorder: ydlColor.Accent,
  interactionSoft: ydlColor.AccentGlow,
  surfaceBorder: ydlColor.Border,
  surface: ydlColor.SurfaceSecondary,
} as const;
