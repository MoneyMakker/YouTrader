import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { BottomSheetHandleProps } from "@gorhom/bottom-sheet";
import { YDL_SHEET_COLORS, YDL_SHEET_HANDLE_HEIGHT } from "./sheet.constants";
import type { YdlSheetAppearance } from "./sheet.types";

type Props = BottomSheetHandleProps & {
  appearance?: YdlSheetAppearance;
  accessibilityLabel?: string;
};

export function YdlSheetHandle({
  appearance = "dark",
  accessibilityLabel = "Sheet handle",
}: Props) {
  const colors = YDL_SHEET_COLORS[appearance];
  const style = useMemo(
    () => [
      styles.handle,
      { backgroundColor: colors.handle },
    ],
    [colors.handle],
  );

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={style} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: YDL_SHEET_HANDLE_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
  },
});
