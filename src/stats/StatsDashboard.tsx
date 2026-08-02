/**
 * Premium Stats dashboard — trader-focused IA.
 * Free users see useful core metrics; no full-screen unlock overlays.
 * Radar + Heatmap always present (visual readiness when data is thin).
 */

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlText } from "../ydl/components/YdlText";
import { YdlButton } from "../ydl/components/YdlButton";
import { useYdlTheme } from "../ydl/tokens";
import { YDL_MIN_TOUCH_TARGET } from "../ydl/accessibility";
import type { Trade } from "../app/types";
import { calcStats } from "../app/utils/stats";
import { StatsEquitySection } from "../components/stats/StatsEquitySection";
import {
  deriveBestEdge,
  deriveBiggestLeak,
  deriveRecentTrend,
  formatStatsMoney,
  formatStatsPct,
  formatStatsRatio,
  groupTradesByKey,
  performanceStateLabel,
  sessionBucket,
  type StatsPeriodId,
} from "./presentation";
import { buildPerformanceRadar } from "./performanceRadar";
import { getInsightsLearningState, type InsightsLearningTarget } from "./insightsLearning";
import { StatsRadarCard } from "./StatsRadarCard";
import { StatsHeatmapCard } from "./StatsHeatmapCard";

const PERIODS: StatsPeriodId[] = ["1D", "7D", "1M", "YTD", "1Y", "ALL"];

type Props = {
  trades: Trade[];
  period: StatsPeriodId;
  onPeriodChange: (period: StatsPeriodId) => void;
  onLogTrade?: () => void;
  onOpenReports?: () => void;
  isPremium?: boolean;
};

function Metric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <YdlText role="caption" color="text.secondary">
        {label}
      </YdlText>
      <YdlText role={emphasis ? "title" : "bodyEmphasized"}>{value}</YdlText>
    </View>
  );
}

export function StatsDashboard({
  trades,
  period,
  onPeriodChange,
  onLogTrade,
  onOpenReports,
}: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const [breakdown, setBreakdown] = useState<"instrument" | "direction" | "session">("instrument");
  const stats = useMemo(() => calcStats(trades), [trades]);
  const bestEdge = useMemo(() => deriveBestEdge(trades), [trades]);
  const biggestLeak = useMemo(() => deriveBiggestLeak(trades), [trades]);
  const recentTrend = useMemo(() => deriveRecentTrend(trades), [trades]);
  const radar = useMemo(() => buildPerformanceRadar(trades), [trades]);
  const insightsLearning = useMemo(
    () =>
      getInsightsLearningState({
        tradeCount: trades.length,
        hasRecentTrend: Boolean(recentTrend),
        radarReady: radar.ready,
        hasBestEdge: Boolean(bestEdge),
        hasBiggestLeak: Boolean(biggestLeak),
      }),
    [bestEdge, biggestLeak, radar.ready, recentTrend, trades.length],
  );
  const breakdownRows = useMemo(() => {
    if (breakdown === "direction") {
      return groupTradesByKey(trades, (tr) => String(tr.direction || "—").toUpperCase());
    }
    if (breakdown === "session") {
      return groupTradesByKey(trades, (tr) => sessionBucket(tr));
    }
    return groupTradesByKey(trades, (tr) => String(tr.symbol || "—").toUpperCase());
  }, [breakdown, trades]);

  if (!trades.length) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background.primary }}
        contentContainerStyle={styles.body}
        testID="stats-dashboard-empty"
      >
        <PeriodBar period={period} onPeriodChange={onPeriodChange} />
        <View style={[styles.hero, { backgroundColor: theme.colors.surface.card }]}>
          <YdlText role="title">{t("stats.emptyTitle")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("stats.emptyBody")}
          </YdlText>
          {onLogTrade ? (
            <YdlButton label={t("stats.logTradeCta")} onPress={onLogTrade} testID="stats-log-trade" />
          ) : null}
        </View>
        <StatsRadarCard trades={trades} model={radar} />
        <StatsHeatmapCard trades={trades} />
      </ScrollView>
    );
  }

  const conclusion =
    bestEdge?.insight ||
    (stats.pnl >= 0
      ? t("stats.heroPositive")
      : t("stats.heroNegative"));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background.primary }}
      contentContainerStyle={styles.body}
      testID="stats-dashboard"
    >
      <PeriodBar period={period} onPeriodChange={onPeriodChange} />

      <View
        style={[styles.hero, { backgroundColor: theme.colors.surface.card }]}
        accessibilityRole="summary"
        accessibilityLabel={`${formatStatsMoney(stats.pnl)}. ${stats.count} trades. ${performanceStateLabel(stats.pnl, stats.count)}`}
        testID="stats-hero"
      >
        <YdlText role="caption" color="text.secondary">
          {t("stats.netPnlPeriod", { period })}
        </YdlText>
        <YdlText
          role="display"
          style={{ color: stats.pnl >= 0 ? theme.colors.status.positive : theme.colors.status.negative }}
        >
          {formatStatsMoney(stats.pnl)}
        </YdlText>
        <YdlText role="body" color="text.secondary">
          {`${stats.count} ${t("stats.tradesLabel")} · ${performanceStateLabel(stats.pnl, stats.count)}`}
        </YdlText>
        <YdlText role="body">{conclusion}</YdlText>
      </View>

      <View testID="stats-equity">
        <StatsEquitySection trades={trades} stats={stats} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface.card }]} testID="stats-core-metrics">
        <YdlText role="label">{t("stats.coreMetrics")}</YdlText>
        <View style={styles.grid}>
          <Metric label={t("stats.winRate")} value={formatStatsPct(stats.wr)} emphasis />
          <Metric label={t("stats.profitFactor")} value={formatStatsRatio(stats.pf)} emphasis />
          <Metric label={t("stats.expectancy")} value={formatStatsMoney(stats.exp)} emphasis />
          <Metric label={t("stats.avgWin")} value={formatStatsMoney(stats.avgWin)} />
          <Metric
            label={t("stats.avgLoss")}
            value={formatStatsMoney(
              stats.avgLoss === 0 ? 0 : -Math.abs(Number(stats.avgLoss) || 0),
            )}
          />
          <Metric label={t("stats.maxDrawdown")} value={formatStatsMoney(-Math.abs(stats.maxDd || 0))} />
        </View>
      </View>

      <StatsRadarCard trades={trades} model={radar} />
      <StatsHeatmapCard trades={trades} />

      <View style={[styles.card, { backgroundColor: theme.colors.surface.card }]} testID="stats-breakdown">
        <YdlText role="label">{t("stats.breakdown")}</YdlText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentRow}
        >
          {(["instrument", "direction", "session"] as const).map((id) => (
            <Pressable
              key={id}
              onPress={() => setBreakdown(id)}
              style={[
                styles.segment,
                {
                  backgroundColor:
                    breakdown === id ? theme.colors.action.primary : theme.colors.surface.interactive,
                  borderColor: theme.colors.border.subtle,
                  minHeight: YDL_MIN_TOUCH_TARGET,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: breakdown === id }}
            >
              <YdlText
                role="caption"
                numberOfLines={1}
                style={{ color: breakdown === id ? theme.colors.action.primaryText : theme.colors.text.secondary }}
              >
                {t(`stats.breakdown.${id}`)}
              </YdlText>
            </Pressable>
          ))}
        </ScrollView>
        {breakdownRows.slice(0, 6).map((row) => (
          <View key={row.key} style={styles.breakdownRow}>
            <View style={{ flex: 1 }}>
              <YdlText role="bodyEmphasized">{row.key}</YdlText>
              <YdlText role="caption" color="text.secondary">
                {`${row.count} ${t("stats.tradesLabel")} · ${formatStatsPct(row.winRate)} WR`}
              </YdlText>
            </View>
            <YdlText
              role="bodyEmphasized"
              style={{ color: row.pnl >= 0 ? theme.colors.status.positive : theme.colors.status.negative }}
            >
              {formatStatsMoney(row.pnl)}
            </YdlText>
          </View>
        ))}
      </View>

      {insightsLearning.isLearning ? <InsightsLearningCard state={insightsLearning} t={t} /> : null}
      {bestEdge ? <InsightCard testID="stats-best-edge" data={bestEdge} positive /> : null}
      {biggestLeak ? <InsightCard testID="stats-biggest-leak" data={biggestLeak} positive={false} /> : null}

      <View style={[styles.card, { backgroundColor: theme.colors.surface.card }]} testID="stats-risk">
        <YdlText role="label">{t("stats.riskTitle")}</YdlText>
        <Metric label={t("stats.maxDrawdown")} value={formatStatsMoney(-Math.abs(stats.maxDd || 0))} />
        <Metric label={t("stats.riskControl")} value={formatStatsPct(stats.drawdownControl)} />
        <YdlText role="body" color="text.secondary">
          {t("stats.riskExplain", {
            dd: formatStatsMoney(-Math.abs(stats.maxDd || 0)),
          })}
        </YdlText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface.card }]} testID="stats-consistency">
        <YdlText role="label">{t("stats.consistency")}</YdlText>
        {(stats.weekday || []).slice(0, 5).map((row) => (
          <View key={row.label} style={styles.breakdownRow}>
            <View style={{ flex: 1 }}>
              <YdlText role="bodyEmphasized">{row.label}</YdlText>
              <YdlText role="caption" color="text.secondary">
                {`${row.count} ${t("stats.tradesLabel")} · ${formatStatsPct(row.wr)} WR`}
              </YdlText>
            </View>
            <YdlText
              role="bodyEmphasized"
              style={{ color: row.pnl >= 0 ? theme.colors.status.positive : theme.colors.status.negative }}
            >
              {formatStatsMoney(row.pnl)}
            </YdlText>
          </View>
        ))}
      </View>

      {!insightsLearning.isLearning || recentTrend ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface.card }]} testID="stats-recent-trend">
          <YdlText role="label">{t("stats.recentTrend")}</YdlText>
          {recentTrend ? (
            <>
              <YdlText role="body" color="text.secondary">
                {recentTrend.summary}
              </YdlText>
              <YdlText role="caption" color="text.secondary">
                {`P&L ${recentTrend.pnlDelta} · WR ${recentTrend.wrDelta} · Trades ${recentTrend.tradeDelta}`}
              </YdlText>
            </>
          ) : null}
        </View>
      ) : null}

      {onOpenReports ? (
        <YdlButton
          label={t("more.performanceReports")}
          variant="secondary"
          onPress={onOpenReports}
          testID="stats-open-reports"
        />
      ) : null}
    </ScrollView>
  );
}

function PeriodBar({
  period,
  onPeriodChange,
}: {
  period: StatsPeriodId;
  onPeriodChange: (p: StatsPeriodId) => void;
}) {
  const theme = useYdlTheme("dark");
  return (
    <View style={styles.periodRow} accessibilityRole="tablist" testID="stats-period-bar">
      {PERIODS.map((id) => {
        const active = id === period;
        return (
          <Pressable
            key={id}
            onPress={() => onPeriodChange(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Period ${id}`}
            style={[
              styles.periodChip,
              {
                backgroundColor: active ? theme.colors.action.primary : theme.colors.surface.interactive,
                minHeight: YDL_MIN_TOUCH_TARGET,
              },
            ]}
          >
            <YdlText
              role="caption"
              style={{ color: active ? theme.colors.action.primaryText : theme.colors.text.secondary }}
            >
              {id}
            </YdlText>
          </Pressable>
        );
      })}
    </View>
  );
}

function InsightCard({
  testID,
  data,
  positive,
}: {
  testID: string;
  data: ReturnType<typeof deriveBestEdge>;
  positive: boolean;
}) {
  const theme = useYdlTheme("dark");
  if (!data) return null;
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface.card }]} testID={testID}>
      <YdlText role="label">{data.title}</YdlText>
      <YdlText role="title">{data.subtitle}</YdlText>
      <YdlText
        role="bodyEmphasized"
        style={{ color: positive ? theme.colors.status.positive : theme.colors.status.negative }}
      >
        {`${formatStatsMoney(data.pnl)} · ${formatStatsPct(data.winRate)} · ${data.tradeCount} trades`}
      </YdlText>
      <YdlText role="body" color="text.secondary">
        {data.insight}
      </YdlText>
    </View>
  );
}

function InsightsLearningCard({
  state,
  t,
}: {
  state: ReturnType<typeof getInsightsLearningState>;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const theme = useYdlTheme("dark");
  const targetLabels: Record<InsightsLearningTarget, string> = {
    recentTrend: t("stats.recentTrend"),
    performanceRadar: t("stats.insightsTargetRadar"),
    bestEdge: t("stats.insightsTargetBestEdge"),
    biggestLeak: t("stats.insightsTargetBiggestLeak"),
  };
  const targets = state.targets.map((target) => targetLabels[target]).join(" · ");

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface.card }]} testID="stats-insights-learning">
      <YdlText role="bodyEmphasized">{t("stats.insightsLearningTitle")}</YdlText>
      <YdlText role="body" color="text.secondary">
        {t("stats.insightsLearningBody", { targets })}
      </YdlText>
      <YdlText role="caption" color="text.secondary">
        {t("stats.insightsProgress", { count: state.tradeCount, required: state.requiredTrades })}
      </YdlText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14, paddingBottom: 32 },
  hero: { borderRadius: 16, padding: 18, gap: 8 },
  card: { borderRadius: 14, padding: 14, gap: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: { width: "46%", gap: 2 },
  periodRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  periodChip: {
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentRow: { flexDirection: "row", gap: 8, paddingRight: 16 },
  segment: {
    flexShrink: 0,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
});
