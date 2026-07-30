import { ydlDuration } from "./tokens";

/**
 * iPad / pointer hover interaction tokens.
 * Map onto Pressable onHoverIn / onHoverOut in a later phase.
 */
export type YdlHoverInteraction = {
  scaleTo: number;
  opacityTo: number;
  durationMs: number;
  /** Elevation hint for consumers (YDL elevation token name). */
  elevationHint: "none" | "low" | "medium";
};

export const ydlHover = {
  card: {
    scaleTo: 1.01,
    opacityTo: 1,
    durationMs: ydlDuration.Fast,
    elevationHint: "low",
  },
  button: {
    scaleTo: 1.02,
    opacityTo: 1,
    durationMs: ydlDuration.Fast,
    elevationHint: "none",
  },
  listItem: {
    scaleTo: 1,
    opacityTo: 0.92,
    durationMs: ydlDuration.Fast,
    elevationHint: "none",
  },
  chip: {
    scaleTo: 1.03,
    opacityTo: 1,
    durationMs: ydlDuration.Tooltip,
    elevationHint: "none",
  },
} as const satisfies Record<string, YdlHoverInteraction>;

export type YdlHoverToken = keyof typeof ydlHover;
