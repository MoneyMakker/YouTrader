import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { YdlSemanticSymbol } from "../symbols";
import type { YdlHapticIntent } from "../haptics";
import type { YdlAppearance } from "../tokens";
import { YdlListItem } from "./YdlListItem";

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
  appearance?: YdlAppearance;
};

/**
 * Compatibility wrapper around `YdlListItem` (Phase 5/6 consolidation).
 *
 * Prefer `YdlListItem` for new screens. Do not expand this API independently —
 * add capabilities on `YdlListItem` and map them here explicitly.
 *
 * Soft deprecation: keep imports working; no noisy runtime logs.
 */
export function YdlActionRow({
  title,
  subtitle,
  leadingSymbol,
  trailingValue,
  showChevron,
  onPress,
  disabled,
  haptic,
  style,
  testID,
  appearance,
}: YdlActionRowProps) {
  return (
    <YdlListItem
      title={title}
      subtitle={subtitle}
      leadingSymbol={leadingSymbol}
      trailingValue={trailingValue}
      showChevron={showChevron}
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      style={style}
      testID={testID}
      appearance={appearance}
    />
  );
}
