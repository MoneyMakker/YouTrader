import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ydlStatusBlock } from "../../../ydl/status";
import { ydlSpace } from "../../../ydl/space";
import { AnimatedPressable } from "./AnimatedPressable";
import { PremiumCard } from "./PremiumCard";
import { premiumTone, type PremiumTone } from "./tokens";

export type EmptyStateCardProps = {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
  tone?: PremiumTone;
  /** empty = possibility; error = calm recovery (no alarming red surface). */
  kind?: "empty" | "error";
  style?: StyleProp<ViewStyle>;
};

export function EmptyStateCard({
  title,
  message,
  icon,
  actionLabel,
  onActionPress,
  tone = "purple",
  kind = "empty",
  style,
}: EmptyStateCardProps) {
  const toneConfig = premiumTone[tone];
  const a11y = message ? `${title}. ${message}` : title;

  return (
    <PremiumCard
      tone={kind === "error" ? "neutral" : tone}
      style={[styles.card, style]}
      contentStyle={styles.content}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={a11y}
      accessibilityLiveRegion={kind === "error" ? "polite" : undefined}
    >
      {icon ? (
        <View
          style={[styles.iconShell, { backgroundColor: toneConfig.soft }]}
          importantForAccessibility="no"
        >
          {icon}
        </View>
      ) : null}
      <Text style={styles.title} maxFontSizeMultiplier={1.3} importantForAccessibility="no">
        {title}
      </Text>
      {message ? (
        <Text style={styles.message} maxFontSizeMultiplier={1.25} importantForAccessibility="no">
          {message}
        </Text>
      ) : null}
      {actionLabel && onActionPress ? (
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onActionPress}
          haptic
          style={styles.actionPressable}
          contentStyle={[styles.action, { borderColor: toneConfig.border, backgroundColor: toneConfig.soft }]}
        >
          <Text style={[styles.actionText, { color: toneConfig.accent }]}>{actionLabel}</Text>
        </AnimatedPressable>
      ) : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
  },
  content: {
    alignItems: "center",
    gap: ydlStatusBlock.gap,
    paddingVertical: ydlSpace.lg,
    paddingHorizontal: ydlSpace.sm,
  },
  iconShell: {
    width: ydlStatusBlock.iconShell,
    height: ydlStatusBlock.iconShell,
    borderRadius: ydlStatusBlock.iconRadius,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...ydlStatusBlock.title,
  },
  message: {
    ...ydlStatusBlock.body,
    maxWidth: 320,
  },
  actionPressable: {
    marginTop: ydlSpace.xxs,
    alignSelf: "stretch",
  },
  action: {
    minHeight: ydlStatusBlock.actionMinHeight,
    paddingHorizontal: ydlSpace.md,
    borderRadius: ydlStatusBlock.iconRadius,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    ...ydlStatusBlock.body,
    fontWeight: "700",
  },
});
