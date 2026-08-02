/**
 * Visual Trading Heatmap — graduated lime/red cells from journal data only.
 */

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import { YDL_MIN_TOUCH_TARGET } from "../ydl/accessibility";
import { formatStatsMoney, formatStatsPct } from "./presentation";
import {
  buildVisualHeatmap,
  heatmapReadiness,
  HEATMAP_MODE_LABELS,
  type HeatmapCell,
  type HeatmapMode,
} from "./tradingHeatmap";
import type { Trade } from "../app/types";

type Props = {
  trades: Trade[];
};

function heatColor(cell: HeatmapCell, maxAbs: number): string {
  if (!cell.count) return "rgba(255,255,255,0.045)";
  const intensity = Math.min(1, Math.abs(cell.pnl) / Math.max(1, maxAbs));
  if (cell.pnl > 0) {
    const a = 0.22 + intensity * 0.62;
    return `rgba(163,255,18,${a.toFixed(2)})`;
  }
  if (cell.pnl < 0) {
    const a = 0.22 + intensity * 0.62;
    return `rgba(255,59,95,${a.toFixed(2)})`;
  }
  return "rgba(255,255,255,0.06)";
}

/** Compact P&L for dense day×hour cells — avoids ellipsis on small tiles. */
function formatCompactHeatMoney(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const k = abs / 1000;
    const digits = k >= 10 ? 0 : 1;
    return `${sign}$${k.toFixed(digits)}k`;
  }
  return `${sign}$${Math.round(abs)}`;
}

export function StatsHeatmapCard({ trades }: Props) {
  const theme = useYdlTheme("dark");
  const [mode, setMode] = useState<HeatmapMode>("weekday");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const cells = useMemo(() => buildVisualHeatmap(trades, mode), [trades, mode]);
  const readiness = useMemo(() => heatmapReadiness(trades.length), [trades.length]);
  const maxAbs = useMemo(
    () => Math.max(1, ...cells.filter((c) => c.count > 0).map((c) => Math.abs(c.pnl))),
    [cells],
  );
  const selected = cells.find((c) => c.key === selectedKey) || null;
  const compact = mode === "dayHour";

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.surface.card }]}
      testID="stats-heatmap"
    >
      <YdlText role="label">Trading Heatmap</YdlText>
      {!readiness.ready ? (
        <>
          <YdlText role="body" color="text.secondary" testID="stats-heatmap-progress">
            {readiness.message}
          </YdlText>
          <YdlText role="caption" color="text.secondary">
            {readiness.progressLabel}
          </YdlText>
        </>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segmentRow}
      >
        {(["dayHour", "weekday", "session", "instrument", "setup"] as HeatmapMode[]).map((id) => {
          const active = mode === id;
          return (
            <Pressable
              key={id}
              onPress={() => {
                setMode(id);
                setSelectedKey(null);
              }}
              style={[
                styles.segment,
                {
                  backgroundColor: active
                    ? theme.colors.action.primary
                    : theme.colors.surface.interactive,
                  borderColor: theme.colors.border.subtle,
                  minHeight: YDL_MIN_TOUCH_TARGET,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={HEATMAP_MODE_LABELS[id]}
            >
              <YdlText
                role="caption"
                numberOfLines={1}
                style={{
                  color: active ? theme.colors.action.primaryText : theme.colors.text.secondary,
                }}
              >
                {HEATMAP_MODE_LABELS[id]}
              </YdlText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.grid, compact && styles.gridCompact]} testID="stats-heatmap-grid">
        {cells.map((cell) => (
          <Pressable
            key={cell.key}
            onPress={() => setSelectedKey(cell.key)}
            accessibilityRole="button"
            accessibilityLabel={
              cell.count
                ? `${cell.label}. ${cell.count} trades. Win rate ${formatStatsPct(cell.winRate)}. Average ${formatStatsMoney(cell.avg)}. Total ${formatStatsMoney(cell.pnl)}.`
                : `${cell.label}. No trades`
            }
            style={[
              styles.cell,
              compact && styles.cellCompact,
              { backgroundColor: heatColor(cell, maxAbs) },
            ]}
          >
            <YdlText role="caption" numberOfLines={1} color="text.secondary">
              {cell.label}
            </YdlText>
            <YdlText role="caption" numberOfLines={1}>
              {cell.count
                ? compact
                  ? formatCompactHeatMoney(cell.pnl)
                  : formatStatsMoney(cell.pnl)
                : "—"}
            </YdlText>
          </Pressable>
        ))}
      </View>

      <View style={styles.legend} accessibilityRole="summary" accessibilityLabel="Legend. Lime positive. Red negative. Neutral no data.">
        <View style={[styles.legendSwatch, { backgroundColor: "rgba(163,255,18,0.55)" }]} />
        <YdlText role="caption" color="text.secondary">
          Positive
        </YdlText>
        <View style={[styles.legendSwatch, { backgroundColor: "rgba(255,59,95,0.55)" }]} />
        <YdlText role="caption" color="text.secondary">
          Negative
        </YdlText>
        <View style={[styles.legendSwatch, { backgroundColor: "rgba(255,255,255,0.045)" }]} />
        <YdlText role="caption" color="text.secondary">
          No data
        </YdlText>
      </View>

      {selected && selected.count > 0 ? (
        <View style={styles.detail} testID="stats-heatmap-selected">
          <YdlText role="bodyEmphasized">{selected.label}</YdlText>
          <YdlText role="caption" color="text.secondary">
            {`${selected.count} trades · ${formatStatsPct(selected.winRate)} WR · avg ${formatStatsMoney(selected.avg)} · total ${formatStatsMoney(selected.pnl)}`}
          </YdlText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, gap: 10 },
  segmentRow: { flexDirection: "row", gap: 8, paddingRight: 16 },
  segment: {
    flexShrink: 0,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  gridCompact: {
    // Keep 7 dayHour columns without percentage+gap overflow (overflow was clipping labels).
    gap: 3,
  },
  cell: {
    width: "31%",
    minHeight: 56,
    borderRadius: 10,
    padding: 8,
    gap: 2,
  },
  cellCompact: {
    width: "13%",
    minHeight: 56,
    paddingHorizontal: 2,
    paddingVertical: 5,
    alignItems: "center",
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  detail: { gap: 4, paddingTop: 4 },
});
