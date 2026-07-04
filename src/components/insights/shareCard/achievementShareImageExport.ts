import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { Achievement } from "../../../analytics/achievements";
import { buildAchievementRewardOverlay, type AchievementShareStats } from "./achievementHelpers";
import { buildAchievementSvgLayers } from "./achievementShareSvgBuilder";
import {
  ACHIEVEMENT_EXPORT_HEIGHT,
  ACHIEVEMENT_EXPORT_WIDTH,
  ACHIEVEMENT_GALAXY_TEMPLATE,
} from "./achievementTemplateLayout";
import { enqueueStatCardRaster } from "./statCardRasterizer";

let templateUriCache: string | null = null;

function logShareCard(event: string, detail?: string) {
  console.log(`[YouTrader:share-card] ${event}${detail ? ` ${detail}` : ""}`);
}

async function loadAchievementTemplateUri() {
  if (templateUriCache) return templateUriCache;
  const asset = Asset.fromModule(ACHIEVEMENT_GALAXY_TEMPLATE);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  if (!uri) throw new Error("Achievement template asset is missing");
  if (uri.startsWith("http")) {
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!cacheDir) throw new Error("No writable cache directory for achievement template");
    const localPath = `${cacheDir}youtrader-achievement-galaxy-template.png`;
    await FileSystem.downloadAsync(uri, localPath);
    templateUriCache = localPath;
  } else {
    templateUriCache = uri;
  }
  logShareCard("template_loaded");
  return templateUriCache;
}

export async function generateAchievementShareCardImage(
  item: Achievement,
  stats: AchievementShareStats | null | undefined,
  filename: string,
) {
  const templateUri = await loadAchievementTemplateUri();
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
