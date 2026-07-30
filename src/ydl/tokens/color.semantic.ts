import { ydlPrimitiveColor, type YdlPrimitiveColorName } from "./color.primitive";

/**
 * Semantic color roles — feature code should use these (via theme), not primitives.
 */
export type YdlSemanticColors = {
  background: {
    primary: string;
    secondary: string;
    elevated: string;
    overlay: string;
  };
  surface: {
    card: string;
    interactive: string;
    selected: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };
  border: {
    subtle: string;
    strong: string;
  };
  icon: {
    primary: string;
    secondary: string;
  };
  action: {
    primary: string;
    primaryPressed: string;
    primaryText: string;
    secondary: string;
    secondaryPressed: string;
    secondaryText: string;
    tertiaryText: string;
    disabled: string;
    disabledText: string;
    destructive: string;
    destructivePressed: string;
    destructiveText: string;
  };
  status: {
    positive: string;
    positiveSoft: string;
    negative: string;
    negativeSoft: string;
    warning: string;
    warningSoft: string;
    info: string;
    infoSoft: string;
  };
  chart: {
    profit: string;
    loss: string;
    neutral: string;
  };
};

export const ydlSemanticColorsDark: YdlSemanticColors = {
  background: {
    primary: ydlPrimitiveColor.neutral0,
    secondary: ydlPrimitiveColor.neutral100,
    elevated: ydlPrimitiveColor.neutral250,
    overlay: ydlPrimitiveColor.overlayDark,
  },
  surface: {
    card: ydlPrimitiveColor.neutral100,
    interactive: ydlPrimitiveColor.neutral200,
    selected: ydlPrimitiveColor.neutral300,
  },
  text: {
    primary: ydlPrimitiveColor.neutral900,
    secondary: ydlPrimitiveColor.neutral800,
    tertiary: ydlPrimitiveColor.neutral700,
    inverse: ydlPrimitiveColor.neutral0,
  },
  border: {
    subtle: ydlPrimitiveColor.neutral400,
    strong: ydlPrimitiveColor.neutral500,
  },
  icon: {
    primary: ydlPrimitiveColor.neutral900,
    secondary: ydlPrimitiveColor.neutral800,
  },
  action: {
    primary: ydlPrimitiveColor.accent400,
    primaryPressed: ydlPrimitiveColor.accentPressed,
    primaryText: ydlPrimitiveColor.white,
    secondary: ydlPrimitiveColor.neutral200,
    secondaryPressed: ydlPrimitiveColor.neutral250,
    secondaryText: ydlPrimitiveColor.neutral900,
    tertiaryText: ydlPrimitiveColor.accent400,
    disabled: ydlPrimitiveColor.neutral400,
    disabledText: ydlPrimitiveColor.neutral700,
    destructive: ydlPrimitiveColor.red400,
    destructivePressed: ydlPrimitiveColor.redPressed,
    destructiveText: ydlPrimitiveColor.white,
  },
  status: {
    positive: ydlPrimitiveColor.green400,
    positiveSoft: ydlPrimitiveColor.greenSoft,
    negative: ydlPrimitiveColor.red400,
    negativeSoft: ydlPrimitiveColor.redSoft,
    warning: ydlPrimitiveColor.amber400,
    warningSoft: ydlPrimitiveColor.amberSoft,
    info: ydlPrimitiveColor.blue400,
    infoSoft: ydlPrimitiveColor.blueSoft,
  },
  chart: {
    profit: ydlPrimitiveColor.green400,
    loss: ydlPrimitiveColor.red400,
    neutral: ydlPrimitiveColor.neutral800,
  },
};

export const ydlSemanticColorsLight: YdlSemanticColors = {
  background: {
    primary: ydlPrimitiveColor.light50,
    secondary: ydlPrimitiveColor.light100,
    elevated: ydlPrimitiveColor.white,
    overlay: ydlPrimitiveColor.overlayLight,
  },
  surface: {
    card: ydlPrimitiveColor.white,
    interactive: ydlPrimitiveColor.light100,
    selected: ydlPrimitiveColor.light200,
  },
  text: {
    primary: ydlPrimitiveColor.lightInk,
    secondary: ydlPrimitiveColor.lightInkMuted,
    tertiary: ydlPrimitiveColor.neutral700,
    inverse: ydlPrimitiveColor.neutral950,
  },
  border: {
    subtle: ydlPrimitiveColor.light200,
    strong: ydlPrimitiveColor.light300,
  },
  icon: {
    primary: ydlPrimitiveColor.lightInk,
    secondary: ydlPrimitiveColor.lightInkMuted,
  },
  action: {
    primary: ydlPrimitiveColor.accent400,
    primaryPressed: ydlPrimitiveColor.accentPressed,
    primaryText: ydlPrimitiveColor.white,
    secondary: ydlPrimitiveColor.light100,
    secondaryPressed: ydlPrimitiveColor.light200,
    secondaryText: ydlPrimitiveColor.lightInk,
    tertiaryText: ydlPrimitiveColor.accent400,
    disabled: ydlPrimitiveColor.light200,
    disabledText: ydlPrimitiveColor.neutral700,
    destructive: ydlPrimitiveColor.red400,
    destructivePressed: ydlPrimitiveColor.redPressed,
    destructiveText: ydlPrimitiveColor.white,
  },
  status: {
    positive: "#1B8A2E",
    positiveSoft: "rgba(27,138,46,0.12)",
    negative: "#C6284A",
    negativeSoft: "rgba(198,40,74,0.12)",
    warning: "#B8860B",
    warningSoft: "rgba(184,134,11,0.14)",
    info: "#2F6FED",
    infoSoft: "rgba(47,111,237,0.12)",
  },
  chart: {
    profit: "#1B8A2E",
    loss: "#C6284A",
    neutral: ydlPrimitiveColor.lightInkMuted,
  },
};

/** Dot-path keys used by resolveYdlSemanticColor. */
export type YdlSemanticColorPath =
  | `background.${keyof YdlSemanticColors["background"]}`
  | `surface.${keyof YdlSemanticColors["surface"]}`
  | `text.${keyof YdlSemanticColors["text"]}`
  | `border.${keyof YdlSemanticColors["border"]}`
  | `icon.${keyof YdlSemanticColors["icon"]}`
  | `action.${keyof YdlSemanticColors["action"]}`
  | `status.${keyof YdlSemanticColors["status"]}`
  | `chart.${keyof YdlSemanticColors["chart"]}`;

export function resolveYdlSemanticColor(
  colors: YdlSemanticColors,
  path: string,
): { color: string; known: boolean } {
  const [group, key] = path.split(".");
  if (!group || !key) {
    return { color: colors.text.primary, known: false };
  }
  const bucket = (colors as Record<string, Record<string, string>>)[group];
  if (!bucket || typeof bucket[key] !== "string") {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(`[YdlTokens] Unknown semantic color "${path}" — falling back to text.primary`);
    }
    return { color: colors.text.primary, known: false };
  }
  return { color: bucket[key], known: true };
}

/** Flat legacy map for older ydlColor imports (dark terminal). */
export const ydlColor = {
  Background: ydlSemanticColorsDark.background.primary,
  BackgroundSecondary: ydlSemanticColorsDark.background.secondary,
  Surface: ydlSemanticColorsDark.surface.card,
  SurfaceSecondary: ydlSemanticColorsDark.surface.interactive,
  SurfaceElevated: ydlSemanticColorsDark.background.elevated,
  SurfaceFloating: ydlSemanticColorsDark.background.elevated,
  Border: ydlSemanticColorsDark.border.subtle,
  BorderStrong: ydlSemanticColorsDark.border.strong,
  Divider: ydlSemanticColorsDark.border.subtle,
  Accent: ydlSemanticColorsDark.action.primary,
  AccentGlow: ydlPrimitiveColor.accentSoft,
  Positive: ydlSemanticColorsDark.status.positive,
  PositiveSoft: ydlSemanticColorsDark.status.positiveSoft,
  Negative: ydlSemanticColorsDark.status.negative,
  NegativeSoft: ydlSemanticColorsDark.status.negativeSoft,
  Warning: ydlSemanticColorsDark.status.warning,
  WarningSoft: ydlSemanticColorsDark.status.warningSoft,
  Info: ydlSemanticColorsDark.status.info,
  TextPrimary: ydlSemanticColorsDark.text.primary,
  TextSecondary: ydlSemanticColorsDark.text.secondary,
  TextMuted: ydlSemanticColorsDark.text.tertiary,
  White: ydlPrimitiveColor.white,
} as const;

export type YdlColorToken = keyof typeof ydlColor;

export type { YdlPrimitiveColorName };
