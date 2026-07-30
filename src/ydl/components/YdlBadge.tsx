import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { YdlSymbol, type YdlSemanticSymbol } from "../symbols";
import { useYdlTheme, type YdlAppearance } from "../tokens";
import { YdlText } from "./YdlText";

export type YdlBadgeTone = "neutral" | "positive" | "negative" | "warning" | "info";

export type YdlBadgeProps = {
  label: string;
  tone?: YdlBadgeTone;
  symbol?: YdlSemanticSymbol;
  appearance?: YdlAppearance;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const TONE_SYMBOL: Record<YdlBadgeTone, YdlSemanticSymbol> = {
  neutral: "info",
  positive: "success",
  negative: "loss",
  warning: "warning",
  info: "info",
};

export function YdlBadge({
  label,
  tone = "neutral",
  symbol,
  appearance,
  style,
  testID,
}: YdlBadgeProps) {
  const theme = useYdlTheme(appearance);
  const status = theme.colors.status;
  const palette = {
    neutral: { fg: theme.colors.text.secondary, bg: theme.colors.surface.interactive },
    positive: { fg: status.positive, bg: status.positiveSoft },
    negative: { fg: status.negative, bg: status.negativeSoft },
    warning: { fg: status.warning, bg: status.warningSoft },
    info: { fg: status.info, bg: status.infoSoft },
  }[tone];

  const glyph = symbol ?? TONE_SYMBOL[tone];
  const a11y = `${tone}: ${label}`;

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={a11y}
      style={[
        styles.badge,
        {
          backgroundColor: palette.bg,
          borderColor: palette.fg,
          borderRadius: theme.radius.pill,
        },
        style,
      ]}
    >
      <YdlSymbol name={glyph} size="sm" tintColor={palette.fg} decorative />
      <YdlText
        role="labelEmphasized"
        appearance={appearance}
        style={{ color: palette.fg, flexShrink: 1 }}
      >
        {label}
      </YdlText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "100%",
  },
});
