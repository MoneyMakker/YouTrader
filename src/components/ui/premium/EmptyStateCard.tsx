import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { C } from "../../../theme/colors";
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
  style?: StyleProp<ViewStyle>;
};

export function EmptyStateCard({
  title,
  message,
  icon,
  actionLabel,
  onActionPress,
  tone = "purple",
  style,
}: EmptyStateCardProps) {
  const toneConfig = premiumTone[tone];

  return (
    <PremiumCard tone={tone} style={[styles.card, style]} contentStyle={styles.content}>
      {icon ? <View style={[styles.iconShell, { backgroundColor: toneConfig.soft }]}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onActionPress ? (
        <AnimatedPressable
          accessibilityRole="button"
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
    gap: 10,
    paddingVertical: 4,
  },
  iconShell: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  title: {
    color: C.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  actionPressable: {
    marginTop: 4,
  },
  action: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
