import type { TextStyle } from "react-native";

/**
 * Semantic typography roles — sizes only as defaults.
 * Prefer soft lineHeights (≥ ~1.3×) so Dynamic Type does not clip.
 * Financial numbers: numericLarge / numeric / numericCompact (+ tabular).
 */

export type YdlTypographyRole =
  | "display"
  | "titleLarge"
  | "title"
  | "heading"
  | "body"
  | "bodyEmphasized"
  | "callout"
  | "label"
  | "labelEmphasized"
  | "caption"
  | "numericLarge"
  | "numeric"
  | "numericCompact";

type RoleStyle = Pick<TextStyle, "fontSize" | "lineHeight" | "fontWeight" | "letterSpacing"> & {
  fontVariant?: TextStyle["fontVariant"];
};

function role(size: number, weight: TextStyle["fontWeight"], tracking = 0): RoleStyle {
  return {
    fontSize: size,
    lineHeight: Math.round(size * 1.35),
    fontWeight: weight,
    letterSpacing: tracking,
  };
}

export const ydlTypographyRoles: Record<YdlTypographyRole, RoleStyle> = {
  display: role(34, "700", -0.5),
  titleLarge: role(28, "700", -0.4),
  title: role(22, "700", -0.3),
  heading: role(18, "600", -0.2),
  body: role(16, "400", 0),
  bodyEmphasized: role(16, "600", 0),
  callout: role(14, "500", 0),
  label: role(12, "500", 0.3),
  labelEmphasized: role(12, "700", 0.4),
  caption: role(11, "500", 0.2),
  numericLarge: {
    ...role(28, "700", -0.5),
    fontVariant: ["tabular-nums"],
  },
  numeric: {
    ...role(16, "600", -0.2),
    fontVariant: ["tabular-nums"],
  },
  numericCompact: {
    ...role(13, "600", -0.1),
    fontVariant: ["tabular-nums"],
  },
};

/** Legacy map used by older imports. */
export const ydlFontSize = {
  caption: 11,
  footnote: 12,
  subhead: 13,
  callout: 14,
  body: 16,
  title3: 18,
  title2: 20,
  title1: 24,
  largeTitle: 28,
  display: 34,
  heroMetric: 40,
} as const;

export const ydlTypography = {
  caption: ydlTypographyRoles.caption,
  footnote: ydlTypographyRoles.label,
  label: ydlTypographyRoles.labelEmphasized,
  body: ydlTypographyRoles.body,
  callout: ydlTypographyRoles.callout,
  headline: ydlTypographyRoles.heading,
  title: { ...ydlTypographyRoles.title, fontSize: 24, lineHeight: 32 },
  largeTitle: ydlTypographyRoles.titleLarge,
  metric: {
    fontSize: ydlFontSize.heroMetric,
    lineHeight: Math.round(ydlFontSize.heroMetric * 1.1),
    fontWeight: "700" as const,
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
  },
} as const;

export type YdlTypographyToken = keyof typeof ydlTypography;

export function resolveYdlTypographyRole(roleName: string): {
  style: RoleStyle;
  known: boolean;
} {
  if (roleName in ydlTypographyRoles) {
    return {
      style: ydlTypographyRoles[roleName as YdlTypographyRole],
      known: true,
    };
  }
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn(`[YdlTokens] Unknown typography role "${roleName}" — falling back to body`);
  }
  return { style: ydlTypographyRoles.body, known: false };
}
