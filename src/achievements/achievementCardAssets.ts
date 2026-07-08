import type { ImageSourcePropType } from "react-native";
import { logger } from "../lib/logger";

const DEFAULT_ACHIEVEMENT_CARD = require("../../assets/achievements/default_achievement.png");

/** Static collectible cards — artwork and copy are baked into each PNG. */
const ACHIEVEMENT_CARD_BY_ID: Record<string, ImageSourcePropType> = {
  first_trade: require("../../assets/achievements/first_trade_logged.png"),
  first_10_trades: require("../../assets/achievements/ten_trades_logged.png"),
  green_100: require("../../assets/achievements/hundred_green_trades.png"),
  green_days_10: require("../../assets/achievements/ten_green_days.png"),
  first_green_week: require("../../assets/achievements/first_green_week.png"),
  five_r_trade: require("../../assets/achievements/five_r_trade.png"),
  pass_eval: require("../../assets/achievements/prop_firm_ready.png"),
  no_revenge_week: require("../../assets/achievements/no_revenge_trading_week.png"),
  risk_streak: require("../../assets/achievements/rule_perfect.png"),
  equity_high: require("../../assets/achievements/new_equity_high.png"),
  first_1k_month: require("../../assets/achievements/positive_month.png"),
  first_10k_month: require("../../assets/achievements/elite_trader.png"),
  top_20_trader: require("../../assets/achievements/elite_trader.png"),
  one_step_funding: require("../../assets/achievements/prop_firm_ready.png"),
};

/** Extra bundled cards reserved for future achievement IDs (not used in unlock logic). */
export const BUNDLED_ACHIEVEMENT_CARD_FILES = [
  "first_green_trade.png",
  "first_green_day.png",
  "fifty_trades_logged.png",
  "hundred_trades_logged.png",
  "profit_factor_two.png",
  "thirty_green_days.png",
  "risk_master.png",
  "trading_streak.png",
] as const;

export const MAPPED_ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENT_CARD_BY_ID);

export function getAchievementCardSource(achievementId: string): ImageSourcePropType {
  const source = ACHIEVEMENT_CARD_BY_ID[achievementId];
  if (source) return source;
  if (__DEV__) {
    logger.warn(`[achievement-card] missing static asset for "${achievementId}", using default_achievement.png`);
  }
  return DEFAULT_ACHIEVEMENT_CARD;
}

export function hasDedicatedAchievementCard(achievementId: string) {
  return Boolean(ACHIEVEMENT_CARD_BY_ID[achievementId]);
}

export { DEFAULT_ACHIEVEMENT_CARD };
