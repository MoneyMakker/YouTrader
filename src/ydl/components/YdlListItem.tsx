import React, { useCallback, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { YdlAnimatedPressable } from "../motion";
import { YdlSymbol, type YdlSemanticSymbol } from "../symbols";
import {
  ydlCombinedAccessibilityLabel,
  YDL_MIN_TOUCH_TARGET,
} from "../accessibility";
import { runYdlHaptic, type YdlHapticIntent } from "../haptics";
import { useYdlTheme, type YdlAppearance } from "../tokens";
import { YdlText } from "./YdlText";

export type YdlListItemProps = {
  title: string;
  subtitle?: string;
  leadingSymbol?: YdlSemanticSymbol;
  leading?: React.ReactNode;
  trailingValue?: string;
  showChevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  destructive?: boolean;
  haptic?: YdlHapticIntent | false;
  appearance?: YdlAppearance;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Canonical list row. Prefer this for new UI.
 * `YdlActionRow` is a thin compatibility wrapper around this component.
 */
export function YdlListItem({
  title,
  subtitle,
  leadingSymbol = "info",
  leading,
  trailingValue,
  showChevron = true,
  onPress,
  disabled = false,
  selected = false,
  destructive = false,
  haptic = false,
  appearance,
  style,
  testID,
}: YdlListItemProps) {
  const theme = useYdlTheme(appearance);

  const a11yLabel = useMemo(() => {
    const base = ydlCombinedAccessibilityLabel(
      destructive ? `${title}. Destructive` : title,
      subtitle,
      trailingValue,
    );
    return selected ? `${base}. Selected` : base;
  }, [destructive, selected, subtitle, title, trailingValue]);

  const a11yHint =
    onPress && showChevron && !trailingValue ? "Opens details" : undefined;

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (haptic) runYdlHaptic(haptic);
    onPress?.();
  }, [disabled, haptic, onPress]);

  const titleColor = destructive
    ? "status.negative"
    : "text.primary";

  const body = (
    <>
      {leading ?? (
        <YdlSymbol
          name={leadingSymbol}
          size="md"
          tintColor={
            destructive ? theme.colors.status.negative : theme.colors.icon.secondary
          }
          decorative
        />
      )}
      <View style={styles.textCol}>
        <YdlText role="callout" color={titleColor} appearance={appearance}>
          {title}
        </YdlText>
        {subtitle ? (
          <YdlText role="caption" color="text.secondary" appearance={appearance}>
            {subtitle}
          </YdlText>
        ) : null}
      </View>
      {trailingValue ? (
        <YdlText
          role="numericCompact"
          color="text.secondary"
          appearance={appearance}
          style={styles.trailing}
        >
          {trailingValue}
        </YdlText>
      ) : null}
      {showChevron ? (
        <YdlSymbol
          name="chevronRight"
          size="sm"
          tintColor={theme.colors.text.tertiary}
          decorative
        />
      ) : null}
    </>
  );

  const rowStyle = [
    styles.row,
    {
      minHeight: YDL_MIN_TOUCH_TARGET,
      backgroundColor: selected ? theme.colors.surface.selected : "transparent",
      borderRadius: theme.radius.control,
      opacity: disabled ? theme.opacity.disabled : 1,
      borderWidth: selected ? StyleSheet.hairlineWidth : 0,
      borderColor: theme.colors.border.strong,
    },
    style,
  ];

  if (onPress) {
    return (
      <YdlAnimatedPressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint={a11yHint}
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        haptic={false}
        minTouchTarget
        onPress={handlePress}
        style={rowStyle}
      >
        {body}
      </YdlAnimatedPressable>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled, selected }}
      style={rowStyle}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  trailing: {
    marginLeft: 6,
    maxWidth: "36%",
  },
});
