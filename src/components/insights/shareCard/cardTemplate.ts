import type { ViewStyle } from "react-native";
import { EXPORT_CARD_HEIGHT, EXPORT_CARD_WIDTH } from "../exportDesign";

export const TRADER_CARD_TEMPLATE = require("../../../../assets/trader-card-template.png");

export const TEMPLATE_NATIVE_WIDTH = 755;
export const TEMPLATE_NATIVE_HEIGHT = 1024;

export type CardSlot = {
  left: number;
  top: number;
  width: number;
  height: number;
  align?: "left" | "center" | "right";
};

export const CARD_LAYOUT = {
  score: { left: 5.2, top: 15.2, width: 17, height: 10, align: "center" as const },
  trdLabel: { left: 6.4, top: 24.8, width: 14, height: 4.5, align: "center" as const },
  tier: { left: 68, top: 16.5, width: 24, height: 7, align: "center" as const },
  totsCover: { left: 34.5, top: 1.8, width: 31, height: 12.5 },
  date: { left: 58, top: 24.5, width: 34, height: 4.5, align: "right" as const },
  emptyMessage: { left: 8, top: 58.5, width: 84, height: 5.5, align: "center" as const },
  stats: [
    { left: 6.8, top: 64.3, width: 27.5, height: 11.2, align: "center" as const },
    { left: 36.2, top: 64.3, width: 27.5, height: 11.2, align: "center" as const },
    { left: 65.6, top: 64.3, width: 27.5, height: 11.2, align: "center" as const },
    { left: 6.8, top: 77.2, width: 27.5, height: 11.2, align: "center" as const },
    { left: 36.2, top: 77.2, width: 27.5, height: 11.2, align: "center" as const },
    { left: 65.6, top: 77.2, width: 27.5, height: 11.2, align: "center" as const },
  ] satisfies CardSlot[],
  footer: { left: 8, top: 90.8, width: 84, height: 8.2, align: "center" as const },
};

export function slotStyle(slot: CardSlot): ViewStyle {
  return {
    position: "absolute",
    left: `${slot.left}%`,
    top: `${slot.top}%`,
    width: `${slot.width}%`,
    height: `${slot.height}%`,
  };
}

export function scaledFont(sizeAtNative: number) {
  return Math.round((sizeAtNative * EXPORT_CARD_WIDTH) / TEMPLATE_NATIVE_WIDTH);
}

export const CARD_TEXT = {
  green: "#B8FF00",
  greenBright: "#9CFF00",
  white: "#F7F8FA",
  purple: "#E056FF",
  red: "#FF4D8D",
  gold: "#F4C95D",
  shadow: "#000000",
};
