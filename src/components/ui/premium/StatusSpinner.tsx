import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  getYdlSpinnerColor,
  ydlSpinnerSizeMap,
  ydlStatusSpinner,
  type YdlSpinnerSize,
  type YdlSpinnerVariant,
} from "../../../ydl/status";

export type StatusSpinnerProps = {
  size?: YdlSpinnerSize;
  variant?: YdlSpinnerVariant;
  /** Optional override — prefer variants; use only when an existing accent is required. */
  color?: string;
  /** VoiceOver label — defaults to a calm “Loading” announcement. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function StatusSpinner({
  size = ydlStatusSpinner.sizeDefault,
  variant = "default",
  color,
  accessibilityLabel = "Loading",
  style,
}: StatusSpinnerProps) {
  return (
    <View
      style={[styles.wrap, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator
        size={ydlSpinnerSizeMap[size]}
        color={color || getYdlSpinnerColor(variant)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: ydlStatusSpinner.marginBlock,
  },
});
