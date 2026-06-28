import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { C } from "../../theme/colors";

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

export const SHARE_CARD_WIDTH = 540;
export const SHARE_CARD_HEIGHT = 675;

export function SharePnLCard({ data }: { data: ShareCardData }) {
  const positive = data.netPnl >= 0;
  return (
    <View style={styles.root}>
      <View style={styles.topLine} />
      <View style={styles.brandRow}>
        <Image source={YOU_TRADER_MARK} style={styles.logo} resizeMode="contain" />
        <View>
          <Text style={styles.brand}>YouTrader</Text>
          <Text style={styles.brandSub}>TRADE. ANALYZE. IMPROVE.</Text>
        </View>
      </View>
      <View style={styles.heroBlock}>
        <Text style={styles.period}>{data.periodLabel}</Text>
        <Text style={[styles.net, { color: positive ? C.green : C.red }]}>
          {data.netPnl >= 0 ? "+" : "-"}${Math.abs(data.netPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={styles.caption}>Net P&L</Text>
      </View>
      <View style={styles.grid}>
        <Metric label="Win Rate" value={`${data.winRate.toFixed(0)}%`} />
        <Metric label="Profit Factor" value={data.profitFactor ? data.profitFactor.toFixed(2) : "—"} />
        <Metric label="Trading Score" value={data.tradingScore != null ? `${Math.round(data.tradingScore)}` : "—"} tone={C.green} />
        <Metric label="Trades" value={`${data.trades}`} />
      </View>
      {!!data.dailyBuffer && (
        <View style={styles.bufferBox}>
          <Text style={styles.bufferLabel}>Prop daily buffer</Text>
          <Text style={styles.bufferValue}>{data.dailyBuffer}</Text>
          {!!data.propStatus && <Text style={styles.bufferStatus}>{data.propStatus}</Text>}
        </View>
      )}
      <View style={styles.footerRow}>
        <View>
          <Text style={styles.footerDate}>{data.dateLabel || data.periodLabel}</Text>
          <Text style={styles.footer}>Educational journal • Not financial advice</Text>
        </View>
        <View style={styles.qrBox}>
          <View style={styles.qrGrid}>
            {Array.from({ length: 16 }, (_, index) => (
              <View key={index} style={[styles.qrDot, (index + Math.floor(index / 4)) % 2 === 0 && styles.qrDotOn]} />
            ))}
          </View>
          <Text style={styles.qrText}>APP STORE</Text>
        </View>
      </View>
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: "#030507",
    padding: 34,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  topLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: C.green,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  logo: { width: 46, height: 46 },
  brand: { color: C.text, fontSize: 25, fontWeight: "900", letterSpacing: 0 },
  brandSub: { color: C.sub, fontSize: 8, marginTop: 3, fontWeight: "900", letterSpacing: 2 },
  heroBlock: { marginTop: 18 },
  period: { color: C.sub, fontSize: 13, fontWeight: "800" },
  net: { fontSize: 56, fontWeight: "900", marginTop: 12, letterSpacing: 0 },
  caption: { color: C.sub, fontSize: 13, marginTop: 4, fontWeight: "800" },
  grid: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  metric: {
    width: "48%",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.11)",
    borderRadius: 8,
    padding: 13,
    backgroundColor: "#0A0F14",
  },
  metricLabel: { color: C.sub, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  metricValue: { color: C.text, fontSize: 20, fontWeight: "900", marginTop: 5 },
  bufferBox: {
    marginTop: 20,
    borderWidth: 2,
    borderColor: "rgba(163,255,18,0.45)",
    backgroundColor: "rgba(163,255,18,0.08)",
    borderRadius: 8,
    padding: 12,
  },
  bufferLabel: { color: C.sub, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  bufferValue: { color: C.green, fontSize: 22, fontWeight: "900", marginTop: 4 },
  bufferStatus: { color: C.text, fontSize: 12, fontWeight: "800", marginTop: 4 },
  footerRow: { marginTop: 18, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 14 },
  footerDate: { color: C.text, fontSize: 12, fontWeight: "900", marginBottom: 5 },
  footer: { color: C.muted, fontSize: 10, fontWeight: "700" },
  qrBox: { width: 78, alignItems: "center", gap: 5 },
  qrGrid: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#F4F4F5",
    padding: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  qrDot: { width: 7, height: 7, borderRadius: 2, backgroundColor: "transparent" },
  qrDotOn: { backgroundColor: "#030507" },
  qrText: { color: C.sub, fontSize: 8, fontWeight: "900" },
});
