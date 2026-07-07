import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { premiumTone, type PremiumTone } from "./tokens";

export type NeonDividerProps = {
  tone?: PremiumTone;
  thickness?: number;
  vertical?: boolean;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function NeonDivider({
  tone = "purple",
  thickness = StyleSheet.hairlineWidth,
  vertical = false,
  glow = true,
  style,
}: NeonDividerProps) {
  const toneConfig = premiumTone[tone];

  return (
    <View
      pointerEvents="none"
      style={[
        styles.root,
        vertical ? { width: thickness, alignSelf: "stretch" } : { height: thickness, width: "100%" },
        {
          backgroundColor: toneConfig.accent,
          shadowColor: toneConfig.accent,
          shadowOpacity: glow ? 0.45 : 0,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    opacity: 0.62,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
