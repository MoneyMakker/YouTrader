import React from "react";
import type { Achievement, TraderLevel } from "../../../analytics/achievements";
import { EXPORT_CARD_HEIGHT, EXPORT_CARD_WIDTH } from "../exportDesign";
import { CardTemplateShell, OverlayLabelValue } from "./CardTemplateShell";
import {
  achievementCategoryLabel,
  achievementRarity,
  prestigeStatement,
  type AchievementShareStats,
} from "./achievementHelpers";
import { CARD_LAYOUT } from "./cardTemplate";
import { traderTier } from "./formatters";

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
  const tone = rarity === "LEGENDARY" ? "gold" : rarity === "RARE" || rarity === "EPIC" ? "purple" : "green";
  const unlocked = item.status === "unlocked";
  const metricResult = item.progressLabel || `${Math.round(item.progress)} / ${Math.round(item.target)}`;
  const tier = traderTier(stats.tradingScore);
  const slots = CARD_LAYOUT.stats;

  return (
    <CardTemplateShell>
      <OverlayLabelValue slot={CARD_LAYOUT.score} label="SCORE" value={String(Math.round(stats.tradingScore))} tone="white" valueSize={46} />
      <OverlayLabelValue slot={CARD_LAYOUT.trdLabel} label="LEVEL" value={tier} tone="white" valueSize={14} />
      <OverlayLabelValue slot={CARD_LAYOUT.tier} label="STATUS" value={unlocked ? "UNLOCKED" : "IN PROGRESS"} tone={tone} valueSize={14} />

      <OverlayLabelValue slot={slots[0]} label="RARITY" value={rarity} tone={tone} valueSize={24} />
      <OverlayLabelValue slot={slots[1]} label="ACHIEVEMENT" value={item.title.toUpperCase()} tone="green" valueSize={18} />
      <OverlayLabelValue slot={slots[2]} label="CATEGORY" value={achievementCategoryLabel(item.category)} tone="white" valueSize={16} />
      <OverlayLabelValue
        slot={slots[3]}
        label={unlocked ? "UNLOCKED" : "PROGRESS"}
        value={unlocked ? stats.dateLabel : metricResult}
        tone="green"
        valueSize={18}
      />
      <OverlayLabelValue slot={slots[4]} label="RELATED STAT" value={item.metricLabel || "Journal discipline"} tone="white" valueSize={16} />
      <OverlayLabelValue slot={slots[5]} label="WHY IT MATTERS" value={prestigeStatement(item)} tone={tone} valueSize={14} />
    </CardTemplateShell>
  );
}

export const ACHIEVEMENT_SHARE_CARD_WIDTH = EXPORT_CARD_WIDTH;
export const ACHIEVEMENT_SHARE_CARD_HEIGHT = EXPORT_CARD_HEIGHT;
