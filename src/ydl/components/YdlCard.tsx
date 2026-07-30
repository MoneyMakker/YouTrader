import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { YdlAnimatedPressable } from "../motion";
import { useYdlTheme, type YdlAppearance } from "../tokens";
import { YdlText } from "./YdlText";

export type YdlCardVariant = "default" | "elevated" | "outlined" | "interactive" | "selected";

export type YdlCardProps = {
  children: React.ReactNode;
  variant?: YdlCardVariant;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Press handler. When set, card is interactive unless `disabled`.
   * Prefer `variant="interactive"` or `variant="selected"` for interactive visuals.
   */
  onPress?: () => void;
  disabled?: boolean;
  appearance?: YdlAppearance;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Required when interactive (onPress without disabled). */
  accessibilityLabel?: string;
};

/**
 * Surface card. Static cards never expose button semantics.
 * Selected state uses stronger border + optional “Selected” a11y — not color alone.
 */
export function YdlCard({
  children,
  variant = "default",
  header,
  footer,
  onPress,
  disabled = false,
  appearance,
  style,
  testID,
  accessibilityLabel,
}: YdlCardProps) {
  const theme = useYdlTheme(appearance);
  const selected = variant === "selected";
  const elevated = variant === "elevated";
  const outlined = variant === "outlined" || selected || variant === "interactive";
  const wantsPress = typeof onPress === "function" && !disabled;
  const interactive = wantsPress;

  if (
    interactive &&
    !accessibilityLabel?.trim() &&
    typeof __DEV__ !== "undefined" &&
    __DEV__
  ) {
    console.warn("[YdlCard] interactive cards require accessibilityLabel");
  }

  const surface =
    selected
      ? theme.colors.surface.selected
      : variant === "interactive"
        ? theme.colors.surface.interactive
        : theme.colors.surface.card;

  const body = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: surface,
          borderColor: outlined ? theme.colors.border.strong : theme.colors.border.subtle,
          borderWidth: outlined ? 1.5 : StyleSheet.hairlineWidth,
          padding: theme.space[16],
          borderRadius: theme.radius.card,
          opacity: disabled ? theme.opacity.disabled : 1,
        },
        elevated ? theme.elevation.card : theme.elevation.none,
        style,
      ]}
    >
      {header ? <View style={styles.header}>{header}</View> : null}
      <View style={styles.content}>{children}</View>
      {selected ? (
        <YdlText role="caption" color="text.secondary" appearance={appearance}>
          Selected
        </YdlText>
      ) : null}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );

  if (interactive) {
    return (
      <YdlAnimatedPressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        haptic={false}
        onPress={onPress}
        style={styles.pressWrap}
      >
        {body}
      </YdlAnimatedPressable>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityState={selected ? { selected: true } : undefined}
      // Static: no button role
      accessible={selected}
      accessibilityLabel={selected ? accessibilityLabel ?? "Selected card" : undefined}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  pressWrap: { alignSelf: "stretch" },
  card: { gap: 10 },
  header: { marginBottom: 2 },
  content: { gap: 8 },
  footer: { marginTop: 4 },
});
