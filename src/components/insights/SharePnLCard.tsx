import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { C } from "../../theme/colors";

export type ShareCardData = {
  periodLabel: string;
  netPnl: number;
  winRate: number;
  profitFactor: number;
  weekPnl: number;
  trades: number;
  dailyBuffer?: string;
  propStatus?: string;
};

export const SHARE_CARD_WIDTH = 540;
export const SHARE_CARD_HEIGHT = 675;

export function SharePnLCard({ data }: { data: ShareCardData }) {
  const positive = data.netPnl >= 0;
  return (
    <View style={styles.root}>
      <Text style={styles.brand}>YOUTRADER</Text>
      <Text style={styles.period}>{data.periodLabel}</Text>
      <Text style={[styles.net, { color: positive ? C.green : C.red }]}>
        {data.netPnl >= 0 ? "+" : ""}${Math.abs(data.netPnl).toFixed(2)}
      </Text>
      <Text style={styles.caption}>Net P&L</Text>
      <View style={styles.grid}>
        <Metric label="Win Rate" value={`${data.winRate.toFixed(0)}%`} />
        <Metric label="Profit Factor" value={data.profitFactor ? data.profitFactor.toFixed(2) : "—"} />
        <Metric label="Week P&L" value={`$${data.weekPnl.toFixed(0)}`} tone={data.weekPnl >= 0 ? C.green : C.red} />
        <Metric label="Trades" value={`${data.trades}`} />
      </View>
      {!!data.dailyBuffer && (
        <View style={styles.bufferBox}>
          <Text style={styles.bufferLabel}>Prop daily buffer</Text>
          <Text style={styles.bufferValue}>{data.dailyBuffer}</Text>
          {!!data.propStatus && <Text style={styles.bufferStatus}>{data.propStatus}</Text>}
        </View>
      )}
      <Text style={styles.footer}>Educational journal • Not financial advice</Text>
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
    backgroundColor: "#000000",
    padding: 36,
    justifyContent: "center",
  },
  brand: { color: C.green, fontSize: 21, fontWeight: "900", letterSpacing: 2 },
  period: { color: C.sub, fontSize: 14, marginTop: 9, fontWeight: "700" },
  net: { fontSize: 60, fontWeight: "900", marginTop: 14, letterSpacing: -1.5 },
  caption: { color: C.sub, fontSize: 13, marginTop: 4, fontWeight: "700" },
  grid: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metric: {
    width: "47%",
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: C.card,
  },
  metricLabel: { color: C.sub, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  metricValue: { color: C.text, fontSize: 20, fontWeight: "900", marginTop: 5 },
  bufferBox: {
    marginTop: 20,
    borderWidth: 2,
    borderColor: "rgba(163,255,18,0.45)",
    backgroundColor: "rgba(163,255,18,0.08)",
    borderRadius: 12,
    padding: 12,
  },
  bufferLabel: { color: C.sub, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  bufferValue: { color: C.green, fontSize: 22, fontWeight: "900", marginTop: 4 },
  bufferStatus: { color: C.text, fontSize: 12, fontWeight: "800", marginTop: 4 },
  footer: { color: C.muted, fontSize: 10, marginTop: 24, fontWeight: "700" },
});
