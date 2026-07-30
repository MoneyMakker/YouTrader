/**
 * Primitive palette — not for feature import.
 * Prefer semantic colors via theme / ydlSemanticColors.
 * Values preserve established YouTrader terminal branding.
 */

export const ydlPrimitiveColor = {
  // Neutral (terminal dark family — intentional near-black brand)
  neutral0: "#000000",
  neutral50: "#05070A",
  neutral100: "#090A0C",
  neutral150: "#0E141D",
  neutral200: "#101216",
  neutral250: "#15181D",
  neutral300: "#1F2A3A",
  neutral400: "#242932",
  neutral500: "#2F3540",
  neutral600: "#3A4558",
  neutral700: "#5B6570",
  neutral800: "#9AA3AD",
  neutral850: "#A7B0C0",
  neutral900: "#F4F7F5",
  neutral950: "#F4F7FB",
  // Light surfaces
  light50: "#F7F8FA",
  light100: "#EEF1F5",
  light200: "#D7DCE5",
  light300: "#C5CAD3",
  lightInk: "#0E141D",
  lightInkMuted: "#4A5568",
  // Accent (brand purple)
  accent400: "#B026FF",
  accentSoft: "rgba(176,38,255,0.12)",
  accentPressed: "#9A1FE0",
  // Positive / green
  green400: "#A3FF12",
  greenSoft: "rgba(163,255,18,0.13)",
  // Negative / red
  red400: "#FF3B5F",
  redSoft: "rgba(255,59,95,0.11)",
  redPressed: "#E03252",
  // Warning / amber
  amber400: "#FFD23F",
  amberSoft: "rgba(255,210,63,0.11)",
  // Info / blue (restrained — not a second brand)
  blue400: "#5B9FFF",
  blueSoft: "rgba(91,159,255,0.14)",
  // Overlay
  overlayDark: "rgba(0,0,0,0.55)",
  overlayLight: "rgba(15,23,35,0.35)",
  white: "#FFFFFF",
  transparent: "transparent",
} as const;

export type YdlPrimitiveColorName = keyof typeof ydlPrimitiveColor;

/** @deprecated Bridge name — same as ydlPrimitive terminal core. */
export const ydlCore = {
  bg: ydlPrimitiveColor.neutral0,
  card: ydlPrimitiveColor.neutral100,
  card2: ydlPrimitiveColor.neutral200,
  card3: ydlPrimitiveColor.neutral250,
  border: ydlPrimitiveColor.neutral400,
  text: ydlPrimitiveColor.neutral900,
  sub: ydlPrimitiveColor.neutral800,
  muted: ydlPrimitiveColor.neutral700,
  green: ydlPrimitiveColor.green400,
  greenSoft: ydlPrimitiveColor.greenSoft,
  red: ydlPrimitiveColor.red400,
  redSoft: ydlPrimitiveColor.redSoft,
  yellow: ydlPrimitiveColor.amber400,
  yellowSoft: ydlPrimitiveColor.amberSoft,
  purple: ydlPrimitiveColor.accent400,
  purpleSoft: ydlPrimitiveColor.accentSoft,
  orange: "#FF9F1A",
  white: ydlPrimitiveColor.white,
} as const;

/** Graphite legacy — pixel-identical; do not change. */
export const ydlLegacyGraphite = {
  bg: "#05070A",
  card: "#0B0F14",
  card2: "#11161F",
  text: "#F4F4F5",
  sub: "#9CA3AF",
  muted: "#6B7280",
  white: "#FFFFFF",
  green: "#A3FF12",
  greenSoft: "rgba(163,255,18,0.12)",
  purple: "#B026FF",
  purpleSoft: "rgba(176,38,255,0.14)",
  red: "#FF3B5F",
  redSoft: "rgba(255,59,95,0.14)",
  yellow: "#FFD166",
  yellowSoft: "rgba(255,209,102,0.14)",
  border: "rgba(255,255,255,0.10)",
} as const;
