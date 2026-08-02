/**
 * Primary AppShell tab bar — YDL tokens + press motion.
 * Feature screens import this instead of hard-coded #96FF00 Pressables.
 */

import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YdlAnimatedPressable } from "../motion";
import { YdlText } from "../components/YdlText";
import { useYdlTheme } from "../tokens";
import { YDL_MIN_TOUCH_TARGET } from "../accessibility";

export type YdlTabItem<T extends string = string> = {
  id: T;
  label: string;
  glyph: React.ReactNode;
};

type Props<T extends string> = {
  tabs: YdlTabItem<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function YdlTabBar<T extends string>({
  tabs,
  activeId,
  onSelect,
  style,
  testID = "ydl-tab-bar",
}: Props<T>) {
  const theme = useYdlTheme("dark");
  const insets = useSafeAreaInsets();
  const accent = theme.colors.action.primary; // lime
  const inactiveLabel = accent;

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.background.primary,
          borderTopColor: theme.colors.border.subtle,
          paddingBottom: Math.max(6, Math.min(insets.bottom, 14)),
          paddingTop: 8,
        },
        style,
      ]}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <YdlAnimatedPressable
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            haptic="selection"
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            style={styles.tab}
          >
            <View
              style={[
                styles.iconWrap,
                active && {
                  shadowColor: accent,
                  shadowOpacity: 0.28,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 0 },
                },
              ]}
            >
              {tab.glyph}
            </View>
            <YdlText
              role="caption"
              numberOfLines={1}
              style={[styles.label, { color: accent, opacity: active ? 1 : 0.58 }]}
            >
              {tab.label}
            </YdlText>
            <View
              style={[
                styles.underline,
                {
                  backgroundColor: accent,
                  opacity: active ? 1 : 0,
                },
              ]}
            />
          </YdlAnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
    paddingHorizontal: 1,
    minWidth: 0,
    minHeight: YDL_MIN_TOUCH_TARGET,
    overflow: "hidden",
  },
  iconWrap: {
    width: 31,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 6,
    fontSize: 8.4,
    lineHeight: 10,
    textAlign: "center",
    width: "100%",
  },
  underline: {
    width: 36,
    height: 3,
    borderRadius: 999,
    marginTop: 8,
  },
});
