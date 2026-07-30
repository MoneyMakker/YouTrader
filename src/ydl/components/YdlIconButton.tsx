import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { YdlSymbol } from "../symbols";
import type { YdlSemanticSymbol, YdlSymbolSize, YdlSymbolWeight } from "../symbols";
import { runYdlHaptic, type YdlHapticIntent } from "../haptics";
import {
  YDL_MIN_TOUCH_TARGET,
  ydlMinTouchTargetStyle,
} from "../accessibility";

export type YdlIconButtonProps = {
  symbol: YdlSemanticSymbol;
  accessibilityLabel: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: YdlSymbolSize;
  weight?: YdlSymbolWeight;
  tintColor?: string;
  /** Optional restrained haptic intent via canonical YDL adapter only. */
  haptic?: YdlHapticIntent | false;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const PRESSED_OPACITY = 0.72;
const DISABLED_OPACITY = 0.4;
const DEFAULT_TINT = "#F4F7F5";

/**
 * Icon-only control with ≥44×44 effective hit area.
 * No direct expo-symbols / expo-haptics imports.
 */
export function YdlIconButton({
  symbol,
  accessibilityLabel,
  onPress,
  disabled = false,
  loading = false,
  size = "md",
  weight = "regular",
  tintColor = DEFAULT_TINT,
  haptic = false,
  style,
  testID,
}: YdlIconButtonProps) {
  const isDisabled = disabled || loading;

  const handlePress = useCallback(() => {
    if (isDisabled) return;
    if (haptic) runYdlHaptic(haptic);
    onPress?.();
  }, [haptic, isDisabled, onPress]);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={handlePress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        ydlMinTouchTargetStyle(YDL_MIN_TOUCH_TARGET),
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tintColor} />
      ) : (
        <YdlSymbol
          name={symbol}
          size={size}
          weight={weight}
          tintColor={tintColor}
          decorative
          disabled={isDisabled}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: PRESSED_OPACITY,
  },
  disabled: {
    opacity: DISABLED_OPACITY,
  },
});
