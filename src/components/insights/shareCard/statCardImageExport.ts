import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { AchievementShareStats } from "./achievementHelpers";
import { buildAchievementStatSlots } from "./achievementStatSlots";
import { buildStatTextLayers, STAT_CARD_EXPORT_HEIGHT, STAT_CARD_EXPORT_WIDTH } from "./statCardSvgBuilder";
import { enqueueStatCardRaster } from "./statCardRasterizer";
import { STAT_DARK_BULL_TEMPLATE } from "./statTemplateLayout";
import type { TraderShareCardData } from "./TraderShareCard";

let templateUriCache: string | null = null;

function logExport(event: string, detail?: string) {
  console.log(`[YouTrader:export-card] ${event}${detail ? ` ${detail}` : ""}`);
}

function traderDataToStats(data: TraderShareCardData): AchievementShareStats {
  return {
    tradesLogged: data.trades,
    winRate: data.winRate,
    totalPnl: data.netPnl,
    profitFactor: data.profitFactor,
    avgWinLoss: data.avgWinLoss ?? 0,
    avgWin: data.avgWin,
    avgLoss: data.avgLoss,
    expectancy: data.expectancy,
    bestTrade: data.bestTrade,
    currentWinStreak: data.currentWinStreak,
    greenDays: data.greenDays,
    riskControl: data.riskControl ?? 0,
    consistency: data.consistency ?? 0,
    maxDrawdown: data.maxDrawdown ?? 0,
    tradingScore: data.tradingScore ?? 0,
    bestSession: data.bestSession ?? "N/A",
    dateLabel: data.dateLabel ?? "",
  };
}

async function loadTemplateUri() {
  if (templateUriCache) return templateUriCache;
  const asset = Asset.fromModule(STAT_DARK_BULL_TEMPLATE);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  if (!uri) throw new Error("Share card template asset is missing");
  if (uri.startsWith("http")) {
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!cacheDir) throw new Error("No writable cache directory for template");
    const localPath = `${cacheDir}youtrader-stat-card-template.png`;
    await FileSystem.downloadAsync(uri, localPath);
    templateUriCache = localPath;
  } else {
    templateUriCache = uri;
  }
  logExport("template_loaded");
  return templateUriCache;
}

export async function generateStatShareCardImage(data: TraderShareCardData, filename: string) {
  const templateUri = await loadTemplateUri();
  const slots = buildAchievementStatSlots(traderDataToStats(data));
  const layers = buildStatTextLayers(slots);
  const uri = await enqueueStatCardRaster({
    templateUri,
    layers,
    width: STAT_CARD_EXPORT_WIDTH,
    height: STAT_CARD_EXPORT_HEIGHT,
    filename,
  });
  logExport("image_generated");
  return uri;
}

export { logExport as logStatCardExport };
