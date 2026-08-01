import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ydlStatusInline } from "../../../ydl/status";
import { ydlTypography } from "../../../ydl/typography";
import { AnimatedPressable } from "./AnimatedPressable";

export type StatusInlineKind = "error" | "warning" | "info";

export type StatusInlineMessageProps = {
  message: string;
  title?: string;
  kind?: StatusInlineKind;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Calm inline feedback for errors / warnings.
 * Preserves existing retry handlers — presentation only.
 */
export function StatusInlineMessage({
  message,
  title,
  kind = "error",
  actionLabel,
  onActionPress,
  style,
}: StatusInlineMessageProps) {
  const tone = ydlStatusInline[kind];
  const a11y = title ? `${title}. ${message}` : message;

  return (
    <View
      style={[
        styles.root,
        {
          borderColor: tone.borderColor,
          backgroundColor: tone.backgroundColor,
        },
        style,
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={a11y}
    >
      {title ? (
        <Text style={[styles.title, { color: tone.titleColor }]} maxFontSizeMultiplier={1.3} importantForAccessibility="no">
          {title}
        </Text>
      ) : null}
      <Text style={[styles.body, { color: tone.bodyColor }]} maxFontSizeMultiplier={1.25} importantForAccessibility="no">
        {message}
      </Text>
      {actionLabel && onActionPress ? (
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onActionPress}
          haptic
          style={styles.actionPressable}
          contentStyle={styles.action}
        >
          <Text style={[styles.actionText, { color: tone.accent }]}>{actionLabel}</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: ydlStatusInline.borderWidth,
    borderRadius: ydlStatusInline.borderRadius,
    padding: ydlStatusInline.padding,
    gap: ydlStatusInline.gap,
  },
  title: {
    ...ydlTypography.callout,
    fontWeight: "600",
  },
  body: {
    ...ydlTypography.footnote,
  },
  actionPressable: {
    marginTop: 4,
    alignSelf: "flex-start",
  },
  action: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  actionText: {
    ...ydlTypography.callout,
    fontWeight: "600",
  },
});
