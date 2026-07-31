/**
 * App chrome background — YDL dark terminal surface.
 */

import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { YdlFade } from "../motion";
import { useYdlTheme } from "../tokens";

type Props = {
  children: React.ReactNode;
  /** Cross-fade content when this key changes (e.g. active tab). */
  contentKey?: string;
  style?: StyleProp<ViewStyle>;
  edges?: ("top" | "right" | "bottom" | "left")[];
  testID?: string;
};

export function YdlAppShell({
  children,
  contentKey,
  style,
  edges = ["top", "left", "right"],
  testID = "ydl-app-shell",
}: Props) {
  const theme = useYdlTheme("dark");
  const bg = theme.colors.background.primary;

  return (
    <SafeAreaView
      testID={testID}
      edges={edges}
      style={[styles.root, { backgroundColor: bg }, style]}
    >
      {contentKey != null ? (
        <YdlFade key={contentKey} style={styles.body} enter>
          {children}
        </YdlFade>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
});
