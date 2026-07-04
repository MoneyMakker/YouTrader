import type { ImageStyle, ViewStyle } from "react-native";
import { EXPORT_CARD_HEIGHT, EXPORT_CARD_WIDTH } from "../exportDesign";

export const STAT_DARK_BULL_TEMPLATE = require("../../../../assets/share-templates/youtrader-dark-bull-stat-template.png");

export const STAT_TEMPLATE_NATIVE_WIDTH = 663;
export const STAT_TEMPLATE_NATIVE_HEIGHT = 1024;

export const STAT_EXPORT_WIDTH = EXPORT_CARD_WIDTH;
export const STAT_EXPORT_HEIGHT = EXPORT_CARD_HEIGHT;

export type StatSlot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Six bottom stat boxes only — do not overlay bull, plaque, or border art. */
export const STAT_BOX_SLOTS: StatSlot[] = [
  { left: 7.2, top: 66.8, width: 26.8, height: 10.8 },
  { left: 36.6, top: 66.8, width: 26.8, height: 10.8 },
  { left: 66.0, top: 66.8, width: 26.8, height: 10.8 },
  { left: 7.2, top: 79.2, width: 26.8, height: 10.8 },
  { left: 36.6, top: 79.2, width: 26.8, height: 10.8 },
  { left: 66.0, top: 79.2, width: 26.8, height: 10.8 },
];

export function statSlotStyle(slot: StatSlot): ViewStyle {
  return {
    position: "absolute",
    left: `${slot.left}%`,
    top: `${slot.top}%`,
    width: `${slot.width}%`,
    height: `${slot.height}%`,
  };
}

export function statScaledFont(sizeAtNative: number) {
  return Math.round((sizeAtNative * STAT_EXPORT_WIDTH) / STAT_TEMPLATE_NATIVE_WIDTH);
}

export function statTemplateImageStyle(): ImageStyle {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    width: STAT_EXPORT_WIDTH,
    height: STAT_EXPORT_HEIGHT,
  };
}

export const STAT_TEXT = {
  green: "#B8FF00",
  white: "#F7F8FA",
  purple: "#E056FF",
  red: "#FF4D8D",
  gold: "#F4C95D",
  label: "rgba(247,248,250,0.72)",
  shadow: "#000000",
};
