import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { AchievementShareStats } from "./achievementHelpers";
import { buildAchievementStatSlots } from "./achievementStatSlots";
import {
  STAT_BOX_PADDING,
  statLabelFontSize,
  statValueFontSize,
  statValueMinimumScale,
} from "./shareCardTypography";
import {
  STAT_BOX_SLOTS,
  STAT_DARK_BULL_TEMPLATE,
  STAT_EXPORT_HEIGHT,
  STAT_EXPORT_WIDTH,
  STAT_TEXT,
  statSlotStyle,
  statTemplateImageStyle,
} from "./statTemplateLayout";

export type TraderShareCardData = {
  periodLabel: string;
  netPnl: number;
  monthPnl?: number;
  winRate: number;
  profitFactor: number;
  avgWinLoss?: number;
  avgWin?: number;
  avgLoss?: number;
  expectancy?: number;
  consistency?: number;
  maxDrawdown?: number;
  riskControl?: number;
  bestSession?: string;
  weekPnl?: number;
  trades: number;
  tradingScore?: number;
  dateLabel?: string;
  dailyBuffer?: string;
  propStatus?: string;
  bestTrade?: number;
  currentWinStreak?: number;
  greenDays?: number;
};

function toShareStats(data: TraderShareCardData): AchievementShareStats {
  return {
    tradesLogged: data.trades,
    winRate: data.winRate,
    totalPnl: data.netPnl,
    profitFactor: data.profitFactor,
    avgWinLoss: data.avgWinLoss ?? 0,
    avgWin: data.avgWin,
    avgLoss: data.avgLoss,
    expectancy: data.expectancy,
    bestTrade: data.bestTrade,
    currentWinStreak: data.currentWinStreak,
    greenDays: data.greenDays,
    riskControl: data.riskControl ?? 0,
    consistency: data.consistency ?? 0,
    maxDrawdown: data.maxDrawdown ?? 0,
    tradingScore: data.tradingScore ?? 0,
    bestSession: data.bestSession ?? "N/A",
    dateLabel: data.dateLabel ?? "",
  };
}

function toneColor(tone: "green" | "white" | "purple" | "red" | "gold") {
  if (tone === "white") return STAT_TEXT.white;
  if (tone === "purple") return STAT_TEXT.purple;
  if (tone === "red") return STAT_TEXT.red;
  if (tone === "gold") return STAT_TEXT.gold;
  return STAT_TEXT.green;
}

function StatBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "white" | "purple" | "red" | "gold";
}) {
  const labelSize = statLabelFontSize();
  const valueSize = statValueFontSize(value);
  const minScale = statValueMinimumScale(value);

  return (
    <>
      <Text
        allowFontScaling={false}
        style={[styles.label, { fontSize: labelSize, lineHeight: Math.round(labelSize * 1.15) }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
        {label}
      </Text>
      <Text
        allowFontScaling={false}
        style={[
          styles.value,
          {
            color: toneColor(tone),
            fontSize: valueSize,
            lineHeight: Math.round(valueSize * 1.08),
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={minScale}
      >
        {value}
      </Text>
    </>
  );
}

export function TraderShareCard({ data }: { data: TraderShareCardData }) {
  const slots = buildAchievementStatSlots(toShareStats(data));

  return (
    <View style={styles.root} collapsable={false}>
      <Image source={STAT_DARK_BULL_TEMPLATE} style={statTemplateImageStyle()} resizeMode="stretch" />
      {STAT_BOX_SLOTS.map((box, index) => {
        const stat = slots[index];
        if (!stat) return null;
        return (
          <View key={`${stat.label}-${index}`} style={[styles.statBox, statSlotStyle(box)]}>
            <StatBlock label={stat.label} value={stat.value} tone={stat.tone} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: STAT_EXPORT_WIDTH,
    height: STAT_EXPORT_HEIGHT,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  statBox: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: STAT_BOX_PADDING.horizontal,
    paddingVertical: STAT_BOX_PADDING.vertical,
    maxWidth: "100%",
    overflow: "hidden",
  },
  label: {
    color: STAT_TEXT.label,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    textAlign: "center",
    width: "100%",
    maxWidth: "100%",
    marginBottom: 4,
  },
  value: {
    fontWeight: "900",
    textAlign: "center",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    textShadowColor: STAT_TEXT.shadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});

export const TRADER_SHARE_CARD_WIDTH = STAT_EXPORT_WIDTH;
export const TRADER_SHARE_CARD_HEIGHT = STAT_EXPORT_HEIGHT;
