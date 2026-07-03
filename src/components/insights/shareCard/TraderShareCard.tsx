import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { EXPORT_BRAND, EXPORT_CARD_HEIGHT, EXPORT_CARD_WIDTH, EXPORT_COLORS } from "../exportDesign";
import { GlowBackground } from "./GlowBackground";
import { MetricBlock, MetricGrid } from "./MetricBlock";
import { NeonFrame } from "./NeonFrame";
import { ShareCardFooter } from "./ShareCardFooter";
import { StatBadgeRail } from "./StatBadge";
import { TraderLevelBadge, TraderScoreBadge } from "./TraderLevelBadge";
import { formatMetric, money, pnlCompact, pnlDisplay, traderTier } from "./formatters";

const YOU_TRADER_MARK = require("../../../../assets/youtrader-bull-mark.png");

export type TraderShareCardData = {
  periodLabel: string;
  netPnl: number;
  monthPnl?: number;
  winRate: number;
  profitFactor: number;
  avgWinLoss?: number;
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
};

export function TraderShareCard({ data }: { data: TraderShareCardData }) {
  const hasTrades = data.trades > 0;
  const positive = data.netPnl >= 0;
  const score = data.tradingScore != null ? Math.round(data.tradingScore) : null;
  const tier = hasTrades ? traderTier(score) : "ROOKIE";
  const pnlText = pnlDisplay(data.netPnl, hasTrades);
  const pnlColor = !hasTrades ? EXPORT_COLORS.sub : positive ? EXPORT_COLORS.green : EXPORT_COLORS.red;
  const monthPnl = data.monthPnl ?? data.netPnl;

  return (
    <View style={styles.root}>
      <GlowBackground accent="mixed" />
      <NeonFrame>
        <View style={styles.topRow}>
          <TraderScoreBadge score={hasTrades ? score : null} />
          <View style={styles.identityBlock}>
            <Text style={styles.kicker}>PERFORMANCE CARD</Text>
            <Text style={styles.brand}>{EXPORT_BRAND.name}</Text>
          </View>
          <TraderLevelBadge tier={tier} />
        </View>

        <View style={styles.emblemStage}>
          <View style={styles.emblemGlow} />
          <View style={styles.emblemRing} />
          <Svg width={560} height={560} style={styles.emblemSvg}>
            <Path d="M120 420 L280 120 L440 420" stroke="rgba(176,38,255,0.55)" strokeWidth={10} fill="none" strokeLinecap="round" />
            <Line x1="280" y1="120" x2="280" y2="500" stroke="rgba(156,255,0,0.18)" strokeWidth={2} strokeDasharray="8 10" />
          </Svg>
          <Image source={YOU_TRADER_MARK} style={styles.heroLogo} resizeMode="contain" />
          <View style={styles.sideBadgesLeft}>
            {["BULL", "EDGE"].map((label) => (
              <View key={label} style={styles.hexBadge}>
                <Text style={styles.hexText}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.sideBadgesRight}>
            {["RISK", "P&L"].map((label) => (
              <View key={label} style={styles.hexBadge}>
                <Text style={styles.hexText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.pnlBanner}>
          <Text style={styles.period}>{data.periodLabel}</Text>
          {hasTrades ? (
            <>
              <Text style={[styles.net, { color: pnlColor }]} adjustsFontSizeToFit numberOfLines={1}>
                {pnlText}
              </Text>
              <Text style={styles.caption}>Net P&L from logged journal data</Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyHeadline} adjustsFontSizeToFit numberOfLines={2}>
                Start logging trades to unlock your trader card
              </Text>
              <Text style={styles.caption}>Your performance card fills in as you journal</Text>
            </>
          )}
        </View>

        <StatBadgeRail labels={["BULL", "RISK", "P&L", "EDGE"]} />

        <MetricGrid>
          <MetricBlock label="Win Rate" value={hasTrades ? `${data.winRate.toFixed(0)}%` : "N/A"} tone={hasTrades && data.winRate >= 50 ? "green" : "default"} />
          <MetricBlock label="Month P&L" value={hasTrades ? pnlCompact(monthPnl) : "N/A"} tone={hasTrades ? (monthPnl >= 0 ? "green" : "red") : "default"} />
          <MetricBlock label="Profit Factor" value={hasTrades && data.profitFactor ? data.profitFactor.toFixed(2) : "N/A"} tone="purple" />
          <MetricBlock label="Avg Win/Loss" value={hasTrades && data.avgWinLoss ? data.avgWinLoss.toFixed(2) : "N/A"} />
          <MetricBlock label="Consistency" value={hasTrades && data.consistency != null ? `${data.consistency.toFixed(0)}%` : "N/A"} tone="purple" />
          <MetricBlock
            label="Biggest Loss"
            value={hasTrades ? money(data.maxDrawdown || 0) : "N/A"}
            tone={hasTrades && (data.maxDrawdown || 0) < 0 ? "red" : "default"}
          />
          <MetricBlock label="Trades Logged" value={hasTrades ? `${data.trades}` : "0"} />
          <MetricBlock label="Best Session" value={formatMetric(data.bestSession)} small />
          <MetricBlock
            label="Prop Buffer"
            value={data.dailyBuffer && data.dailyBuffer !== "—" ? data.dailyBuffer : hasTrades ? "Not linked" : "N/A"}
            tone="gold"
            small
          />
          <MetricBlock label="Risk Control" value={hasTrades && data.riskControl != null ? `${data.riskControl.toFixed(0)}%` : "N/A"} />
        </MetricGrid>

        <ShareCardFooter dateLabel={data.dateLabel} />
      </NeonFrame>
    </View>
  );
}

export const TRADER_SHARE_CARD_WIDTH = EXPORT_CARD_WIDTH;
export const TRADER_SHARE_CARD_HEIGHT = EXPORT_CARD_HEIGHT;

const styles = StyleSheet.create({
  root: {
    width: TRADER_SHARE_CARD_WIDTH,
    height: TRADER_SHARE_CARD_HEIGHT,
    backgroundColor: EXPORT_COLORS.bg,
    paddingHorizontal: 72,
    paddingTop: 70,
    paddingBottom: 64,
    overflow: "hidden",
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    width: "100%",
  },
  identityBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  kicker: {
    color: EXPORT_COLORS.sub,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
    letterSpacing: 3,
  },
  brand: {
    color: EXPORT_COLORS.text,
    fontSize: 54,
    lineHeight: 62,
    fontWeight: "900",
    marginTop: 4,
  },
  emblemStage: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 520,
    marginTop: 8,
  },
  emblemGlow: {
    position: "absolute",
    width: 640,
    height: 640,
    borderRadius: 320,
    backgroundColor: "rgba(156,255,0,0.14)",
    shadowColor: EXPORT_COLORS.green,
    shadowOpacity: 0.85,
    shadowRadius: 56,
  },
  emblemRing: {
    position: "absolute",
    width: 560,
    height: 560,
    borderRadius: 280,
    borderWidth: 4,
    borderColor: "rgba(244,201,93,0.68)",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  emblemSvg: {
    position: "absolute",
  },
  heroLogo: {
    width: 500,
    height: 500,
  },
  sideBadgesLeft: {
    position: "absolute",
    left: 0,
    top: "28%",
    gap: 14,
  },
  sideBadgesRight: {
    position: "absolute",
    right: 0,
    top: "28%",
    gap: 14,
  },
  hexBadge: {
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(156,255,0,0.42)",
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
  },
  hexText: {
    color: EXPORT_COLORS.green,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    transform: [{ rotate: "-45deg" }],
  },
  pnlBanner: {
    width: "100%",
    borderWidth: 2,
    borderColor: "rgba(176,38,255,0.42)",
    backgroundColor: "rgba(176,38,255,0.10)",
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: "center",
  },
  period: {
    color: EXPORT_COLORS.sub,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  net: {
    fontSize: 82,
    lineHeight: 92,
    fontWeight: "900",
    marginTop: 6,
    letterSpacing: 0,
  },
  emptyHeadline: {
    color: EXPORT_COLORS.text,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  caption: {
    color: EXPORT_COLORS.sub,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    marginTop: 8,
    textAlign: "center",
  },
});
