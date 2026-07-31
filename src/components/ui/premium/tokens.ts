import { C } from "../../../theme/colors";
import { ydlRadiusScale } from "../../../ydl/radius";
import { ydlShadowColor, ydlToneBorder } from "../../../ydl/elevation";

export type PremiumTone = "lime" | "purple" | "red" | "yellow" | "neutral";

export const premiumTone = {
  lime: {
    accent: C.green,
    soft: C.greenSoft,
    border: ydlToneBorder.lime,
    shadow: ydlShadowColor.lime,
  },
  purple: {
    accent: C.purple,
    soft: C.purpleSoft,
    border: ydlToneBorder.purple,
    shadow: ydlShadowColor.purple,
  },
  red: {
    accent: C.red,
    soft: C.redSoft,
    border: ydlToneBorder.red,
    shadow: ydlShadowColor.red,
  },
  yellow: {
    accent: C.yellow,
    soft: C.yellowSoft,
    border: ydlToneBorder.yellow,
    shadow: ydlShadowColor.yellow,
  },
  neutral: {
    accent: C.text,
    soft: "rgba(255,255,255,0.08)",
    border: ydlToneBorder.neutral,
    shadow: ydlShadowColor.neutral,
  },
} as const;

export const premiumRadii = {
  sm: ydlRadiusScale.sm,
  md: ydlRadiusScale.md,
  lg: ydlRadiusScale.lg,
  xl: ydlRadiusScale.xl,
} as const;
