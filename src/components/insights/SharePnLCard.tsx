import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { EXPORT_BRAND, EXPORT_CARD_HEIGHT, EXPORT_CARD_WIDTH, EXPORT_COLORS } from "./exportDesign";

const YOU_TRADER_MARK = require("../../../assets/youtrader-bull-mark.png");

export type ShareCardData = {
  periodLabel: string;
  netPnl: number;
  winRate: number;
  profitFactor: number;
  avgWinLoss?: number;
  consistency?: number;
  maxDrawdown?: number;
  riskControl?: number;
  bestSession?: string;
  weekPnl: number;
  trades: number;
  tradingScore?: number;
  dateLabel?: string;
  dailyBuffer?: string;
  propStatus?: string;
};

export const SHARE_CARD_WIDTH = EXPORT_CARD_WIDTH;
export const SHARE_CARD_HEIGHT = EXPORT_CARD_HEIGHT;

export function SharePnLCard({ data }: { data: ShareCardData }) {
  const positive = data.netPnl >= 0;
  const pnl = `${positive ? "+" : "-"}$${Math.abs(data.netPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const score = data.tradingScore != null ? Math.round(data.tradingScore) : null;
  const tier = traderTier(score);
  return (
    <View style={styles.root}>
      <View style={styles.glowPurple} />
      <View style={styles.glowGreen} />
      <View style={styles.cardShell}>
        <View style={styles.frameOuter} />
        <View style={styles.frameInner} />

        <View style={styles.topRow}>
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreNumber}>{score != null ? score : "--"}</Text>
            <Text style={styles.scoreLabel}>TRD</Text>
          </View>
          <View style={styles.identityBlock}>
            <Text style={styles.kicker}>TRADER STATUS PACK</Text>
            <Text style={styles.brand}>{EXPORT_BRAND.name}</Text>
          </View>
          <View style={styles.tierPill}>
            <Text style={styles.tierText}>{tier}</Text>
          </View>
        </View>

        <View style={styles.emblemStage}>
          <View style={styles.emblemGlow} />
          <View style={styles.emblemRing} />
          <Image source={YOU_TRADER_MARK} style={styles.heroLogo} resizeMode="contain" />
        </View>

        <View style={styles.pnlBanner}>
          <Text style={styles.period}>{data.periodLabel}</Text>
          <Text style={[styles.net, { color: positive ? EXPORT_COLORS.green : EXPORT_COLORS.red }]} adjustsFontSizeToFit numberOfLines={1}>
            {pnl}
          </Text>
          <Text style={styles.caption}>Net P&L from logged journal data</Text>
        </View>

        <View style={styles.iconRail}>
          <IconBadge text="BULL" />
          <IconBadge text="RISK" />
          <IconBadge text="P&L" />
          <IconBadge text="EDGE" />
        </View>

        <View style={styles.grid}>
          <Metric label="Win Rate" value={`${data.winRate.toFixed(0)}%`} />
          <Metric label="Net P&L" value={pnlCompact(data.netPnl)} tone={positive ? "green" : "red"} />
          <Metric label="Profit Factor" value={data.profitFactor ? data.profitFactor.toFixed(2) : "N/A"} />
          <Metric label="Avg Win/Loss" value={data.avgWinLoss ? data.avgWinLoss.toFixed(2) : "N/A"} />
          <Metric label="Consistency" value={data.consistency != null ? `${data.consistency.toFixed(0)}%` : "N/A"} accent />
          <Metric label="Max DD" value={money(data.maxDrawdown || 0)} tone={(data.maxDrawdown || 0) < 0 ? "red" : undefined} />
          <Metric label="Risk Control" value={data.riskControl != null ? `${data.riskControl.toFixed(0)}%` : "N/A"} />
          <Metric label="Trades Logged" value={`${data.trades}`} />
          <Metric label="Best Session" value={data.bestSession || "N/A"} small />
          <Metric label="Prop Buffer" value={data.dailyBuffer || "Ready"} accent small />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>{EXPORT_BRAND.appStoreHint}</Text>
          <Text style={styles.footerSub}>{EXPORT_BRAND.disclaimer}</Text>
        </View>
      </View>
    </View>
  );
}

function IconBadge({ text }: { text: string }) {
  return (
    <View style={styles.iconBadge}>
      <Text style={styles.iconBadgeText}>{text}</Text>
    </View>
  );
}

function Metric({ label, value, small, accent, tone }: { label: string; value: string; small?: boolean; accent?: boolean; tone?: "green" | "red" }) {
  const toneColor = tone === "green" ? EXPORT_COLORS.green : tone === "red" ? EXPORT_COLORS.red : accent ? EXPORT_COLORS.purple2 : EXPORT_COLORS.text;
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: toneColor }, small && styles.metricValueSmall]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function pnlCompact(value: number) {
  const sign = value >= 0 ? "+" : "-";
  const abs = Math.abs(value);
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 10000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function traderTier(score: number | null) {
  if (score == null) return "ROOKIE";
  if (score >= 90) return "APEX";
  if (score >= 75) return "ELITE";
  if (score >= 60) return "CONSISTENT";
  return "ROOKIE";
}

const styles = StyleSheet.create({
  root: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: EXPORT_COLORS.bg,
    paddingHorizontal: 72,
    paddingTop: 70,
    paddingBottom: 64,
    overflow: "hidden",
    justifyContent: "center",
  },
  glowPurple: {
    position: "absolute",
    top: -210,
    right: -170,
    width: 660,
    height: 660,
    borderRadius: 330,
    backgroundColor: "rgba(176,38,255,0.22)",
  },
  glowGreen: {
    position: "absolute",
    left: -260,
    bottom: 260,
    width: 560,
    height: 560,
    borderRadius: 280,
    backgroundColor: "rgba(156,255,0,0.11)",
  },
  cardShell: {
    width: "100%",
    height: "100%",
    borderRadius: 58,
    borderWidth: 3,
    borderColor: "rgba(244,201,93,0.72)",
    backgroundColor: "rgba(6,8,13,0.94)",
    paddingHorizontal: 46,
    paddingTop: 44,
    paddingBottom: 38,
    overflow: "hidden",
    justifyContent: "space-between",
    shadowColor: EXPORT_COLORS.gold,
    shadowOpacity: 0.46,
    shadowRadius: 34,
  },
  frameOuter: { position: "absolute", left: 18, right: 18, top: 18, bottom: 18, borderRadius: 48, borderWidth: 2, borderColor: "rgba(244,201,93,0.48)" },
  frameInner: { position: "absolute", left: 34, right: 34, top: 34, bottom: 34, borderRadius: 38, borderWidth: 1, borderColor: "rgba(156,255,0,0.36)" },
  topRow: { flexDirection: "row", alignItems: "center", gap: 18, width: "100%" },
  scoreBlock: { width: 142, height: 132, borderRadius: 28, borderWidth: 2, borderColor: "rgba(244,201,93,0.7)", backgroundColor: "rgba(0,0,0,0.36)", alignItems: "center", justifyContent: "center" },
  scoreNumber: { color: EXPORT_COLORS.text, fontSize: 70, lineHeight: 74, fontWeight: "900" },
  scoreLabel: { color: EXPORT_COLORS.gold, fontSize: 24, lineHeight: 30, fontWeight: "900", letterSpacing: 2 },
  identityBlock: { flex: 1, minWidth: 0, alignItems: "center" },
  kicker: { color: EXPORT_COLORS.sub, fontSize: 17, lineHeight: 23, fontWeight: "900", letterSpacing: 3 },
  brand: { color: EXPORT_COLORS.text, fontSize: 54, lineHeight: 62, fontWeight: "900", letterSpacing: 0, marginTop: 4 },
  tierPill: { minWidth: 150, borderWidth: 2, borderColor: "rgba(176,38,255,0.72)", backgroundColor: "rgba(176,38,255,0.13)", borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, alignItems: "center" },
  tierText: { color: EXPORT_COLORS.purple2, fontSize: 20, lineHeight: 26, fontWeight: "900", letterSpacing: 2 },
  emblemStage: { width: "100%", alignItems: "center", justifyContent: "center", minHeight: 575, marginTop: 12 },
  emblemGlow: { position: "absolute", width: 640, height: 640, borderRadius: 320, backgroundColor: "rgba(156,255,0,0.14)", shadowColor: EXPORT_COLORS.green, shadowOpacity: 0.85, shadowRadius: 56 },
  emblemRing: { position: "absolute", width: 560, height: 560, borderRadius: 280, borderWidth: 4, borderColor: "rgba(244,201,93,0.68)", backgroundColor: "rgba(0,0,0,0.28)" },
  heroLogo: { width: 515, height: 515 },
  pnlBanner: { width: "100%", borderWidth: 2, borderColor: "rgba(176,38,255,0.42)", backgroundColor: "rgba(176,38,255,0.10)", borderRadius: 32, paddingHorizontal: 28, paddingVertical: 24, alignItems: "center" },
  period: { color: EXPORT_COLORS.sub, fontSize: 20, lineHeight: 26, fontWeight: "900", letterSpacing: 1.6 },
  net: { fontSize: 82, lineHeight: 92, fontWeight: "900", marginTop: 6, letterSpacing: 0 },
  caption: { color: EXPORT_COLORS.sub, fontSize: 20, lineHeight: 28, fontWeight: "800", marginTop: 4 },
  iconRail: { flexDirection: "row", justifyContent: "center", gap: 16, width: "100%" },
  iconBadge: { borderWidth: 2, borderColor: "rgba(156,255,0,0.46)", backgroundColor: "rgba(156,255,0,0.10)", borderRadius: 18, paddingHorizontal: 22, paddingVertical: 13 },
  iconBadgeText: { color: EXPORT_COLORS.green, fontSize: 16, lineHeight: 21, fontWeight: "900", letterSpacing: 1.4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, width: "100%" },
  metric: { width: "48.9%", minHeight: 95, borderWidth: 2, borderColor: "rgba(244,201,93,0.32)", borderRadius: 18, paddingHorizontal: 18, paddingVertical: 13, backgroundColor: "rgba(255,255,255,0.06)", justifyContent: "center" },
  metricLabel: { color: EXPORT_COLORS.text, fontSize: 15, lineHeight: 19, fontWeight: "900", textTransform: "uppercase" },
  metricValue: { color: EXPORT_COLORS.green, fontSize: 32, lineHeight: 38, fontWeight: "900", marginTop: 4 },
  metricValueSmall: { fontSize: 25, lineHeight: 31 },
  footer: { borderTopWidth: 1, borderTopColor: "rgba(244,201,93,0.28)", paddingTop: 22, width: "100%", alignItems: "center" },
  footerTitle: { color: EXPORT_COLORS.text, fontSize: 23, lineHeight: 30, fontWeight: "900", textAlign: "center" },
  footerSub: { color: EXPORT_COLORS.sub, fontSize: 16, lineHeight: 23, fontWeight: "700", marginTop: 6, textAlign: "center" },
});
