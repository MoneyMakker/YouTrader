import React from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

export type YdlSectionHeaderProps = {
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  /** Override title color (e.g. sheet appearance). */
  tintColor?: string;
  testID?: string;
};

export function YdlSectionHeader({
  title,
  subtitle,
  style,
  titleStyle,
  tintColor,
  testID,
}: YdlSectionHeaderProps) {
  return (
    <View testID={testID} style={[styles.wrap, style]} accessibilityRole="header">
      <Text
        style={[styles.title, tintColor ? { color: tintColor } : null, titleStyle]}
        allowFontScaling
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} allowFontScaling>
          {subtitle}
        </Text>
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
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#F4F7F5",
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 14,
    color: "#9AA3AD",
  },
});
