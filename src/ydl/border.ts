import { ydlColor } from "./color";

/**
 * YouTrader Design Language — border tokens.
 */
export const ydlBorderWidth = {
  none: 0,
  hairline: 1,
  thick: 2,
} as const;

export const ydlBorder = {
  width: ydlBorderWidth,
  color: {
    default: ydlColor.Border,
    strong: ydlColor.BorderStrong,
    divider: ydlColor.Divider,
  },
} as const;
