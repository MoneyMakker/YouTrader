import React from "react";
import { Text, View } from "react-native";
import { t } from "../../i18n";
import { CountUpText } from "../ui/premium";
import { AnimatedEntrance } from "../ui/AnimatedEntrance";
import { getYdlNumberMotionConfig } from "../../ydl";
import { C } from "../../app/theme";
import { styles } from "../../app/styles";
import type { Trade } from "../../app/types";
import { moneyCompact } from "../../app/utils/format";
import { buildDailySeries, calcStats } from "../../app/utils/stats";

type StatsMetricRow = {
  label: string;
  value: string;
  tone: "green" | "red" | "purple" | "grey";
  pro?: boolean;
  numericValue?: number;
  decimals?: number;
  formatValue?: (value: number) => string;
  hero?: boolean;
};

type StatsMetricSection = {
  title: string;
  rows: StatsMetricRow[];
  overview?: boolean;
};

export function StatsMetricDashboard({
  stats,
  trades,
  consistency,
  isPremium,
  band,
  showTitle = true,
}: {
  stats: ReturnType<typeof calcStats>;
  trades: Trade[];
  consistency: number;
  isPremium: boolean;
  band: "overview" | "detail";
  showTitle?: boolean;
}) {
  const sections: StatsMetricSection[] = (() => {
    if (band === "overview") {
      const overview: StatsMetricRow[] = [
        {
          label: t("pnl"),
          value: moneyCompact(stats.pnl),
          numericValue: stats.pnl,
          formatValue: moneyCompact,
          tone: stats.pnl >= 0 ? "green" : "red",
          hero: true,
        },
        { label: t("winRate"), value: `${stats.wr.toFixed(0)}%`, numericValue: stats.wr, formatValue: (value) => `${value.toFixed(0)}%`, tone: stats.wr >= 50 ? "green" : "red" },
        { label: t("profitFactor"), value: stats.pf ? stats.pf.toFixed(2) : "—", numericValue: stats.pf || undefined, decimals: 2, tone: stats.pf >= 1.5 ? "green" : "purple", pro: true },
        { label: t("trades"), value: String(stats.count), numericValue: stats.count, tone: "grey" },
      ];
      return [{ title: t("statsOverview"), rows: overview, overview: true }];
    }

    const wins = trades.filter((trade) => trade.pnl > 0).length;
    const losses = trades.filter((trade) => trade.pnl < 0).length;
    const biggestWin = Math.max(0, ...trades.map((trade) => trade.pnl));
    const biggestLoss = Math.min(0, ...trades.map((trade) => trade.pnl));
    const dailySeries = buildDailySeries(trades);
    const avgDay = dailySeries.length ? stats.pnl / dailySeries.length : 0;

    const performance: StatsMetricRow[] = [
      { label: t("biggestWin"), value: moneyCompact(biggestWin), numericValue: biggestWin, formatValue: moneyCompact, tone: "green" },
      { label: t("expectancy"), value: moneyCompact(stats.exp), numericValue: stats.exp, formatValue: moneyCompact, tone: stats.exp >= 0 ? "green" : "red", pro: true },
      { label: t("microAvgDay"), value: moneyCompact(avgDay), numericValue: avgDay, formatValue: moneyCompact, tone: avgDay >= 0 ? "green" : "red" },
    ];

    const consistencyRows: StatsMetricRow[] = [
      { label: t("consistency"), value: `${consistency.toFixed(0)}%`, numericValue: consistency, formatValue: (value) => `${value.toFixed(0)}%`, tone: consistency >= 65 ? "green" : "purple", pro: true },
      { label: t("stabilityScore"), value: stats.sharpeRatio ? stats.sharpeRatio.toFixed(2) : "0.00", numericValue: stats.sharpeRatio || 0, decimals: 2, tone: stats.sharpeRatio >= 0.8 ? "green" : "purple", pro: true },
      { label: t("maxWinningDayStreak"), value: String(stats.maxWinDayStreak), numericValue: stats.maxWinDayStreak, tone: "green", pro: true },
    ];

    const risk: StatsMetricRow[] = [
      { label: t("biggestLoss"), value: moneyCompact(biggestLoss), numericValue: biggestLoss, formatValue: moneyCompact, tone: biggestLoss < 0 ? "red" : "grey" },
      { label: t("microMaxDd"), value: moneyCompact(stats.maxDd), numericValue: stats.maxDd, formatValue: moneyCompact, tone: stats.maxDd < 0 ? "red" : "grey" },
      { label: t("maxLosingDayStreak"), value: String(stats.maxLossDayStreak), numericValue: stats.maxLossDayStreak, tone: stats.maxLossDayStreak >= 2 ? "red" : "grey", pro: true },
    ];

    const execution: StatsMetricRow[] = [
      { label: t("winLoss"), value: `${wins} / ${losses}`, tone: wins >= losses ? "green" : "red" },
      { label: t("avgWinLoss"), value: stats.avgWinLoss ? stats.avgWinLoss.toFixed(2) : "—", numericValue: stats.avgWinLoss || undefined, decimals: 2, tone: stats.avgWinLoss >= 1.5 ? "green" : "purple", pro: true },
    ];

    return [
      { title: t("statsPerformance"), rows: performance },
      { title: t("consistency"), rows: consistencyRows },
      { title: t("risk"), rows: risk },
      { title: t("statsExecution"), rows: execution },
    ];
  })();

  const renderTile = (row: StatsMetricRow) => {
    const locked = row.pro && !isPremium;
    const color =
      row.tone === "red" ? C.red : row.tone === "purple" ? C.purple : row.tone === "green" ? C.green : C.sub;
    const displayValue = locked ? "PRO" : row.value;
    const a11yLabel = `${row.label}, ${displayValue}`;
    const valueStyle = row.hero ? styles.statsMetricValueHero : styles.statsMetricValue;
    return (
      <AnimatedEntrance
        key={row.label}
        style={[
          styles.statsMetricTile,
          row.hero && styles.statsMetricTileHero,
          locked && styles.statsMetricTileLocked,
        ]}
        distance={8}
      >
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={a11yLabel}
          style={styles.statsMetricTileBody}
        >
          {locked || row.numericValue === undefined ? (
            <Text
              style={[valueStyle, { color: locked ? C.muted : color }]}
              maxFontSizeMultiplier={1.35}
              importantForAccessibility="no"
            >
              {displayValue}
            </Text>
          ) : (
            <CountUpText
              value={row.numericValue}
              durationMs={520}
              decimals={row.decimals ?? 0}
              formatValue={row.formatValue}
              importantForAccessibility="no"
              textStyle={[
                valueStyle,
                {
                  color,
                  fontVariant: getYdlNumberMotionConfig("currency").fontVariant,
                },
              ]}
            />
          )}
          <Text
            style={styles.statsMetricLabel}
            maxFontSizeMultiplier={1.2}
            importantForAccessibility="no"
          >
            {row.label}
          </Text>
        </View>
      </AnimatedEntrance>
    );
  };

  return (
    <View style={styles.statsMetricDashboard}>
      {showTitle ? (
        <View style={styles.statsMetricHeader}>
          <Text style={styles.statsDashboardTitle} maxFontSizeMultiplier={1.3} accessibilityRole="header">
            {t("statsDashboard")}
          </Text>
        </View>
      ) : null}
      {sections.map((section) => (
        <View key={section.title} style={styles.statsMetricSection}>
          <Text style={styles.statsMetricSectionTitle} maxFontSizeMultiplier={1.2} accessibilityRole="header">
            {section.title}
          </Text>
          <View style={[styles.statsMetricGrid, section.overview && styles.statsMetricOverviewGrid]}>
            {section.rows.map(renderTile)}
          </View>
        </View>
      ))}
    </View>
  );
}

