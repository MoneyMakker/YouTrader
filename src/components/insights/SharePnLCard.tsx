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
  const score = data.tradingScore != null ? Math.round(data.tradingScore) : null;
  return (
    <View style={styles.root}>
      <View style={styles.glowPurple} />
      <View style={styles.glowGreen} />
      <View style={styles.brandRow}>
        <Image source={YOU_TRADER_MARK} style={styles.logo} resizeMode="contain" />
        <View style={styles.brandTextBlock}>
          <Text style={styles.brand}>{EXPORT_BRAND.name}</Text>
          <Text style={styles.brandSub}>{EXPORT_BRAND.tagline}</Text>
        </View>
        <Text style={styles.reportTag}>P&L CARD</Text>
      </View>

      <View style={styles.heroFrame}>
        <Text style={styles.period}>{data.periodLabel}</Text>
        <Text style={styles.heroLabel}>NET PERFORMANCE</Text>
        <Text style={[styles.net, { color: positive ? EXPORT_COLORS.green : EXPORT_COLORS.red }]} adjustsFontSizeToFit numberOfLines={1}>
          {pnl}
        </Text>
        <View style={styles.heroDivider} />
        <Text style={styles.caption}>
          {data.trades} logged trade{data.trades === 1 ? "" : "s"} · {data.dateLabel || data.periodLabel}
        </Text>
      </View>

      <View style={styles.grid}>
        <Metric label="Trading Score" value={score != null ? String(score) : "-"} accent />
        <Metric label="Win Rate" value={`${data.winRate.toFixed(0)}%`} />
        <Metric label="Profit Factor" value={data.profitFactor ? data.profitFactor.toFixed(2) : "-"} />
        <Metric label="This Week" value={money(data.weekPnl)} tone={data.weekPnl >= 0 ? "green" : "red"} />
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
      </View>
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

const styles = StyleSheet.create({
  root: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: EXPORT_COLORS.bg,
    paddingHorizontal: 72,
    paddingTop: 70,
    paddingBottom: 64,
    overflow: "hidden",
    justifyContent: "space-between",
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
  brandRow: { flexDirection: "row", alignItems: "center", gap: 24, width: "100%" },
  logo: { width: 86, height: 86 },
  brandTextBlock: { flex: 1, minWidth: 0 },
  brand: { color: EXPORT_COLORS.text, fontSize: 48, lineHeight: 54, fontWeight: "900", letterSpacing: 0 },
  brandSub: { color: EXPORT_COLORS.sub, fontSize: 15, marginTop: 7, fontWeight: "900", letterSpacing: 1.4 },
  reportTag: { color: EXPORT_COLORS.purple2, fontSize: 18, fontWeight: "900", letterSpacing: 2, borderWidth: 1, borderColor: "rgba(211,107,255,0.48)", borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  heroFrame: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.045)",
    borderRadius: 44,
    paddingHorizontal: 42,
    paddingVertical: 46,
    width: "100%",
  },
  period: { color: EXPORT_COLORS.sub, fontSize: 24, fontWeight: "900" },
  heroLabel: { color: EXPORT_COLORS.muted, fontSize: 18, fontWeight: "900", letterSpacing: 2.5, marginTop: 34 },
  net: { fontSize: 112, lineHeight: 126, fontWeight: "900", marginTop: 12, letterSpacing: 0 },
  heroDivider: { height: 2, backgroundColor: "rgba(255,255,255,0.12)", marginTop: 28, marginBottom: 20 },
  caption: { color: EXPORT_COLORS.sub, fontSize: 24, lineHeight: 34, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 18, width: "100%" },
  metric: { width: "48.7%", minHeight: 142, borderWidth: 2, borderColor: EXPORT_COLORS.border, borderRadius: 26, padding: 24, backgroundColor: EXPORT_COLORS.panel2, justifyContent: "center" },
  metricLabel: { color: EXPORT_COLORS.sub, fontSize: 18, fontWeight: "900", textTransform: "uppercase" },
  metricValue: { color: EXPORT_COLORS.text, fontSize: 42, lineHeight: 50, fontWeight: "900", marginTop: 10 },
  metricValueSmall: { fontSize: 30, lineHeight: 38 },
  bufferBox: { borderWidth: 2, borderColor: "rgba(176,38,255,0.38)", backgroundColor: "rgba(176,38,255,0.10)", borderRadius: 32, padding: 30, width: "100%" },
  bufferLabel: { color: EXPORT_COLORS.sub, fontSize: 18, fontWeight: "900", textTransform: "uppercase" },
  bufferValue: { color: EXPORT_COLORS.purple2, fontSize: 42, lineHeight: 50, fontWeight: "900", marginTop: 12 },
  bufferStatus: { color: EXPORT_COLORS.text, fontSize: 24, lineHeight: 34, fontWeight: "800", marginTop: 14 },
  footer: { borderTopWidth: 1, borderTopColor: EXPORT_COLORS.border, paddingTop: 30, width: "100%" },
  footerCopy: { flex: 1, minWidth: 0 },
  footerTitle: { color: EXPORT_COLORS.text, fontSize: 26, lineHeight: 34, fontWeight: "900" },
  footerSub: { color: EXPORT_COLORS.sub, fontSize: 18, lineHeight: 26, fontWeight: "700", marginTop: 8 },
});
