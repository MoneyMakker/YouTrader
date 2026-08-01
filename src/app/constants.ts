import type { Asset, RiskInstrument } from "./types";
import { SECURITY_LIMITS } from "../security/securityConfig";
import { GUEST_TRADES_STORAGE_KEY } from "../auth/userCache";
import {
  REVENUECAT_IOS_PRODUCT_ID,
  REVENUECAT_IOS_YEARLY_PRODUCT_ID,
} from "../config/appConfig";
import * as FileSystem from "expo-file-system/legacy";

export const UI_ICON_SIZE = 22;
export const UI_ICON_STROKE = 2.4;

export const RAW_FINNHUB = process.env.EXPO_PUBLIC_FINNHUB_API_KEY || "";
export const FINNHUB = /your/i.test(RAW_FINNHUB) ? "" : RAW_FINNHUB;
export const CALENDAR_API_URL = process.env.EXPO_PUBLIC_CALENDAR_API_URL || "";
export const YOU_TRADER_BULL_LOGO = require("../../assets/youtrader-bull-mark.png");
export const PREMIUM_PRICE = "$12.99/mo";
export const PREMIUM_PRICE_YEARLY = "$99.99/yr";
export const PREMIUM_PRICE_WEEKLY = "$4.99/wk";
// RevenueCat product ids. Must exist in App Store Connect AND be added to the
// DEFAULT RevenueCat offering as packages. All unlock the same entitlement
// (REVENUECAT_ENTITLEMENT_ID, default "YouTrader Pro").
export const YOU_TRADER_WEEKLY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_WEEKLY_PRODUCT_ID || "youtrader_pro_weekly";
export const YOU_TRADER_MONTHLY_PRODUCT_ID = REVENUECAT_IOS_PRODUCT_ID || "youtrader_pro_monthly";
export const YOU_TRADER_YEARLY_PRODUCT_ID = REVENUECAT_IOS_YEARLY_PRODUCT_ID || "youtrader_pro_yearly__";
/**
 * Canonical + historical aliases. ASC currently ships yearly as `youtrader_pro_yearly__`;
 * keep the clean alias so older builds/docs and mistaken env values still unlock Pro.
 */
export const YOU_TRADER_PRO_PRODUCT_IDS = Array.from(
  new Set([
    YOU_TRADER_WEEKLY_PRODUCT_ID,
    YOU_TRADER_MONTHLY_PRODUCT_ID,
    YOU_TRADER_YEARLY_PRODUCT_ID,
    "youtrader_pro_weekly",
    "youtrader_pro_monthly",
    "youtrader_pro_yearly",
    "youtrader_pro_yearly__",
  ]),
);
export const BILLING_DEBUG_LOGS = __DEV__ || process.env.EXPO_PUBLIC_BILLING_DEBUG_LOGS === "true";
export const ENTITLEMENT_RETRY_DELAYS_MS = [0, 900, 1800, 3200];
export const TRADES_STORAGE_KEY = GUEST_TRADES_STORAGE_KEY;
export const LANG_STORAGE_KEY = "lang-v1";
/** @deprecated Journal day limit removed — free users log unlimited days; Pro unlocks media/sync/analytics. */
export const FREE_JOURNAL_DAYS = 10;
export const MAX_SYMBOL_LENGTH = 12;
export const MAX_NOTES_LENGTH = 2000;
export const MAX_MOOD_LENGTH = 32;
export const MAX_CONTRACTS = 1000;
export const MAX_PRICE = 10000000;
export const MAX_ABS_PNL = 10000000;
export const MAX_LOCAL_TRADES = 25000;
export const MAX_SCREENSHOT_BYTES = SECURITY_LIMITS.screenshotMaxBytes;
export const MAX_VOICE_NOTE_BYTES = SECURITY_LIMITS.voiceNoteMaxBytes;
export const TRADE_SAVE_DEBOUNCE_MS = 900;
export const JOURNAL_MEDIA_DIR = `${FileSystem.documentDirectory || ""}youtrader-media/`;

export const INSTRUMENTS: Record<
  string,
  { name: string; tickSize: number; tickValue: number }
> = {
  ES: { name: "S&P 500", tickSize: 0.25, tickValue: 12.5 },
  NQ: { name: "Nasdaq", tickSize: 0.25, tickValue: 5 },
  GC: { name: "Gold", tickSize: 0.1, tickValue: 10 },
  CL: { name: "Oil", tickSize: 0.01, tickValue: 10 },
  MES: { name: "Micro S&P 500", tickSize: 0.25, tickValue: 1.25 },
  MNQ: { name: "Micro Nasdaq", tickSize: 0.25, tickValue: 0.5 },
  MGC: { name: "Micro Gold", tickSize: 0.1, tickValue: 1 },
  MCL: { name: "Micro Oil", tickSize: 0.01, tickValue: 1 },
};
export const MINI_INSTRUMENTS = ["ES", "NQ", "GC", "CL"];
export const MICRO_INSTRUMENTS = ["MES", "MNQ", "MGC", "MCL"];
export const MINI_TO_MICRO_MAP: Record<string, RiskInstrument> = {
  ES: "MES",
  NQ: "MNQ",
  GC: "MGC",
  CL: "MCL",
};
export const ASSETS: Asset[] = ["ES", "NQ", "GOLD", "OIL", "BTC", "ETH"];
export const COMMON_TRADE_TAGS = ["ORB", "Pullback", "Breakout", "Reversal", "Trend", "News", "Scalp", "A+ Setup"];
export const MOODS = [
  { key: "Calm", emoji: "🧘🏼‍♂️" },
  { key: "Focused", emoji: "🎯" },
  { key: "Confident", emoji: "😎" },
  { key: "FOMO", emoji: "😤" },
  { key: "Foggy", emoji: "😵‍💫" },
  { key: "Sick", emoji: "🤒" },
  { key: "Tired", emoji: "😴" },
  { key: "Oops", emoji: "🤦🏽‍♂️" },
  { key: "Reckless", emoji: "⚠️" },
  { key: "Gambling", emoji: "🎰" },
  { key: "Patient", emoji: "🧊" },
  { key: "Greedy", emoji: "🤑" },
];

