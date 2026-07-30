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
 * Compatibility wrapper around `YdlListItem` (Phase 5 consolidation).
 * Prefer `YdlListItem` for new screens.
 */
export function YdlActionRow(props: YdlActionRowProps) {
  return <YdlListItem {...props} />;
}
