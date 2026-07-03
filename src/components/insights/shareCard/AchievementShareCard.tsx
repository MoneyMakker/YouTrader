import React from "react";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import type { Achievement, TraderLevel } from "../../../analytics/achievements";
import { EXPORT_BRAND, EXPORT_CARD_HEIGHT, EXPORT_CARD_WIDTH } from "../exportDesign";
import {
  achievementCategoryLabel,
  achievementRarity,
  prestigeStatement,
  rarityColor,
  type AchievementShareStats,
} from "./achievementHelpers";
import { CARD_TEXT, scaledFont, TRADER_CARD_TEMPLATE } from "./cardTemplate";
import { traderTier } from "./formatters";

export type { AchievementShareStats };

function safeTitle(item?: Achievement | null) {
  const title = item?.title?.trim();
  return title ? title.toUpperCase() : "ACHIEVEMENT UNLOCKED";
}

function safeCategory(item?: Achievement | null) {
  if (!item?.category) return "DISCIPLINE";
  return achievementCategoryLabel(item.category);
}

function safeRelatedStat(item?: Achievement | null) {
  return item?.metricLabel?.trim() || item?.condition?.trim() || "Keep journaling to build your trader profile";
}

function safeWhy(item?: Achievement | null) {
  if (!item) return "Keep journaling to build your trader profile.";
  return prestigeStatement(item);
}

export function AchievementShareCard({
  item,
  level,
  stats,
}: {
  item?: Achievement | null;
  level?: TraderLevel | null;
  stats?: AchievementShareStats | null;
}) {
  const hasItem = Boolean(item?.title);
  const rarity = item && level ? achievementRarity(item, level) : "COMMON";
  const accent = rarityColor(rarity);
  const unlocked = item?.status === "unlocked";
  const score = stats?.tradingScore != null ? Math.round(stats.tradingScore) : null;
  const tier = stats ? traderTier(stats.tradingScore) : "ROOKIE";
  const dateLabel = stats?.dateLabel || "";
  const progressLabel =
    item?.progressLabel || (item ? `${Math.round(item.progress)} / ${Math.round(item.target)}` : "");

  return (
    <View style={styles.root}>
      <ImageBackground source={TRADER_CARD_TEMPLATE} style={styles.background} resizeMode="stretch" imageStyle={styles.image}>
        <View style={styles.brandChip}>
          <Text style={styles.brandChipText}>YOUTRADER</Text>
        </View>

        <View style={styles.scoreChip}>
          <Text style={styles.scoreValue}>{score != null ? score : "--"}</Text>
          <Text style={styles.scoreMeta}>{tier}</Text>
        </View>

        <View style={styles.lowerScrim} />

        <View style={styles.glassPanel}>
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>
            {safeTitle(item)}
          </Text>

          <View style={styles.badgeRow}>
            <View style={[styles.rarityBadge, { borderColor: accent, backgroundColor: `${accent}22` }]}>
              <Text style={[styles.rarityText, { color: accent }]}>{rarity}</Text>
            </View>
            <Text style={styles.categoryText}>{safeCategory(item)}</Text>
          </View>

          <Text style={styles.metaLine} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
            {safeRelatedStat(item)}
          </Text>

          <Text style={styles.whyLine} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
            {safeWhy(item)}
          </Text>

          <Text style={styles.dateLine} numberOfLines={1}>
            {unlocked && dateLabel
              ? `Unlocked ${dateLabel}`
              : hasItem && progressLabel
                ? `Progress ${progressLabel}`
                : "Achievement unlocked"}
          </Text>

          <View style={styles.panelFooter}>
            <Text style={styles.footerTitle}>{EXPORT_BRAND.appStoreHint}</Text>
            <Text style={styles.footerSub}>{EXPORT_BRAND.disclaimer}</Text>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

export const ACHIEVEMENT_SHARE_CARD_WIDTH = EXPORT_CARD_WIDTH;
export const ACHIEVEMENT_SHARE_CARD_HEIGHT = EXPORT_CARD_HEIGHT;

const META = scaledFont(15);
const TITLE = scaledFont(28);

const styles = StyleSheet.create({
  root: {
    width: EXPORT_CARD_WIDTH,
    height: EXPORT_CARD_HEIGHT,
    backgroundColor: "#030507",
    overflow: "hidden",
  },
  background: {
    width: EXPORT_CARD_WIDTH,
    height: EXPORT_CARD_HEIGHT,
  },
  image: {
    width: EXPORT_CARD_WIDTH,
    height: EXPORT_CARD_HEIGHT,
  },
  brandChip: {
    position: "absolute",
    top: "2.2%",
    alignSelf: "center",
    left: "34%",
    width: "32%",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(3,5,7,0.92)",
    borderWidth: 1,
    borderColor: "rgba(156,255,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandChipText: {
    color: CARD_TEXT.greenBright,
    fontSize: scaledFont(14),
    fontWeight: "900",
    letterSpacing: 3,
  },
  scoreChip: {
    position: "absolute",
    left: "5.5%",
    top: "14.5%",
    width: "16%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(3,5,7,0.55)",
    borderRadius: 10,
    paddingVertical: 6,
  },
  scoreValue: {
    color: CARD_TEXT.white,
    fontSize: scaledFont(34),
    fontWeight: "900",
    lineHeight: scaledFont(38),
    textShadowColor: CARD_TEXT.shadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  scoreMeta: {
    color: CARD_TEXT.green,
    fontSize: scaledFont(11),
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 2,
  },
  lowerScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "56%",
    bottom: 0,
    backgroundColor: "rgba(3,5,7,0.72)",
  },
  glassPanel: {
    position: "absolute",
    left: "5.5%",
    width: "89%",
    top: "58%",
    height: "38%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(156,255,0,0.28)",
    backgroundColor: "rgba(8,10,18,0.88)",
    paddingHorizontal: 28,
    paddingTop: 22,
    paddingBottom: 16,
    justifyContent: "space-between",
  },
  title: {
    color: CARD_TEXT.white,
    fontSize: TITLE,
    fontWeight: "900",
    letterSpacing: 0.5,
    lineHeight: TITLE + 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
  },
  rarityBadge: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  rarityText: {
    fontSize: META,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  categoryText: {
    color: CARD_TEXT.sub,
    fontSize: META,
    fontWeight: "800",
    letterSpacing: 1.2,
    flex: 1,
  },
  metaLine: {
    color: "rgba(247,248,250,0.88)",
    fontSize: META,
    fontWeight: "700",
    lineHeight: META + 6,
    marginTop: 10,
  },
  whyLine: {
    color: CARD_TEXT.green,
    fontSize: META,
    fontWeight: "700",
    lineHeight: META + 6,
    marginTop: 6,
  },
  dateLine: {
    color: "rgba(247,248,250,0.65)",
    fontSize: META,
    fontWeight: "700",
    marginTop: 8,
  },
  panelFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    paddingTop: 10,
    marginTop: 8,
    alignItems: "center",
  },
  footerTitle: {
    color: CARD_TEXT.white,
    fontSize: scaledFont(13),
    fontWeight: "900",
    textAlign: "center",
  },
  footerSub: {
    color: "rgba(247,248,250,0.7)",
    fontSize: scaledFont(10),
    fontWeight: "700",
    marginTop: 3,
    textAlign: "center",
  },
});
