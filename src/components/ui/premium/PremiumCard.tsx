import React from "react";
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { GlassCard } from "../GlassCard";
import { C } from "../../../theme/colors";
import { premiumRadii, premiumTone, type PremiumTone } from "./tokens";

export type PremiumCardProps = ViewProps & {
  children?: React.ReactNode;
  tone?: PremiumTone;
  compact?: boolean;
  elevated?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function PremiumCard({
  children,
  tone = "neutral",
  compact = false,
  elevated = true,
  style,
  contentStyle,
  ...rest
}: PremiumCardProps) {
  const toneConfig = premiumTone[tone];

  return (
    <GlassCard
      {...rest}
      compact={compact}
      intensity={compact ? 24 : 38}
      style={[
        styles.card,
        compact && styles.compact,
        elevated && styles.elevated,
        { borderColor: toneConfig.border, shadowColor: toneConfig.accent },
        style,
      ]}
    >
      <View pointerEvents="none" style={[styles.accentLine, { backgroundColor: toneConfig.accent }]} />
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: toneConfig.soft }]} />
      <View style={contentStyle}>{children}</View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(5,7,10,0.84)",
    borderRadius: premiumRadii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  compact: {
    borderRadius: premiumRadii.md,
  },
  elevated: {
    shadowOpacity: 0.20,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 5,
  },
  accentLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: StyleSheet.hairlineWidth,
    opacity: 0.74,
  },
  glow: {
    position: "absolute",
    right: -56,
    top: -64,
    width: 156,
    height: 156,
    borderRadius: 78,
    opacity: 0.72,
  },
});
