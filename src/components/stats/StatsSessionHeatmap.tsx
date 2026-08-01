import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { t } from "../../i18n";
import { MetricPillRow, TerminalGlassCard } from "../../app/ai/sharedUi";
import { BottomSheetPanel } from "../ui/BottomSheetPanel";
import { styles } from "../../app/styles";
import type { Trade } from "../../app/types";
import { moneyCompact } from "../../app/utils/format";
import { safeDateFromISO } from "../../app/utils/dates";
import { sessionLabelForTrade } from "../../app/utils/stats";
import {
  buildAnalysisBreakdown,
  dayKeyForTrade,
  emptyBreakdown,
  hourKeyForTrade,
} from "../../app/utils/tradeBreakdown";

function SegmentedTimeFilter<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.terminalSegment}>
      {options.map((option) => (
        <Pressable key={option} onPress={() => onChange(option)} style={[styles.terminalSegmentBtn, value === option && styles.terminalSegmentActive]}>
          <Text style={[styles.terminalSegmentText, value === option && styles.terminalSegmentTextActive]}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}


type SessionMode = "Hours" | "Sessions" | "Days" | "Months";
const SESSION_MODES: SessionMode[] = ["Hours", "Sessions", "Days", "Months"];

function buildSessionCells(trades: Trade[], mode: SessionMode) {
  const keyFn =
    mode === "Hours"
      ? hourKeyForTrade
      : mode === "Sessions"
        ? sessionLabelForTrade
        : mode === "Days"
          ? dayKeyForTrade
          : (trade: Trade) => safeDateFromISO(trade.date).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const rows = buildAnalysisBreakdown(trades, keyFn);
  const orderedKeys =
    mode === "Hours"
      ? Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`)
      : mode === "Sessions"
        ? [t("sessionMorning"), t("sessionMidday"), t("sessionAfternoon")]
        : mode === "Days"
          ? [t("weekdayMonday"), t("weekdayTuesday"), t("weekdayWednesday"), t("weekdayThursday"), t("weekdayFriday"), t("weekdaySaturday"), t("weekdaySunday")]
          : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const expanded = orderedKeys.map((key) => byKey.get(key) || emptyBreakdown(key));
  const maxAbs = Math.max(1, ...expanded.map((row) => Math.abs(row.netPnl)));
  return expanded.map((item) => ({
    ...item,
    intensity: Math.min(1, Math.abs(item.netPnl) / maxAbs),
  }));
}

function heatCellColor(pnl: number, intensity: number) {
  if (pnl > 0) return intensity > 0.65 ? "rgba(91,176,0,0.82)" : "rgba(91,176,0,0.46)";
  if (pnl < 0) return intensity > 0.65 ? "rgba(255,59,95,0.78)" : "rgba(255,59,95,0.38)";
  return "rgba(255,255,255,0.038)";
}

export function StatsSessionHeatmap({ trades }: { trades: Trade[] }) {
  const [mode, setMode] = useState<SessionMode>("Hours");
  const [selected, setSelected] = useState<ReturnType<typeof buildSessionCells>[number] | null>(null);
  const cells = useMemo(() => buildSessionCells(trades, mode), [mode, trades]);

  return (
    <TerminalGlassCard>
      <View style={styles.terminalHeaderRow}>
        <View>
          <Text style={styles.terminalSectionTitle}>{t("heatmap")}</Text>
        </View>
      </View>
      <SegmentedTimeFilter options={SESSION_MODES} value={mode} onChange={(value) => setMode(value as SessionMode)} />
      <View style={styles.calendarHeatmapGrid}>
        {cells.length ? cells.map((cell) => (
          <Pressable key={cell.key} onPress={() => setSelected(cell)} style={[styles.calendarHeatmapCell, { backgroundColor: heatCellColor(cell.netPnl, cell.intensity) }]}>
            <Text style={styles.calendarHeatmapKey} numberOfLines={1}>{cell.key}</Text>
            <Text style={styles.calendarHeatmapValue} numberOfLines={1}>{cell.trades ? moneyCompact(cell.netPnl) : "—"}</Text>
            <Text style={styles.calendarHeatmapMeta}>{cell.trades} trades</Text>
          </Pressable>
        )) : (
          <Text style={styles.terminalSub}>{t("logTradesSessionIntel")}</Text>
        )}
      </View>
      <BottomSheetPanel visible={!!selected} title={selected?.key || "Session"} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            <MetricPillRow
              items={[
                { label: t("trades"), value: `${selected.trades}`, tone: "grey" },
                { label: t("winRate"), value: `${selected.winRate.toFixed(0)}%`, tone: selected.winRate >= 50 ? "green" : "red" },
                { label: t("microProfit"), value: moneyCompact(selected.netPnl), tone: selected.netPnl >= 0 ? "green" : "red" },
                { label: t("microAvg"), value: moneyCompact(selected.avgPnl), tone: "grey" },
              ]}
            />
            <Text style={styles.bottomSheetText}>Best setup: {selected.netPnl >= 0 ? "Repeat this window with strict checklist quality." : "Wait for cleaner context before sizing up."}</Text>
            <Text style={styles.bottomSheetText}>{t("breakdownMistakesHint")}</Text>
          </>
        ) : null}
      </BottomSheetPanel>
    </TerminalGlassCard>
  );
}

