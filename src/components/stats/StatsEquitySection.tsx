import { MetricPillRow } from "../../app/ai/sharedUi";
import { getYdlNumberMotionConfig } from "../../ydl";
import { C } from "../../app/theme";
import { styles } from "../../app/styles";
import type { Trade } from "../../app/types";
import { moneyCompact } from "../../app/utils/format";
import { buildDailySeries, calcStats } from "../../app/utils/stats";
import { View, Text, PanResponder, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import React, { useMemo, useState } from "react";
import { t } from "../../i18n";

function buildEquityPoints(trades: Trade[], width: number, height: number) {
  const daily = buildDailySeries(trades);
  let cumulative = 0;
  const rows = daily.map((day, index) => ({ ...day, index, cumulative: (cumulative += day.value) }));
  if (!rows.length) return [];
  const values = rows.map((row) => row.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = Math.max(1, max - min);
  const padX = 18;
  const padY = 16;
  return rows.map((row, index) => ({
    ...row,
    x: padX + (rows.length === 1 ? (width - padX * 2) / 2 : (index / (rows.length - 1)) * (width - padX * 2)),
    y: padY + (height - padY * 2) - ((row.cumulative - min) / range) * (height - padY * 2),
    tradeCount: trades.filter((trade) => trade.date === row.label).length,
  }));
}

function smoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  return points.reduce((path, point, index) => {
    if (index === 0) return `M${point.x},${point.y}`;
    const prev = points[index - 1];
    const midX = (prev.x + point.x) / 2;
    return `${path} C${midX},${prev.y} ${midX},${point.y} ${point.x},${point.y}`;
  }, "");
}

export function StatsEquitySection({ trades, stats }: { trades: Trade[]; stats: ReturnType<typeof calcStats> }) {
  const { width } = useWindowDimensions();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const chartWidth = Math.max(300, Math.min(720, width - 56));
  const chartHeight = 250;
  const points = useMemo(() => buildEquityPoints(trades, chartWidth, chartHeight), [chartHeight, chartWidth, trades]);
  const dailySeries = useMemo(() => buildDailySeries(trades), [trades]);
  const avgDay = dailySeries.length ? stats.pnl / dailySeries.length : 0;
  const selected = selectedIndex != null ? points[selectedIndex] : points[points.length - 1];
  const path = smoothPath(points);
  const fillPath = points.length ? `${path} L${points[points.length - 1].x},${chartHeight - 12} L${points[0].x},${chartHeight - 12} Z` : "";
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const x = event.nativeEvent.locationX;
          const nearest = points.reduce((best, point, index) => (Math.abs(point.x - x) < Math.abs(points[best]?.x - x || 9999) ? index : best), 0);
          setSelectedIndex(nearest);
        },
        onPanResponderMove: (event) => {
          const x = event.nativeEvent.locationX;
          const nearest = points.reduce((best, point, index) => (Math.abs(point.x - x) < Math.abs(points[best]?.x - x || 9999) ? index : best), 0);
          setSelectedIndex(nearest);
        },
      }),
    [points],
  );

  return (
    <View style={[styles.terminalHeroCard, styles.terminalEquityCard, { backgroundColor: "transparent" }]}>
      <View style={styles.terminalHeaderRow}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          <Text
            style={[styles.terminalSub, { fontSize: 13, fontWeight: "700", color: C.text, letterSpacing: 0.2 }]}
            numberOfLines={1}
          >
            {t("equityCurveTitle")}
          </Text>
          <Text style={styles.terminalSub} numberOfLines={1}>
            {t("equityCurveSub")}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
          <Text
            style={[styles.terminalKpi, { color: stats.pnl >= 0 ? C.green : C.red, fontVariant: getYdlNumberMotionConfig("currency").fontVariant }]}
            maxFontSizeMultiplier={1.35}
            accessibilityLabel={`${t("pnl")} ${moneyCompact(stats.pnl)}`}
          >
            {moneyCompact(stats.pnl)}
          </Text>
          <Text style={styles.terminalSub}>{t("pnl")}</Text>
        </View>
      </View>
      <View style={styles.terminalChartWrap} {...panResponder.panHandlers}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="terminalEquityLine" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={C.purple} stopOpacity="0.72" />
              <Stop offset="1" stopColor={C.green} stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="terminalEquityFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.green} stopOpacity="0.18" />
              <Stop offset="1" stopColor={C.purple} stopOpacity="0.015" />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75].map((line) => (
            <Line key={line} x1={18} x2={chartWidth - 18} y1={chartHeight * line} y2={chartHeight * line} stroke="rgba(255,255,255,0.055)" strokeWidth={1} />
          ))}
          {fillPath ? <Path d={fillPath} fill="url(#terminalEquityFill)" /> : null}
          {path ? <Path d={path} stroke="url(#terminalEquityLine)" strokeWidth={4} strokeLinecap="round" fill="none" /> : null}
          {points.map((point, index) => (
            <Circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r={index === points.length - 1 ? 7 : 3.5} fill={point.value >= 0 ? C.green : C.red} stroke="rgba(0,0,0,0.85)" strokeWidth={2} />
          ))}
          {selected ? <Circle cx={selected.x} cy={selected.y} r={13} fill="none" stroke={C.green} strokeWidth={2} opacity={0.75} /> : null}
        </Svg>
        {selected ? (
          <View style={[styles.terminalTooltip, { left: Math.min(chartWidth - 178, Math.max(10, selected.x - 82)), top: Math.max(8, selected.y - 86) }]}>
            <Text style={styles.terminalTooltipDate}>{selected.label}</Text>
            <Text style={[styles.terminalTooltipPnl, { color: selected.value >= 0 ? C.green : C.red }]}>{moneyCompact(selected.value)}</Text>
            <Text style={styles.terminalTooltipMeta}>Trade #{selected.tradeCount || 1} • Equity {moneyCompact(selected.cumulative)}</Text>
          </View>
        ) : null}
      </View>
      <MetricPillRow
        items={[
          { label: t("microMaxDd"), value: moneyCompact(stats.maxDd), tone: stats.maxDd < 0 ? "red" : "grey" },
          { label: t("microAvgDay"), value: moneyCompact(avgDay), tone: avgDay >= 0 ? "green" : "red" },
          { label: t("recovery"), value: stats.recoveryFactor ? stats.recoveryFactor.toFixed(1) : "—", tone: "purple" },
        ]}
      />
    </View>
  );
}

