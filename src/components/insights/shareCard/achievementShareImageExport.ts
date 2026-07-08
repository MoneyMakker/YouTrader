import type { Achievement } from "../../../analytics/achievements";
import { logger } from "../../../lib/logger";
import { resolveAchievementCardUri } from "../../../achievements/resolveAchievementCardUri";

function logShareCard(event: string, detail?: string) {
  logger.info(`[YouTrader:share-card] ${event}${detail ? ` ${detail}` : ""}`);
}

/** @deprecated Achievement exports use static PNG assets — kept for legacy imports. */
export async function generateAchievementShareCardImage(
  item: Achievement,
  _stats: unknown,
  _filename: string,
) {
  void _stats;
  void _filename;
  const uri = await resolveAchievementCardUri(item.id);
  logShareCard("static_asset_resolved", item.id);
  return uri;
}
