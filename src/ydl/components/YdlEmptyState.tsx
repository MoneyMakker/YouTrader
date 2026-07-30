import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { YdlSymbol, type YdlSemanticSymbol } from "../symbols";
import { useYdlTheme, type YdlAppearance } from "../tokens";
import { YdlText } from "./YdlText";
import { YdlButton } from "./YdlButton";

export type YdlEmptyStateProps = {
  title: string;
  description?: string;
  symbol?: YdlSemanticSymbol;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  appearance?: YdlAppearance;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function YdlEmptyState({
  title,
  description,
  symbol = "info",
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  appearance,
  style,
  testID,
}: YdlEmptyStateProps) {
  const theme = useYdlTheme(appearance);

  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      style={[
        styles.wrap,
        {
          padding: theme.space[16],
          maxWidth: theme.layout.maxContentWidth,
        },
        style,
      ]}
    >
      <YdlSymbol name={symbol} size="lg" tintColor={theme.colors.icon.secondary} decorative />
      <YdlText role="heading" appearance={appearance} align="center">
        {title}
      </YdlText>
      {description ? (
        <YdlText role="body" color="text.secondary" appearance={appearance} align="center">
          {description}
        </YdlText>
      ) : null}
      {primaryActionLabel && onPrimaryAction ? (
        <YdlButton
          label={primaryActionLabel}
          onPress={onPrimaryAction}
          variant="primary"
          appearance={appearance}
        />
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <YdlButton
          label={secondaryActionLabel}
          onPress={onSecondaryAction}
          variant="tertiary"
          appearance={appearance}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
    gap: 12,
  },
});
