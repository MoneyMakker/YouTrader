import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import {
  currentProfitMinor,
  mapChallengeHeroStatus,
  moneyOrDash,
  tradesNeededForInsights,
  type ChallengeHeroStatus,
} from "../presentation";
import type { PropPassViewModel } from "../types";

type Props = {
  model: PropPassViewModel;
};

function statusColor(
  status: ChallengeHeroStatus,
  theme: ReturnType<typeof useYdlTheme>,
): string {
  switch (status) {
    case "on_track":
    case "passed":
      return theme.colors.status.positive;
    case "caution":
      return theme.colors.status.warning;
    case "at_risk":
    case "violated":
      return theme.colors.status.negative;
    default:
      return theme.colors.text.secondary;
  }
}

export function PropPassChallengeHero({ model }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const status = mapChallengeHeroStatus(model);
  const currency =
    model.progress.profitTarget?.currency ??
    model.account.accountSize?.currency ??
    "USD";
  const profit = currentProfitMinor(model);
  const target = model.progress.profitTarget?.minor ?? null;
  const remaining = model.progress.profitRemaining?.minor ?? null;
  const daily = model.buffers.dailyLoss;
  const maxLoss = model.buffers.totalLoss ?? model.buffers.trailingDrawdown;
  const color = statusColor(status, theme);
  const needed = tradesNeededForInsights(model.assignedTradeCount);

  if (status === "insufficient_data") {
    return (
      <View
        style={[styles.hero, { backgroundColor: theme.colors.surface.card }]}
        accessibilityRole="summary"
        testID="prop-pass-hero"
        accessibilityLabel={t("propPass.hero.buildingA11y", { count: needed })}
      >
        <YdlText role="label" color="text.secondary">
          {t("propPass.hero.buildingTitle")}
        </YdlText>
        <YdlText role="title">{t("propPass.hero.buildingBody", { count: needed })}</YdlText>
      </View>
    );
  }

  const profitFmt = moneyOrDash(profit, currency);
  const targetFmt = moneyOrDash(target, currency);
  const remainingFmt = moneyOrDash(remaining, currency);
  const dailyFmt = moneyOrDash(daily?.remainingMinor ?? null, currency);
  const maxFmt = moneyOrDash(maxLoss?.remainingMinor ?? null, currency);

  return (
    <View
      style={[styles.hero, { backgroundColor: theme.colors.surface.card }]}
      accessibilityRole="summary"
      testID="prop-pass-hero"
      accessibilityLabel={`${t(`propPass.hero.status.${status}`)}. ${profitFmt.a11y} of ${targetFmt.a11y}. ${remainingFmt.a11y} left.`}
    >
      <YdlText role="label" style={{ color, letterSpacing: 1.2 }}>
        {t(`propPass.hero.status.${status}`)}
      </YdlText>
      <YdlText role="display" style={styles.pnl}>
        {`${profitFmt.display} ${t("propPass.hero.of")} ${targetFmt.display}`}
      </YdlText>
      <YdlText role="body" color="text.secondary">
        {t("propPass.hero.leftToPass", { amount: remainingFmt.display })}
      </YdlText>

      <View style={styles.rooms}>
        <Room label={t("propPass.hero.dailyRoom")} value={dailyFmt.display} />
        <Room label={t("propPass.hero.maxRoom")} value={maxFmt.display} />
      </View>

      <YdlText role="body" style={styles.insight}>
        {t(`propPass.hero.insight.${status}`)}
      </YdlText>
    </View>
  );
}

function Room({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.room}>
      <YdlText role="caption" color="text.tertiary">
        {label}
      </YdlText>
      <YdlText role="bodyEmphasized">{value}</YdlText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  pnl: { marginTop: 4 },
  rooms: {
    flexDirection: "row",
    gap: 24,
    marginTop: 8,
  },
  room: { gap: 2, minWidth: 120 },
  insight: { marginTop: 8 },
});
