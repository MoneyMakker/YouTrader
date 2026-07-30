import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { YdlAnimatedPressable } from "../motion";
import {
  useYdlTheme,
  type YdlAppearance,
} from "../tokens";

export type YdlCardVariant = "default" | "elevated" | "outlined" | "interactive" | "selected";

export type YdlCardProps = {
  children: React.ReactNode;
  variant?: YdlCardVariant;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  onPress?: () => void;
  appearance?: YdlAppearance;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

export function YdlCard({
  children,
  variant = "default",
  header,
  footer,
  onPress,
  appearance,
  style,
  testID,
  accessibilityLabel,
}: YdlCardProps) {
  const theme = useYdlTheme(appearance);
  const selected = variant === "selected";
  const elevated = variant === "elevated";
  const outlined = variant === "outlined" || selected;
  const interactive = variant === "interactive" || !!onPress;

  const surface =
    selected
      ? theme.colors.surface.selected
      : variant === "interactive"
        ? theme.colors.surface.interactive
        : theme.colors.surface.card;

  const body = (
    <View
      testID={onPress ? undefined : testID}
      style={[
        styles.card,
        {
          backgroundColor: surface,
          borderColor: outlined ? theme.colors.border.strong : theme.colors.border.subtle,
          borderWidth: outlined ? 1.5 : StyleSheet.hairlineWidth,
          padding: theme.space[16],
          borderRadius: theme.radius.card,
        },
        elevated ? theme.elevation.card : theme.elevation.none,
        style,
      ]}
      accessibilityState={selected ? { selected: true } : undefined}
    >
      {header ? <View style={styles.header}>{header}</View> : null}
      <View style={styles.content}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );

  if (interactive && onPress) {
    return (
      <YdlAnimatedPressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={styles.pressWrap}
      >
        {body}
      </YdlAnimatedPressable>
    );
  }

  return body;
}

const styles = StyleSheet.create({
  pressWrap: { alignSelf: "stretch" },
  card: { gap: 10 },
  header: { marginBottom: 2 },
  content: { gap: 8 },
  footer: { marginTop: 4 },
});
