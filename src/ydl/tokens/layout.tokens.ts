import { YDL_MIN_TOUCH_TARGET } from "../accessibility/constants";
import { ydlSpace } from "./spacing.tokens";

export const ydlLayout = {
  minTouchTarget: YDL_MIN_TOUCH_TARGET,
  maxContentWidth: 720,
  iconSize: {
    sm: 16,
    md: 20,
    lg: 24,
  },
  screenPaddingX: ydlSpace[16],
  screenPaddingY: ydlSpace[16],
  sectionGap: ydlSpace[24],
  cardGap: ydlSpace[12],
  chipGap: ydlSpace[8],
  tabBarClearance: 72,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
} as const;

export type YdlLayoutToken = keyof typeof ydlLayout;
