import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { Achievement, TraderLevel } from "../../../analytics/achievements";
import { EXPORT_BRAND, EXPORT_CARD_HEIGHT, EXPORT_CARD_WIDTH, EXPORT_COLORS } from "../exportDesign";
import {
  achievementCategoryLabel,
  achievementRarity,
  prestigeStatement,
  rarityColor,
  raritySecondaryColor,
  type AchievementShareStats,
} from "./achievementHelpers";
import { GlowBackground } from "./GlowBackground";
import { MetricBlock, MetricGrid } from "./MetricBlock";
import { NeonFrame } from "./NeonFrame";
import { ShareCardFooter } from "./ShareCardFooter";
import { TraderLevelBadge, TraderScoreBadge } from "./TraderLevelBadge";
import { money, traderTier } from "./formatters";

const YOU_TRADER_MARK = require("../../../../assets/youtrader-bull-mark.png");

export type { AchievementShareStats };

export function AchievementShareCard({
  item,
  level,
  stats,
}: {
  item: Achievement;
  level: TraderLevel;
  stats: AchievementShareStats;
}) {
  const rarity = achievementRarity(item, level);
  const accent = rarityColor(rarity);
  const accentSecondary = raritySecondaryColor(rarity);
  const tier = traderTier(stats.tradingScore);
  const positive = stats.totalPnl >= 0;
  const unlocked = item.status === "unlocked";
  const glowAccent = rarity === "LEGENDARY" ? "gold" : rarity === "EPIC" ? "mixed" : rarity === "RARE" ? "purple" : "green";
  const metricResult = item.progressLabel || `${Math.round(item.progress)} / ${Math.round(item.target)}`;

  return (
    <View style={styles.root}>
      <GlowBackground accent={glowAccent} />
      <NeonFrame accentColor={accent}>
        <View style={styles.topRow}>
          <TraderScoreBadge score={Math.round(stats.tradingScore)} />
          <View style={styles.identityBlock}>
            <Text style={styles.kicker}>ACHIEVEMENT CARD</Text>
            <Text style={styles.brand}>{EXPORT_BRAND.name}</Text>
          </View>
          <TraderLevelBadge tier={tier} accentColor={accent} />
        </View>

        <View style={styles.heroBlock}>
          <Text style={[styles.unlockedLabel, { color: accentSecondary }]}>
            {unlocked ? "MILESTONE UNLOCKED" : "PROGRESS MILESTONE"}
          </Text>
          <View style={[styles.badgeStage, { borderColor: accent }]}>
            <View style={[styles.badgeHalo, { backgroundColor: `${accent}26` }]} />
            <Svg width={390} height={390} style={styles.badgeSvg}>
              <Circle cx={195} cy={195} r={180} stroke={`${accentSecondary}55`} strokeWidth={3} fill="none" />
              {rarity === "EPIC" || rarity === "LEGENDARY" ? (
                <Path d="M70 260 L195 90 L320 260" stroke={accentSecondary} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.65} />
              ) : null}
            </Svg>
            <Image source={YOU_TRADER_MARK} style={styles.heroLogo} resizeMode="contain" />
            <View style={[styles.rarityPill, { borderColor: accent, backgroundColor: `${accent}18` }]}>
              <Text style={[styles.rarityText, { color: accent }]}>{rarity}</Text>
            </View>
          </View>
          <Text style={styles.category}>{achievementCategoryLabel(item.category)}</Text>
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.62}>
            {item.title.toUpperCase()}
          </Text>
          <Text style={styles.whyItMatters}>{prestigeStatement(item)}</Text>
          <Text style={styles.progressLine}>
            {unlocked ? `Unlocked • ${stats.dateLabel}` : `Progress • ${metricResult}`}
          </Text>
        </View>

        <MetricGrid>
          <MetricBlock label="Result" value={metricResult} tone="purple" />
          <MetricBlock label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} tone={stats.winRate >= 50 ? "green" : "default"} />
          <MetricBlock label="Trading Score" value={`${Math.round(stats.tradingScore)}`} tone="gold" />
          <MetricBlock label="Profit Factor" value={stats.profitFactor ? stats.profitFactor.toFixed(2) : "N/A"} />
          <MetricBlock label="Avg Win/Loss" value={stats.avgWinLoss ? stats.avgWinLoss.toFixed(2) : "N/A"} />
          <MetricBlock label="Risk Control" value={`${stats.riskControl.toFixed(0)}%`} />
          <MetricBlock label="Consistency" value={`${stats.consistency.toFixed(0)}%`} tone="purple" />
          <MetricBlock label="Net P&L" value={money(stats.totalPnl)} tone={positive ? "green" : "red"} />
          <MetricBlock label="Max DD" value={money(stats.maxDrawdown)} tone={stats.maxDrawdown < 0 ? "red" : "default"} />
          <MetricBlock label="Trades Logged" value={`${stats.tradesLogged}`} />
          <MetricBlock label="Best Session" value={stats.bestSession || "N/A"} small />
          <MetricBlock label="Related Stat" value={item.metricLabel || "Journal discipline"} small tone="gold" />
        </MetricGrid>

        <ShareCardFooter dateLabel={stats.dateLabel} />
      </NeonFrame>
    </View>
  );
}

export const ACHIEVEMENT_SHARE_CARD_WIDTH = EXPORT_CARD_WIDTH;
export const ACHIEVEMENT_SHARE_CARD_HEIGHT = EXPORT_CARD_HEIGHT;

const styles = StyleSheet.create({
  root: {
    width: ACHIEVEMENT_SHARE_CARD_WIDTH,
    height: ACHIEVEMENT_SHARE_CARD_HEIGHT,
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
  heroBlock: {
    width: "100%",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  unlockedLabel: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: 6,
    textShadowColor: "rgba(156,255,0,0.45)",
    textShadowRadius: 14,
  },
  badgeStage: {
    width: 390,
    height: 390,
    borderRadius: 195,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    shadowColor: EXPORT_COLORS.purple,
    shadowOpacity: 0.75,
    shadowRadius: 48,
  },
  badgeHalo: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  badgeSvg: {
    position: "absolute",
  },
  heroLogo: {
    width: 280,
    height: 280,
  },
  rarityPill: {
    position: "absolute",
    bottom: 24,
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  rarityText: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
  },
  category: {
    color: EXPORT_COLORS.sub,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2.5,
    marginTop: 18,
  },
  title: {
    color: EXPORT_COLORS.text,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 12,
  },
  whyItMatters: {
    color: EXPORT_COLORS.sub,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 20,
  },
  progressLine: {
    color: EXPORT_COLORS.green,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    marginTop: 10,
  },
});
