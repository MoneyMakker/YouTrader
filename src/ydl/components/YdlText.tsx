import React from "react";
import { Text, type StyleProp, type TextProps, type TextStyle } from "react-native";
import {
  resolveYdlSemanticColor,
  resolveYdlTypographyRole,
  useYdlTheme,
  type YdlAppearance,
  type YdlSemanticColorPath,
  type YdlTypographyRole,
} from "../tokens";

export type YdlTextProps = {
  children: React.ReactNode;
  role?: YdlTypographyRole;
  color?: YdlSemanticColorPath;
  appearance?: YdlAppearance;
  align?: TextStyle["textAlign"];
  numberOfLines?: number;
  tabular?: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: TextProps["accessibilityRole"];
};

/**
 * Semantic text — roles from tokens, colors from theme.
 * Font scaling enabled; no global scale cap.
 */
export function YdlText({
  children,
  role = "body",
  color = "text.primary",
  appearance,
  align,
  numberOfLines,
  tabular = false,
  style,
  testID,
  accessibilityLabel,
  accessibilityRole = "text",
}: YdlTextProps) {
  const theme = useYdlTheme(appearance);
  const { style: roleStyle } = resolveYdlTypographyRole(role);
  const { color: resolvedColor } = resolveYdlSemanticColor(theme.colors, color);

  return (
    <Text
      testID={testID}
      allowFontScaling
      numberOfLines={numberOfLines}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[
        roleStyle,
        { color: resolvedColor, textAlign: align },
        tabular || role.startsWith("numeric")
          ? { fontVariant: ["tabular-nums"] }
          : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
