import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlCard } from "../../ydl/components/YdlCard";
import { YdlText } from "../../ydl/components/YdlText";
import type { PropPassViewModel } from "../types";

export function PropPassDisciplineStreak({ model }: { model: PropPassViewModel }) {
  const { t } = useTranslation();
  const stats = model.tradingStats;
  if (!stats || model.tradeCountInSnapshot === 0 || model.tradeCountInSnapshot == null) {
    return (
      <YdlCard testID="prop-pass-discipline-streak">
        <YdlText role="label">{t("propPass.streak.title")}</YdlText>
        <YdlText role="bodyEmphasized">{t("propPass.streak.notEnoughData")}</YdlText>
        <YdlText role="caption" color="text.secondary">
          {t("propPass.streak.requirement")}
        </YdlText>
      </YdlCard>
    );
  }

  return (
    <YdlCard testID="prop-pass-discipline-streak">
      <YdlText role="label">{t("propPass.streak.title")}</YdlText>
      <Metric label={t("propPass.streak.current")} value={String(stats.disciplineStreakDays)} />
      <Metric label={t("propPass.streak.best")} value={String(stats.bestDisciplineStreakDays)} />
      <Metric label={t("propPass.streak.violations")} value={String(stats.ruleViolations)} />
    </YdlCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <YdlText role="caption" color="text.secondary">{label}</YdlText>
      <YdlText role="bodyEmphasized">{value}</YdlText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
