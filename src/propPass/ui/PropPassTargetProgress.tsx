import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useYdlReduceMotion } from "../../ydl/accessibility/useReduceMotion";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import {
  currentProfitMinor,
  moneyOrDash,
  progressPercent,
} from "../presentation";
import type { PropPassViewModel } from "../types";

type Props = {
  model: PropPassViewModel;
};

export function PropPassTargetProgress({ model }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const reduceMotion = useYdlReduceMotion();
  const currency =
    model.progress.currentBalance?.currency ??
    model.progress.profitTarget?.currency ??
    "USD";
  const pct = progressPercent(model) ?? 0;
  const balance = moneyOrDash(model.progress.currentBalance?.minor ?? null, currency);
  const targetBalance = moneyOrDash(
    model.progress.currentBalance?.minor != null &&
      model.progress.profitRemaining?.minor != null
      ? model.progress.currentBalance.minor + model.progress.profitRemaining.minor
      : model.progress.profitTarget?.minor ?? null,
    currency,
  );
  const profit = moneyOrDash(currentProfitMinor(model), currency);
  const remaining = moneyOrDash(model.progress.profitRemaining?.minor ?? null, currency);

  return (
    <View
      style={styles.wrap}
      accessibilityRole="summary"
      testID="prop-pass-target-progress"
      accessibilityLabel={t("propPass.progress.sectionA11y", {
        percent: pct,
        remaining: remaining.a11y,
      })}
    >
      <YdlText role="label">{t("propPass.progress.title")}</YdlText>
      <View
        style={[styles.track, { backgroundColor: theme.colors.surface.interactive }]}
        accessibilityElementsHidden
      >
        <View
          style={[
            styles.fill,
            {
              width: `${reduceMotion ? pct : pct}%` as `${number}%`,
              backgroundColor: theme.colors.action.primary,
            },
          ]}
        />
      </View>
      <YdlText role="caption" color="text.secondary">
        {t("propPass.progress.percentComplete", { percent: pct })}
      </YdlText>
      <MetricRow label={t("propPass.progress.currentBalance")} value={balance.display} />
      <MetricRow label={t("propPass.progress.targetBalance")} value={targetBalance.display} />
      <MetricRow label={t("propPass.progress.currentProfit")} value={profit.display} />
      <MetricRow label={t("propPass.progress.remainingToPass")} value={remaining.display} />
      <MetricRow
        label={t("propPass.progress.assignedTrades")}
        value={String(model.assignedTradeCount)}
      />
    </View>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <YdlText role="caption" color="text.secondary">
        {label}
      </YdlText>
      <YdlText role="bodyEmphasized">{value}</YdlText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  track: { height: 10, borderRadius: 5, overflow: "hidden", marginTop: 4 },
  fill: { height: "100%", borderRadius: 5 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 28,
  },
});
