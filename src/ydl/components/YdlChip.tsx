import React, { useCallback } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { YdlAnimatedPressable } from "../motion";
import { YdlSymbol, type YdlSemanticSymbol } from "../symbols";
import { YDL_MIN_TOUCH_TARGET } from "../accessibility";
import type { YdlHapticIntent } from "../haptics";
import { useYdlTheme, type YdlAppearance } from "../tokens";
import { YdlText } from "./YdlText";

export type YdlChipProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  leadingSymbol?: YdlSemanticSymbol;
  onPress?: () => void;
  haptic?: YdlHapticIntent | false;
  appearance?: YdlAppearance;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function YdlChip({
  label,
  selected = false,
  disabled = false,
  leadingSymbol,
  onPress,
  haptic = false,
  appearance,
  style,
  testID,
}: YdlChipProps) {
  const theme = useYdlTheme(appearance);

  const handlePress = useCallback(() => {
    if (disabled) return;
    onPress?.();
  }, [disabled, onPress]);

  return (
    <YdlAnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled || !onPress}
      haptic={disabled ? false : haptic}
      minTouchTarget
      onPress={handlePress}
      style={[
        styles.chip,
        {
          minHeight: YDL_MIN_TOUCH_TARGET,
          backgroundColor: selected
            ? theme.colors.surface.selected
            : theme.colors.surface.interactive,
          borderColor: selected ? theme.colors.border.strong : theme.colors.border.subtle,
          borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
          borderRadius: theme.radius.chip,
          opacity: disabled ? theme.opacity.disabled : 1,
        },
        style,
      ]}
    >
      {leadingSymbol ? (
        <YdlSymbol
          name={leadingSymbol}
          size="sm"
          tintColor={theme.colors.icon.secondary}
          decorative
        />
      ) : null}
      <YdlText
        role="labelEmphasized"
        appearance={appearance}
        style={{
          color: theme.colors.text.primary,
          flexShrink: 1,
        }}
      >
        {label}
      </YdlText>
    </YdlAnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "100%",
  },
});
