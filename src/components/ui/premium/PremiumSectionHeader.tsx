import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { C } from "../../../theme/colors";
import { AnimatedPressable } from "./AnimatedPressable";
import { premiumTone, type PremiumTone } from "./tokens";

export type PremiumSectionHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  right?: React.ReactNode;
  tone?: PremiumTone;
  style?: StyleProp<ViewStyle>;
};

export function PremiumSectionHeader({
  title,
  eyebrow,
  subtitle,
  actionLabel,
  onActionPress,
  right,
  tone = "lime",
  style,
}: PremiumSectionHeaderProps) {
  const toneConfig = premiumTone[tone];

  return (
    <View style={[styles.root, style]}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: toneConfig.accent }]}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? (
        right
      ) : actionLabel && onActionPress ? (
        <AnimatedPressable
          accessibilityRole="button"
          onPress={onActionPress}
          haptic
          contentStyle={[styles.action, { borderColor: toneConfig.border, backgroundColor: toneConfig.soft }]}
        >
          <Text style={[styles.actionText, { color: toneConfig.accent }]} numberOfLines={1}>
            {actionLabel}
          </Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    color: C.text,
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  action: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "900",
  },
});
