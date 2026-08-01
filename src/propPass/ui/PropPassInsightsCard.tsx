import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import {
  formatRelativeUpdated,
  mapChallengeHeroStatus,
  mapReadinessLabel,
  tradesNeededForInsights,
} from "../presentation";
import type { PropPassViewModel } from "../types";

type Props = {
  model: PropPassViewModel;
  onOpenDetail: () => void;
};

export function PropPassInsightsCard({ model, onOpenDetail }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const readiness = mapReadinessLabel(model);
  const hero = mapChallengeHeroStatus(model);
  const needed = tradesNeededForInsights(model.assignedTradeCount);
  const updated = formatRelativeUpdated(model.freshness.calculatedAt);

  return (
    <View
      style={[styles.wrap, { backgroundColor: theme.colors.surface.card }]}
      testID="prop-pass-insights"
      accessibilityRole="summary"
      accessibilityLabel={t("propPass.insights.sectionA11y")}
    >
      <View style={styles.header}>
        <YdlText role="label">{t("propPass.insights.title")}</YdlText>
        <YdlText role="caption" color="text.secondary">
          {updated ?? t("propPass.freshness.unknown")}
        </YdlText>
      </View>

      {readiness === "more_data_needed" ? (
        <>
          <YdlText role="bodyEmphasized">{t("propPass.insights.moreDataTitle")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("propPass.insights.moreDataBody", { count: needed || 3 })}
          </YdlText>
        </>
      ) : (
        <>
          <View style={styles.row}>
            <YdlText role="caption" color="text.secondary">
              {t("propPass.insights.readiness")}
            </YdlText>
            <YdlText role="bodyEmphasized">
              {t(`propPass.insights.readinessLevel.${readiness}`)}
            </YdlText>
          </View>
          <YdlText role="caption" color="text.tertiary">
            {t("propPass.insights.workingTitle")}
          </YdlText>
          <YdlText role="body" color="text.secondary">
            {t(`propPass.insights.working.${hero}`)}
          </YdlText>
          <YdlText role="caption" color="text.tertiary">
            {t("propPass.insights.riskTitle")}
          </YdlText>
          <YdlText role="body" color="text.secondary">
            {t(`propPass.insights.risk.${hero}`)}
          </YdlText>
          <YdlText role="caption" color="text.tertiary">
            {t("propPass.insights.nextTitle")}
          </YdlText>
          <YdlText role="body" color="text.secondary">
            {t(`propPass.insights.next.${hero}`)}
          </YdlText>
        </>
      )}

      <YdlButton
        label={t("propPass.insights.openDetail")}
        variant="secondary"
        onPress={onOpenDetail}
        testID="prop-pass-insights-open"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
});
