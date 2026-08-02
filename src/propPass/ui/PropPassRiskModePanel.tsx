/**
 * Challenge/Live context + Calm/Balanced/Gambler risk mode planner UI.
 */

import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import { formatPropMoney } from "../formatMoney";
import type { PropPassViewModel } from "../types";
import {
  buildPropPassRiskModePlan,
  type PropPassAccountContext,
  type PropPassRiskModeId,
  type PropPassRiskModePlan,
} from "../riskModes";

type Props = {
  model: PropPassViewModel;
  currency: string;
};

function modeLabel(id: PropPassRiskModeId, t: (k: string) => string) {
  if (id === "calm") return t("propPass.riskMode.calm");
  if (id === "balanced") return t("propPass.riskMode.balanced");
  return t("propPass.riskMode.gambler");
}

function paceLabel(pace: PropPassRiskModePlan["pace"], t: (k: string) => string) {
  if (pace === "too_slow") return t("propPass.riskMode.paceTooSlow");
  if (pace === "too_aggressive") return t("propPass.riskMode.paceTooAggressive");
  if (pace === "on_pace") return t("propPass.riskMode.paceOnPace");
  return "—";
}

function drawdownSafetyLabel(
  value: PropPassRiskModePlan["drawdownSafety"],
  t: (k: string) => string,
) {
  if (value === "ok") return t("propPass.riskMode.drawdownHealthy");
  if (value === "warn") return t("propPass.riskMode.drawdownWatch");
  if (value === "hard") return t("propPass.riskMode.drawdownCritical");
  return "—";
}

export function PropPassRiskModePanel({ model, currency }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const [context, setContext] = useState<PropPassAccountContext>("challenge");
  const [mode, setMode] = useState<PropPassRiskModeId>("balanced");
  const [gamblerUnlocked, setGamblerUnlocked] = useState(false);
  const [stopDistanceDraft, setStopDistanceDraft] = useState("");
  const [stopOverride, setStopOverride] = useState<number | null>(null);

  const selectMode = (next: PropPassRiskModeId) => {
    if (next === "gambler" && !gamblerUnlocked) {
      const preview = buildPropPassRiskModePlan(buildInput(model, context, "gambler", stopOverride));
      const consequence = preview.gamblerConsequenceMinor;
      Alert.alert(
        t("propPass.riskMode.gamblerWarnTitle"),
        t("propPass.riskMode.gamblerWarnBody", {
          amount:
            consequence != null
              ? formatPropMoney(consequence, { currency })
              : t("propPass.valueUnavailable"),
        }),
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("propPass.riskMode.gamblerConfirm"),
            style: "destructive",
            onPress: () => {
              setGamblerUnlocked(true);
              setMode("gambler");
            },
          },
        ],
      );
      return;
    }
    if (next !== "gambler") setGamblerUnlocked(false);
    setMode(next);
  };

  const plan = useMemo(
    () => buildPropPassRiskModePlan(buildInput(model, context, mode, stopOverride)),
    [model, context, mode, stopOverride],
  );

  const applyStopDistance = () => {
    const n = Number(String(stopDistanceDraft).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    setStopOverride(n);
  };

  // Live must not show challenge-only “wins to target / remaining to pass” framing.
  const showChallengeProgress = context === "challenge";

  return (
    <View
      style={[styles.wrap, { backgroundColor: theme.colors.surface.card }]}
      testID="prop-pass-risk-mode-panel"
    >
      <YdlText role="label">{t("propPass.riskMode.contextTitle")}</YdlText>
      <View style={styles.row} testID="prop-pass-account-context">
        {(["challenge", "live"] as const).map((id) => (
          <Pressable
            key={id}
            testID={`prop-pass-context-${id}`}
            onPress={() => setContext(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: context === id }}
            style={[
              styles.chip,
              {
                borderColor: context === id ? theme.colors.action.primary : theme.colors.border.subtle,
                backgroundColor: context === id ? "rgba(163,230,53,0.14)" : "transparent",
              },
            ]}
          >
            <YdlText role="bodyEmphasized">
              {id === "challenge" ? t("propPass.riskMode.challenge") : t("propPass.riskMode.live")}
            </YdlText>
          </Pressable>
        ))}
      </View>

      <YdlText role="label">{t("propPass.riskMode.modeTitle")}</YdlText>
      <View style={styles.row} testID="prop-pass-risk-modes">
        {(["calm", "balanced", "gambler"] as const).map((id) => (
          <Pressable
            key={id}
            testID={`prop-pass-risk-mode-${id}`}
            onPress={() => selectMode(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === id }}
            style={[
              styles.chip,
              {
                borderColor: mode === id ? theme.colors.action.primary : theme.colors.border.subtle,
                backgroundColor: mode === id ? "rgba(163,230,53,0.14)" : "transparent",
                flex: 1,
              },
            ]}
          >
            <YdlText role="caption">{modeLabel(id, t)}</YdlText>
          </Pressable>
        ))}
      </View>
      {mode === "gambler" ? (
        <YdlText role="caption" color="text.secondary" testID="prop-pass-gambler-warning">
          {t("propPass.riskMode.gamblerHighRisk")}
        </YdlText>
      ) : null}

      {!plan.ready ? (
        <YdlText role="body" color="text.secondary" testID="prop-pass-risk-mode-missing">
          {plan.suggestedAction ?? t("propPass.riskMode.missingInputs")}
        </YdlText>
      ) : (
        <View style={styles.metrics} testID="prop-pass-risk-mode-plan">
          <Metric
            label={t("propPass.riskMode.maxRiskPerTrade")}
            value={formatPropMoney(plan.maxRiskPerTradeMinor!, { currency })}
          />
          <Metric
            label={t("propPass.riskMode.maxRiskToday")}
            value={formatPropMoney(plan.maxRiskTodayMinor!, { currency })}
          />
          {plan.maxContracts != null ? (
            <Metric label={t("propPass.riskMode.maxContracts")} value={String(plan.maxContracts)} />
          ) : (
            <View style={styles.metric} testID="prop-pass-max-contracts-cta">
              <YdlText role="caption" color="text.secondary">
                {t("propPass.riskMode.maxContracts")}
              </YdlText>
              <YdlText role="bodyEmphasized">{t("propPass.riskMode.addStopDistance")}</YdlText>
              <View style={styles.stopRow}>
                <TextInput
                  testID="prop-pass-stop-distance-input"
                  value={stopDistanceDraft}
                  onChangeText={setStopDistanceDraft}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.text.secondary}
                  style={[
                    styles.stopInput,
                    {
                      color: theme.colors.text.primary,
                      borderColor: theme.colors.border.subtle,
                      backgroundColor: theme.colors.surface.interactive,
                    },
                  ]}
                />
                <Pressable
                  testID="prop-pass-set-stop-distance"
                  onPress={applyStopDistance}
                  style={[styles.stopCta, { backgroundColor: theme.colors.action.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel={t("propPass.riskMode.setStopDistance")}
                >
                  <YdlText role="caption" style={{ color: "#0B0F0A" }}>
                    {t("propPass.riskMode.setStopDistance")}
                  </YdlText>
                </Pressable>
              </View>
            </View>
          )}
          <Metric
            label={t("propPass.riskMode.maxTradesToday")}
            value={plan.maxTradesToday != null ? String(plan.maxTradesToday) : "—"}
          />
          <Metric
            label={t("propPass.riskMode.stopAfterLosses")}
            value={plan.stopAfterLosses != null ? String(plan.stopAfterLosses) : "—"}
          />
          {showChallengeProgress ? (
            <Metric
              label={t("propPass.riskMode.winsToTarget")}
              value={plan.estimatedWinsToTarget != null ? String(plan.estimatedWinsToTarget) : "—"}
            />
          ) : null}
          {showChallengeProgress ? (
            <Metric
              label={t("propPass.riskMode.sessionsRemaining")}
              value={
                plan.estimatedSessionsRemaining != null
                  ? String(plan.estimatedSessionsRemaining)
                  : "—"
              }
            />
          ) : null}
          <Metric
            label={t("propPass.riskMode.dailyUsage")}
            value={
              plan.dailyLossRoomUsagePct != null
                ? `${Math.round(plan.dailyLossRoomUsagePct * 100)}%`
                : "—"
            }
          />
          <Metric
            label={t("propPass.riskMode.drawdownSafety")}
            value={drawdownSafetyLabel(plan.drawdownSafety, t)}
          />
          <Metric label={t("propPass.riskMode.pace")} value={paceLabel(plan.pace, t)} />
          <YdlText role="body" color="text.secondary">
            {plan.suggestedAction}
          </YdlText>
        </View>
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <YdlText role="caption" color="text.secondary">
        {label}
      </YdlText>
      <YdlText role="bodyEmphasized">{value}</YdlText>
    </View>
  );
}

function buildInput(
  model: PropPassViewModel,
  context: PropPassAccountContext,
  mode: PropPassRiskModeId,
  stopOverride: number | null,
) {
  return {
    context,
    mode,
    accountSizeMinor: model.account.accountSize?.minor ?? null,
    currentEquityMinor: model.progress.currentBalance?.minor ?? null,
    profitTargetMinor: model.rules?.profitTargetMinor ?? model.progress.profitTarget?.minor ?? null,
    profitRemainingMinor: model.progress.profitRemaining?.minor ?? null,
    dailyLossLimitMinor: model.rules?.dailyLossLimitMinor ?? model.buffers.dailyLoss?.limitMinor ?? null,
    dailyLossRemainingMinor: model.buffers.dailyLoss?.remainingMinor ?? null,
    maxDrawdownLimitMinor:
      model.rules?.drawdownAmountMinor ??
      model.buffers.trailingDrawdown?.limitMinor ??
      model.buffers.totalLoss?.limitMinor ??
      null,
    maxDrawdownRemainingMinor:
      model.buffers.trailingDrawdown?.remainingMinor ??
      model.buffers.totalLoss?.remainingMinor ??
      null,
    stopSizePoints: stopOverride != null && stopOverride > 0 ? stopOverride : null,
    // Point value stays null until instrument config is wired; contracts CTA collects stop first.
    pointValue: stopOverride != null && stopOverride > 0 ? 5 : null,
    userMaxRiskPerTradeMinor: null,
    realizedPnlTodayMinor: null,
    winRate: null,
    avgWinR: null,
  };
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, padding: 14, gap: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 88,
  },
  metrics: { gap: 10 },
  metric: { gap: 4 },
  stopRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 6 },
  stopInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  stopCta: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
});
