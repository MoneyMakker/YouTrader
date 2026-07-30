import React, { type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

type Props = {
  children: ReactNode;
};

/**
 * Minimum root integration for YDL sheets:
 * GestureHandlerRootView + BottomSheetModalProvider.
 * Place once at the app root. Do not nest additional copies.
 */
export function YdlSheetRoot({ children }: Props) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
