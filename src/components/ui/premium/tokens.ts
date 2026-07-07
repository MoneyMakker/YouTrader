import { C } from "../../../theme/colors";

export type PremiumTone = "lime" | "purple" | "red" | "yellow" | "neutral";

export const premiumTone = {
  lime: {
    accent: C.green,
    soft: C.greenSoft,
    border: "rgba(163,255,18,0.30)",
    shadow: "rgba(163,255,18,0.22)",
  },
  purple: {
    accent: C.purple,
    soft: C.purpleSoft,
    border: "rgba(176,38,255,0.30)",
    shadow: "rgba(176,38,255,0.22)",
  },
  red: {
    accent: C.red,
    soft: C.redSoft,
    border: "rgba(255,59,95,0.28)",
    shadow: "rgba(255,59,95,0.20)",
  },
  yellow: {
    accent: C.yellow,
    soft: C.yellowSoft,
    border: "rgba(255,209,102,0.28)",
    shadow: "rgba(255,209,102,0.18)",
  },
  neutral: {
    accent: C.text,
    soft: "rgba(255,255,255,0.08)",
    border: C.border,
    shadow: "rgba(0,0,0,0.28)",
  },
} as const;

export const premiumRadii = {
  sm: 14,
  md: 18,
  lg: 24,
  xl: 28,
} as const;
