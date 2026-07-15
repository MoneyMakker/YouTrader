import { logger } from "../../../lib/logger";
import type { AchievementShareStats } from "./achievementHelpers";
import { buildAchievementStatSlots } from "./achievementStatSlots";
import { buildStatTextLayers, STAT_CARD_EXPORT_HEIGHT, STAT_CARD_EXPORT_WIDTH } from "./statCardSvgBuilder";
import { loadBundledAssetAsSvgHref } from "./shareTemplateAssetLoader";
import { enqueueStatCardRaster } from "./statCardRasterizer";
import { STAT_DARK_BULL_TEMPLATE } from "./statTemplateLayout";
import type { TraderShareCardData } from "./TraderShareCard";

let templateHrefCache: string | null = null;

function logExport(event: string, detail?: string) {
  logger.info(`[YouTrader:export-card] ${event}${detail ? ` ${detail}` : ""}`);
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

async function loadTemplateHref() {
  if (templateHrefCache) return templateHrefCache;
  templateHrefCache = await loadBundledAssetAsSvgHref(
    STAT_DARK_BULL_TEMPLATE,
    "youtrader-stat-card-template.jpg",
  );
  logExport("template_loaded");
  return templateHrefCache;
}

export async function generateStatShareCardImage(data: TraderShareCardData, filename: string) {
  const templateUri = await loadTemplateHref();
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
