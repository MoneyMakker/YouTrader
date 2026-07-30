/**
 * Phase 6 — shared accessibility / interaction contracts for YDL primitives.
 * Documentation + static values for QA (not a runtime store).
 */

import { YDL_MIN_TOUCH_TARGET } from "../accessibility";

export const YDL_TOUCH_TARGET_MIN = YDL_MIN_TOUCH_TARGET;

/** Recommended max simultaneous pulsed skeletons on one screen. */
export const YDL_SKELETON_MAX_ANIMATED = 4;

export type YdlPrimitiveName =
  | "YdlText"
  | "YdlButton"
  | "YdlCard"
  | "YdlBadge"
  | "YdlChip"
  | "YdlListItem"
  | "YdlEmptyState"
  | "YdlSkeleton"
  | "YdlBanner";

/** Reduce Motion matrix — expected behavior when system Reduce Motion is on. */
export const YDL_REDUCE_MOTION_MATRIX: Record<YdlPrimitiveName, string> = {
  YdlText: "no motion",
  YdlButton: "no scale travel; opacity/state feedback only",
  YdlCard: "no scale travel when interactive",
  YdlBadge: "no motion",
  YdlChip: "no scale travel",
  YdlListItem: "no scale travel",
  YdlEmptyState: "no decorative entrance requirement",
  YdlSkeleton: "static placeholder only",
  YdlBanner: "immediate / minimal appearance",
};

export const YDL_A11Y_MATRIX: Record<
  YdlPrimitiveName,
  {
    defaultRole: string;
    requiresLabel: boolean;
    exposesSelected?: boolean;
    exposesBusy?: boolean;
    decorativeIconsHidden: boolean;
  }
> = {
  YdlText: {
    defaultRole: "text",
    requiresLabel: false,
    decorativeIconsHidden: true,
  },
  YdlButton: {
    defaultRole: "button",
    requiresLabel: true,
    exposesBusy: true,
    decorativeIconsHidden: true,
  },
  YdlCard: {
    defaultRole: "none|button(interactive)",
    requiresLabel: true, // when interactive
    exposesSelected: true,
    decorativeIconsHidden: true,
  },
  YdlBadge: {
    defaultRole: "text",
    requiresLabel: true,
    decorativeIconsHidden: true,
  },
  YdlChip: {
    defaultRole: "button|none(static)",
    requiresLabel: true,
    exposesSelected: true,
    decorativeIconsHidden: true,
  },
  YdlListItem: {
    defaultRole: "button|summary",
    requiresLabel: true,
    exposesSelected: true,
    decorativeIconsHidden: true,
  },
  YdlEmptyState: {
    defaultRole: "summary",
    requiresLabel: false,
    decorativeIconsHidden: true,
  },
  YdlSkeleton: {
    defaultRole: "none (hidden)",
    requiresLabel: false,
    decorativeIconsHidden: true,
  },
  YdlBanner: {
    defaultRole: "summary",
    requiresLabel: true,
    decorativeIconsHidden: true,
  },
};
