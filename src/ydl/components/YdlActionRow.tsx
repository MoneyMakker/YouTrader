import React, { useCallback, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { YdlSymbol } from "../symbols";
import type { YdlSemanticSymbol } from "../symbols";
import { ydlCombinedAccessibilityLabel, YDL_MIN_TOUCH_TARGET } from "../accessibility";
import { runYdlHaptic, type YdlHapticIntent } from "../haptics";

export type YdlActionRowProps = {
  title: string;
  subtitle?: string;
  leadingSymbol?: YdlSemanticSymbol;
  trailingValue?: string;
  showChevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  haptic?: YdlHapticIntent | false;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const PRESSED_OPACITY = 0.72;
const DISABLED_OPACITY = 0.4;

/**
 * Settings-style row: semantic leading symbol, flexible multiline text, optional trailing.
 * Fixed height is intentionally avoided so large Dynamic Type does not clip.
 */
export function YdlActionRow({
  title,
  subtitle,
  leadingSymbol = "info",
  trailingValue,
  showChevron = true,
  onPress,
  disabled = false,
  haptic = false,
  style,
  testID,
}: YdlActionRowProps) {
  const a11yLabel = useMemo(
    () =>
      ydlCombinedAccessibilityLabel(
        title,
        subtitle,
        trailingValue,
        showChevron && !trailingValue ? "Opens details" : undefined,
      ),
    [showChevron, subtitle, title, trailingValue],
  );

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (haptic) runYdlHaptic(haptic);
    onPress?.();
  }, [disabled, haptic, onPress]);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled }}
      disabled={disabled || !onPress}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <YdlSymbol name={leadingSymbol} size="md" tintColor="#9AA3AD" decorative />
      <View style={styles.textCol}>
        <Text style={styles.title} allowFontScaling>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} allowFontScaling>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailingValue ? (
        <Text style={styles.trailing} allowFontScaling>
          {trailingValue}
        </Text>
      ) : null}
      {showChevron ? (
        <YdlSymbol name="chevronRight" size="sm" tintColor="#5B6570" decorative />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: YDL_MIN_TOUCH_TARGET,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#F4F7F5",
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 14,
    color: "#9AA3AD",
  },
  trailing: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: "#9AA3AD",
    marginLeft: 6,
    maxWidth: "36%",
  },
  pressed: {
    opacity: PRESSED_OPACITY,
  },
  disabled: {
    opacity: DISABLED_OPACITY,
  },
});
