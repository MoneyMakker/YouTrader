import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlCard } from "../../ydl/components/YdlCard";
import { YdlText } from "../../ydl/components/YdlText";
import { moneyOrDash } from "../presentation";
import type { BufferViewModel, PropPassViewModel } from "../types";

export function PropPassRuleStatus({ model }: { model: PropPassViewModel }) {
  const { t } = useTranslation();
  const rules = model.rules;
  if (!rules) return null;
  const currency = rules.currency;
  const profit = moneyOrDash(rules.profitTargetMinor, currency).display;
  const profitCurrent = moneyOrDash(
    model.progress.profitTarget?.minor != null && model.progress.profitRemaining?.minor != null
      ? model.progress.profitTarget.minor - model.progress.profitRemaining.minor
      : null,
    currency,
  ).display;
  return (
    <YdlCard testID="prop-pass-rule-status">
      <YdlText role="label">{t("propPass.rules.title")}</YdlText>
      <RuleRow label={t("propPass.rules.profitTarget")} value={`${profitCurrent} / ${profit}`} />
      {rules.dailyLossLimitMinor != null ? (
        <RuleRow
          label={t("propPass.rules.dailyLoss")}
          value={formatBuffer(model.buffers.dailyLoss, rules.dailyLossLimitMinor, currency)}
          status={model.buffers.dailyLoss?.status}
        />
      ) : null}
      <RuleRow
        label={t("propPass.rules.maxDrawdown")}
        value={formatBuffer(model.buffers.trailingDrawdown, rules.drawdownAmountMinor, currency)}
        status={model.buffers.trailingDrawdown?.status}
      />
      {rules.minimumTradingDays != null ? (
        <RuleRow
          label={t("propPass.rules.minimumDays")}
          value={t("propPass.rules.daysValue", {
            current: model.daysTraded ?? "—",
            limit: rules.minimumTradingDays,
          })}
        />
      ) : null}
    </YdlCard>
  );
}

function formatBuffer(buffer: BufferViewModel | undefined, limit: number | null, currency: string) {
  if (limit == null) return "—";
  const remaining = moneyOrDash(buffer?.remainingMinor ?? null, currency).display;
  return `${remaining} / ${moneyOrDash(limit, currency).display}`;
}

function RuleRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: BufferViewModel["status"];
}) {
  const suffix = status && status !== "unsupported" ? ` · ${status}` : "";
  return (
    <View style={styles.row}>
      <YdlText role="caption" color="text.secondary">{label}</YdlText>
      <YdlText role="bodyEmphasized">{`${value}${suffix}`}</YdlText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
});
