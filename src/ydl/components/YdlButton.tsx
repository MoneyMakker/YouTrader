import React, { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { YdlAnimatedPressable } from "../motion";
import { YdlSymbol, type YdlSemanticSymbol } from "../symbols";
import { YDL_MIN_TOUCH_TARGET } from "../accessibility";
import type { YdlHapticIntent } from "../haptics";
import { useYdlTheme, type YdlAppearance } from "../tokens";
import { YdlText } from "./YdlText";

export type YdlButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type YdlButtonSize = "small" | "medium" | "large";

export type YdlButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: YdlButtonVariant;
  size?: YdlButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leadingSymbol?: YdlSemanticSymbol;
  trailingSymbol?: YdlSemanticSymbol;
  /** Icon-only requires non-empty `label` for accessibility. */
  iconOnly?: boolean;
  haptic?: YdlHapticIntent | false;
  appearance?: YdlAppearance;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const SIZE_PAD: Record<YdlButtonSize, { py: number; px: number; gap: number }> = {
  small: { py: 8, px: 12, gap: 6 },
  medium: { py: 12, px: 16, gap: 8 },
  large: { py: 14, px: 20, gap: 10 },
};

/**
 * Restrained button — YdlAnimatedPressable, semantic tokens, no Reanimated import.
 */
export function YdlButton({
  label,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  fullWidth = false,
  leadingSymbol,
  trailingSymbol,
  iconOnly = false,
  haptic = false,
  appearance,
  style,
  testID,
}: YdlButtonProps) {
  const theme = useYdlTheme(appearance);
  const isDisabled = disabled || loading;
  const inFlight = useRef(false);

  if (iconOnly && !label.trim() && typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn("[YdlButton] iconOnly requires a non-empty label for accessibility");
  }

  const c = theme.colors;
  const colors =
    variant === "secondary"
      ? {
          bg: c.action.secondary,
          text: c.action.secondaryText,
          border: c.border.subtle,
        }
      : variant === "tertiary"
        ? {
            bg: "transparent",
            text: c.action.tertiaryText,
            border: "transparent",
          }
        : variant === "destructive"
          ? {
              bg: c.action.destructive,
              text: c.action.destructiveText,
              border: c.action.destructive,
            }
          : {
              bg: c.action.primary,
              text: c.action.primaryText,
              border: c.action.primary,
            };

  const pad = SIZE_PAD[size];

  const handlePress = useCallback(() => {
    if (isDisabled || inFlight.current) return;
    inFlight.current = true;
    try {
      onPress?.();
    } finally {
      inFlight.current = false;
    }
  }, [isDisabled, onPress]);

  const fg = isDisabled ? theme.colors.action.disabledText : colors.text;

  return (
    <YdlAnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        variant === "destructive" ? `${label}. Destructive action` : label
      }
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      haptic={isDisabled ? false : haptic}
      minTouchTarget
      onPress={handlePress}
      style={[
        styles.base,
        {
          backgroundColor: isDisabled ? theme.colors.action.disabled : colors.bg,
          borderColor: isDisabled ? theme.colors.action.disabled : colors.border,
          paddingVertical: pad.py,
          paddingHorizontal: iconOnly ? pad.py : pad.px,
          gap: pad.gap,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          opacity: isDisabled ? theme.opacity.disabled : 1,
          borderRadius: theme.radius.control,
        },
        style,
      ]}
    >
      <View style={styles.inner} pointerEvents="none">
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : iconOnly ? (
          <YdlSymbol
            name={leadingSymbol ?? trailingSymbol ?? "info"}
            size="md"
            tintColor={fg}
            decorative
          />
        ) : (
          <>
            {leadingSymbol ? (
              <YdlSymbol name={leadingSymbol} size="sm" tintColor={fg} decorative />
            ) : null}
            <YdlText
              role={size === "small" ? "labelEmphasized" : "callout"}
              appearance={appearance}
              style={{ color: fg, flexShrink: 1 }}
            >
              {label}
            </YdlText>
            {trailingSymbol ? (
              <YdlSymbol name={trailingSymbol} size="sm" tintColor={fg} decorative />
            ) : null}
          </>
        )}
      </View>
    </YdlAnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: YDL_MIN_TOUCH_TARGET,
    minWidth: YDL_MIN_TOUCH_TARGET,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 20,
    gap: 8,
  },
});
