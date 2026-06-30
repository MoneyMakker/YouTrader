import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { EXPORT_BRAND, EXPORT_CARD_HEIGHT, EXPORT_CARD_WIDTH, EXPORT_COLORS } from "./exportDesign";

const YOU_TRADER_MARK = require("../../../assets/youtrader-bull-mark.png");

export type ShareCardData = {
  periodLabel: string;
  netPnl: number;
  winRate: number;
  profitFactor: number;
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
  return (
    <View style={styles.root}>
      <View style={styles.glowTop} />
      <View style={styles.brandRow}>
        <Image source={YOU_TRADER_MARK} style={styles.logo} resizeMode="contain" />
        <View style={styles.brandTextBlock}>
          <Text style={styles.brand}>{EXPORT_BRAND.name}</Text>
          <Text style={styles.brandSub}>{EXPORT_BRAND.tagline}</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.period}>{data.periodLabel}</Text>
        <Text style={[styles.net, { color: positive ? EXPORT_COLORS.green : EXPORT_COLORS.red }]} adjustsFontSizeToFit numberOfLines={1}>
          {pnl}
        </Text>
        <Text style={styles.caption}>Net P&L from verified journal data</Text>
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.scorePanel}>
          <Text style={styles.scoreLabel}>Trading Score</Text>
          <Text style={styles.scoreValue}>{data.tradingScore != null ? Math.round(data.tradingScore) : "-"}</Text>
        </View>
        <View style={styles.scorePanel}>
          <Text style={styles.scoreLabel}>This Week</Text>
          <Text style={[styles.scoreValueSmall, { color: data.weekPnl >= 0 ? EXPORT_COLORS.green : EXPORT_COLORS.red }]}>
            {money(data.weekPnl)}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <Metric label="Win Rate" value={`${data.winRate.toFixed(0)}%`} />
        <Metric label="Profit Factor" value={data.profitFactor ? data.profitFactor.toFixed(2) : "-"} />
        <Metric label="Trades" value={`${data.trades}`} />
        <Metric label="Period" value={data.dateLabel || data.periodLabel} small />
      </View>

      <View style={styles.bufferBox}>
        <Text style={styles.bufferLabel}>Prop Firm Protection</Text>
        <Text style={styles.bufferValue}>{data.dailyBuffer || "Journal risk buffer ready"}</Text>
        <Text style={styles.bufferStatus}>{data.propStatus || "Track size, daily loss and account buffer before the next session."}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerCopy}>
          <Text style={styles.footerTitle}>{EXPORT_BRAND.appStoreHint}</Text>
          <Text style={styles.footerSub}>{EXPORT_BRAND.disclaimer}</Text>
        </View>
        <View style={styles.appBadge}>
          <Text style={styles.appBadgeTop}>APP</Text>
          <Text style={styles.appBadgeBottom}>STORE</Text>
        </View>
      </View>
    </View>
  );
}

function Metric({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, small && styles.metricValueSmall]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const styles = StyleSheet.create({
  root: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: EXPORT_COLORS.bg,
    paddingHorizontal: 78,
    paddingTop: 78,
    paddingBottom: 72,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  glowTop: {
    position: "absolute",
    top: -180,
    right: -120,
    width: 560,
    height: 560,
    borderRadius: 280,
    backgroundColor: "rgba(176,38,255,0.24)",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 24, width: "100%" },
  logo: { width: 96, height: 96 },
  brandTextBlock: { flex: 1, minWidth: 0 },
  brand: { color: EXPORT_COLORS.text, fontSize: 56, lineHeight: 62, fontWeight: "900", letterSpacing: 0 },
  brandSub: { color: EXPORT_COLORS.sub, fontSize: 16, marginTop: 8, fontWeight: "900", letterSpacing: 2 },
  hero: { paddingTop: 76, paddingBottom: 34, alignItems: "flex-start" },
  period: { color: EXPORT_COLORS.sub, fontSize: 28, fontWeight: "900" },
  net: { fontSize: 124, lineHeight: 138, fontWeight: "900", marginTop: 22, letterSpacing: 0 },
  caption: { color: EXPORT_COLORS.sub, fontSize: 26, lineHeight: 36, marginTop: 12, fontWeight: "800" },
  scoreRow: { flexDirection: "row", gap: 20, width: "100%" },
  scorePanel: { flex: 1, minHeight: 210, borderRadius: 36, borderWidth: 2, borderColor: EXPORT_COLORS.border, backgroundColor: EXPORT_COLORS.panel, padding: 30, justifyContent: "center" },
  scoreLabel: { color: EXPORT_COLORS.sub, fontSize: 20, fontWeight: "900", textTransform: "uppercase" },
  scoreValue: { color: EXPORT_COLORS.purple2, fontSize: 68, lineHeight: 78, fontWeight: "900", marginTop: 12 },
  scoreValueSmall: { fontSize: 52, lineHeight: 62, fontWeight: "900", marginTop: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 8, width: "100%" },
  metric: { width: "48%", minHeight: 166, borderWidth: 2, borderColor: EXPORT_COLORS.border, borderRadius: 28, padding: 26, backgroundColor: EXPORT_COLORS.panel2, justifyContent: "center" },
  metricLabel: { color: EXPORT_COLORS.sub, fontSize: 18, fontWeight: "900", textTransform: "uppercase" },
  metricValue: { color: EXPORT_COLORS.text, fontSize: 44, lineHeight: 52, fontWeight: "900", marginTop: 12 },
  metricValueSmall: { fontSize: 30, lineHeight: 38 },
  bufferBox: { borderWidth: 2, borderColor: "rgba(176,38,255,0.42)", backgroundColor: "rgba(176,38,255,0.12)", borderRadius: 34, padding: 32, width: "100%" },
  bufferLabel: { color: EXPORT_COLORS.sub, fontSize: 18, fontWeight: "900", textTransform: "uppercase" },
  bufferValue: { color: EXPORT_COLORS.purple2, fontSize: 42, lineHeight: 50, fontWeight: "900", marginTop: 12 },
  bufferStatus: { color: EXPORT_COLORS.text, fontSize: 24, lineHeight: 34, fontWeight: "800", marginTop: 14 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 30, borderTopWidth: 1, borderTopColor: EXPORT_COLORS.border, paddingTop: 32, width: "100%" },
  footerCopy: { flex: 1, minWidth: 0 },
  footerTitle: { color: EXPORT_COLORS.text, fontSize: 26, lineHeight: 34, fontWeight: "900" },
  footerSub: { color: EXPORT_COLORS.sub, fontSize: 18, lineHeight: 26, fontWeight: "700", marginTop: 8 },
  appBadge: { width: 134, height: 92, borderRadius: 24, borderWidth: 2, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  appBadgeTop: { color: EXPORT_COLORS.text, fontSize: 20, fontWeight: "900" },
  appBadgeBottom: { color: EXPORT_COLORS.purple2, fontSize: 20, fontWeight: "900", marginTop: 2 },
});
