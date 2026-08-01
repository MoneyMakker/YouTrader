/**
 * More hub — Calculator, News, Settings, secondary utilities.
 * Keeps bottom navigation at ≤5 primary tabs.
 */

import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Calculator as CalculatorIcon, Newspaper, Settings as SettingsIcon } from "lucide-react-native";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import { YDL_MIN_TOUCH_TARGET } from "../ydl/accessibility";
import type { Tab } from "./types";

type Props = {
  onOpen: (tab: Tab) => void;
};

const ITEMS: Array<{ id: Tab; labelKey: string; Icon: typeof CalculatorIcon }> = [
  { id: "calc", labelKey: "calc", Icon: CalculatorIcon },
  { id: "news", labelKey: "news", Icon: Newspaper },
  { id: "settings", labelKey: "settings", Icon: SettingsIcon },
];

export function MoreScreen({ onOpen }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background.primary }}
      contentContainerStyle={styles.body}
      testID="more-screen"
    >
      <YdlText role="title">{t("more.title")}</YdlText>
      <YdlText role="caption" color="text.secondary">
        {t("more.subtitle")}
      </YdlText>
      <View style={styles.list}>
        {ITEMS.map(({ id, labelKey, Icon }) => (
          <Pressable
            key={id}
            onPress={() => onOpen(id)}
            accessibilityRole="button"
            accessibilityLabel={t(labelKey)}
            testID={`more.open.${id}`}
            style={[
              styles.row,
              {
                backgroundColor: theme.colors.surface.card,
                minHeight: YDL_MIN_TOUCH_TARGET,
              },
            ]}
          >
            <Icon size={22} color={theme.colors.text.primary} strokeWidth={2} />
            <YdlText role="bodyEmphasized">{t(labelKey)}</YdlText>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  list: { gap: 10, marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
});
