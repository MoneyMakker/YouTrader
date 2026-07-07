import type { Achievement } from "../../../analytics/achievements";
import { logger } from "../../../lib/logger";
import { buildAchievementRewardOverlay, type AchievementShareStats } from "./achievementHelpers";
import { buildAchievementSvgLayers } from "./achievementShareSvgBuilder";
import {
  ACHIEVEMENT_EXPORT_HEIGHT,
  ACHIEVEMENT_EXPORT_WIDTH,
  ACHIEVEMENT_GALAXY_TEMPLATE,
} from "./achievementTemplateLayout";
import { loadBundledAssetAsSvgHref } from "./shareTemplateAssetLoader";
import { enqueueStatCardRaster } from "./statCardRasterizer";

let templateHrefCache: string | null = null;

function logShareCard(event: string, detail?: string) {
  logger.info(`[YouTrader:share-card] ${event}${detail ? ` ${detail}` : ""}`);
}

async function loadAchievementTemplateHref() {
  if (templateHrefCache) return templateHrefCache;
  templateHrefCache = await loadBundledAssetAsSvgHref(
    ACHIEVEMENT_GALAXY_TEMPLATE,
    "youtrader-achievement-galaxy-template.jpg",
  );
  logShareCard("template_loaded");
  return templateHrefCache;
}

export async function generateAchievementShareCardImage(
  item: Achievement,
  stats: AchievementShareStats | null | undefined,
  filename: string,
) {
  const templateUri = await loadAchievementTemplateHref();
  const copy = buildAchievementRewardOverlay(item, stats);
  const achievementLayers = buildAchievementSvgLayers(copy);
  const uri = await enqueueStatCardRaster({
    templateUri,
    achievementLayers,
    width: ACHIEVEMENT_EXPORT_WIDTH,
    height: ACHIEVEMENT_EXPORT_HEIGHT,
    filename,
  });
  logShareCard("image_generated", item.id);
  return uri;
}
