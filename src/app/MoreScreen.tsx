/**
 * More hub — Calendar, Calculator, News, Reports, Import Trades.
 * Settings is a primary bottom tab (not duplicated here).
 * Prop Pass is a primary bottom tab (not placed in More).
 * Bottom tabs: always five (Journal, Prop Pass, Stats, Settings, More).
 */

import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Calculator as CalculatorIcon,
  CalendarDays,
  FileText,
  FileUp,
  Newspaper,
} from "lucide-react-native";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import { YDL_MIN_TOUCH_TARGET } from "../ydl/accessibility";
import type { Tab } from "./types";

export type MoreDestination =
  | Tab
  | "subscription"
  | "restore"
  | "reports"
  | "account"
  | "importTrades"
  | "help"
  | "privacy"
  | "terms";

type Props = {
  onOpen: (dest: MoreDestination) => void;
  showRestore?: boolean;
  isPremium?: boolean;
};

type Row = {
  id: MoreDestination;
  labelKey: string;
  Icon: typeof CalculatorIcon;
};

const TRADING: Row[] = [
  { id: "calendar", labelKey: "calendar", Icon: CalendarDays },
  { id: "calc", labelKey: "calc", Icon: CalculatorIcon },
  { id: "news", labelKey: "news", Icon: Newspaper },
  { id: "reports", labelKey: "more.performanceReports", Icon: FileText },
  { id: "importTrades", labelKey: "importTrades", Icon: FileUp },
];

function Section({
  title,
  rows,
  onOpen,
  theme,
  isPremium,
}: {
  title: string;
  rows: Row[];
  onOpen: (dest: MoreDestination) => void;
  theme: ReturnType<typeof useYdlTheme>;
  isPremium?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <YdlText role="label" color="text.secondary">
        {title}
      </YdlText>
      <View style={styles.list}>
        {rows.map(({ id, labelKey, Icon }) => {
          const lockedImport = id === "importTrades" && !isPremium;
          const label = lockedImport ? t("importTradesCsvPro") : t(labelKey);
          return (
            <Pressable
              key={id}
              onPress={() => onOpen(id)}
              accessibilityRole="button"
              accessibilityLabel={label}
              testID={`more.open.${id}`}
              style={[
                styles.row,
                {
                  backgroundColor: theme.colors.surface.card,
                  minHeight: YDL_MIN_TOUCH_TARGET,
                  opacity: lockedImport ? 0.72 : 1,
                },
              ]}
            >
              <Icon
                size={22}
                color={
                  lockedImport
                    ? theme.colors.text.tertiary
                    : theme.colors.text.primary
                }
                strokeWidth={2}
              />
              <YdlText role="bodyEmphasized" color={lockedImport ? "text.secondary" : undefined}>
                {t(labelKey)}
              </YdlText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MoreScreen({ onOpen, isPremium }: Props) {
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
        {t("more.subtitleTools")}
      </YdlText>

      <Section
        title={t("more.sectionTradingTools")}
        rows={TRADING}
        onOpen={onOpen}
        theme={theme}
        isPremium={isPremium}
      />

      <View style={styles.section}>
        <YdlText role="label" color="text.secondary">
          {t("more.sectionSupport")}
        </YdlText>
        <View style={styles.list}>
          {(
            [
              { id: "help" as const, label: t("more.help"), url: "mailto:support@borovikgroup.com?subject=YouTrader%20Support" },
              { id: "privacy" as const, label: t("privacyPolicy"), url: "https://youtrader.app/privacy" },
              { id: "terms" as const, label: t("termsOfUse"), url: "https://youtrader.app/terms" },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                if (item.url) void Linking.openURL(item.url);
                else onOpen(item.id);
              }}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              testID={`more.open.${item.id}`}
              style={[
                styles.row,
                {
                  backgroundColor: theme.colors.surface.card,
                  minHeight: YDL_MIN_TOUCH_TARGET,
                },
              ]}
            >
              <YdlText role="bodyEmphasized">{item.label}</YdlText>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 18, paddingBottom: 48 },
  section: { gap: 10 },
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
});
