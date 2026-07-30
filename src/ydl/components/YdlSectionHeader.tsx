import React from "react";
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useYdlTheme, type YdlAppearance } from "../tokens";
import { YdlText } from "./YdlText";

export type YdlSectionHeaderProps = {
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  /** Override title color (e.g. sheet appearance). */
  tintColor?: string;
  appearance?: YdlAppearance;
  testID?: string;
};

export function YdlSectionHeader({
  title,
  subtitle,
  style,
  titleStyle,
  tintColor,
  appearance,
  testID,
}: YdlSectionHeaderProps) {
  const theme = useYdlTheme(appearance);

  return (
    <View testID={testID} style={[styles.wrap, style]} accessibilityRole="header">
      <YdlText
        role="heading"
        appearance={appearance}
        style={[
          { color: tintColor ?? theme.colors.text.primary, fontWeight: "800" },
          titleStyle,
        ]}
      >
        {title}
      </YdlText>
      {subtitle ? (
        <YdlText role="caption" color="text.secondary" appearance={appearance}>
          {subtitle}
        </YdlText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
    paddingVertical: 6,
    flexShrink: 1,
    minWidth: 0,
  },
});
