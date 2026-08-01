import type { AppLang } from "../i18n";

export type Tab =
  | "journal"
  | "stats"
  | "propPass"
  | "calendar"
  | "news"
  | "calc"
  | "settings"
  | "more";
export type Direction = "LONG" | "SHORT";
export type Asset = "ES" | "NQ" | "GOLD" | "OIL" | "BTC" | "ETH";
export type Bias = "LONG" | "SHORT" | "NEUTRAL";
export type Impact = "HIGH" | "MED" | "LOW";
export type Lang = AppLang;
export type FirmMode = "evaluation" | "funded";
export type ContractFamily = "micro" | "emini";
export type EvalStrategy = "steady" | "balanced" | "allIn";
export type RiskInstrument = "MES" | "MNQ" | "MGC" | "MCL" | "ES" | "NQ" | "GC" | "CL";
export type RiskStatus = "STOP" | "CAUTION" | "CLEAR";
export type Trade = {
  id: string;
  date: string;
  symbol: string;
  direction: Direction;
  entryTime?: string | null;
  exitTime?: string | null;
  entry?: number | null;
  exit?: number | null;
  contracts: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  pnl: number;
  mood: string;
  notes: string;
  tags?: string[];
  photoUri?: string | null;
  voiceUri?: string | null;
  photoCloudUri?: string | null;
  voiceCloudUri?: string | null;
  voiceName?: string | null;
  createdAt?: number;
  updatedAt?: number;
};

export type TradeJournalRow = {
  id?: string;
  client_id: string;
  user_id: string;
  trade_date: string;
  symbol: string;
  direction: Direction;
  entry_time?: string | null;
  exit_time?: string | null;
  contracts: number;
  entry: number | null;
  exit: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  pnl: number;
  mood: string | null;
  notes: string | null;
  screenshot_url: string | null;
  voice_url: string | null;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type MarketNews = {
  id: string;
  title: string;
  summary: string;
  source: string;
  time: string;
  impact: Impact;
  bias: Record<Asset, Bias>;
  url?: string;
};
export type EconEvent = {
  id: string;
  date: string;
  time: string;
  name: string;
  impact: Impact;
  actual: string;
  forecast: string;
  previous: string;
  bias: Record<Asset, Bias>;
};
export type MarketDailyBrief = {
  title: string;
  summary: string;
  marketRegime: string;
  keyMacroEvents: string[];
  topRisks: string[];
  assetsToWatch: string[];
  volatilityWarning: string;
  propFirmCaution: string;
  whatNotToDo: string;
  generatedAt: string;
};
export type MarketWatchlistItem = {
  asset: string;
  bias: Bias;
  confidence: string;
  reason: string;
  caution: string;
};
export type MarketSummary = {
  macroTone: string;
  riskMode: string;
  strongestHeadlines: string[];
  importantCalendarEvents: string[];
  propFirmRiskWarnings: string[];
  updatedAt: string;
};
export type PropFirmUpdate = {
  id: string;
  firm: string;
  category: string;
  keyText: string;
  detectedChangeSummary: string;
  changedAt: string;
  url: string;
};
export type MarketIntelData = {
  brief: MarketDailyBrief | null;
  watchlist: MarketWatchlistItem[];
  summary: MarketSummary | null;
  events: EconEvent[];
  propUpdates: PropFirmUpdate[];
  headlines: MarketNews[];
};
export type ServerSubscriptionRow = {
  status: string | null;
  expires_at: string | null;
};
export type ProAccessSource = "none" | "revenuecat_entitlement" | "apple_subscription" | "server_entitlement";
export type ProAccessState = {
  isPro: boolean;
  source: ProAccessSource;
  revenueCatEntitlementActive: boolean;
  appleMonthlyActive: boolean;
  serverEntitlementActive: boolean;
  lastUpdatedAt: number;
};
