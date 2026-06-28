import "react-native-url-polyfill/auto";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as AppleAuthentication from "expo-apple-authentication";
import { makeRedirectUri } from "expo-auth-session";
import * as Notifications from "expo-notifications";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type MakePurchaseResult,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from "react-native-purchases";
import { PostHogProvider } from "posthog-react-native";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  BookOpen,
  BrainCircuit,
  Calculator as CalculatorIcon,
  CalendarDays,
  ChartColumnIncreasing,
  Lock,
  Newspaper,
  Settings as SettingsIcon,
  Unlock,
} from "lucide-react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from "react-native-svg";
import * as DocumentPicker from "expo-document-picker";
import { SharePnLCard } from "./src/components/insights/SharePnLCard";
import { alertExportError } from "./src/utils/alertExportError";
import { parseTradesCsvText } from "./src/utils/importTradesCsv";
import { readCsvFileAsText } from "./src/utils/readCsvFile";
import { scheduleDailyPropRiskNotification } from "./src/utils/propRiskNotification";
import { fetchFinnhubEconomicCalendar, mapFinnhubEconomicRows } from "./src/api/finnhubCalendar";
import {
  analyzeTrades,
  type DetectiveAgentFinding,
  type TradeAnalysisPayload,
  type TradeAnalysisResult,
  type TradePerformanceBreakdown,
} from "./src/api/tradeAnalysis";
import {
  fetchAIDailyChallenge,
  fetchAIDailyPlan,
  fetchAIJournalSummary,
  fetchAINewsExplainer,
  fetchAIRiskPredictor,
  fetchAIWeeklyCoach,
  type AIDailyChallenge,
  type AIDailyPlan,
  type AIJournalSummary,
  type AINewsExplainer,
  type AIProviderStatus,
  type AIResponse,
  type AIRiskPredictor,
  type AIWeeklyCoach,
} from "./src/api/aiCoach";
import { trackEvent, trackScreen } from "./src/observability/analytics";
import { captureAppError, initializeMonitoring, logCrashlyticsBreadcrumb, wrapAppWithSentry } from "./src/observability/monitoring";
import { recordMetric } from "./src/observability/metrics";
import { posthogClient } from "./src/lib/posthog";
import { logger } from "./src/lib/logger";
import {
  enableCloudSignIn,
  enableNativeAppleSignIn,
  isRevenueCatConfigured,
  isSupabaseConfigured,
  REVENUECAT_API_KEY,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_IOS_PRODUCT_ID,
  REVENUECAT_IOS_YEARLY_PRODUCT_ID,
  supabase,
  userFacingBillingError,
} from "./src/config/appConfig";
import { openLegalUrl, PRIVACY_POLICY_URL, TERMS_OF_USE_EULA_URL } from "./src/config/legalUrls";
import { SubscriptionLegalDisclosure } from "./src/components/subscription/SubscriptionLegalDisclosure";
import {
  checkClientRateLimit,
  recordSecurityEvent,
  runIdempotentLocal,
  stableSecurityHash,
  withTimeout,
} from "./src/security/clientSecurity";
import { SECURITY_LIMITS, SECURITY_MESSAGES } from "./src/security/securityConfig";
import { validateImportedRows, validateTradeInput } from "./src/security/tradeValidation";
import { validateSecureUploadInput } from "./src/security/uploadSecurity";
import { GlassCard } from "./src/components/ui/GlassCard";
import { AnimatedEquityCurve } from "./src/components/charts/AnimatedEquityCurve";
import { PremiumGlassCard } from "./src/components/ui/PremiumGlassCard";
import { PremiumLockOverlay } from "./src/components/ui/PremiumLockOverlay";
import { lightHaptic, warningHaptic } from "./src/components/ui/haptics";
import { calculateAchievements, traderLevelFromScore, type Achievement, type TraderLevel } from "./src/analytics/achievements";
import { detectTradingPatterns, type PatternDetectionResult } from "./src/analytics/patternDetector";
import { calculatePropSurvival } from "./src/analytics/propSurvival";
import { buildSessionHeatmap, type HourHeatmapCell } from "./src/analytics/sessionHeatmap";
import { calculateTradingScore, type TradingScoreResult } from "./src/analytics/tradingScore";
import { buildAIAnalyticsContext } from "./src/analytics/aiContextBuilder";
import { buildUnifiedTradeAnalytics, drawdownControlFromMetrics, infinitySafeMetric } from "./src/analytics/tradeMetrics";
import { calculatePassProbability, type PassProbabilityResult } from "./src/ai/passProbabilityEngine";
import { detectRevengeTrading, type RevengeTradingResult } from "./src/ai/revengeTradingDetector";
import { detectHiddenLeaks, type HiddenLeak } from "./src/ai/hiddenLeakDetector";

WebBrowser.maybeCompleteAuthSession();
initializeMonitoring();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type Tab = "journal" | "stats" | "ai" | "calendar" | "news" | "calc" | "settings";
type Direction = "LONG" | "SHORT";
type Asset = "ES" | "NQ" | "GOLD" | "OIL" | "BTC" | "ETH";
type Bias = "LONG" | "SHORT" | "NEUTRAL";
type Impact = "HIGH" | "MED" | "LOW";
type Lang = "en" | "ru" | "es" | "fr" | "it" | "uk" | "de";
type AuthProvider = "google" | "apple";
type FirmMode = "evaluation" | "funded";
type ContractFamily = "micro" | "emini";
type EvalStrategy = "steady" | "balanced" | "allIn";
type RiskInstrument = "MES" | "MNQ" | "MGC" | "MCL" | "ES" | "NQ" | "GC" | "CL";
type RiskStatus = "STOP" | "CAUTION" | "CLEAR";

type Trade = {
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
  voiceName?: string | null;
  createdAt?: number;
  updatedAt?: number;
};

type TradeJournalRow = {
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

type MarketNews = {
  id: string;
  title: string;
  summary: string;
  source: string;
  time: string;
  impact: Impact;
  bias: Record<Asset, Bias>;
  url?: string;
};
type EconEvent = {
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
type MarketDailyBrief = {
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
type MarketWatchlistItem = {
  asset: string;
  bias: Bias;
  confidence: string;
  reason: string;
  caution: string;
};
type MarketSummary = {
  macroTone: string;
  riskMode: string;
  strongestHeadlines: string[];
  importantCalendarEvents: string[];
  propFirmRiskWarnings: string[];
  updatedAt: string;
};
type PropFirmUpdate = {
  id: string;
  firm: string;
  category: string;
  keyText: string;
  detectedChangeSummary: string;
  changedAt: string;
  url: string;
};
type MarketIntelData = {
  brief: MarketDailyBrief | null;
  watchlist: MarketWatchlistItem[];
  summary: MarketSummary | null;
  events: EconEvent[];
  propUpdates: PropFirmUpdate[];
  headlines: MarketNews[];
};
type ServerSubscriptionRow = {
  status: string | null;
  expires_at: string | null;
};
type ProAccessSource = "none" | "revenuecat_entitlement" | "apple_subscription" | "server_entitlement";
type ProAccessState = {
  isPro: boolean;
  source: ProAccessSource;
  revenueCatEntitlementActive: boolean;
  appleMonthlyActive: boolean;
  serverEntitlementActive: boolean;
  lastUpdatedAt: number;
};

const RAW_FINNHUB = process.env.EXPO_PUBLIC_FINNHUB_API_KEY || "";
const FINNHUB = /your/i.test(RAW_FINNHUB) ? "" : RAW_FINNHUB;
const CALENDAR_API_URL = process.env.EXPO_PUBLIC_CALENDAR_API_URL || "";
const YOU_TRADER_BULL_LOGO = require("./assets/youtrader-bull-mark.png");
const AUTH_REDIRECT_TO = makeRedirectUri({ scheme: "com.youtrader.pro", path: "auth" });
const PREMIUM_PRICE = "$12.99/mo";
const PREMIUM_PRICE_YEARLY = "$99.99/yr";
// RevenueCat product ids. Both must exist in App Store Connect AND be added to the
// DEFAULT RevenueCat offering as packages. Both unlock the same entitlement
// (REVENUECAT_ENTITLEMENT_ID, default "YouTrader Pro").
const YOU_TRADER_MONTHLY_PRODUCT_ID = REVENUECAT_IOS_PRODUCT_ID || "youtrader_pro_monthly";
const YOU_TRADER_YEARLY_PRODUCT_ID = REVENUECAT_IOS_YEARLY_PRODUCT_ID || "youtrader_pro_yearly";
// Any of these product ids unlocking the shared entitlement grants Pro access.
const YOU_TRADER_PRO_PRODUCT_IDS = [YOU_TRADER_MONTHLY_PRODUCT_ID, YOU_TRADER_YEARLY_PRODUCT_ID];
const BILLING_DEBUG_LOGS = __DEV__ || process.env.EXPO_PUBLIC_BILLING_DEBUG_LOGS === "true";
const ENTITLEMENT_RETRY_DELAYS_MS = [0, 900, 1800, 3200];
const TRADES_STORAGE_KEY = "trades-v6";
const LANG_STORAGE_KEY = "lang-v1";
const LOCK_SCREEN_BUFFER_KEY = "prop-lock-screen-v1";
/** @deprecated Journal day limit removed — free users log unlimited days; Pro unlocks media/sync/analytics. */
const FREE_JOURNAL_DAYS = 10;
const PROP_RULES_CACHE_KEY = "prop-risk-templates-cache-v1";
const PROP_RISK_ALERT_ID_KEY = "prop-risk-alert-notification-id-v1";
const CALENDAR_ALERT_ID_KEY = "calendar-alert-notification-id-v1";
const MAX_SYMBOL_LENGTH = 12;
const MAX_NOTES_LENGTH = 2000;
const MAX_MOOD_LENGTH = 32;
const MAX_CONTRACTS = 1000;
const MAX_PRICE = 10000000;
const MAX_ABS_PNL = 10000000;
const MAX_LOCAL_TRADES = 25000;
const MAX_SCREENSHOT_BYTES = SECURITY_LIMITS.screenshotMaxBytes;
const MAX_VOICE_NOTE_BYTES = SECURITY_LIMITS.voiceNoteMaxBytes;
const TRADE_SAVE_DEBOUNCE_MS = 900;

const C = {
  bg: "#000000",
  card: "#090A0C",
  card2: "#101216",
  card3: "#15181D",
  border: "#242932",
  text: "#F4F7F5",
  sub: "#9AA3AD",
  muted: "#5B6570",
  green: "#A3FF12",
  greenSoft: "rgba(163,255,18,0.13)",
  red: "#FF3B5F",
  redSoft: "rgba(255,59,95,0.11)",
  yellow: "#FFD23F",
  yellowSoft: "rgba(255,210,63,0.11)",
  purple: "#B026FF",
  purpleSoft: "rgba(176,38,255,0.12)",
  orange: "#FF9F1A",
  white: "#FFFFFF",
};

const I18N: Record<Lang, Record<string, string>> = {
  en: {
    myJournal: "My Journal",
    journal: "Journal",
    stats: "Stats",
    calendar: "Calendar",
    news: "News",
    calc: "Calculator",
    settings: "Settings",
    addTrade: "+ Add Trade",
    statistics: "Statistics",
    today: "Today",
    trades: "Trades",
    tapDay: "Tap any day to add a trade",
    net: "Net P&L",
    winRate: "Win Rate",
    profitFactor: "Profit Factor",
    expectancy: "Expectancy",
    count: "Trades",
    avgR: "Avg R",
    avgWinStreak: "Avg win streak",
    avgLossStreak: "Avg loss streak",
    ev: "EV",
    saveTrade: "Save Trade",
    updateTrade: "Update Trade",
    deleteTrade: "Delete Trade",
    close: "Close",
    symbol: "Symbol",
    customSymbol: "Custom Symbol",
    direction: "Direction",
    entry: "Entry Price",
    exit: "Exit Price",
    contracts: "Contracts",
    stopLoss: "Stop Loss",
    takeProfit: "Take Profit",
    mood: "Mood",
    notes: "Day Notes",
    pnl: "P&L",
    addPnl: "Add P&L or entry/exit prices",
    deleteQuestion: "Delete trade?",
    cannotUndo: "This cannot be undone.",
    liveNews: "Live News",
    autoRefresh: "auto-refresh every 60 seconds",
    refresh: "Refresh",
    economicCalendar: "Economic Calendar",
    calendarSub: "Market-Events • (Eastern Time)",
    act: "ACT",
    fcst: "FCST",
    prev: "PREV",
    miniContracts: "E-mini contracts",
    microContracts: "Micro contracts",
    customInstrument: "Custom Instrument",
    ticks: "Ticks",
    resultInUsd: "Result in $",
    language: "Language",
    subscription: "Subscription",
    premiumAccess: "YouTrader Pro",
    subscribe: "Unlock Pro • $12.99/mo",
    restore: "Restore Purchase",
    premiumLocked: "Premium Feature",
    premiumLockedText:
      "Your manual journal stays free. Pro unlocks AI coaching, prop firm protection, advanced analytics, media notes, import/export, full news, and the full economic calendar.",
    plusPnl: "Profit +",
    minusPnl: "Loss −",
    photo: "Trade Screenshot",
    takePhoto: "Take Photo",
    uploadPhoto: "Upload Photo",
    voiceNote: "Voice Note",
    uploadAudio: "Add Voice Note",
    openAudio: "Open Audio",
    noAudio: "No audio note yet",
    calendarIntel: "Calendar intelligence",
    calendarIntelText: "High impact events can expand volatility. Check ES/NQ/GOLD/OIL/BTC bias before trading.",
    premiumBenefit1: "AI Trade Analysis and Prop Firm Coach",
    premiumBenefit2: "Pass Probability, Revenge Trading alerts, Hidden Leaks, and Pattern Prediction",
    premiumBenefit3: "Advanced stats: Profit Factor, Expectancy, Drawdown, radar, sessions, symbols, and setups",
    premiumBenefit4: "CSV import/export, share cards, and monthly PDF reports",
    premiumBenefit5: "Cloud sync for your journal across devices",
    premiumBenefit6: "Screenshots, photos, and voice notes for trade reviews",
    premiumBenefit7: "Full real-time Market Pulse news feed",
    premiumBenefit8: "Full economic calendar beyond today's preview",
    percentRiskCalculator: "% Risk Calculator",
    accountBalance: "Account Balance",
    riskPercent: "Risk %",
    maxRisk: "Max SL Risk",
    acceptTerms: "I read and agree to Terms and Conditions.",
    termsText: "YouTrader is an educational journaling and market-information tool. It is not financial, investment, legal, tax or trading advice. You are fully responsible for all trading decisions, risk, losses and gains. YouTrader does not guarantee profits, market outcomes, data accuracy or uninterrupted service.",
    recordVoice: "Record Voice",
    stopRecording: "Stop Recording",
    playVoice: "Play Voice",
    points: "Points",
    mode: "Mode",
    rrCalculator: "Risk Reward",
    slAmount: "SL",
    tpAmount: "TP",
    riskReward: "Risk / Reward",
    dataProtection: "Data Protection",
    backupNow: "Export Backup",
    restoreBackup: "Import Backup",
    backupText: "Save a full backup of your trades and screenshots to iCloud Drive. If the app is deleted, import this file to restore your journal.",
    cloudSync: "Local backup",
    cloudSyncText: "Keep your journal on this device and export backups when needed.",
    backupReady: "Backup ready",
    backupFailed: "Backup failed",
    restoreDone: "Backup restored. Restart the app to reload your journal.",
    restoreFailed: "Restore failed",
  },
  ru: {
    myJournal: "Мой журнал",
    journal: "Журнал",
    stats: "Stats",
    calendar: "Календарь",
    news: "Новости",
    calc: "Кальк.",
    settings: "Настр.",
    addTrade: "+ Добавить сделку",
    statistics: "Статистика",
    today: "Сегодня",
    trades: "Сделки",
    tapDay: "Нажми на день, чтобы добавить сделку",
    net: "Общий P&L",
    winRate: "Win Rate",
    profitFactor: "Profit Factor",
    expectancy: "Expectancy",
    count: "Сделки",
    avgR: "Avg R",
    avgWinStreak: "Avg win streak",
    avgLossStreak: "Avg loss streak",
    ev: "EV",
    saveTrade: "Сохранить сделку",
    updateTrade: "Обновить сделку",
    deleteTrade: "Удалить сделку",
    close: "Закрыть",
    symbol: "Символ",
    customSymbol: "Свой символ",
    direction: "Направление",
    entry: "Цена входа",
    exit: "Цена выхода",
    contracts: "Контракты",
    stopLoss: "Stop Loss",
    takeProfit: "Take Profit",
    mood: "Эмоция",
    notes: "Заметки дня",
    pnl: "P&L",
    addPnl: "Добавь P&L или цены входа/выхода",
    deleteQuestion: "Удалить сделку?",
    cannotUndo: "Это действие нельзя отменить.",
    liveNews: "Живые новости",
    autoRefresh: "Finnhub live • автообновление каждые 60 секунд",
    refresh: "Обновить",
    economicCalendar: "Экономический календарь",
    calendarSub: "Важные события рынка • Eastern Time",
    act: "ФАКТ",
    fcst: "ПРОГ",
    prev: "ПРЕД",
    miniContracts: "E-mini контракты",
    microContracts: "Micro контракты",
    customInstrument: "Свой инструмент",
    ticks: "Тики",
    resultInUsd: "Результат в $",
    language: "Язык",
    subscription: "Подписка",
    premiumAccess: "YouTrader Pro",
    subscribe: "Оформить Premium • $12.99/мес",
    restore: "Восстановить покупку",
    premiumLocked: "Premium функция",
    premiumLockedText:
      "Ручной журнал остаётся бесплатным. Pro открывает AI-коучинг, защиту prop firm, продвинутую аналитику, медиа-заметки, импорт/экспорт, полные новости и полный экономический календарь.",
    plusPnl: "Профит +",
    minusPnl: "Лосс −",
    photo: "Скрин сделки",
    takePhoto: "Сфотографировать",
    uploadPhoto: "Загрузить фото",
    voiceNote: "Аудиозаметка",
    uploadAudio: "Добавить аудио",
    openAudio: "Открыть аудио",
    noAudio: "Пока нет аудио",
    calendarIntel: "Интеллект календаря",
    calendarIntelText: "High impact события могут резко увеличить волатильность. Проверь bias по ES/NQ/GOLD/OIL/BTC перед торговлей.",
    premiumBenefit1: "AI-анализ сделок и Prop Firm Coach",
    premiumBenefit2: "Pass Probability, Revenge Trading alerts, Hidden Leaks и Pattern Prediction",
    premiumBenefit3: "Продвинутая статистика: Profit Factor, Expectancy, Drawdown, radar, сессии, символы и сетапы",
    premiumBenefit4: "CSV импорт/экспорт, share cards и monthly PDF reports",
    premiumBenefit5: "Cloud sync журнала между устройствами",
    premiumBenefit6: "Скриншоты, фото и голосовые заметки для разбора сделок",
    premiumBenefit7: "Полная real-time Market Pulse лента новостей",
    premiumBenefit8: "Полный экономический календарь за пределами сегодняшнего превью",
    percentRiskCalculator: "% Risk Calculator",
    accountBalance: "Account Balance",
    riskPercent: "Risk %",
    maxRisk: "Max SL Risk",
    dataProtection: "Защита данных",
    backupNow: "Экспорт backup",
    restoreBackup: "Импорт backup",
    backupText: "Сохраняй полный backup сделок и скриншотов в iCloud Drive. Если приложение удалится, импортируй этот файл и восстанови журнал.",
    cloudSync: "Local backup",
    cloudSyncText: "Журнал хранится на устройстве, а backup можно экспортировать при необходимости.",
    backupReady: "Backup готов",
    backupFailed: "Backup не удался",
    restoreDone: "Backup восстановлен. Перезапусти приложение, чтобы журнал обновился.",
    restoreFailed: "Восстановление не удалось",
  },
  es: {
    myJournal: "Mi diario",
    journal: "Diario",
    calendar: "Calend.",
    news: "Noticias",
    calc: "Calculadora",
    settings: "Ajustes",
    addTrade: "+ Añadir trade",
    statistics: "Estadísticas",
    today: "Hoy",
    trades: "Trades",
    tapDay: "Toca un día para añadir trade",
    net: "P&L neto",
    winRate: "Win Rate",
    profitFactor: "Profit Factor",
    expectancy: "Expectancy",
    count: "Trades",
    avgR: "Avg R",
    avgWinStreak: "Avg win streak",
    avgLossStreak: "Avg loss streak",
    ev: "EV",
    saveTrade: "Guardar trade",
    updateTrade: "Actualizar trade",
    deleteTrade: "Eliminar trade",
    close: "Cerrar",
    symbol: "Símbolo",
    customSymbol: "Símbolo custom",
    direction: "Dirección",
    entry: "Entrada",
    exit: "Salida",
    contracts: "Contratos",
    stopLoss: "Stop Loss",
    takeProfit: "Take Profit",
    mood: "Emoción",
    notes: "Notas",
    pnl: "P&L",
    addPnl: "Añade P&L o precios",
    deleteQuestion: "¿Eliminar trade?",
    cannotUndo: "No se puede deshacer.",
    liveNews: "Noticias live",
    autoRefresh: "Auto-refresh cada 60 segundos",
    refresh: "Actualizar",
    economicCalendar: "Calendario económico",
    calendarSub: "Eventos clave • Eastern Time",
    act: "ACT",
    fcst: "FCST",
    prev: "PREV",
    miniContracts: "E-mini contracts",
    microContracts: "Micro contratos",
    customInstrument: "Instrumento custom",
    ticks: "Ticks",
    resultInUsd: "Resultado en $",
    language: "Idioma",
    subscription: "Suscripción",
    premiumAccess: "YouTrader Pro",
    subscribe: "Premium • $12.99/mes",
    restore: "Restaurar compra",
    premiumLocked: "Función Premium",
    premiumLockedText:
      "Desbloquea análisis de trades con IA, notas multimedia, importación CSV, exportación, analíticas completas, noticias Market Pulse y calendario económico de varios días.",
    plusPnl: "Profit +",
    minusPnl: "Loss −",
    photo: "Screenshot",
    takePhoto: "Tomar foto",
    uploadPhoto: "Subir foto",
    premiumBenefit1: "Análisis de trades con IA y feedback educativo",
    premiumBenefit2: "Capturas, fotos y notas de voz para cada setup",
    premiumBenefit3: "Importación CSV y flujo de backup para el journal a largo plazo",
    premiumBenefit4: "Analíticas completas: Profit Factor, Expectancy, Win Rate, Drawdown y Recovery",
    premiumBenefit5: "Performance Profile, radar y seguimiento avanzado del edge",
    premiumBenefit6: "Estadísticas profundas por símbolo, sesión, día y setup",
    premiumBenefit7: "Noticias Market Pulse en tiempo real y actualizaciones financieras",
    premiumBenefit8: "Calendario económico de varios días con CPI, PPI, FOMC, NFP, GDP y más",
    percentRiskCalculator: "% Risk Calculator",
    accountBalance: "Account Balance",
    riskPercent: "Risk %",
    maxRisk: "Max SL Risk",
  },
  fr: {
    myJournal: "Mon journal",
    journal: "Journal",
    calendar: "Calendrier",
    news: "News",
    calc: "Calculateur",
    settings: "Réglages",
    addTrade: "+ Ajouter trade",
    statistics: "Statistiques",
    today: "Aujourd’hui",
    trades: "Trades",
    tapDay: "Touchez un jour pour ajouter",
    net: "P&L net",
    winRate: "Win Rate",
    profitFactor: "Profit Factor",
    expectancy: "Expectancy",
    count: "Trades",
    avgR: "Avg R",
    avgWinStreak: "Avg win streak",
    avgLossStreak: "Avg loss streak",
    ev: "EV",
    saveTrade: "Sauver trade",
    updateTrade: "Modifier trade",
    deleteTrade: "Supprimer trade",
    close: "Fermer",
    symbol: "Symbole",
    customSymbol: "Symbole custom",
    direction: "Direction",
    entry: "Entrée",
    exit: "Sortie",
    contracts: "Contrats",
    stopLoss: "Stop Loss",
    takeProfit: "Take Profit",
    mood: "Émotion",
    notes: "Notes",
    pnl: "P&L",
    addPnl: "Ajoutez P&L ou prix",
    deleteQuestion: "Supprimer ?",
    cannotUndo: "Action irréversible.",
    liveNews: "News live",
    autoRefresh: "Auto-refresh 60 sec",
    refresh: "Rafraîchir",
    economicCalendar: "Calendrier économique",
    calendarSub: "Événements • Eastern Time",
    act: "ACT",
    fcst: "FCST",
    prev: "PREV",
    miniContracts: "E-mini contracts",
    microContracts: "Micro contrats",
    customInstrument: "Instrument custom",
    ticks: "Ticks",
    resultInUsd: "Résultat en $",
    language: "Langue",
    subscription: "Abonnement",
    premiumAccess: "YouTrader Pro",
    subscribe: "Premium • $12.99/mois",
    restore: "Restaurer achat",
    premiumLocked: "Fonction Premium",
    premiumLockedText:
      "Débloquez l'analyse IA des trades, les notes multimédias, l'import CSV, l'export, les analytics complets, les news Market Pulse et le calendrier économique sur plusieurs jours.",
    plusPnl: "Profit +",
    minusPnl: "Loss −",
    photo: "Screenshot",
    takePhoto: "Photo",
    uploadPhoto: "Importer",
    premiumBenefit1: "Analyse IA des trades avec feedback éducatif",
    premiumBenefit2: "Captures, photos et notes vocales pour chaque setup",
    premiumBenefit3: "Import CSV et workflow de sauvegarde du journal à long terme",
    premiumBenefit4: "Analytics complets : Profit Factor, Expectancy, Win Rate, Drawdown et Recovery",
    premiumBenefit5: "Performance Profile, radar et suivi avancé de l'edge",
    premiumBenefit6: "Statistiques détaillées par symbole, session, jour et setup",
    premiumBenefit7: "News Market Pulse en temps réel et mises à jour financières",
    premiumBenefit8: "Calendrier économique multi-jours avec CPI, PPI, FOMC, NFP, GDP et plus",
    percentRiskCalculator: "% Risk Calculator",
    accountBalance: "Account Balance",
    riskPercent: "Risk %",
    maxRisk: "Max SL Risk",
  },
  it: {
    myJournal: "Il mio diario",
    journal: "Diario",
    calendar: "Calendario",
    news: "Notizie",
    calc: "Calc.",
    settings: "Imp.",
    addTrade: "+ Aggiungi trade",
    statistics: "Statistiche",
    today: "Oggi",
    trades: "Trades",
    tapDay: "Tocca un giorno per aggiungere",
    net: "P&L netto",
    winRate: "Win Rate",
    profitFactor: "Profit Factor",
    expectancy: "Expectancy",
    count: "Trades",
    avgR: "Avg R",
    avgWinStreak: "Avg win streak",
    avgLossStreak: "Avg loss streak",
    ev: "EV",
    saveTrade: "Salva trade",
    updateTrade: "Aggiorna trade",
    deleteTrade: "Elimina trade",
    close: "Chiudi",
    symbol: "Simbolo",
    customSymbol: "Simbolo custom",
    direction: "Direzione",
    entry: "Ingresso",
    exit: "Uscita",
    contracts: "Contratti",
    stopLoss: "Stop Loss",
    takeProfit: "Take Profit",
    mood: "Emozione",
    notes: "Note",
    pnl: "P&L",
    addPnl: "Aggiungi P&L o prezzi",
    deleteQuestion: "Eliminare?",
    cannotUndo: "Non si può annullare.",
    liveNews: "News live",
    autoRefresh: "Auto-refresh ogni 60 sec",
    refresh: "Aggiorna",
    economicCalendar: "Calendario economico",
    calendarSub: "Eventi • Eastern Time",
    act: "ACT",
    fcst: "FCST",
    prev: "PREV",
    miniContracts: "E-mini contracts",
    microContracts: "Micro contratti",
    customInstrument: "Strumento custom",
    ticks: "Ticks",
    resultInUsd: "Risultato in $",
    language: "Lingua",
    subscription: "Abbonamento",
    premiumAccess: "YouTrader Pro",
    subscribe: "Premium • $12.99/mese",
    restore: "Ripristina",
    premiumLocked: "Funzione Premium",
    premiumLockedText:
      "Sblocca analisi trade con IA, note multimediali, import CSV, export, analytics completi, news Market Pulse e calendario economico multi-giorno.",
    plusPnl: "Profit +",
    minusPnl: "Loss −",
    photo: "Screenshot",
    takePhoto: "Foto",
    uploadPhoto: "Carica",
    premiumBenefit1: "Analisi trade con IA e feedback educativo",
    premiumBenefit2: "Screenshot, foto e note vocali per ogni setup",
    premiumBenefit3: "Import CSV e workflow di backup del journal a lungo termine",
    premiumBenefit4: "Analytics completi: Profit Factor, Expectancy, Win Rate, Drawdown e Recovery",
    premiumBenefit5: "Performance Profile, radar e tracking avanzato dell'edge",
    premiumBenefit6: "Statistiche profonde per simbolo, sessione, giorno e setup",
    premiumBenefit7: "News Market Pulse in tempo reale e aggiornamenti finanziari",
    premiumBenefit8: "Calendario economico multi-giorno con CPI, PPI, FOMC, NFP, GDP e altro",
    percentRiskCalculator: "% Risk Calculator",
    accountBalance: "Account Balance",
    riskPercent: "Risk %",
    maxRisk: "Max SL Risk",
  },
  uk: {
    myJournal: "Мій журнал",
    journal: "Журнал",
    calendar: "Календар",
    news: "Новини",
    calc: "Кальк.",
    settings: "Налашт.",
    addTrade: "+ Додати угоду",
    statistics: "Статистика",
    today: "Сьогодні",
    trades: "Угоди",
    tapDay: "Натисни день, щоб додати",
    net: "Загальний P&L",
    winRate: "Win Rate",
    profitFactor: "Profit Factor",
    expectancy: "Expectancy",
    count: "Угоди",
    avgR: "Avg R",
    avgWinStreak: "Avg win streak",
    avgLossStreak: "Avg loss streak",
    ev: "EV",
    saveTrade: "Зберегти угоду",
    updateTrade: "Оновити угоду",
    deleteTrade: "Видалити угоду",
    close: "Закрити",
    symbol: "Символ",
    customSymbol: "Свій символ",
    direction: "Напрям",
    entry: "Вхід",
    exit: "Вихід",
    contracts: "Контракти",
    stopLoss: "Stop Loss",
    takeProfit: "Take Profit",
    mood: "Емоція",
    notes: "Нотатки",
    pnl: "P&L",
    addPnl: "Додай P&L або ціни",
    deleteQuestion: "Видалити?",
    cannotUndo: "Не можна скасувати.",
    liveNews: "Live новини",
    autoRefresh: "Оновлення 60 сек",
    refresh: "Оновити",
    economicCalendar: "Економічний календар",
    calendarSub: "Події • Eastern Time",
    act: "ФАКТ",
    fcst: "ПРОГ",
    prev: "ПОП",
    miniContracts: "E-mini контракти",
    microContracts: "Micro контракти",
    customInstrument: "Свій інструмент",
    ticks: "Тіки",
    resultInUsd: "Результат у $",
    language: "Мова",
    subscription: "Підписка",
    premiumAccess: "YouTrader Pro",
    subscribe: "Premium • $12.99/міс",
    restore: "Відновити",
    premiumLocked: "Premium функція",
    premiumLockedText:
      "Відкрий AI-аналіз угод, медіа-нотатки, CSV-імпорт, експорт, повну аналітику, Market Pulse новини та календар на кілька днів.",
    plusPnl: "Профіт +",
    minusPnl: "Лосс −",
    photo: "Скрин",
    takePhoto: "Фото",
    uploadPhoto: "Завантажити",
    premiumBenefit1: "AI-аналіз угод з навчальним фідбеком",
    premiumBenefit2: "Скриншоти, фото та голосові нотатки для кожного сетапу",
    premiumBenefit3: "CSV-імпорт і довгостроковий backup журналу",
    premiumBenefit4: "Повна аналітика: Profit Factor, Expectancy, Win Rate, Drawdown і Recovery",
    premiumBenefit5: "Performance Profile, radar і просунутий аналіз edge",
    premiumBenefit6: "Глибока статистика за символами, сесіями, днями та сетапами",
    premiumBenefit7: "Real-time Market Pulse новини та фінансові оновлення",
    premiumBenefit8: "Календар на кілька днів: CPI, PPI, FOMC, NFP, GDP та інші події",
    percentRiskCalculator: "% Risk Calculator",
    accountBalance: "Account Balance",
    riskPercent: "Risk %",
    maxRisk: "Max SL Risk",
  },
  de: {
    myJournal: "Mein Journal",
    journal: "Journal",
    calendar: "Kalender",
    news: "News",
    calc: "Calc.",
    settings: "Einst.",
    addTrade: "+ Trade hinzufügen",
    statistics: "Statistik",
    today: "Heute",
    trades: "Trades",
    tapDay: "Tag antippen zum Hinzufügen",
    net: "Net P&L",
    winRate: "Win Rate",
    profitFactor: "Profit Factor",
    expectancy: "Expectancy",
    count: "Trades",
    avgR: "Avg R",
    avgWinStreak: "Avg win streak",
    avgLossStreak: "Avg loss streak",
    ev: "EV",
    saveTrade: "Trade speichern",
    updateTrade: "Trade aktualisieren",
    deleteTrade: "Trade löschen",
    close: "Schließen",
    symbol: "Symbol",
    customSymbol: "Eigenes Symbol",
    direction: "Richtung",
    entry: "Entry",
    exit: "Exit",
    contracts: "Kontrakte",
    stopLoss: "Stop Loss",
    takeProfit: "Take Profit",
    mood: "Emotion",
    notes: "Notizen",
    pnl: "P&L",
    addPnl: "P&L oder Preise eingeben",
    deleteQuestion: "Trade löschen?",
    cannotUndo: "Nicht rückgängig.",
    liveNews: "Live News",
    autoRefresh: "Auto-refresh 60 Sek",
    refresh: "Aktualisieren",
    economicCalendar: "Wirtschaftskalender",
    calendarSub: "Events • Eastern Time",
    act: "ACT",
    fcst: "FCST",
    prev: "PREV",
    miniContracts: "E-mini / Standard",
    microContracts: "Micro Kontrakte",
    customInstrument: "Eigenes Instrument",
    ticks: "Ticks",
    resultInUsd: "Ergebnis in $",
    language: "Sprache",
    subscription: "Abo",
    premiumAccess: "YouTrader Pro",
    subscribe: "Premium • $12.99/Monat",
    restore: "Kauf wiederherstellen",
    premiumLocked: "Premium Funktion",
    premiumLockedText:
      "Schalte KI-Trade-Analyse, Mediennotizen, CSV-Import, Export, vollständige Analytics, Market-Pulse-News und den mehrtägigen Wirtschaftskalender frei.",
    plusPnl: "Profit +",
    minusPnl: "Loss −",
    photo: "Screenshot",
    takePhoto: "Foto",
    uploadPhoto: "Hochladen",
    premiumBenefit1: "KI-Trade-Analyse mit edukativem Feedback",
    premiumBenefit2: "Screenshots, Fotos und Sprachnotizen für jedes Setup",
    premiumBenefit3: "CSV-Import und langfristiger Journal-Backup-Workflow",
    premiumBenefit4: "Vollständige Analytics: Profit Factor, Expectancy, Win Rate, Drawdown und Recovery",
    premiumBenefit5: "Performance Profile, Radar und erweitertes Edge-Tracking",
    premiumBenefit6: "Tiefe Statistiken nach Symbol, Session, Tag und Setup",
    premiumBenefit7: "Market-Pulse-News in Echtzeit und Finanz-Updates",
    premiumBenefit8: "Mehrtägiger Wirtschaftskalender mit CPI, PPI, FOMC, NFP, GDP und mehr",
    percentRiskCalculator: "% Risk Calculator",
    accountBalance: "Account Balance",
    riskPercent: "Risk %",
    maxRisk: "Max SL Risk",
  },
};
function tText(lang: Lang, key: string) {
  return I18N[lang]?.[key] || I18N.en[key] || key;
}

const INSTRUMENTS: Record<
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
const MINI_INSTRUMENTS = ["ES", "NQ", "GC", "CL"];
const MICRO_INSTRUMENTS = ["MES", "MNQ", "MGC", "MCL"];
const MINI_TO_MICRO_MAP: Record<string, RiskInstrument> = {
  ES: "MES",
  NQ: "MNQ",
  GC: "MGC",
  CL: "MCL",
};
const ASSETS: Asset[] = ["ES", "NQ", "GOLD", "OIL", "BTC", "ETH"];
const COMMON_TRADE_TAGS = ["ORB", "Pullback", "Breakout", "Reversal", "Trend", "News", "Scalp", "A+ Setup"];
const MOODS = [
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

function safeDateFromISO(value?: string) {
  const raw = typeof value === "string" ? value.slice(0, 10) : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return new Date();
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m, d, 12, 0, 0));
  return Number.isFinite(dt.getTime()) ? dt : new Date();
}
function nyNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((x) => x.type === type)?.value || 0);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const hh = get("hour");
  const mm = get("minute");
  const ss = get("second");
  const dt = new Date(y, Math.max(0, m - 1), d, hh, mm, ss);
  return Number.isFinite(dt.getTime()) ? dt : new Date();
}
function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((x) => x.type === "year")?.value || "2026";
  const m = parts.find((x) => x.type === "month")?.value || "01";
  const d = parts.find((x) => x.type === "day")?.value || "01";
  return `${y}-${m}-${d}`;
}
function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
function safeText(value: string, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function normalizeTradeClock(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3]?.toUpperCase();
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return "";
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function formatClockFromDate(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function parseTagsInput(value?: string | null) {
  return [...new Set(
    String(value || "")
      .split(/[,\s]+/)
      .map((tag) => tag.replace(/^#/, "").replace(/[^a-z0-9_-]/gi, "").toUpperCase())
      .filter((tag) => tag.length >= 2)
      .slice(0, 8),
  )];
}
function tagsToInput(tags?: string[] | null) {
  return (tags || []).map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
}
function tradeTimestampFromClock(dateISO: string, clock?: string | null) {
  const safeClock = normalizeTradeClock(clock) || "12:00";
  const parsed = new Date(`${dateISO}T${safeClock}:00`);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : safeDateFromISO(dateISO).getTime();
}
function normalizeSymbolInput(value: string) {
  const symbol = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9._/-]/g, "")
    .slice(0, MAX_SYMBOL_LENGTH);
  return symbol || "MES";
}
function optionalPositiveNumber(value: string, label: string, max = MAX_PRICE) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return { value: null as number | null };
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > max) {
    return { value: null as number | null, error: `${label} is outside the safe range.` };
  }
  return { value: n };
}
function validateTradeForm(
  form: {
    symbol: string;
    direction: Direction;
    entryTime?: string;
    exitTime?: string;
    entry: string;
    exit: string;
    contracts: string;
    stopLoss: string;
    takeProfit: string;
    pnl: string;
    mood: string;
    notes: string;
    tags?: string;
    photoUri: string;
    voiceUri: string;
  },
  pnlSide: "plus" | "minus",
) {
  const symbol = normalizeSymbolInput(form.symbol);
  const entryTime = normalizeTradeClock(form.entryTime);
  const exitTime = normalizeTradeClock(form.exitTime);
  if (String(form.entryTime || "").trim() && !entryTime) {
    return { error: "Entry time must look like 09:30 or 9:30 AM." };
  }
  if (String(form.exitTime || "").trim() && !exitTime) {
    return { error: "Exit time must look like 09:45 or 9:45 AM." };
  }
  const contractsRaw = Number(String(form.contracts || "1").replace(",", "."));
  if (!Number.isFinite(contractsRaw) || contractsRaw <= 0 || contractsRaw > MAX_CONTRACTS) {
    return { error: "Contracts must be between 1 and 1000." };
  }

  const entry = optionalPositiveNumber(form.entry, "Entry price");
  if (entry.error) return { error: entry.error };
  const exit = optionalPositiveNumber(form.exit, "Exit price");
  if (exit.error) return { error: exit.error };
  const stopLoss = optionalPositiveNumber(form.stopLoss, "Stop loss");
  if (stopLoss.error) return { error: stopLoss.error };
  const takeProfit = optionalPositiveNumber(form.takeProfit, "Take profit");
  if (takeProfit.error) return { error: takeProfit.error };

  const manualPnl = String(form.pnl || "").trim();
  let pnl: number;
  if (manualPnl) {
    const amount = Math.abs(Number(manualPnl.replace(",", ".")));
    if (!Number.isFinite(amount) || amount > MAX_ABS_PNL) {
      return { error: "P&L is outside the safe range." };
    }
    pnl = Number((pnlSide === "minus" ? -amount : amount).toFixed(2));
  } else {
    if (entry.value == null || exit.value == null) {
      return { error: "Add P&L or entry/exit prices." };
    }
    const instrument = INSTRUMENTS[symbol];
    if (!instrument) {
      return { error: "Manual P&L is required for custom symbols." };
    }
    const diff =
      form.direction === "LONG"
        ? exit.value - entry.value
        : entry.value - exit.value;
    pnl = Number(((diff / instrument.tickSize) * instrument.tickValue * contractsRaw).toFixed(2));
    if (!Number.isFinite(pnl) || Math.abs(pnl) > MAX_ABS_PNL) {
      return { error: "Calculated P&L is outside the safe range." };
    }
  }

  return {
    value: {
      symbol,
      entry: entry.value,
      exit: exit.value,
      stopLoss: stopLoss.value,
      takeProfit: takeProfit.value,
      contracts: clampNumber(contractsRaw, 1, MAX_CONTRACTS),
      pnl,
      mood: safeText(form.mood, MAX_MOOD_LENGTH) || "Focused",
      notes: safeText(form.notes, MAX_NOTES_LENGTH),
      entryTime,
      exitTime,
      tags: parseTagsInput(form.tags),
      photoUri: safeText(form.photoUri, 2048),
      voiceUri: safeText(form.voiceUri, 2048),
    },
  };
}
async function fileSizeWithinLimit(uri: string, maxBytes: number) {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return false;
    const size = typeof info.size === "number" ? info.size : 0;
    return size > 0 && size <= maxBytes;
  } catch {
    return false;
  }
}
function cloudSafeAssetUrl(uri?: string | null) {
  if (!uri) return null;
  try {
    const parsed = new URL(uri);
    return parsed.protocol === "https:" ? uri : null;
  } catch {
    return null;
  }
}

async function claimRemoteIdempotency(action: string, userId: string | undefined, payload: unknown) {
  if (!supabase || !userId) return true;
  const requestHash = stableSecurityHash(JSON.stringify(payload));
  const idempotencyKey = `${action}:${requestHash}`;
  try {
    const { data, error } = await withTimeout(supabase.rpc("security_claim_idempotency_key", {
      p_idempotency_key: idempotencyKey,
      p_action: action,
      p_request_hash: requestHash,
    }));
    if (error) return true;
    const result = data as { duplicate?: boolean; hash_mismatch?: boolean } | null;
    if (result?.hash_mismatch) {
      await recordSecurityEvent("remote_idempotency_hash_mismatch", action, userId);
      return false;
    }
    return !result?.duplicate;
  } catch {
    return true;
  }
}

function addDays(date: Date, n: number) {
  const d = Number.isFinite(date?.getTime?.()) ? new Date(date) : new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function addMonths(date: Date, n: number) {
  const d = Number.isFinite(date?.getTime?.()) ? new Date(date) : new Date();
  d.setMonth(d.getMonth() + n);
  return d;
}
function isoFromDate(d: Date) {
  const safe = Number.isFinite(d?.getTime?.()) ? d : new Date();
  const y = safe.getFullYear();
  const m = String(safe.getMonth() + 1).padStart(2, "0");
  const day = String(safe.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function sameMonth(a: string, b: Date) {
  const d = safeDateFromISO(a);
  const month = Number.isFinite(b?.getTime?.()) ? b : new Date();
  return d.getUTCFullYear() === month.getFullYear() && d.getUTCMonth() === month.getMonth();
}
function monthTitle(d: Date) {
  const safe = Number.isFinite(d?.getTime?.()) ? d : new Date();
  return safe.toLocaleDateString([], { month: "long", year: "numeric" });
}
function eventDateLabel(date: string) {
  return safeDateFromISO(date).toLocaleDateString([], {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function fmtTime(ts: number) {
  const safeTs = Number.isFinite(ts) && ts > 0 ? ts : Date.now() / 1000;
  return new Date(safeTs * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function splitTimeLabel(time: string) {
  const match = String(time || "").trim().match(/^(.+?)\s*(AM|PM)$/i);
  if (!match) return { clock: time || "-", meridiem: "" };
  return { clock: match[1], meridiem: match[2].toUpperCase() };
}
function eventValueNumber(value: string | number | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text || text === "—" || text === "-") return null;
  const cleaned = text.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!cleaned) return null;
  const n = Number(cleaned[0]);
  return Number.isFinite(n) ? n : null;
}
function calendarMetricColor(event: EconEvent, kind: "actual" | "forecast" | "previous") {
  const actual = eventValueNumber(event.actual);
  const forecast = eventValueNumber(event.forecast);
  const previous = eventValueNumber(event.previous);
  if (kind === "forecast") return forecast == null ? C.sub : C.purple;
  if (kind === "actual") {
    if (actual == null || forecast == null) return C.sub;
    if (actual > forecast) return C.green;
    if (actual < forecast) return C.red;
    return C.yellow;
  }
  if (previous == null || actual == null) return C.sub;
  if (actual > previous) return C.green;
  if (actual < previous) return C.red;
  return C.yellow;
}
function calendarTimeMinutes(time: string) {
  const { clock, meridiem } = splitTimeLabel(time);
  const match = clock.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 24 * 60;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}
function money(n: number) {
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function moneyCompact(n: number) {
  const a = Math.abs(n);
  if (a >= 1000000) return `${n >= 0 ? "+" : "-"}$${(a / 1000000).toFixed(1)}M`;
  if (a >= 10000)
    return `${n >= 0 ? "+" : "-"}$${(a / 1000).toFixed(a >= 100000 ? 0 : 1)}K`;
  return money(n);
}
function dayMoney(n: number) {
  return formatCompactMoney(n);
}
function formatCompactMoney(n: number) {
  const a = Math.abs(n);
  if (!a) return "$0";
  const sign = n >= 0 ? "+" : "-";
  if (a >= 1000) {
    const value = a / 1000;
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
    return `${sign}$${formatted}K`;
  }
  return `${sign}$${Math.round(a)}`;
}
function moodLabel(key: string) {
  const m = MOODS.find((x) => x.key === key);
  return m ? `${m.emoji} ${m.key}` : key;
}

function billingDebugLog(message: string, details?: Record<string, unknown>) {
  if (!BILLING_DEBUG_LOGS) return;
  console.log(`[billing] ${message}`, details || {});
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isFutureOrMissing(dateValue?: string | null) {
  if (!dateValue) return true;
  const parsed = Date.parse(dateValue);
  return Number.isFinite(parsed) && parsed > Date.now();
}

function customerHasRevenueCatProEntitlement(customerInfo?: CustomerInfo | null) {
  const entitlement = customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID];
  if (!entitlement?.isActive) return false;
  // The shared "YouTrader Pro" entitlement can be backed by either the monthly OR the
  // yearly product. Accept any known Pro product id so yearly subscribers unlock Pro.
  return (
    !entitlement.productIdentifier ||
    YOU_TRADER_PRO_PRODUCT_IDS.includes(entitlement.productIdentifier)
  );
}

function customerHasActiveProSubscription(customerInfo?: CustomerInfo | null) {
  if (!customerInfo) return false;
  return YOU_TRADER_PRO_PRODUCT_IDS.some((productId) => {
    if (customerInfo.activeSubscriptions?.includes(productId)) return true;

    const subscription = customerInfo.subscriptionsByProductIdentifier?.[productId];
    if (subscription?.isActive && isFutureOrMissing(subscription.expiresDate)) return true;

    const expirationDate = customerInfo.allExpirationDates?.[productId];
    return !!expirationDate && isFutureOrMissing(expirationDate);
  });
}

function customerHasPro(customerInfo?: CustomerInfo | null) {
  return customerHasRevenueCatProEntitlement(customerInfo) || customerHasActiveProSubscription(customerInfo);
}

function buildProAccessState(
  customerInfo: CustomerInfo | null,
  serverEntitlementActive: boolean,
): ProAccessState {
  const revenueCatEntitlementActive = customerHasRevenueCatProEntitlement(customerInfo);
  const appleMonthlyActive = customerHasActiveProSubscription(customerInfo);
  const isPro = revenueCatEntitlementActive || appleMonthlyActive || serverEntitlementActive;
  const source: ProAccessSource = revenueCatEntitlementActive
    ? "revenuecat_entitlement"
    : appleMonthlyActive
      ? "apple_subscription"
      : serverEntitlementActive
        ? "server_entitlement"
        : "none";
  return {
    isPro,
    source,
    revenueCatEntitlementActive,
    appleMonthlyActive,
    serverEntitlementActive,
    lastUpdatedAt: Date.now(),
  };
}

function emptyProAccessState(): ProAccessState {
  return buildProAccessState(null, false);
}

function summarizeCustomerInfo(customerInfo?: CustomerInfo | null) {
  const monthlySubscription = customerInfo?.subscriptionsByProductIdentifier?.[YOU_TRADER_MONTHLY_PRODUCT_ID];
  const yearlySubscription = customerInfo?.subscriptionsByProductIdentifier?.[YOU_TRADER_YEARLY_PRODUCT_ID];
  const entitlement = customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID];
  return {
    entitlementId: REVENUECAT_ENTITLEMENT_ID,
    entitlementActive: !!entitlement?.isActive,
    entitlementProductId: entitlement?.productIdentifier,
    entitlementExpirationDate: entitlement?.expirationDate,
    proProductIds: YOU_TRADER_PRO_PRODUCT_IDS,
    activeSubscriptionDetected: customerHasActiveProSubscription(customerInfo),
    activeSubscriptions: customerInfo?.activeSubscriptions || [],
    monthlyExpirationDate:
      monthlySubscription?.expiresDate ||
      customerInfo?.allExpirationDates?.[YOU_TRADER_MONTHLY_PRODUCT_ID] ||
      null,
    yearlyExpirationDate:
      yearlySubscription?.expiresDate ||
      customerInfo?.allExpirationDates?.[YOU_TRADER_YEARLY_PRODUCT_ID] ||
      null,
    monthlyPurchaseDate:
      monthlySubscription?.purchaseDate ||
      customerInfo?.allPurchaseDates?.[YOU_TRADER_MONTHLY_PRODUCT_ID] ||
      null,
    monthlyIsSandbox: monthlySubscription?.isSandbox,
    yearlyIsSandbox: yearlySubscription?.isSandbox,
    monthlyStoreTransactionId: monthlySubscription?.storeTransactionId,
    yearlyStoreTransactionId: yearlySubscription?.storeTransactionId,
  };
}

function serverSubscriptionHasPro(row?: ServerSubscriptionRow | null) {
  if (!row) return false;
  const status = String(row.status || "").toLowerCase();
  if (!["active", "trialing", "grace_period"].includes(status)) return false;
  if (!row.expires_at) return true;
  const expiresAt = Date.parse(row.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function packagePrice(pkg?: PurchasesPackage | null) {
  return pkg?.product?.priceString || PREMIUM_PRICE;
}

function packageTitle(pkg: PurchasesPackage) {
  const id = `${pkg.identifier} ${pkg.product.identifier}`.toLowerCase();
  if (id.includes("year") || id.includes("annual") || pkg.packageType === "ANNUAL") return "YEARLY";
  if (id.includes("month") || pkg.packageType === "MONTHLY") return "MONTHLY";
  return pkg.packageType || "PRO";
}

// Finds the monthly/yearly RevenueCat package from the loaded offering packages.
function findProPackage(packages: PurchasesPackage[], productId: string) {
  return (
    packages.find((pkg) => pkg.product.identifier === productId) ||
    packages.find((pkg) =>
      productId === YOU_TRADER_YEARLY_PRODUCT_ID
        ? packageTitle(pkg) === "YEARLY"
        : packageTitle(pkg) === "MONTHLY",
    ) ||
    null
  );
}

function normalizeTrade(trade: Trade): Trade {
  const entryTime = normalizeTradeClock(trade.entryTime);
  const exitTime = normalizeTradeClock(trade.exitTime);
  const fallbackTime =
    entryTime
      ? tradeTimestampFromClock(trade.date || todayISO(), entryTime)
      : typeof (trade as any).createdAt === "number"
        ? (trade as any).createdAt
        : Date.now();
  return {
    ...trade,
    id: String(trade.id || uid()),
    date: /^\d{4}-\d{2}-\d{2}$/.test(trade.date || "") ? trade.date : todayISO(),
    symbol: normalizeSymbolInput(trade.symbol),
    entryTime: entryTime || null,
    exitTime: exitTime || null,
    contracts: clampNumber(Number(trade.contracts || 1), 1, MAX_CONTRACTS),
    entry: trade.entry == null ? null : clampNumber(Number(trade.entry), 0, MAX_PRICE),
    exit: trade.exit == null ? null : clampNumber(Number(trade.exit), 0, MAX_PRICE),
    stopLoss: trade.stopLoss == null ? null : clampNumber(Number(trade.stopLoss), 0, MAX_PRICE),
    takeProfit: trade.takeProfit == null ? null : clampNumber(Number(trade.takeProfit), 0, MAX_PRICE),
    pnl: clampNumber(Number(trade.pnl || 0), -MAX_ABS_PNL, MAX_ABS_PNL),
    mood: safeText(trade.mood || "Focused", MAX_MOOD_LENGTH),
    notes: safeText(trade.notes || "", MAX_NOTES_LENGTH),
    tags: Array.isArray(trade.tags) ? parseTagsInput(trade.tags.join(" ")) : [],
    photoUri: trade.photoUri ? safeText(trade.photoUri, 2048) : null,
    voiceUri: trade.voiceUri ? safeText(trade.voiceUri, 2048) : null,
    voiceName: trade.voiceName ? safeText(trade.voiceName, 128) : null,
    createdAt: entryTime ? tradeTimestampFromClock(trade.date || todayISO(), entryTime) : typeof trade.createdAt === "number" ? trade.createdAt : fallbackTime,
    updatedAt: typeof trade.updatedAt === "number" ? trade.updatedAt : fallbackTime,
  };
}

function sortTrades(trades: Trade[]) {
  return [...trades].sort((a, b) => {
    const dateSort = b.date.localeCompare(a.date);
    if (dateSort) return dateSort;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

function normalizeTrades(trades: Trade[]) {
  const map = new Map<string, Trade>();
  trades.slice(0, MAX_LOCAL_TRADES).forEach((trade) => {
    const next = normalizeTrade(trade);
    const current = map.get(next.id);
    if (!current || (next.updatedAt || 0) >= (current.updatedAt || 0)) {
      map.set(next.id, next);
    }
  });
  return sortTrades([...map.values()]);
}

function tradeToCloudRow(trade: Trade, userId: string): TradeJournalRow {
  const normalized = normalizeTrade(trade);
  const updatedAt = new Date(normalized.updatedAt || Date.now()).toISOString();
  const createdAt = new Date(normalized.createdAt || normalized.updatedAt || Date.now()).toISOString();
  return {
    client_id: normalized.id,
    user_id: userId,
    trade_date: normalized.date,
    symbol: normalized.symbol,
    direction: normalized.direction,
    contracts: normalized.contracts,
    entry: normalized.entry ?? null,
    exit: normalized.exit ?? null,
    stop_loss: normalized.stopLoss ?? null,
    take_profit: normalized.takeProfit ?? null,
    pnl: normalized.pnl,
    mood: normalized.mood || null,
    notes: normalized.notes || null,
    screenshot_url: cloudSafeAssetUrl(normalized.photoUri),
    voice_url: cloudSafeAssetUrl(normalized.voiceUri),
    tags: normalized.tags || [],
    created_at: createdAt,
    updated_at: updatedAt,
    deleted_at: null,
  };
}

function cloudRowToTrade(row: TradeJournalRow): Trade {
  const createdAt = row.created_at ? Date.parse(row.created_at) : Date.now();
  const updatedAt = row.updated_at ? Date.parse(row.updated_at) : createdAt;
  return normalizeTrade({
    id: String(row.client_id || row.id || uid()),
    date: row.trade_date,
    symbol: row.symbol,
    direction: row.direction,
    entryTime: row.entry_time || null,
    exitTime: row.exit_time || null,
    entry: row.entry,
    exit: row.exit,
    contracts: Number(row.contracts || 1),
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    pnl: Number(row.pnl || 0),
    mood: row.mood || "Focused",
    notes: row.notes || "",
    tags: row.tags || [],
    photoUri: row.screenshot_url || null,
    voiceUri: row.voice_url || null,
    voiceName: row.voice_url ? "Voice note" : null,
    createdAt,
    updatedAt,
  });
}

function mergeLocalAndCloudTrades(localTrades: Trade[], cloudRows: TradeJournalRow[]) {
  const merged = new Map<string, Trade>();
  normalizeTrades(localTrades).forEach((trade) => merged.set(trade.id, trade));

  cloudRows.forEach((row) => {
    const clientId = String(row.client_id || row.id || "");
    if (!clientId) return;
    const deletedAt = row.deleted_at ? Date.parse(row.deleted_at) : 0;
    if (deletedAt) {
      const local = merged.get(clientId);
      if (!local || deletedAt >= (local.updatedAt || 0)) merged.delete(clientId);
      return;
    }
    const cloudTrade = cloudRowToTrade(row);
    const local = merged.get(cloudTrade.id);
    if (!local || (cloudTrade.updatedAt || 0) > (local.updatedAt || 0)) {
      merged.set(cloudTrade.id, cloudTrade);
    }
  });

  return sortTrades([...merged.values()]);
}

function tradesSignature(trades: Trade[]) {
  return JSON.stringify(
    normalizeTrades(trades).map((trade) => ({
      id: trade.id,
      date: trade.date,
      symbol: trade.symbol,
      direction: trade.direction,
      contracts: trade.contracts,
      entry: trade.entry ?? null,
      exit: trade.exit ?? null,
      stopLoss: trade.stopLoss ?? null,
      takeProfit: trade.takeProfit ?? null,
      pnl: trade.pnl,
      mood: trade.mood,
      notes: trade.notes,
      photoUri: trade.photoUri ?? null,
      voiceUri: trade.voiceUri ?? null,
      updatedAt: trade.updatedAt || 0,
    })),
  );
}

function estimateBias(text: string): Record<Asset, Bias> {
  const lower = text.toLowerCase();
  const bull = [
    "beat",
    "rally",
    "surge",
    "dovish",
    "cut",
    "growth",
    "inflow",
    "strong",
    "higher",
    "risk-on",
    "soft inflation",
  ];
  const bear = [
    "miss",
    "drop",
    "fall",
    "hawkish",
    "hike",
    "inflation",
    "weak",
    "lower",
    "selloff",
    "recession",
    "war",
  ];
  const score =
    bull.reduce((a, w) => a + (lower.includes(w) ? 1 : 0), 0) -
    bear.reduce((a, w) => a + (lower.includes(w) ? 1 : 0), 0);
  const base: Bias = score > 0 ? "LONG" : score < 0 ? "SHORT" : "NEUTRAL";
  const safe: Bias = score < 0 ? "LONG" : score > 0 ? "SHORT" : "NEUTRAL";
  return {
    ES: base,
    NQ: base,
    GOLD: lower.includes("gold") ? base : safe,
    OIL: lower.includes("oil") || lower.includes("crude") ? base : "NEUTRAL",
    BTC: base,
    ETH: base,
  };
}

function numericSurprise(value?: string | null) {
  if (!value || value === "—") return null;
  const cleaned = String(value).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!cleaned) return null;
  return Number(cleaned[0]);
}

function biasSet(es: Bias, nq: Bias, gold: Bias, oil: Bias, btc: Bias = es, eth: Bias = btc): Record<Asset, Bias> {
  return { ES: es, NQ: nq, GOLD: gold, OIL: oil, BTC: btc, ETH: eth };
}

function compareEventNumbers(actual: string, forecast: string, previous: string) {
  const actualNumber = numericSurprise(actual);
  const forecastNumber = numericSurprise(forecast);
  const previousNumber = numericSurprise(previous);
  if (actualNumber !== null && forecastNumber !== null) return actualNumber - forecastNumber;
  if (forecastNumber !== null && previousNumber !== null) return forecastNumber - previousNumber;
  if (actualNumber !== null && previousNumber !== null) return actualNumber - previousNumber;
  return null;
}

function estimateCalendarBias(event: Pick<EconEvent, "name" | "actual" | "forecast" | "previous" | "impact">): Record<Asset, Bias> {
  const name = event.name.toLowerCase();
  const delta = compareEventNumbers(event.actual, event.forecast, event.previous);
  const stronger = delta === null ? null : delta > 0;
  const weaker = delta === null ? null : delta < 0;

  const isInflation =
    /cpi|ppi|pce|inflation|prices|price index|deflator/.test(name);
  const isRates =
    /fomc|fed|powell|rate decision|cash rate|interest rate|rate statement|central bank/.test(name);
  const isJobs =
    /payroll|nfp|employment|unemployment|jobless|claims|wage|earnings/.test(name);
  const isGrowth =
    /gdp|pmi|ism|retail sales|industrial production|consumer sentiment|confidence|durable/.test(name);
  const isOil =
    /crude|oil|eia|api|inventory|inventories|rig count/.test(name);
  const isHousing =
    /housing|home sales|building permits|construction/.test(name);

  if (isOil) {
    if (stronger) return biasSet("NEUTRAL", "NEUTRAL", "NEUTRAL", "SHORT", "NEUTRAL", "NEUTRAL");
    if (weaker) return biasSet("NEUTRAL", "NEUTRAL", "NEUTRAL", "LONG", "NEUTRAL", "NEUTRAL");
    return biasSet("NEUTRAL", "NEUTRAL", "NEUTRAL", "LONG", "NEUTRAL", "NEUTRAL");
  }

  if (isInflation || isRates) {
    if (weaker || name.includes("cut")) return biasSet("LONG", "LONG", "SHORT", "NEUTRAL", "LONG", "LONG");
    return biasSet("SHORT", "SHORT", "LONG", "NEUTRAL", "SHORT", "SHORT");
  }

  if (isJobs) {
    if (name.includes("claims") || name.includes("unemployment")) {
      if (stronger) return biasSet("SHORT", "SHORT", "LONG", "NEUTRAL", "SHORT", "SHORT");
      if (weaker) return biasSet("LONG", "LONG", "SHORT", "NEUTRAL", "LONG", "LONG");
    }
    if (stronger) return biasSet("LONG", "LONG", "SHORT", "LONG", "LONG", "LONG");
    if (weaker) return biasSet("SHORT", "SHORT", "LONG", "NEUTRAL", "SHORT", "SHORT");
    return biasSet("LONG", "LONG", "SHORT", "NEUTRAL", "LONG", "LONG");
  }

  if (isGrowth || isHousing) {
    if (stronger) return biasSet("LONG", "LONG", "SHORT", "LONG", "LONG", "LONG");
    if (weaker) return biasSet("SHORT", "SHORT", "LONG", "SHORT", "SHORT", "SHORT");
    return event.impact === "HIGH"
      ? biasSet("LONG", "LONG", "SHORT", "NEUTRAL", "LONG", "LONG")
      : biasSet("NEUTRAL", "NEUTRAL", "NEUTRAL", "NEUTRAL", "NEUTRAL", "NEUTRAL");
  }

  return estimateBias(event.name);
}

function applyCalendarBias(event: EconEvent): EconEvent {
  return { ...event, bias: estimateCalendarBias(event) };
}
function impactFromText(text: string): Impact {
  const s = text.toLowerCase();
  if (
    [
      "fed",
      "fomc",
      "cpi",
      "pce",
      "payroll",
      "nfp",
      "jobs",
      "inflation",
      "rates",
      "powell",
      "war",
    ].some((w) => s.includes(w))
  )
    return "HIGH";
  if (
    [
      "oil",
      "earnings",
      "treasury",
      "yields",
      "dollar",
      "crypto",
      "gdp",
      "pmi",
    ].some((w) => s.includes(w))
  )
    return "MED";
  return "LOW";
}
function cardTint(impact: Impact) {
  if (impact === "HIGH")
    return { backgroundColor: C.redSoft, borderColor: "rgba(255,59,95,0.32)" };
  if (impact === "MED")
    return {
      backgroundColor: C.yellowSoft,
      borderColor: "rgba(255,210,63,0.28)",
    };
  return { backgroundColor: C.greenSoft, borderColor: "rgba(163,255,18,0.20)" };
}

const demoNews: MarketNews[] = [
  {
    id: "1",
    title: "Fed rate expectations move markets as traders reprice risk",
    summary:
      "Index futures react to rate-cut expectations and bond yield movement.",
    source: "Market desk",
    time: "Offline",
    impact: "HIGH",
    bias: {
      ES: "LONG",
      NQ: "LONG",
      GOLD: "SHORT",
      OIL: "NEUTRAL",
      BTC: "LONG",
      ETH: "LONG",
    },
  },
  {
    id: "2",
    title: "Oil inventory data creates volatility in energy markets",
    summary: "Crude reacts to supply/demand expectations.",
    source: "Market desk",
    time: "Offline",
    impact: "MED",
    bias: {
      ES: "NEUTRAL",
      NQ: "NEUTRAL",
      GOLD: "NEUTRAL",
      OIL: "SHORT",
      BTC: "NEUTRAL",
      ETH: "NEUTRAL",
    },
  },
];

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function rssTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

async function fetchYahooFinanceNews(): Promise<MarketNews[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(
      "https://feeds.finance.yahoo.com/rss/2.0/headline?s=ES=F,NQ=F,GC=F,CL=F,BTC-USD,ETH-USD&region=US&lang=en-US",
      { signal: controller.signal },
    );
    if (!res.ok) throw new Error(`Yahoo Finance RSS HTTP ${res.status}`);
    const xml = await res.text();
    const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    return blocks.slice(0, 40).map((block, index) => {
      const title = stripHtml(rssTag(block, "title") || "Market update");
      const summary = stripHtml(rssTag(block, "description"));
      const link = stripHtml(rssTag(block, "link"));
      const pubDate = rssTag(block, "pubDate");
      const timestamp = pubDate ? Date.parse(pubDate) / 1000 : Date.now() / 1000;
      const text = `${title} ${summary}`;
      return {
        id: `yahoo-${timestamp}-${index}`,
        title,
        summary,
        source: "Yahoo Finance",
        time: fmtTime(timestamp),
        url: link,
        bias: estimateBias(text),
        impact: impactFromText(text),
      };
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeMarketBias(value: unknown, fallbackText: string): Record<Asset, Bias> {
  const fallback = estimateBias(fallbackText);
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Record<string, unknown>;
  return ASSETS.reduce((acc, asset) => {
    const next = String(raw[asset] || fallback[asset] || "NEUTRAL").toUpperCase();
    acc[asset] = next === "LONG" || next === "SHORT" ? (next as Bias) : "NEUTRAL";
    return acc;
  }, {} as Record<Asset, Bias>);
}

async function loadCachedMarketNews(): Promise<MarketNews[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("market_news_items")
        .select("id,source,url,title,summary,impact,bias,published_at,fetched_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(80),
      SECURITY_LIMITS.requestTimeoutMs,
    );
    if (error || !Array.isArray(data)) return [];
    return data.map((row: any) => {
      const text = `${row.title || ""} ${row.summary || ""}`;
      const publishedAt = row.published_at || row.fetched_at;
      const parsed = publishedAt ? Date.parse(publishedAt) / 1000 : Date.now() / 1000;
      return {
        id: String(row.id || uid()),
        title: String(row.title || "Market update"),
        summary: String(row.summary || ""),
        source: String(row.source || "Market Intel"),
        time: fmtTime(Number.isFinite(parsed) ? parsed : Date.now() / 1000),
        url: String(row.url || ""),
        bias: normalizeMarketBias(row.bias, text),
        impact: ["HIGH", "MED", "LOW"].includes(String(row.impact || "").toUpperCase())
          ? (String(row.impact).toUpperCase() as Impact)
          : impactFromText(text),
      };
    });
  } catch {
    return [];
  }
}

function makeOfflineCalendarEvents(): EconEvent[] {
  const base = new Date();
  return [
    {
      id: "cpi",
      date: todayISO(),
      time: "08:30 AM",
      name: "CPI / Inflation Data",
      impact: "HIGH",
      actual: "—",
      forecast: "0.3%",
      previous: "0.2%",
      bias: {
        ES: "SHORT",
        NQ: "SHORT",
        GOLD: "LONG",
        OIL: "NEUTRAL",
        BTC: "SHORT",
        ETH: "SHORT",
      },
    },
    {
      id: "oil",
      date: todayISO(),
      time: "10:30 AM",
      name: "Crude Oil Inventories",
      impact: "MED",
      actual: "—",
      forecast: "-1.2M",
      previous: "+0.8M",
      bias: {
        ES: "NEUTRAL",
        NQ: "NEUTRAL",
        GOLD: "NEUTRAL",
        OIL: "LONG",
        BTC: "NEUTRAL",
        ETH: "NEUTRAL",
      },
    },
    {
      id: "fomc",
      date: isoFromDate(addDays(base, 1)),
      time: "02:00 PM",
      name: "FOMC Minutes",
      impact: "HIGH",
      actual: "—",
      forecast: "—",
      previous: "—",
      bias: {
        ES: "LONG",
        NQ: "LONG",
        GOLD: "SHORT",
        OIL: "NEUTRAL",
        BTC: "LONG",
        ETH: "LONG",
      },
    },
    {
      id: "claims",
      date: isoFromDate(addDays(base, 2)),
      time: "08:30 AM",
      name: "Initial Jobless Claims",
      impact: "MED",
      actual: "—",
      forecast: "225K",
      previous: "229K",
      bias: {
        ES: "NEUTRAL",
        NQ: "NEUTRAL",
        GOLD: "NEUTRAL",
        OIL: "NEUTRAL",
        BTC: "NEUTRAL",
        ETH: "NEUTRAL",
      },
    },
    {
      id: "pmi",
      date: isoFromDate(addDays(base, 3)),
      time: "09:45 AM",
      name: "Flash PMI Composite",
      impact: "MED",
      actual: "—",
      forecast: "51.2",
      previous: "50.8",
      bias: {
        ES: "LONG",
        NQ: "LONG",
        GOLD: "SHORT",
        OIL: "LONG",
        BTC: "LONG",
        ETH: "LONG",
      },
    },
    {
      id: "nfp",
      date: isoFromDate(addDays(base, 4)),
      time: "08:30 AM",
      name: "Nonfarm Payrolls",
      impact: "HIGH",
      actual: "—",
      forecast: "175K",
      previous: "165K",
      bias: {
        ES: "SHORT",
        NQ: "SHORT",
        GOLD: "LONG",
        OIL: "NEUTRAL",
        BTC: "SHORT",
        ETH: "SHORT",
      },
    },
  ];
}
async function loadNews(): Promise<MarketNews[]> {
  const cacheRaw = await AsyncStorage.getItem("news-cache-v6");
  const cached = cacheRaw ? JSON.parse(cacheRaw) : null;
  const persist = async (items: MarketNews[]) => {
    if (items.length) {
      await AsyncStorage.setItem(
        "news-cache-v6",
        JSON.stringify({ at: Date.now(), items }),
      );
    }
    return items;
  };

  const marketIntelItems = await loadCachedMarketNews();
  if (marketIntelItems.length) return persist(marketIntelItems);

  if (FINNHUB) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB}`,
        { signal: controller.signal },
      );
      clearTimeout(timer);
      const data = await res.json();
      const items: MarketNews[] = (
        Array.isArray(data) ? data.slice(0, 80) : []
      ).map((n: any) => {
        const text = `${n.headline || ""} ${n.summary || ""}`;
        return {
          id: String(n.id || uid()),
          title: n.headline || "Market update",
          summary: n.summary || "",
          source: n.source || "Finnhub",
          time: fmtTime(n.datetime || Date.now() / 1000),
          url: n.url || "",
          bias: estimateBias(text),
          impact: impactFromText(text),
        };
      });
      if (items.length) return persist(items);
    } catch {
      clearTimeout(timer);
    }
  }

  try {
    const items = await fetchYahooFinanceNews();
    if (items.length) return persist(items);
  } catch {
    // Fall back to the latest cached feed before showing offline placeholders.
  }

  return cached?.items || demoNews;
}
function normalizeEvent(e: any, index: number): EconEvent {
  const text = `${e.name || e.event || e.title || ""} ${e.currency || e.country || ""}`;
  return applyCalendarBias({
    id: String(e.id || `${e.date || todayISO()}-${index}`),
    date: String(e.date || todayISO()).slice(0, 10),
    time: String(e.time || "08:30 AM"),
    name: String(e.name || e.event || e.title || "Economic event"),
    impact: (String(e.impact || "LOW")
      .toUpperCase()
      .startsWith("H")
      ? "HIGH"
      : String(e.impact || "LOW")
            .toUpperCase()
            .startsWith("M")
        ? "MED"
        : "LOW") as Impact,
    actual: String(e.actual || "—"),
    forecast: String(e.forecast || e.consensus || "—"),
    previous: String(e.previous || e.prev || "—"),
    bias: e.bias || estimateBias(text),
  });
}

async function loadCachedEconomicEvents(start: string, end: string): Promise<EconEvent[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("economic_events")
        .select("id,event_name,event_date,event_time,importance,affected_assets,previous,forecast,actual,source")
        .eq("status", "published")
        .gte("event_date", start)
        .lte("event_date", end)
        .order("event_date", { ascending: true })
        .limit(200),
      SECURITY_LIMITS.requestTimeoutMs,
    );
    if (error || !Array.isArray(data)) return [];
    return data.map((row: any, index: number) => {
      const text = `${row.event_name || ""} ${(row.affected_assets || []).join(" ")}`;
      return applyCalendarBias({
        id: String(row.id || `${row.event_date}-${index}`),
        date: String(row.event_date || todayISO()).slice(0, 10),
        time: String(row.event_time || "TBD"),
        name: String(row.event_name || "Economic event"),
        impact: ["HIGH", "MED", "LOW"].includes(String(row.importance || "").toUpperCase())
          ? (String(row.importance).toUpperCase() as Impact)
          : impactFromText(text),
        actual: String(row.actual || "—"),
        forecast: String(row.forecast || "—"),
        previous: String(row.previous || "—"),
        bias: estimateBias(text),
      } as EconEvent);
    });
  } catch {
    return [];
  }
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function normalizeImpact(value: unknown, fallbackText = ""): Impact {
  const next = String(value || "").toUpperCase();
  return next === "HIGH" || next === "MED" || next === "LOW" ? (next as Impact) : impactFromText(fallbackText);
}

async function loadMarketIntelligence(): Promise<MarketIntelData> {
  const empty: MarketIntelData = { brief: null, watchlist: [], summary: null, events: [], propUpdates: [], headlines: [] };
  if (!supabase) return { ...empty, headlines: await loadNews(), events: await loadCalendarEvents() };
  try {
    const today = todayISO();
    const [briefRes, watchlistRes, summaryRes, eventRes, propRes, newsRes] = await Promise.all([
      withTimeout(supabase.from("market_daily_briefs").select("*").eq("status", "published").order("brief_date", { ascending: false }).limit(1)),
      withTimeout(supabase.from("market_watchlists").select("*").eq("status", "published").order("watchlist_date", { ascending: false }).limit(1)),
      withTimeout(supabase.from("market_summaries").select("*").eq("status", "published").eq("summary_key", "global").limit(1)),
      withTimeout(supabase.from("economic_events").select("*").eq("status", "published").gte("event_date", today).order("event_date", { ascending: true }).limit(12)),
      withTimeout(supabase.from("prop_firm_updates").select("id,firm,category,url,key_text,detected_change_summary,changed_at").eq("status", "published").order("changed_at", { ascending: false }).limit(8)),
      withTimeout(supabase.from("market_news_items").select("id,source,url,title,summary,impact,bias,published_at,fetched_at").eq("status", "published").order("published_at", { ascending: false }).limit(30)),
    ]);

    const briefRow = Array.isArray(briefRes.data) ? briefRes.data[0] : null;
    const watchRow = Array.isArray(watchlistRes.data) ? watchlistRes.data[0] : null;
    const summaryRow = Array.isArray(summaryRes.data) ? summaryRes.data[0] : null;
    const headlines = Array.isArray(newsRes.data)
      ? newsRes.data.map((row: any) => {
          const text = `${row.title || ""} ${row.summary || ""}`;
          const parsed = row.published_at ? Date.parse(row.published_at) / 1000 : Date.now() / 1000;
          return {
            id: String(row.id || uid()),
            title: String(row.title || "Market update"),
            summary: String(row.summary || ""),
            source: String(row.source || "Market Intel"),
            time: fmtTime(Number.isFinite(parsed) ? parsed : Date.now() / 1000),
            url: String(row.url || ""),
            bias: normalizeMarketBias(row.bias, text),
            impact: normalizeImpact(row.impact, text),
          } as MarketNews;
        })
      : [];
    const events = Array.isArray(eventRes.data)
      ? eventRes.data.map((row: any, index: number) => {
          const text = `${row.event_name || ""} ${(row.affected_assets || []).join(" ")}`;
          return applyCalendarBias({
            id: String(row.id || `${row.event_date}-${index}`),
            date: String(row.event_date || today).slice(0, 10),
            time: String(row.event_time || "TBD"),
            name: String(row.event_name || "Economic event"),
            impact: normalizeImpact(row.importance, text),
            actual: String(row.actual || "—"),
            forecast: String(row.forecast || "—"),
            previous: String(row.previous || "—"),
            bias: estimateBias(text),
          } as EconEvent);
        })
      : [];
    return {
      brief: briefRow ? {
        title: String(briefRow.title || "Daily Brief"),
        summary: String(briefRow.summary || ""),
        marketRegime: String(briefRow.market_regime || "Balanced"),
        keyMacroEvents: parseStringArray(briefRow.key_macro_events),
        topRisks: parseStringArray(briefRow.top_risks),
        assetsToWatch: parseStringArray(briefRow.assets_to_watch),
        volatilityWarning: String(briefRow.volatility_warning || ""),
        propFirmCaution: String(briefRow.prop_firm_caution || ""),
        whatNotToDo: String(briefRow.what_not_to_do || ""),
        generatedAt: String(briefRow.generated_at || ""),
      } : null,
      watchlist: Array.isArray(watchRow?.items) ? watchRow.items.slice(0, 8).map((item: any) => ({
        asset: String(item.asset || ""),
        bias: normalizeMarketBias({ [String(item.asset || "ES")]: item.bias }, String(item.reason || ""))[String(item.asset || "ES") as Asset] || "NEUTRAL",
        confidence: String(item.confidence || "LOW"),
        reason: String(item.reason || "No cached reason yet."),
        caution: String(item.caution || "Educational market context only. Not financial advice."),
      })) : [],
      summary: summaryRow ? {
        macroTone: String(summaryRow.macro_tone || "Mixed"),
        riskMode: String(summaryRow.risk_mode || "Balanced"),
        strongestHeadlines: parseStringArray(summaryRow.strongest_headlines),
        importantCalendarEvents: parseStringArray(summaryRow.important_calendar_events),
        propFirmRiskWarnings: parseStringArray(summaryRow.prop_firm_risk_warnings),
        updatedAt: String(summaryRow.updated_at || ""),
      } : null,
      events,
      propUpdates: Array.isArray(propRes.data) ? propRes.data.map((row: any) => ({
        id: String(row.id || uid()),
        firm: String(row.firm || "Prop firm"),
        category: String(row.category || "rules"),
        keyText: String(row.key_text || ""),
        detectedChangeSummary: String(row.detected_change_summary || "No change summary."),
        changedAt: String(row.changed_at || ""),
        url: String(row.url || ""),
      })) : [],
      headlines,
    };
  } catch {
    return { ...empty, headlines: await loadNews(), events: await loadCalendarEvents() };
  }
}

function formatEventTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function mapForexFactoryImpact(raw: unknown): Impact {
  const value = String(raw || "").toLowerCase();
  if (value.includes("high") || value.includes("red")) return "HIGH";
  if (value.includes("medium") || value.includes("med") || value.includes("orange")) return "MED";
  return "LOW";
}

async function fetchForexFactoryCalendar(): Promise<EconEvent[]> {
  const endpoints = [
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
  ];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const responses = await Promise.allSettled(
      endpoints.map((url) => fetch(url, { signal: controller.signal }).then((res) => {
        if (!res.ok) throw new Error(`Economic calendar HTTP ${res.status}`);
        return res.json();
      })),
    );
    const rows = responses.flatMap((result) => {
      if (result.status !== "fulfilled") return [];
      return Array.isArray(result.value) ? result.value : [];
    });
    const priorityCurrencies = new Set(["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CNY"]);
    return rows
      .filter((row: any) => {
        const currency = String(row.currency || row.country || "").toUpperCase();
        return !currency || priorityCurrencies.has(currency);
      })
      .map((row: any, index: number) => {
        const parsedDate = row.date ? new Date(row.date) : new Date();
        const date = Number.isNaN(parsedDate.getTime()) ? todayISO() : isoFromDate(parsedDate);
        const time = Number.isNaN(parsedDate.getTime()) ? String(row.time || "08:30 AM") : formatEventTime(parsedDate);
        const name = String(row.title || row.event || row.name || "Economic event");
        const currency = String(row.currency || row.country || "").toUpperCase();
        const text = `${name} ${currency}`;
        return applyCalendarBias({
          id: `ff-${date}-${index}-${name.slice(0, 20)}`,
          date,
          time,
          name: currency ? `${name} (${currency})` : name,
          impact: mapForexFactoryImpact(row.impact),
          actual: String(row.actual || "—"),
          forecast: String(row.forecast || row.consensus || "—"),
          previous: String(row.previous || row.prev || "—"),
          bias: estimateBias(text),
        } as EconEvent);
      })
      .filter((event) => event.date >= todayISO())
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .slice(0, 200);
  } finally {
    clearTimeout(timer);
  }
}

async function loadCalendarEvents(): Promise<EconEvent[]> {
  const cacheRaw = await AsyncStorage.getItem("calendar-cache-v6");
  let cached: { items?: EconEvent[] } | null = null;
  try {
    cached = cacheRaw ? JSON.parse(cacheRaw) : null;
  } catch {
    cached = null;
  }
  const start = todayISO();
  const end = isoFromDate(addDays(new Date(), 30));

  const persist = async (items: EconEvent[]) => {
    if (items.length) {
      await AsyncStorage.setItem(
        "calendar-cache-v6",
        JSON.stringify({ at: Date.now(), items }),
      );
    }
    return items;
  };

  const cachedIntelEvents = await loadCachedEconomicEvents(start, end);
  if (cachedIntelEvents.length) return persist(cachedIntelEvents);

  if (CALENDAR_API_URL) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const sep = CALENDAR_API_URL.includes("?") ? "&" : "?";
      const res = await fetch(
        `${CALENDAR_API_URL}${sep}start=${start}&end=${end}`,
        { signal: controller.signal },
      );
      clearTimeout(timer);
      const data = await res.json();
      const raw = Array.isArray(data)
        ? data
        : Array.isArray(data.events)
          ? data.events
          : [];
      const items = raw.map(normalizeEvent).map(applyCalendarBias).slice(0, 200) as EconEvent[];
      if (items.length) return persist(items);
    } catch {
      clearTimeout(timer);
    }
  }

  if (FINNHUB) {
    try {
      const rows = await fetchFinnhubEconomicCalendar(FINNHUB, start, end);
      const items = (mapFinnhubEconomicRows(rows, estimateBias) as EconEvent[]).map(applyCalendarBias);
      if (items.length) return persist(items);
    } catch {
      // fall through to cache/demo
    }
  }

  try {
    const items = (await fetchForexFactoryCalendar()).map(applyCalendarBias);
    if (items.length) return persist(items);
  } catch {
    // Fall through to cached data if the public calendar feed is unavailable.
  }

  return (cached?.items || makeOfflineCalendarEvents()).map(applyCalendarBias);
}

function paramsFromUrl(url: string) {
  const params = new URLSearchParams();
  try {
    const parsed = new URL(url);
    parsed.searchParams.forEach((value, key) => params.set(key, value));
    if (parsed.hash) {
      new URLSearchParams(parsed.hash.replace(/^#/, "")).forEach((value, key) =>
        params.set(key, value),
      );
    }
  } catch {
    const raw = url.split("?")[1] || url.split("#")[1] || "";
    new URLSearchParams(raw).forEach((value, key) => params.set(key, value));
  }
  return params;
}

async function createSessionFromAuthUrl(url: string) {
  if (!supabase) throw new Error("Account sign-in is not configured in this build.");
  const params = paramsFromUrl(url);
  const errorCode = params.get("error_code") || params.get("error");
  if (errorCode) throw new Error(errorCode);

  const code = params.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
}

function Card({ children, style }: any) {
  return <View style={[styles.card, styles.safeCard, style]}>{children}</View>;
}
function SafeText({
  children,
  style,
  lines = 1,
  minScale = 0.75,
  ...props
}: any) {
  return (
    <Text
      {...props}
      style={[styles.safeText, style]}
      numberOfLines={lines}
      adjustsFontSizeToFit
      minimumFontScale={minScale}
      ellipsizeMode="tail"
    >
      {children}
    </Text>
  );
}
function SafeMetricLabel({ children, style }: any) {
  return <SafeText style={[styles.safeMetricLabel, style]}>{children}</SafeText>;
}
function Label({ children }: any) {
  return <Text style={styles.label}>{children}</Text>;
}
function Value({ children, color = C.text }: any) {
  return (
    <Text
      style={[styles.value, { color }]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {children}
    </Text>
  );
}
function Pill({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "long" | "short" | "neutral" | "high" | "med" | "low";
}) {
  const color =
    tone === "long" || tone === "low"
      ? C.green
      : tone === "short" || tone === "high"
        ? C.red
        : tone === "med"
          ? C.yellow
          : C.sub;
  return (
    <View
      style={[
        styles.pill,
        { borderColor: color, backgroundColor: color + "18" },
      ]}
    >
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}
function Input(props: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={C.muted}
        style={[
          styles.input,
          props.multiline && { height: 96, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}

function getTradeTime(t: Trade) {
  if (t.entryTime) return new Date(tradeTimestampFromClock(t.date, t.entryTime));
  const raw = (t as any).createdAt || t.id?.split("-")[0];
  const n = Number(raw);
  return Number.isFinite(n) && n > 1000000000 ? new Date(n) : safeDateFromISO(t.date);
}
function rrForTrade(t: Trade) {
  const sl = Number(t.stopLoss ?? 0);
  const tp = Number(t.takeProfit ?? 0);
  const entry = t.entry == null ? null : Number(t.entry);

  if (entry != null && Number.isFinite(entry) && sl && tp) {
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    if (risk > 0 && Number.isFinite(reward)) return reward / risk;
  }

  // Fallback for users who enter Stop Loss / Take Profit as dollar or point values.
  // This keeps Avg R:R working even when entry/exit prices are left empty.
  if (sl > 0 && tp > 0 && Number.isFinite(sl) && Number.isFinite(tp)) {
    return tp / sl;
  }

  return null;
}
function maxDrawdownFromTrades(trades: Trade[]) {
  const ordered = [...trades].sort((a, b) => getTradeTime(a).getTime() - getTradeTime(b).getTime());
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  const curve: number[] = [];
  ordered.forEach((t) => {
    equity += t.pnl;
    curve.push(equity);
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
  });
  return { maxDd, curve };
}

function fullWeekdayName(label: string) {
  const map: Record<string, string> = {
    Sun: "Sunday",
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sunday: "Sunday",
    Monday: "Monday",
    Tuesday: "Tuesday",
    Wednesday: "Wednesday",
    Thursday: "Thursday",
    Friday: "Friday",
    Saturday: "Saturday",
  };
  return map[label] || label;
}

type PerformanceGroup = {
  label: string;
  pnl: number;
  count: number;
  wins: number;
  wr: number;
};

type RiskTemplate = {
  key: string;
  label: string;
  firm: string;
  accountName: string;
  accountSize: number;
  evaluationTarget: number;
  dailyLossLimit: number;
  maxLossLimit: number;
  evaluationContracts: number;
  liveContracts: number;
  evaluationRiskPct: number;
  liveRiskPct: number;
  trailingDrawdown: boolean;
  sourceUrl?: string;
  lastUpdated?: string;
};

const PROP_RISK_TEMPLATES: RiskTemplate[] = [
  {
    key: "eval25k",
    label: "Eval 25K",
    firm: "Topstep/Apex/Lucid/Take Profit (baseline)",
    accountName: "25K Evaluation",
    accountSize: 25000,
    evaluationTarget: 1500,
    dailyLossLimit: 550,
    maxLossLimit: 1500,
    evaluationContracts: 3,
    liveContracts: 2,
    evaluationRiskPct: 0.12,
    liveRiskPct: 0.08,
    trailingDrawdown: true,
    sourceUrl: "https://www.topstep.com",
    lastUpdated: "2026-05-29",
  },
  {
    key: "eval50k",
    label: "Eval 50K",
    firm: "Topstep/Apex/Lucid/Take Profit (baseline)",
    accountName: "50K Evaluation",
    accountSize: 50000,
    evaluationTarget: 3000,
    dailyLossLimit: 1200,
    maxLossLimit: 2500,
    evaluationContracts: 6,
    liveContracts: 4,
    evaluationRiskPct: 0.12,
    liveRiskPct: 0.08,
    trailingDrawdown: true,
    sourceUrl: "https://apextraderfunding.com",
    lastUpdated: "2026-05-29",
  },
  {
    key: "eval100k",
    label: "Eval 100K",
    firm: "Topstep/Apex/Lucid/Take Profit (baseline)",
    accountName: "100K Evaluation",
    accountSize: 100000,
    evaluationTarget: 6000,
    dailyLossLimit: 2000,
    maxLossLimit: 3500,
    evaluationContracts: 8,
    liveContracts: 6,
    evaluationRiskPct: 0.1,
    liveRiskPct: 0.075,
    trailingDrawdown: true,
    sourceUrl: "https://lucidtrading.com",
    lastUpdated: "2026-05-29",
  },
  {
    key: "eval150k",
    label: "Eval 150K",
    firm: "Topstep/Apex/Lucid/Take Profit (baseline)",
    accountName: "150K Evaluation",
    accountSize: 150000,
    evaluationTarget: 9000,
    dailyLossLimit: 2500,
    maxLossLimit: 4500,
    evaluationContracts: 10,
    liveContracts: 7,
    evaluationRiskPct: 0.095,
    liveRiskPct: 0.08,
    trailingDrawdown: true,
    sourceUrl: "https://takeprofittrader.com",
    lastUpdated: "2026-05-29",
  },
];

const FALLBACK_PROP_RULES = PROP_RISK_TEMPLATES;

function normalizeRemoteTemplate(row: any): RiskTemplate | null {
  if (!row) return null;
  const key = String(row.slug || row.key || "").trim();
  if (!key) return null;
  const accountSize = Number(row.account_size ?? row.accountSize);
  const dailyLossLimit = Number(row.daily_loss_limit ?? row.dailyLossLimit);
  const maxLossLimit = Number(row.max_loss_limit ?? row.maxLossLimit);
  const evaluationContracts = Number(row.evaluation_contracts ?? row.evaluationContracts);
  const liveContracts = Number(row.live_contracts ?? row.liveContracts);
  const evaluationTargetRaw = row.evaluation_target ?? row.evaluationTarget;
  const evaluationTarget = Number(
    evaluationTargetRaw != null ? evaluationTargetRaw : Math.round(accountSize * 0.06),
  );
  if (
    !Number.isFinite(accountSize) ||
    !Number.isFinite(dailyLossLimit) ||
    !Number.isFinite(maxLossLimit) ||
    !Number.isFinite(evaluationContracts) ||
    !Number.isFinite(liveContracts)
  ) {
    return null;
  }
  const rules = typeof row.rules === "object" && row.rules ? row.rules : {};
  const evaluationRiskPct = Number(rules.evaluationRiskPct ?? rules.evaluation_risk_pct ?? 0.1);
  const liveRiskPct = Number(rules.liveRiskPct ?? rules.live_risk_pct ?? 0.08);
  return {
    key,
    label: String(row.label || `${Math.round(accountSize / 1000)}K`),
    firm: String(row.name || row.firm || "Unknown"),
    accountName: String(row.account_name || row.accountName || "Evaluation"),
    accountSize,
    evaluationTarget,
    dailyLossLimit,
    maxLossLimit,
    evaluationContracts,
    liveContracts,
    evaluationRiskPct: Number.isFinite(evaluationRiskPct) ? evaluationRiskPct : 0.1,
    liveRiskPct: Number.isFinite(liveRiskPct) ? liveRiskPct : 0.08,
    trailingDrawdown: Boolean(
      row.trailing_drawdown ?? row.trailingDrawdown ?? rules.trailingDrawdown ?? false,
    ),
    sourceUrl: typeof rules.sourceUrl === "string" ? rules.sourceUrl : undefined,
    lastUpdated:
      typeof row.updated_at === "string"
        ? row.updated_at.slice(0, 10)
        : typeof row.created_at === "string"
          ? row.created_at.slice(0, 10)
          : undefined,
  };
}

function groupPerformance(trades: Trade[], keyFn: (t: Trade) => string) {
  const map: Record<string, { pnl: number; count: number; wins: number }> = {};
  trades.forEach((t) => {
    const k = keyFn(t);
    if (!map[k]) map[k] = { pnl: 0, count: 0, wins: 0 };
    map[k].pnl += t.pnl;
    map[k].count += 1;
    if (t.pnl > 0) map[k].wins += 1;
  });
  return Object.entries(map)
    .map(([label, v]) => ({ label, ...v, wr: v.count ? (v.wins / v.count) * 100 : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
}
function calcStats(trades: Trade[]) {
  const unified = buildUnifiedTradeAnalytics(trades);
  const official = unified.metrics;
  const pnl = official.netPnl;
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const wr = official.winRate || 0;
  const exp = official.expectancy || 0;
  const pf = infinitySafeMetric(official.profitFactor);
  const avgWin = official.averageWin;
  const avgLoss = official.averageLoss;
  const avgWinLoss = infinitySafeMetric(official.averageWinLossRatio);
  const rrs = trades.map(rrForTrade).filter((x): x is number => x != null && Number.isFinite(x));
  const avgRR = rrs.length ? rrs.reduce((a, x) => a + x, 0) / rrs.length : 0;
  const ordered = [...trades].sort((a, b) => getTradeTime(a).getTime() - getTradeTime(b).getTime());
  const winStreaks: number[] = [];
  const lossStreaks: number[] = [];
  let current: "win" | "loss" | null = null;
  let len = 0;
  const flush = () => {
    if (!current || len === 0) return;
    if (current === "win") winStreaks.push(len);
    if (current === "loss") lossStreaks.push(len);
  };
  ordered.forEach((t) => {
    const kind = t.pnl > 0 ? "win" : t.pnl < 0 ? "loss" : null;
    if (!kind) { flush(); current = null; len = 0; return; }
    if (kind === current) len += 1;
    else { flush(); current = kind; len = 1; }
  });
  flush();
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, x) => a + x, 0) / arr.length : 0;
  const daily = buildDailySeries(trades);
  const dayStreaks = dailyWinLossStreaks(daily);
  const dd = { maxDd: official.maxDrawdown, curve: unified.equityCurve.map((point) => point.cumulativePnl) };
  const weekday = groupPerformance(trades, (t) => safeDateFromISO(t.date).toLocaleDateString([], { weekday: "short", timeZone: "UTC" }));
  const session = groupPerformance(trades, sessionLabelForTrade);
  const bySetup = groupPerformance(trades, primarySetupLabel);
  const consistency = official.consistency;
  const recoveryFactor = infinitySafeMetric(official.recoveryFactor);
  const drawdownControl = drawdownControlFromMetrics(pnl, official.maxDrawdown);
  return {
    pnl,
    wr,
    exp,
    ev: exp,
    pf,
    count: trades.length,
    avgWinStreak: avg(winStreaks),
    avgLossStreak: avg(lossStreaks),
    avgWin,
    avgLoss,
    avgWinLoss,
    avgRR,
    sharpeRatio: sharpeRatioFromDaily(daily),
    maxWinDayStreak: dayStreaks.maxWinDayStreak,
    maxLossDayStreak: dayStreaks.maxLossDayStreak,
    maxDd: dd.maxDd,
    curve: dd.curve,
    consistency,
    recoveryFactor,
    drawdownControl,
    riskControl: official.riskControl,
    weekday,
    session,
    bySetup,
  };
}

function tradingScoreForTrades(trades: Trade[]) {
  const stats = calcStats(trades);
  return calculateTradingScore({
    winRate: stats.wr,
    profitFactor: stats.pf,
    expectancy: stats.exp,
    consistency: stats.consistency,
    riskControl: stats.drawdownControl,
    recoveryFactor: stats.recoveryFactor,
    maxDrawdown: stats.maxDd,
    avgWinLossRatio: stats.avgWinLoss,
    tradeCount: stats.count,
  });
}

function lowToHighPerformance(rows: ReturnType<typeof groupPerformance>) {
  return [...rows].sort((a, b) => a.pnl - b.pnl);
}

function buildMistakePatterns(stats: ReturnType<typeof calcStats>) {
  const patterns: string[] = [];
  if (stats.count >= 5 && stats.wr < 45) patterns.push("win_rate_below_45_percent");
  if (stats.count >= 5 && stats.pf > 0 && stats.pf < 1) patterns.push("profit_factor_below_1");
  if (stats.exp < 0) patterns.push("negative_expectancy");
  if (stats.maxDd < 0) patterns.push("drawdown_detected");
  if (stats.avgLossStreak >= 2) patterns.push("multi_loss_streaks");
  return patterns.slice(0, 5);
}

function tradeOutcome(trade: Trade): "WIN" | "LOSS" | "BREAKEVEN" {
  if (trade.pnl > 0) return "WIN";
  if (trade.pnl < 0) return "LOSS";
  return "BREAKEVEN";
}

function pnlBucket(value: number) {
  const abs = Math.abs(value);
  const prefix = value > 0 ? "profit" : value < 0 ? "loss" : "flat";
  if (abs === 0) return "flat";
  if (abs < 100) return `${prefix}_under_100`;
  if (abs < 500) return `${prefix}_100_to_500`;
  if (abs < 1000) return `${prefix}_500_to_1000`;
  return `${prefix}_over_1000`;
}

function roundMetric(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function riskAmountForTrade(trade: Trade) {
  const entry = Number(trade.entry ?? 0);
  const stop = Number(trade.stopLoss ?? 0);
  const contracts = Number(trade.contracts || 1);
  if (!entry || !stop || !Number.isFinite(entry) || !Number.isFinite(stop)) return null;
  const risk = Math.abs(entry - stop) * Math.max(1, contracts);
  return Number.isFinite(risk) ? roundMetric(risk) : null;
}

function emptyBreakdown(key: string): TradePerformanceBreakdown {
  return {
    key,
    trades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    netPnl: 0,
    avgPnl: 0,
    profitFactor: 0,
    expectancy: 0,
    avgWin: 0,
    avgLoss: 0,
    maxWin: 0,
    maxLoss: 0,
  };
}

function summarizeTradesForAnalysis(key: string, trades: Trade[]): TradePerformanceBreakdown {
  if (!trades.length) return emptyBreakdown(key);
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const grossWin = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const netPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  return {
    key,
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: roundMetric((wins.length / trades.length) * 100),
    netPnl: roundMetric(netPnl),
    avgPnl: roundMetric(netPnl / trades.length),
    profitFactor: roundMetric(grossLoss ? grossWin / grossLoss : grossWin > 0 ? 99 : 0),
    expectancy: roundMetric(netPnl / trades.length),
    avgWin: roundMetric(wins.length ? grossWin / wins.length : 0),
    avgLoss: roundMetric(losses.length ? grossLoss / losses.length : 0),
    maxWin: roundMetric(Math.max(0, ...trades.map((trade) => trade.pnl))),
    maxLoss: roundMetric(Math.min(0, ...trades.map((trade) => trade.pnl))),
  };
}

function buildAnalysisBreakdown(trades: Trade[], keyFn: (trade: Trade) => string) {
  const groups = new Map<string, Trade[]>();
  trades.forEach((trade) => {
    const key = keyFn(trade) || "Unknown";
    groups.set(key, [...(groups.get(key) || []), trade]);
  });
  return [...groups.entries()]
    .map(([key, rows]) => summarizeTradesForAnalysis(key, rows))
    .sort((a, b) => b.trades - a.trades || Math.abs(b.netPnl) - Math.abs(a.netPnl))
    .slice(0, 12);
}

function dayKeyForTrade(trade: Trade) {
  return safeDateFromISO(trade.date).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

function hourKeyForTrade(trade: Trade) {
  const hour = getTradeTime(trade).getHours();
  return `${String(hour).padStart(2, "0")}:00`;
}

function currentTradeStreaks(ordered: Trade[]) {
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let runningWin = 0;
  let runningLoss = 0;
  ordered.forEach((trade) => {
    if (trade.pnl > 0) {
      runningWin += 1;
      runningLoss = 0;
    } else if (trade.pnl < 0) {
      runningLoss += 1;
      runningWin = 0;
    } else {
      runningWin = 0;
      runningLoss = 0;
    }
    maxWinStreak = Math.max(maxWinStreak, runningWin);
    maxLossStreak = Math.max(maxLossStreak, runningLoss);
  });
  for (const trade of [...ordered].reverse()) {
    if (trade.pnl > 0 && currentLossStreak === 0) currentWinStreak += 1;
    else if (trade.pnl < 0 && currentWinStreak === 0) currentLossStreak += 1;
    else if (trade.pnl !== 0) break;
  }
  return { currentWinStreak, currentLossStreak, maxWinStreak, maxLossStreak };
}

function buildStreakBehaviorForAnalysis(trades: Trade[]): TradeAnalysisPayload["streakBehavior"] {
  const ordered = [...trades].sort((a, b) => getTradeTime(a).getTime() - getTradeTime(b).getTime());
  const afterWinningTrades: Trade[] = [];
  const afterLosingTrades: Trade[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    if (previous.pnl > 0) afterWinningTrades.push(ordered[index]);
    if (previous.pnl < 0) afterLosingTrades.push(ordered[index]);
  }

  const dailyMap = new Map<string, Trade[]>();
  ordered.forEach((trade) => {
    dailyMap.set(trade.date, [...(dailyMap.get(trade.date) || []), trade]);
  });
  const daily = [...dailyMap.entries()]
    .map(([date, rows]) => ({ date, pnl: rows.reduce((sum, trade) => sum + trade.pnl, 0) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const afterGreenDayDates = new Set<string>();
  const afterRedDayDates = new Set<string>();
  for (let index = 1; index < daily.length; index += 1) {
    if (daily[index - 1].pnl > 0) afterGreenDayDates.add(daily[index].date);
    if (daily[index - 1].pnl < 0) afterRedDayDates.add(daily[index].date);
  }

  return {
    ...currentTradeStreaks(ordered),
    afterWinningTrades: summarizeTradesForAnalysis("after_winning_trades", afterWinningTrades),
    afterLosingTrades: summarizeTradesForAnalysis("after_losing_trades", afterLosingTrades),
    afterGreenDays: summarizeTradesForAnalysis(
      "after_green_days",
      ordered.filter((trade) => afterGreenDayDates.has(trade.date)),
    ),
    afterRedDays: summarizeTradesForAnalysis(
      "after_red_days",
      ordered.filter((trade) => afterRedDayDates.has(trade.date)),
    ),
  };
}

function sessionLabelForTrade(trade: Trade) {
  const h = getTradeTime(trade).getHours();
  if (h < 11) return "Morning";
  if (h < 14) return "Midday";
  return "Afternoon";
}
function primarySetupLabel(trade: Trade) {
  const tags = extractStrategyTags(trade);
  return tags[0] ? `#${tags[0]}` : trade.symbol || "Manual";
}

function buildTradeAnalysisPayload(
  trades: Trade[],
  stats: ReturnType<typeof calcStats>,
  period: "day" | "week" | "month" | "year",
  context?: {
    passProbability?: ReturnType<typeof calculatePassProbability>;
    propSnapshot?: ReturnType<typeof computePropRiskSnapshot>;
  },
): TradeAnalysisPayload {
  const bySymbol = groupPerformance(trades, (trade) => trade.symbol || "Unknown");
  const worstSymbols = lowToHighPerformance(bySymbol);
  const worstSessions = lowToHighPerformance(stats.session);
  const tradingScore = tradingScoreForTrades(trades);
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  return {
    period,
    totalTrades: stats.count,
    totalPnl: roundMetric(stats.pnl),
    winRate: Number(stats.wr.toFixed(2)),
    profitFactor: Number(stats.pf.toFixed(2)),
    expectancy: Number(stats.exp.toFixed(2)),
    avgWin: roundMetric(stats.avgWin),
    avgLoss: roundMetric(stats.avgLoss),
    maxWin: roundMetric(Math.max(0, ...wins.map((trade) => trade.pnl))),
    maxLoss: roundMetric(Math.min(0, ...losses.map((trade) => trade.pnl))),
    maxDrawdown: roundMetric(stats.maxDd),
    recoveryFactor: roundMetric(stats.recoveryFactor),
    riskControl: roundMetric(stats.drawdownControl),
    consistency: roundMetric(stats.consistency),
    tradingScore: tradingScore.score,
    propFirmSurvivalScore: context?.passProbability?.probability,
    bestSymbol: bySymbol[0]?.label || null,
    worstSymbol: worstSymbols[0]?.label || null,
    bestSession: stats.session[0]?.label || null,
    worstSession: worstSessions[0]?.label || null,
    biggestMistakePatterns: buildMistakePatterns(stats),
    tradesByDayOfWeek: buildAnalysisBreakdown(trades, dayKeyForTrade),
    tradesBySession: buildAnalysisBreakdown(trades, sessionLabelForTrade),
    tradesByHour: buildAnalysisBreakdown(trades, hourKeyForTrade),
    tradesByInstrument: buildAnalysisBreakdown(trades, (trade) => trade.symbol || "Unknown"),
    tradesByDirection: buildAnalysisBreakdown(trades, (trade) => trade.direction),
    tradesByMood: buildAnalysisBreakdown(trades, (trade) => trade.mood || "Unknown"),
    streakBehavior: buildStreakBehaviorForAnalysis(trades),
    propFirmRuleData: context?.propSnapshot
      ? {
          dailyBuffer: roundMetric(context.propSnapshot.dailyRemaining),
          accountBuffer: roundMetric(context.propSnapshot.accountRemaining),
          dailyLossLimit: roundMetric(context.propSnapshot.template.dailyLossLimit),
          maxLossLimit: roundMetric(context.propSnapshot.template.maxLossLimit),
          passProbability: context.passProbability?.probability,
          riskLevel: context.propSnapshot.status,
          status: context.passProbability?.status,
        }
      : undefined,
    recentTrades: sortTrades(trades)
      .slice(0, 30)
      .map((trade) => ({
        date: trade.date,
        symbol: trade.symbol,
        direction: trade.direction,
        outcome: tradeOutcome(trade),
        pnl: roundMetric(trade.pnl),
        pnlBucket: pnlBucket(trade.pnl),
        contracts: trade.contracts,
        riskAmount: riskAmountForTrade(trade),
        mood: trade.mood ? safeText(trade.mood, MAX_MOOD_LENGTH) : undefined,
        session: sessionLabelForTrade(trade),
        entryHour: getTradeTime(trade).getHours(),
        tags: extractStrategyTags(trade).slice(0, 4),
      })),
  };
}

function buildLocalTradeAnalysisResult(
  stats: ReturnType<typeof calcStats>,
  patterns: ReturnType<typeof buildMistakePatterns>,
): TradeAnalysisResult {
  const weakestSession = lowToHighPerformance(stats.session)[0]?.label || "your weakest session";
  const bestSession = stats.session[0]?.label || "your best session";
  const weakestDay = lowToHighPerformance(stats.weekday)[0]?.label || "your weakest day";
  const sampleConfidence = stats.count >= 20 ? "medium" : "low";
  const detectiveScore = Math.max(20, Math.min(88, Math.round(50 + stats.wr * 0.18 + Math.min(stats.pf, 4) * 7 + (stats.exp > 0 ? 8 : -8))));
  const agent = (finding: string, evidence: string, action: string): DetectiveAgentFinding => ({
    finding,
    evidence,
    action,
  });
  return {
    mistakes: [
      {
        title: stats.pf < 1 ? "Profit factor is below 1" : "Protect low-quality trades",
        explanation:
          stats.pf < 1
            ? "Losses are currently larger than wins. Reduce size until the edge stabilizes."
            : "Your data shows room to filter weaker setups before entry.",
        evidence: `Profit factor is ${stats.pf.toFixed(2)} across ${stats.count} trades.`,
        fix: "Only take setups that match your written checklist for the next 10 trades.",
      },
      {
        title: stats.exp < 0 ? "Negative expectancy" : `Review ${weakestSession}`,
        explanation:
          stats.exp < 0
            ? "Average result per trade is negative. Focus on risk per trade and stop discipline."
            : `${weakestSession} has the weakest performance profile in this period.`,
        evidence: `Expectancy is ${moneyCompact(stats.exp)} and weakest session is ${weakestSession}.`,
        fix: `Reduce size during ${weakestSession} until the sample improves.`,
      },
      {
        title: patterns.includes("multi_loss_streaks") ? "Loss streak pressure" : `Weak day: ${weakestDay}`,
        explanation:
          patterns.includes("multi_loss_streaks")
            ? "Multiple loss streaks appear in this period. Add a hard pause rule after two losses."
            : `${weakestDay} deserves reduced size or stricter setup selection.`,
        evidence: `Average loss streak is ${stats.avgLossStreak.toFixed(1)} and weakest day is ${weakestDay}.`,
        fix: "Add a hard pause after two losses or after one rule-breaking trade.",
      },
    ],
    strengths: [
      {
        title: stats.wr >= 50 ? "Positive win-rate structure" : "Journal sample is building",
        explanation:
          stats.wr >= 50
            ? `Win rate is ${stats.wr.toFixed(0)}%, which gives you a base to refine risk/reward.`
            : "You have enough data to identify what needs improvement next.",
        evidence: `${stats.wr.toFixed(0)}% win rate over ${stats.count} trades.`,
        howToUse: "Keep the same entry quality and improve loss size control.",
      },
      {
        title: stats.exp > 0 ? "Positive expectancy" : "Risk awareness",
        explanation:
          stats.exp > 0
            ? `Average result is ${moneyCompact(stats.exp)} per trade in this period.`
            : "The journal is already showing where risk needs to be tightened.",
        evidence: `Expectancy is ${moneyCompact(stats.exp)} per trade.`,
        howToUse: "Do not increase size until this stays stable across a larger sample.",
      },
      {
        title: `Best session: ${bestSession}`,
        explanation: `${bestSession} is currently your strongest session by net P&L.`,
        evidence: `${bestSession} leads your session breakdown by net P&L.`,
        howToUse: `Prioritize clean setups during ${bestSession}.`,
      },
    ],
    recommendations: [
      {
        title: "Add a two-loss pause rule",
        action: "After two consecutive losses, stop trading or switch to review-only mode.",
        why: "Loss streaks are where many prop firm rule breaches start.",
      },
      {
        title: "Trade your strongest window",
        action: `Prioritize ${bestSession} and reduce size during weaker sessions.`,
        why: `Your session data currently favors ${bestSession}.`,
      },
      {
        title: "Review expectancy weekly",
        action: "Track expectancy, profit factor, and drawdown every weekend before increasing size.",
        why: "Scaling should follow stable execution, not one strong day.",
      },
    ],
    summary: "Generated locally from your journal statistics because cloud AI analysis was unavailable.",
    detectiveScore,
    mainBlindSpot: {
      title: stats.exp < 0 ? "Negative expectancy is the main leak" : `${weakestSession} needs stricter filtering`,
      evidence: `Expectancy ${moneyCompact(stats.exp)} • Profit factor ${stats.pf.toFixed(2)} • ${stats.count} trades analyzed.`,
      whyItMatters: "This pattern affects consistency and can pressure prop firm drawdown limits if repeated.",
      action: stats.exp < 0 ? "Cut size and review every loss before the next live session." : `Use smaller size in ${weakestSession} until the data improves.`,
    },
    hiddenPatterns: [
      {
        title: `${weakestSession} is your weakest session`,
        evidence: `${weakestSession} has the weakest net P&L in the current period.`,
        confidence: sampleConfidence,
        impact: "medium",
        action: `Reduce activity in ${weakestSession} or require A+ setups only.`,
      },
      {
        title: `${weakestDay} needs tighter rules`,
        evidence: `${weakestDay} is the weakest day in your current breakdown.`,
        confidence: sampleConfidence,
        impact: "medium",
        action: `Lower risk or stop earlier on ${weakestDay}.`,
      },
      {
        title: stats.exp > 0 ? "Expectancy is supporting progress" : "Expectancy is not supporting progress",
        evidence: `Average result is ${moneyCompact(stats.exp)} per trade.`,
        confidence: sampleConfidence,
        impact: stats.exp > 0 ? "medium" : "high",
        action: stats.exp > 0 ? "Protect the current process and avoid size jumps." : "Do not scale risk until expectancy turns positive.",
      },
    ],
    agentFindings: {
      riskAgent: agent("Risk needs evidence-based sizing.", `Max drawdown is ${moneyCompact(stats.maxDd)}.`, "Keep size fixed until drawdown stabilizes."),
      disciplineAgent: agent("Discipline sample is being measured.", `Average loss streak is ${stats.avgLossStreak.toFixed(1)}.`, "Pause after two losses."),
      propFirmAgent: agent("Prop firm risk depends on buffer protection.", `Current period P&L is ${moneyCompact(stats.pnl)}.`, "Protect daily and account buffers before chasing targets."),
      sessionAgent: agent(`${bestSession} is currently strongest.`, `${bestSession} leads session performance.`, `Prioritize ${bestSession} and reduce weak-session trades.`),
      psychologyAgent: agent("Mood data can improve future analysis.", "Mood is included only when logged with trades.", "Log mood consistently for the next 20 trades."),
      instrumentAgent: agent("Instrument edge is sample-dependent.", `Best symbol is ${stats.bySetup[0]?.label || "not clear yet"}.`, "Keep symbol tags consistent."),
      streakAgent: agent("Streak behavior needs a hard rule.", `Average loss streak is ${stats.avgLossStreak.toFixed(1)}.`, "No size increase after a loss."),
      executionAgent: agent("Execution quality improves with setup tags.", "Strategy tags are analyzed when present.", "Add setup tags like ORB, pullback, breakout, or reversal."),
      consistencyAgent: agent("Consistency is the core improvement lever.", `Win rate ${stats.wr.toFixed(0)}%, profit factor ${stats.pf.toFixed(2)}.`, "Review the same metrics weekly before changing risk."),
    },
    nextTradingRule: "For the next session, take only checklist-perfect setups and stop after two losses.",
    disclaimer: "Educational trading journal feedback only. This is not financial advice and does not predict market outcomes.",
  };
}

function toDateStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function periodPnlFromTrades(
  trades: Trade[],
  selectedDateISO: string,
  period: "week" | "month",
) {
  const selected = safeDateFromISO(selectedDateISO);
  const start = toDateStart(
    period === "week"
      ? addDays(selected, -selected.getUTCDay())
      : new Date(selected.getUTCFullYear(), selected.getUTCMonth(), 1),
  );
  return trades
    .filter((trade) => toDateStart(safeDateFromISO(trade.date)) >= start)
    .reduce((sum, trade) => sum + trade.pnl, 0);
}

function PerformanceBreakdown({
  title,
  data,
  maxItems,
  labelFormatter = (label: string) => label,
  locked = false,
}: {
  title: string;
  data: PerformanceGroup[];
  maxItems: number;
  labelFormatter?: (label: string) => string;
  locked?: boolean;
}) {
  const items = data.slice(0, maxItems);
  const max = Math.max(1, ...items.map((x) => Math.abs(x.pnl)));

  return (
    <View style={styles.breakdownSection}>
      <View style={[styles.breakdownHeader, locked && styles.breakdownHeaderLocked]}>
        {locked ? (
          <View style={styles.breakdownProBadge}>
            <Text style={styles.breakdownProBadgeText}>PRO</Text>
          </View>
        ) : null}
        <Text style={styles.breakdownTitle}>{title}</Text>
        {!locked ? (
          <Text style={styles.breakdownHint} numberOfLines={1}>
            Ranked by net P&L
          </Text>
        ) : null}
      </View>
      {items.length === 0 ? (
        <View style={styles.breakdownEmpty}>
          <Text style={styles.breakdownEmptyText}>Add trades to reveal your edge.</Text>
        </View>
      ) : (
        items.map((item, index) => {
          const color = item.pnl >= 0 ? C.green : C.red;
          const pct = Math.max(8, Math.min(100, (Math.abs(item.pnl) / max) * 100));
          return (
            <View key={`${title}-${item.label}`} style={styles.breakdownCard}>
              <View style={styles.breakdownTopRow}>
                <View style={styles.breakdownNameRow}>
                  <View style={[styles.breakdownRank, { borderColor: color }]}>
                    <Text style={[styles.breakdownRankText, { color }]}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.breakdownName} numberOfLines={1}>
                      {labelFormatter(item.label)}
                    </Text>
                    <Text style={styles.breakdownMeta} numberOfLines={1}>
                      {item.count} trades • {item.wr.toFixed(0)}% win rate
                    </Text>
                  </View>
                </View>
                <Text style={[styles.breakdownPnl, { color }]} numberOfLines={1} adjustsFontSizeToFit>
                  {moneyCompact(item.pnl)}
                </Text>
              </View>
              <View style={styles.breakdownTrack}>
                <View style={[styles.breakdownFill, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function RiskBufferBar({
  label,
  remaining,
  limit,
  tone,
}: {
  label: string;
  remaining: number;
  limit: number;
  tone: "green" | "red" | "purple";
}) {
  const pct = Math.max(0, Math.min(100, (remaining / Math.max(1, limit)) * 100));
  const color = tone === "red" ? C.red : tone === "purple" ? C.purple : C.green;
  return (
    <View style={styles.riskBarBlock}>
      <View style={styles.rowBetween}>
        <Text style={styles.riskBarLabel}>{label}</Text>
        <Text style={[styles.riskBarValue, { color }]}>{moneyCompact(remaining)}</Text>
      </View>
      <View style={styles.riskTrack}>
        <View style={[styles.riskFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function extractStrategyTags(trade: Trade) {
  const noteTags = (trade.notes.match(/#[a-z0-9_-]{2,24}/gi) || []).map((tag) =>
    tag.replace(/^#/, "").toUpperCase(),
  );
  const explicitTags = (trade.tags || []).map((tag) => String(tag).replace(/^#/, "").toUpperCase());
  return [...new Set([...explicitTags, ...noteTags])].filter(Boolean).slice(0, 6);
}

function bestStrategyTagFromTrades(trades: Trade[]) {
  const groups = new Map<string, { pnl: number; count: number; wins: number }>();
  trades.forEach((trade) => {
    extractStrategyTags(trade).forEach((tag) => {
      const current = groups.get(tag) || { pnl: 0, count: 0, wins: 0 };
      current.pnl += trade.pnl;
      current.count += 1;
      if (trade.pnl > 0) current.wins += 1;
      groups.set(tag, current);
    });
  });
  return [...groups.entries()]
    .map(([tag, data]) => ({
      tag,
      ...data,
      winRate: data.count ? (data.wins / data.count) * 100 : 0,
    }))
    .filter((item) => item.count >= 3)
    .sort((a, b) => b.pnl - a.pnl || b.winRate - a.winRate)[0] || null;
}

function computePropRiskSnapshot({
  trades,
  selectedDate,
  templateKey,
  mode,
  templates,
}: {
  trades: Trade[];
  selectedDate: string;
  templateKey: string;
  mode: FirmMode;
  templates: RiskTemplate[];
}) {
  const safeTemplates = templates.length ? templates : FALLBACK_PROP_RULES;
  const template =
    safeTemplates.find((item) => item.key === templateKey) || safeTemplates[0];
  const dayTrades = trades.filter((trade) => trade.date === selectedDate);
  const stats = calcStats(trades);
  const dayPnl = dayTrades.reduce((total, trade) => total + trade.pnl, 0);
  const totalPnl = trades.reduce((total, trade) => total + trade.pnl, 0);
  const remainingToPass = Math.max(0, template.evaluationTarget - Math.max(0, totalPnl));
  const dailyRemaining = Math.max(0, template.dailyLossLimit + Math.min(dayPnl, 0));
  const accountRemaining = Math.max(0, template.maxLossLimit + Math.min(totalPnl, 0));
  const recentTrades = [...trades]
    .sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id))
    .slice(0, 8);
  let lossStreak = 0;
  for (const trade of recentTrades) {
    if (trade.pnl < 0) lossStreak += 1;
    else break;
  }
  const expectancy = stats.exp;
  const hardStop = dailyRemaining <= 0 || accountRemaining <= 0;
  const caution =
    !hardStop &&
    (dailyRemaining <= template.dailyLossLimit * 0.35 ||
      accountRemaining <= template.maxLossLimit * 0.35 ||
      lossStreak >= 2 ||
      expectancy <= 0 ||
      dayPnl < 0);
  const status: RiskStatus = hardStop ? "STOP" : caution ? "CAUTION" : "CLEAR";
  const statusColor = hardStop ? C.red : caution ? C.yellow : C.green;
  const statusSoft = hardStop ? C.redSoft : caution ? C.yellowSoft : C.greenSoft;
  const bufferPct = Math.max(
    0,
    Math.min(100, (dailyRemaining / Math.max(1, template.dailyLossLimit)) * 100),
  );
  return {
    template,
    status,
    statusColor,
    statusSoft,
    dayPnl,
    totalPnl,
    remainingToPass,
    dailyRemaining,
    accountRemaining,
    bufferPct,
    mode,
    selectedDate,
  };
}

function PropRiskEntryCard({
  title = "Prop risk today",
  trades,
  selectedDate,
  templates,
  onPress,
}: {
  title?: string;
  trades: Trade[];
  selectedDate: string;
  templates: RiskTemplate[];
  onPress: () => void;
}) {
  const safeTemplates = templates.length ? templates : FALLBACK_PROP_RULES;
  const [templateKey, setTemplateKey] = useState(safeTemplates[0].key);
  const [mode, setMode] = useState<FirmMode>("evaluation");

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("prop-risk-template-v1"),
      AsyncStorage.getItem("prop-risk-mode-v1"),
    ]).then(([savedTemplate, savedMode]) => {
      if (savedTemplate && safeTemplates.some((template) => template.key === savedTemplate)) {
        setTemplateKey(savedTemplate);
      }
      if (savedMode === "evaluation" || savedMode === "funded") setMode(savedMode);
    });
  }, [safeTemplates]);

  const snapshot = useMemo(
    () => computePropRiskSnapshot({ trades, selectedDate, templateKey, mode, templates: safeTemplates }),
    [trades, selectedDate, templateKey, mode, safeTemplates],
  );

  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.propEntryCard} intensity={32}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.propEntryTitle}>{title}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {snapshot.template.label} • {mode === "funded" ? "Funded" : "Evaluation"}
            </Text>
          </View>
          <View
            style={[
              styles.riskStatusPill,
              { borderColor: snapshot.statusColor, backgroundColor: snapshot.statusSoft },
            ]}
          >
            <Text style={[styles.riskStatusText, { color: snapshot.statusColor }]}>
              {snapshot.status}
            </Text>
          </View>
        </View>
        <View style={styles.propEntryStatsRow}>
          <View style={styles.propEntryStat}>
            <Text style={styles.edgeMiniLabel}>Daily buffer</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              style={[styles.propEntryValue, { color: snapshot.statusColor }]}
            >
              {moneyCompact(snapshot.dailyRemaining)}
            </Text>
          </View>
          <View style={styles.propEntryStat}>
            <Text style={styles.edgeMiniLabel}>Day P&L</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              style={[styles.propEntryValue, { color: snapshot.dayPnl >= 0 ? C.green : C.red }]}
            >
              {moneyCompact(snapshot.dayPnl)}
            </Text>
          </View>
          <View style={styles.propEntryStat}>
            <Text style={styles.edgeMiniLabel}>To pass</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              style={[
                styles.propEntryValue,
                { color: snapshot.remainingToPass > 0 ? C.yellow : C.green },
              ]}
            >
              {moneyCompact(snapshot.remainingToPass)}
            </Text>
          </View>
        </View>
        <View style={styles.riskTrack}>
          <View
            style={[
              styles.riskFill,
              { width: `${snapshot.bufferPct}%`, backgroundColor: snapshot.statusColor },
            ]}
          />
        </View>
        <Text style={styles.propEntryHint}>Tap for prop firm rules & daily buffer</Text>
      </GlassCard>
    </Pressable>
  );
}

function PropFirmRiskCoach({
  trades,
  selectedDate,
  templates,
}: {
  trades: Trade[];
  selectedDate: string;
  templates: RiskTemplate[];
}) {
  const safeTemplates = templates.length ? templates : FALLBACK_PROP_RULES;
  const [templateKey, setTemplateKey] = useState(safeTemplates[0].key);
  const [mode, setMode] = useState<FirmMode>("evaluation");
  const [evalStrategy, setEvalStrategy] = useState<EvalStrategy>("steady");
  const [riskInstrument, setRiskInstrument] = useState<RiskInstrument>("MES");
  const [stopTicksInput, setStopTicksInput] = useState("16");

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("prop-risk-template-v1"),
      AsyncStorage.getItem("prop-risk-mode-v1"),
      AsyncStorage.getItem("prop-risk-eval-strategy-v1"),
      AsyncStorage.getItem("prop-risk-instrument-v1"),
      AsyncStorage.getItem("prop-risk-stop-ticks-v1"),
    ]).then(([savedTemplate, savedMode, savedStrategy, savedInstrument, savedStopTicks]) => {
      if (savedTemplate && safeTemplates.some((template) => template.key === savedTemplate)) {
        setTemplateKey(savedTemplate);
      }
      if (savedMode === "evaluation" || savedMode === "funded") setMode(savedMode);
      if (savedStrategy === "steady" || savedStrategy === "balanced" || savedStrategy === "allIn") {
        setEvalStrategy(savedStrategy);
      }
      if (savedInstrument && INSTRUMENTS[savedInstrument]) {
        setRiskInstrument(savedInstrument as RiskInstrument);
      }
      if (savedStopTicks && Number(savedStopTicks) > 0) {
        setStopTicksInput(savedStopTicks);
      }
    });
  }, [safeTemplates]);

  useEffect(() => {
    AsyncStorage.setItem("prop-risk-template-v1", templateKey);
  }, [templateKey]);

  useEffect(() => {
    AsyncStorage.setItem("prop-risk-mode-v1", mode);
  }, [mode]);

  useEffect(() => {
    AsyncStorage.setItem("prop-risk-eval-strategy-v1", evalStrategy);
  }, [evalStrategy]);

  useEffect(() => {
    AsyncStorage.setItem("prop-risk-instrument-v1", riskInstrument);
  }, [riskInstrument]);

  useEffect(() => {
    AsyncStorage.setItem("prop-risk-stop-ticks-v1", stopTicksInput);
  }, [stopTicksInput]);

  const template =
    safeTemplates.find((item) => item.key === templateKey) || safeTemplates[0];
  const hasJournalData = trades.length > 0;
  const bestStrategy = useMemo(() => bestStrategyTagFromTrades(trades), [trades]);
  const dayTrades = trades.filter((trade) => trade.date === selectedDate);
  const stats = calcStats(trades);
  const dailySeries = buildDailySeries(trades);
  const dayIndex = safeDateFromISO(selectedDate).getUTCDay();
  const selected = safeDateFromISO(selectedDate);
  const weekStart = addDays(selected, -dayIndex);
  const monthStart = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1, 12));
  const weekPnl = dailySeries
    .filter((day) => safeDateFromISO(day.label) >= weekStart)
    .reduce((sum, day) => sum + day.value, 0);
  const monthPnl = dailySeries
    .filter((day) => safeDateFromISO(day.label) >= monthStart)
    .reduce((sum, day) => sum + day.value, 0);
  const dayPnl = dayTrades.reduce((total, trade) => total + trade.pnl, 0);
  const totalPnl = trades.reduce((total, trade) => total + trade.pnl, 0);
  const remainingToPass = Math.max(0, template.evaluationTarget - Math.max(0, totalPnl));
  const dailyRemaining = Math.max(0, template.dailyLossLimit + Math.min(dayPnl, 0));
  const accountRemaining = Math.max(0, template.maxLossLimit + Math.min(totalPnl, 0));
  const nearDailyLimit = dailyRemaining <= template.dailyLossLimit * 0.35;
  const nearAccountLimit = accountRemaining <= template.maxLossLimit * 0.35;
  const nearPass =
    mode === "evaluation" &&
    hasJournalData &&
    remainingToPass > 0 &&
    remainingToPass <= Math.max(template.evaluationTarget * 0.18, template.dailyLossLimit * 0.6);
  const recentTrades = [...trades].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)).slice(0, 8);
  let lossStreak = 0;
  for (const trade of recentTrades) {
    if (trade.pnl < 0) lossStreak += 1;
    else break;
  }
  const consistency = stats.consistency;
  const expectancy = stats.exp;
  const sharpe = stats.sharpeRatio;
  const avgLoss = Math.max(35, stats.avgLoss || Math.max(50, Math.abs(expectancy || 0) * 1.7));
  const baseRiskPct = mode === "funded" ? template.liveRiskPct : template.evaluationRiskPct;
  const qualityMultiplier =
    !hasJournalData || expectancy <= 0 || sharpe < 0
      ? 0.42
      : consistency >= 72 && sharpe >= 0.8
        ? 1
        : consistency >= 55
          ? 0.72
          : 0.55;
  const streakPenalty = lossStreak >= 3 ? 0.28 : lossStreak === 2 ? 0.48 : lossStreak === 1 ? 0.72 : 1;
  const modeMultiplier = mode === "funded" ? 0.72 : 1;
  const redDay = dayPnl <= -template.dailyLossLimit * 0.55 || lossStreak >= 3 || nearDailyLimit || nearAccountLimit;
  const yellowDay =
    !redDay &&
    (dayPnl < 0 || lossStreak >= 2 || expectancy <= 0 || accountRemaining <= template.maxLossLimit * 0.45 || nearPass);
  const dayMode = redDay ? "RED" : yellowDay ? "YELLOW" : "GREEN";
  const dayModeMultiplier = redDay ? 0.32 : yellowDay ? 0.62 : 1;
  const riskBudget = Math.floor(
    Math.max(
      0,
      Math.min(dailyRemaining, accountRemaining) *
        baseRiskPct *
        qualityMultiplier *
        streakPenalty *
        modeMultiplier *
        dayModeMultiplier,
    ),
  );
  const maxFirmContracts = mode === "funded" ? template.liveContracts : template.evaluationContracts;
  const selectedInstrument = INSTRUMENTS[riskInstrument] || INSTRUMENTS.MES;
  const normalizedStopTicks = Math.max(4, Math.min(200, Number(stopTicksInput) || 16));
  const selectedRiskPerContract = Math.max(
    selectedInstrument.tickValue * 2,
    normalizedStopTicks * selectedInstrument.tickValue,
  );
  const selectedContractCap =
    MICRO_INSTRUMENTS.includes(riskInstrument)
      ? maxFirmContracts * 10
      : maxFirmContracts;
  const microSymbol = MICRO_INSTRUMENTS.includes(riskInstrument)
    ? riskInstrument
    : MINI_TO_MICRO_MAP[riskInstrument] || "MES";
  const microInstrument = INSTRUMENTS[microSymbol] || INSTRUMENTS.MES;
  const microRiskUnit = Math.max(18, normalizedStopTicks * microInstrument.tickValue);
  const eminiRiskUnit = Math.max(90, normalizedStopTicks * selectedInstrument.tickValue);
  const microContracts = Math.max(0, Math.min(maxFirmContracts * 10, Math.floor(riskBudget / microRiskUnit)));
  const eminiContracts = Math.max(0, Math.min(maxFirmContracts, Math.floor(riskBudget / eminiRiskUnit)));
  const family: ContractFamily =
    mode === "funded" || nearPass || dailyRemaining < template.dailyLossLimit * 0.55 || accountRemaining < template.maxLossLimit * 0.5 || lossStreak >= 2 || expectancy <= 0
      ? "micro"
      : eminiContracts >= 1
        ? "emini"
        : "micro";
  const fallbackContracts = family === "emini" ? Math.min(1, maxFirmContracts) : Math.min(1, maxFirmContracts * 10);
  let suggestedContracts = family === "emini"
    ? eminiContracts
    : microContracts || fallbackContracts;
  let suggestedRiskUsd = Math.max(0, riskBudget);

  const strategyMeta: Record<EvalStrategy, { label: string; risk: number; targetDays: [number, number]; tone: "green" | "purple" | "red" }> = {
    steady: { label: "Steady", risk: 200, targetDays: [10, 25], tone: "green" },
    balanced: { label: "Balanced", risk: 500, targetDays: [5, 12], tone: "purple" },
    allIn: { label: "Accelerated", risk: 650, targetDays: [4, 9], tone: "red" },
  };

  if (mode === "evaluation") {
    const chosenRisk = strategyMeta[evalStrategy].risk;
    suggestedRiskUsd = Math.min(riskBudget, chosenRisk, nearPass ? Math.max(50, remainingToPass * 0.25) : chosenRisk);
    const riskUnit = family === "emini" ? eminiRiskUnit : microRiskUnit;
    const cap = family === "emini" ? maxFirmContracts : maxFirmContracts * 10;
    suggestedContracts = Math.min(cap, Math.floor(suggestedRiskUsd / Math.max(1, riskUnit)));
  }
  const protectivePause =
    !hasJournalData ||
    nearDailyLimit ||
    nearAccountLimit ||
    lossStreak >= 2 ||
    expectancy <= 0;
  if (protectivePause) {
    suggestedRiskUsd = 0;
    suggestedContracts = 0;
  }
  const instrumentContracts = Math.min(
    selectedContractCap,
    Math.floor(suggestedRiskUsd / Math.max(1, selectedRiskPerContract)),
  );
  suggestedContracts = Math.min(suggestedContracts, instrumentContracts);
  const avgWinningDay = Math.max(50, weekPnl > 0 ? weekPnl / Math.max(1, dayIndex + 1) : stats.avgWin || 120);
  const evalDailyCapture = Math.max(50, Math.min(suggestedRiskUsd * 1.3, avgWinningDay));
  const projectedEvalDays = Math.max(1, Math.ceil(remainingToPass / Math.max(1, evalDailyCapture)));
  const hardStop = dailyRemaining <= 0 || accountRemaining <= 0;
  const caution =
    !hardStop &&
    (!hasJournalData ||
      nearDailyLimit ||
      nearAccountLimit ||
      nearPass ||
      lossStreak >= 2 ||
      expectancy <= 0 ||
      dayPnl < 0);
  const status = hardStop ? "STOP" : caution ? "CAUTION" : "CLEAR";
  const statusColor = hardStop ? C.red : caution ? C.yellow : C.green;
  const sizeLabel = suggestedContracts > 0 ? `${suggestedContracts} ${family === "emini" ? "E-mini" : "Micro"}` : "review mode";
  const coachLine = !hasJournalData
    ? "Add journal data first. Use simulator or smallest-size practice until the coach has a real sample."
    : hardStop
      ? "Stop trading today. Protect the account and reset tomorrow."
      : nearAccountLimit
        ? "You are close to max loss / trailing drawdown. Stop live trading and protect the account."
        : nearDailyLimit
          ? "Daily loss buffer is thin. Stop for the day or switch to review-only mode."
          : lossStreak >= 2
            ? "Two losses in a row. Pause now; do not add size to win it back."
            : nearPass
              ? `You are close to passing. Protect the result; max plan is ${sizeLabel} only if the setup is A+.`
              : expectancy <= 0
                ? "Negative expectancy. Do not scale live risk; review setups until expectancy improves."
                : caution
                  ? `Reduce size. Max plan is ${sizeLabel} and only for A+ setups.`
                  : `Conditions are clear. Keep size fixed at ${sizeLabel} with strict stop discipline.`;
  const fundedRiskBand = accountRemaining <= template.maxLossLimit * 0.25
    ? "Low"
    : accountRemaining <= template.maxLossLimit * 0.55
      ? "Medium"
      : "High";
  const evalDays = strategyMeta[evalStrategy].targetDays;
  const estDays = mode === "evaluation"
    ? `${Math.max(evalDays[0], projectedEvalDays)}-${Math.max(evalDays[1], projectedEvalDays + 3)}`
    : fundedRiskBand === "High"
      ? "15+"
      : fundedRiskBand === "Medium"
        ? "8-15"
        : "5-10";
  const currentRiskLabel =
    hardStop
      ? "STOP"
      : mode === "evaluation"
        ? evalStrategy === "steady"
          ? "LOW"
          : evalStrategy === "balanced"
            ? "MEDIUM"
            : "ELEVATED"
        : fundedRiskBand.toUpperCase();
  const strategyName = mode === "evaluation" ? strategyMeta[evalStrategy].label : "Funded";
  const strategyRiskText =
    mode === "evaluation"
      ? `${strategyName} • ${moneyCompact(strategyMeta[evalStrategy].risk)} risk / trade • ${moneyCompact(remainingToPass)} to pass`
      : `Funded safety mode • ${currentRiskLabel} risk`;
  const reviewReady = selected.getUTCDay() === 0;
  const strategyReviewText = bestStrategy
    ? `Best tagged strategy: #${bestStrategy.tag} (${bestStrategy.count} trades, ${moneyCompact(bestStrategy.pnl)}, ${bestStrategy.winRate.toFixed(0)}% WR).`
    : "Add strategy tags like #ORB or #Pullback in notes to reveal your best-performing setup.";
  const reviewLine = reviewReady
    ? `Weekly Review ready: week ${moneyCompact(weekPnl)}, month ${moneyCompact(monthPnl)}, expectancy ${moneyCompact(expectancy)}, Sharpe ${sharpe ? sharpe.toFixed(2) : "0.00"}.`
    : `Next weekly review on Sunday. Current week: ${moneyCompact(weekPnl)}.`;
  const survival = calculatePropSurvival({
    consistency,
    drawdown: stats.maxDd,
    dailyRemaining,
    dailyLossLimit: template.dailyLossLimit,
    accountRemaining,
    maxLossLimit: template.maxLossLimit,
    expectancy,
    avgLoss,
    lossStreak,
    dayPnl,
  });

  return (
    <GlassCard style={styles.riskCoachCard} intensity={34}>
      <View style={styles.survivalCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.edgeMiniLabel}>Prop Firm Survival Score</Text>
            <Text style={styles.survivalValue}>{survival.probability}%</Text>
          </View>
          <Text style={[styles.aiAnalysisSource, { color: survival.probability >= 75 ? C.green : survival.probability >= 50 ? C.yellow : C.red }]}>
            {mode === "evaluation" ? "PASS PROBABILITY" : "SURVIVAL SCORE"}
          </Text>
        </View>
        <Text style={styles.weeklyReviewText}>Top Risk: {survival.topRisk}</Text>
        <Text style={styles.weeklyReviewText}>Biggest Advantage: {survival.biggestAdvantage}</Text>
        <Text style={styles.weeklyReviewText}>Recommended Action: {survival.recommendedAction}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.riskTemplateRail}>
        {safeTemplates.map((item) => {
          const active = item.key === templateKey;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTemplateKey(item.key)}
              style={[styles.riskTemplateBtn, active && styles.riskTemplateActive]}
            >
              <Text style={[styles.riskTemplateLabel, active && { color: C.green }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={styles.riskTemplateSub} numberOfLines={1}>
                {item.trailingDrawdown ? "Trailing DD" : "Static DD"} • ${item.accountSize / 1000}K
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.riskModeRow}>
        {(["evaluation", "funded"] as FirmMode[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => setMode(item)}
            style={[styles.riskModeBtn, mode === item && styles.riskModeActive]}
          >
            <Text style={[styles.riskModeText, mode === item && { color: C.bg }]}>
              {item === "funded" ? "FUNDED" : "EVALUATION"}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === "evaluation" && (
        <View style={styles.riskModeRow}>
          {(["steady", "balanced", "allIn"] as EvalStrategy[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => setEvalStrategy(item)}
              style={[styles.riskModeBtn, evalStrategy === item && styles.riskModeActive]}
            >
              <Text style={[styles.riskModeText, evalStrategy === item && { color: C.bg }]}>
                {item === "steady" ? "STEADY" : item === "balanced" ? "BALANCED" : "ACCEL"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.riskModeRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(["MES", "MNQ", "MGC", "MCL", "ES", "NQ", "GC", "CL"] as RiskInstrument[]).map((item) => {
            const active = riskInstrument === item;
            return (
              <Pressable
                key={item}
                onPress={() => setRiskInstrument(item as RiskInstrument)}
                style={[styles.riskTemplateBtn, { width: 86, minHeight: 46, marginRight: 8 }, active && styles.riskTemplateActive]}
              >
                <Text style={[styles.riskTemplateLabel, styles.riskInstrumentSymbol, active && { color: C.orange }]}>{item}</Text>
                <Text style={styles.riskTemplateSub}>{moneyCompact((INSTRUMENTS[item]?.tickValue || 0) * normalizedStopTicks)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.rowBetween}>
        <Text style={styles.riskBarLabel}>Stop (ticks)</Text>
        <View style={styles.riskStopTicksInputWrap}>
          <TextInput
            value={stopTicksInput}
            onChangeText={setStopTicksInput}
            keyboardType="number-pad"
            style={styles.riskStopTicksInput}
          />
        </View>
      </View>

      <View style={styles.coachCallout}>
        <Text style={[styles.edgeMiniLabel, { color: statusColor }]}>Today's coach</Text>
        <Text style={styles.coachCalloutText}>{coachLine}</Text>
      </View>

      <RiskBufferBar
        label="Daily loss buffer"
        remaining={dailyRemaining}
        limit={template.dailyLossLimit}
        tone={hardStop && dailyRemaining <= 0 ? "red" : caution ? "purple" : "green"}
      />
      <RiskBufferBar
        label="Account buffer"
        remaining={accountRemaining}
        limit={template.maxLossLimit}
        tone={hardStop && accountRemaining <= 0 ? "red" : "purple"}
      />

      <View style={styles.riskMetricGrid}>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Day P&L</Text>
          <Text style={[styles.riskMetricValue, { color: dayPnl >= 0 ? C.green : C.red }]}>
            {moneyCompact(dayPnl)}
          </Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Risk budget</Text>
          <Text style={styles.riskMetricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {moneyCompact(suggestedRiskUsd)}
          </Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>{mode === "evaluation" ? "To pass eval" : "Safety buffer"}</Text>
          <Text style={[styles.riskMetricValue, { color: mode === "evaluation" ? (remainingToPass > 0 ? C.yellow : C.green) : accountRemaining <= template.maxLossLimit * 0.35 ? C.red : C.green }]}>
            {mode === "evaluation" ? moneyCompact(remainingToPass) : moneyCompact(accountRemaining)}
          </Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Smart size</Text>
          <Text style={[styles.riskMetricValue, { color: suggestedContracts > 0 ? C.green : C.yellow }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {suggestedContracts > 0 ? `${suggestedContracts} ${family === "emini" ? "E-mini" : "Micro"}` : "Review"}
          </Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Contract plan</Text>
          <Text style={styles.riskMetricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {suggestedContracts > 0 ? `${suggestedContracts}x ${riskInstrument}` : "Paused"}
          </Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Risk / contract</Text>
          <Text style={styles.riskMetricValue}>{moneyCompact(selectedRiskPerContract)}</Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Day mode</Text>
          <Text style={[styles.riskMetricValue, { color: dayMode === "RED" ? C.red : dayMode === "YELLOW" ? C.yellow : C.green }]}>
            {dayMode}
          </Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Risk level</Text>
          <Text style={[styles.riskMetricValue, { color: currentRiskLabel === "STOP" || currentRiskLabel === "ELEVATED" ? C.red : currentRiskLabel === "MEDIUM" ? C.yellow : C.green }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {currentRiskLabel}
          </Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Estimated days</Text>
          <Text style={styles.riskMetricValue}>{estDays}</Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Loss streak</Text>
          <Text style={[styles.riskMetricValue, { color: lossStreak >= 2 ? C.red : C.text }]}>{lossStreak}</Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Expectancy</Text>
          <Text style={[styles.riskMetricValue, { color: expectancy >= 0 ? C.green : C.red }]}>
            {moneyCompact(expectancy)}
          </Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Sharpe</Text>
          <Text style={styles.riskMetricValue}>{sharpe ? sharpe.toFixed(2) : "0.00"}</Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Best strategy</Text>
          <Text style={[styles.riskMetricValue, { color: bestStrategy ? C.green : C.sub }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
            {bestStrategy ? `#${bestStrategy.tag}` : "Add tags"}
          </Text>
        </View>
      </View>

      <View style={styles.weeklyReviewBox}>
        <Text style={styles.edgeMiniLabel}>Weekly / Monthly Review</Text>
        <Text style={styles.weeklyReviewText}>{reviewLine}</Text>
        <Text style={[styles.weeklyReviewText, { marginTop: 8 }]}>
          {strategyRiskText}
        </Text>
        <Text style={[styles.weeklyReviewText, { marginTop: 8 }]}>
          {strategyReviewText}
        </Text>
      </View>

      <Text style={[styles.sub, { marginTop: 10 }]}>
        This coach uses calculations from Topstep rule source: https://www.topstep.com • (2026-05-29).
      </Text>
    </GlassCard>
  );
}
function MetricGauge({ label, value, helper, tone = "green" }: { label: string; value: string; helper?: string; tone?: "green" | "purple" | "red" | "white" }) {
  const color = tone === "purple" ? C.purple : tone === "red" ? C.red : tone === "white" ? C.text : C.green;
  return (
    <GlassCard compact style={styles.dashboardMetric}>
      <View style={styles.rowBetween}>
        <SafeMetricLabel style={styles.dashboardMetricLabel}>{label}</SafeMetricLabel>
        <View style={[styles.metricDot, { backgroundColor: color }]} />
      </View>
      <SafeText style={[styles.dashboardMetricValue, { color }]}>{value}</SafeText>
      {!!helper && <SafeText style={styles.dashboardMetricHelper}>{helper}</SafeText>}
    </GlassCard>
  );
}
function DashboardBars({ data, cumulative = false }: { data: { label: string; value: number }[]; cumulative?: boolean }) {
  const arr = data.length ? data.slice(-18) : [{ label: "", value: 0 }];
  const max = Math.max(1, ...arr.map((x) => Math.abs(x.value)));
  return (
    <View style={styles.dashboardChartBox}>
      {arr.map((x, i) => {
        const h = 14 + (Math.abs(x.value) / max) * 72;
        const color = x.value >= 0 ? C.green : C.red;
        return (
          <View key={`${x.label}-${i}`} style={styles.dashboardBarSlot}>
            <View style={[styles.dashboardBar, { height: h, backgroundColor: color, opacity: cumulative ? 0.95 : 0.88 }]} />
          </View>
        );
      })}
    </View>
  );
}

function EquityCurve({ data }: { data: { label: string; value: number }[] }) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(260, Math.min(620, width - 64));
  const chartHeight = 150;
  const arr = data.length ? data.slice(-36) : [{ label: "", value: 0 }];
  const values = arr.map((x) => x.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = Math.max(1, max - min);
  const points = arr.map((x, i) => ({
    label: x.label,
    value: x.value,
    x: arr.length === 1 ? chartWidth / 2 : (i / (arr.length - 1)) * chartWidth,
    y: chartHeight - ((x.value - min) / range) * chartHeight,
  }));
  const zeroY = chartHeight - ((0 - min) / range) * chartHeight;

  return (
    <View style={[styles.equityCurveBox, { width: chartWidth, height: chartHeight }]}>
      {[0.25, 0.5, 0.75].map((p) => (
        <View key={p} style={[styles.equityGridLine, { top: chartHeight * p }]} />
      ))}
      <View style={[styles.equityZeroLine, { top: zeroY }]} />
      {points.slice(1).map((pt, i) => {
        const prev = points[i];
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={`${pt.label}-${i}`}
            style={[
              styles.equityCurveSegment,
              {
                left: prev.x,
                top: prev.y,
                width: length,
                backgroundColor: pt.value >= prev.value ? C.green : C.red,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: "left center",
              },
            ]}
          />
        );
      })}
      {points.map((pt, i) => (
        <View
          key={`${pt.label}-point-${i}`}
          style={[
            styles.equityCurvePoint,
            {
              left: pt.x - 4,
              top: pt.y - 4,
              backgroundColor: pt.value >= 0 ? C.green : C.red,
            },
          ]}
        />
      ))}
    </View>
  );
}

function buildDailySeries(trades: Trade[]) {
  const map: Record<string, number> = {};
  trades.forEach((t) => { map[t.date] = (map[t.date] || 0) + t.pnl; });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
}

function sharpeRatioFromDaily(daily: { value: number }[]) {
  if (daily.length < 2) return 0;
  const avg = daily.reduce((a, d) => a + d.value, 0) / daily.length;
  const variance = daily.reduce((a, d) => a + Math.pow(d.value - avg, 2), 0) / daily.length;
  const stdev = Math.sqrt(variance);
  if (!stdev) return avg > 0 ? 99 : 0;
  return avg / stdev;
}

function dailyWinLossStreaks(daily: { value: number }[]) {
  let current: "win" | "loss" | null = null;
  let len = 0;
  let maxWin = 0;
  let maxLoss = 0;

  const flush = () => {
    if (current === "win") maxWin = Math.max(maxWin, len);
    if (current === "loss") maxLoss = Math.max(maxLoss, len);
  };

  daily.forEach((day) => {
    const kind = day.value > 0 ? "win" : day.value < 0 ? "loss" : null;
    if (!kind) {
      flush();
      current = null;
      len = 0;
      return;
    }
    if (kind === current) len += 1;
    else {
      flush();
      current = kind;
      len = 1;
    }
  });
  flush();

  return { maxWinDayStreak: maxWin, maxLossDayStreak: maxLoss };
}

function ScoreChip({
  label,
  value,
  tone = "purple",
  locked = false,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "green" | "purple" | "red" | "white";
  locked?: boolean;
}) {
  const color =
    tone === "green" ? C.green : tone === "red" ? C.red : tone === "white" ? C.text : C.purple;
  return (
    <GlassCard compact style={[styles.dashboardMetric, locked && { opacity: 0.52 }]}>
      <SafeMetricLabel style={[styles.dashboardMetricLabel, { color: C.sub, fontSize: 14 }]}>{label}</SafeMetricLabel>
      <View style={[{ marginTop: 10, minHeight: 30, justifyContent: "center" }, locked && styles.lockedMetricPreview]}>
        {typeof value === "string" ? (
          <SafeText style={[styles.dashboardMetricValue, { color: value.includes("-") ? C.red : (value.includes("$") || value.includes("+") ? C.green : C.text), fontSize: 25 }]}>
            {value}
          </SafeText>
        ) : (
          value
        )}
      </View>
      {locked && (
        <View style={styles.metricLockGlass}>
          <Lock size={14} color={C.green} strokeWidth={2.6} />
        </View>
      )}
    </GlassCard>
  );
}

function SplitMoney({
  win,
  loss,
  locked = false,
}: {
  win: number;
  loss: number;
  locked?: boolean;
}) {
  if (locked) {
    return <SafeText style={[styles.dashboardMetricValue, { color: C.purple, fontSize: 25 }]}>••••</SafeText>;
  }
  return (
    <Text style={[styles.dashboardMetricValue, styles.safeText, { fontSize: 22 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
      <Text style={{ color: C.green }}>{moneyCompact(win || 0)}</Text>
      <Text style={{ color: C.sub }}> / </Text>
      <Text style={{ color: C.red }}>{moneyCompact(-(loss || 0))}</Text>
    </Text>
  );
}

function SplitCount({
  wins,
  losses,
  locked = false,
}: {
  wins: number;
  losses: number;
  locked?: boolean;
}) {
  if (locked) {
    return <SafeText style={[styles.dashboardMetricValue, { color: C.purple, fontSize: 25 }]}>••••</SafeText>;
  }
  return (
    <Text style={[styles.dashboardMetricValue, styles.safeText, { fontSize: 25 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
      <Text style={{ color: C.green }}>{wins}</Text>
      <Text style={{ color: C.sub }}> / </Text>
      <Text style={{ color: C.red }}>{losses}</Text>
    </Text>
  );
}

function PaywallPreview({
  packages,
  storeProducts,
  purchaseBusy,
  paywallError,
  onPurchase,
  onRestore,
  showRestorePurchases,
}: {
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  paywallError: string;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
  showRestorePurchases: boolean;
}) {
  const monthly = packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null;
  const monthlyProduct =
    storeProducts.find((product) => product.identifier === YOU_TRADER_MONTHLY_PRODUCT_ID) || null;
  useEffect(() => {
    trackEvent("paywall_viewed", { screen: "paywall_preview" });
  }, []);
  return (
    <GlassCard style={styles.paywallPreview} intensity={42}>
      <Text style={styles.paywallTitle}>Unlock Full Edge Analysis</Text>
      <Text style={styles.paywallSub}>
        Your journal stays free. Pro unlocks AI coaching, prop firm protection, hidden leaks, advanced stats, media notes, import/export, full news, and the full economic calendar.
      </Text>
      <Pressable
        disabled={purchaseBusy}
        onPress={() => onPurchase(monthly, YOU_TRADER_MONTHLY_PRODUCT_ID)}
        style={[styles.primaryBig, purchaseBusy && styles.disabledBtn]}
      >
        <Text style={styles.primaryText}>{purchaseBusy ? "Connecting..." : "Unlock Pro"}</Text>
      </Pressable>
      <SubscriptionLegalDisclosure
        monthlyPackage={monthly}
        monthlyProduct={monthlyProduct}
      />
      {(showRestorePurchases || !!paywallError) ? (
        <Pressable
          disabled={purchaseBusy}
          onPress={onRestore}
          style={[styles.secondaryBig, styles.restorePurchaseBtn, purchaseBusy && styles.disabledBtn]}
        >
          <Text style={styles.secondaryText}>{purchaseBusy ? "Checking..." : "Restore Purchases"}</Text>
        </Pressable>
      ) : null}
      {paywallError ? (
        <Text style={[styles.sub, { color: C.red, marginTop: 10 }]}>{paywallError}</Text>
      ) : null}
    </GlassCard>
  );
}

function TerminalGlassCard({
  children,
  style,
  intensity = 46,
}: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
}) {
  return (
    <GlassCard style={[styles.terminalCard, style]} intensity={intensity}>
      {children}
    </GlassCard>
  );
}

function SegmentedTimeFilter<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.terminalSegment}>
      {options.map((option) => (
        <Pressable key={option} onPress={() => onChange(option)} style={[styles.terminalSegmentBtn, value === option && styles.terminalSegmentActive]}>
          <Text style={[styles.terminalSegmentText, value === option && styles.terminalSegmentTextActive]}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function MetricPillRow({ items }: { items: { label: string; value: string; tone?: "green" | "red" | "purple" | "grey" }[] }) {
  return (
    <View style={styles.metricPillRow}>
      {items.map((item) => {
        const color = item.tone === "red" ? C.red : item.tone === "purple" ? C.purple : item.tone === "green" ? C.green : C.sub;
        return (
          <View key={item.label} style={styles.metricPill}>
            <Text style={styles.metricPillLabel}>{item.label}</Text>
            <Text style={[styles.metricPillValue, { color }]}>{item.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

function PropTemplateSelector({
  templates,
  value,
  mode,
  onChange,
  onModeChange,
}: {
  templates: RiskTemplate[];
  value: string;
  mode?: FirmMode;
  onChange: (key: string) => void;
  onModeChange?: (mode: FirmMode) => void;
}) {
  const safeTemplates = templates.length ? templates : FALLBACK_PROP_RULES;
  return (
    <View style={styles.propTemplateSelector}>
      <View style={styles.propTemplateHeader}>
        <Text style={styles.terminalSmallLabel}>Eval account</Text>
        <Text style={styles.propTemplateHint}>Rules, buffers and contract plan update live</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propTemplateRail}>
        {safeTemplates.map((template) => {
          const active = template.key === value;
          return (
            <Pressable
              key={template.key}
              onPress={() => onChange(template.key)}
              style={[styles.propTemplateChip, active && styles.propTemplateChipActive]}
            >
              <Text style={[styles.propTemplateChipText, active && styles.propTemplateChipTextActive]}>
                {template.label}
              </Text>
              <Text style={styles.propTemplateChipSub}>
                {template.evaluationContracts} eval / {template.liveContracts} live
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {onModeChange && mode ? (
        <View style={styles.propModeRail}>
          {(["evaluation", "funded"] as FirmMode[]).map((item) => {
            const active = item === mode;
            return (
              <Pressable
                key={item}
                onPress={() => onModeChange(item)}
                style={[styles.propModeChip, active && styles.propModeChipActive]}
              >
                <Text style={[styles.propModeChipText, active && styles.propModeChipTextActive]}>
                  {item === "evaluation" ? "Evaluation" : "Funded"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function StatsMetricDashboard({
  stats,
  trades,
  weekPnl,
  monthPnl,
  consistency,
  isPremium,
}: {
  stats: ReturnType<typeof calcStats>;
  trades: Trade[];
  weekPnl: number;
  monthPnl: number;
  consistency: number;
  isPremium: boolean;
}) {
  const wins = trades.filter((trade) => trade.pnl > 0).length;
  const losses = trades.filter((trade) => trade.pnl < 0).length;
  const biggestWin = Math.max(0, ...trades.map((trade) => trade.pnl));
  const biggestLoss = Math.min(0, ...trades.map((trade) => trade.pnl));
  const rows: Array<{ label: string; value: string; tone: "green" | "red" | "purple" | "grey"; pro?: boolean }> = [
    { label: "Win Rate", value: `${stats.wr.toFixed(0)}%`, tone: stats.wr >= 50 ? "green" : "red" },
    { label: "Trades", value: String(stats.count), tone: "grey" },
    { label: "Win / Loss", value: `${wins} / ${losses}`, tone: wins >= losses ? "green" : "red" },
    { label: "Month P&L", value: moneyCompact(monthPnl), tone: monthPnl >= 0 ? "green" : "red" },
    { label: "Week P&L", value: moneyCompact(weekPnl), tone: weekPnl >= 0 ? "green" : "red" },
    { label: "Biggest Win", value: moneyCompact(biggestWin), tone: "green" },
    { label: "Biggest Loss", value: moneyCompact(biggestLoss), tone: biggestLoss < 0 ? "red" : "grey" },
    { label: "Profit Factor", value: stats.pf ? stats.pf.toFixed(2) : "—", tone: stats.pf >= 1.5 ? "green" : "purple", pro: true },
    { label: "Expectancy", value: moneyCompact(stats.exp), tone: stats.exp >= 0 ? "green" : "red", pro: true },
    { label: "Avg Win/Loss", value: stats.avgWinLoss ? stats.avgWinLoss.toFixed(2) : "—", tone: stats.avgWinLoss >= 1.5 ? "green" : "purple", pro: true },
    { label: "Consistency", value: `${consistency.toFixed(0)}%`, tone: consistency >= 65 ? "green" : "purple", pro: true },
    { label: "Stability Score", value: stats.sharpeRatio ? stats.sharpeRatio.toFixed(2) : "0.00", tone: stats.sharpeRatio >= 0.8 ? "green" : "purple", pro: true },
    { label: "Max Losing Day Streak", value: String(stats.maxLossDayStreak), tone: stats.maxLossDayStreak >= 2 ? "red" : "grey", pro: true },
    { label: "Max Winning Day Streak", value: String(stats.maxWinDayStreak), tone: "green", pro: true },
  ];
  return (
    <View style={styles.statsMetricDashboard}>
      <View style={styles.statsMetricHeader}>
        <Text style={styles.terminalHeroTitle}>Stats Dashboard</Text>
      </View>
      <View style={styles.statsMetricGrid}>
        {rows.map((row) => {
          const locked = row.pro && !isPremium;
          const color =
            row.tone === "red" ? C.red : row.tone === "purple" ? C.purple : row.tone === "green" ? C.green : C.sub;
          return (
            <View key={row.label} style={[styles.statsMetricTile, locked && styles.statsMetricTileLocked]}>
              <Text style={styles.statsMetricLabel}>{row.label}</Text>
              <Text style={[styles.statsMetricValue, { color: locked ? C.sub : color }]}>{locked ? "PRO" : row.value}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function AppleRing({
  label,
  value,
  display,
  color = C.green,
  size = 86,
  onPress,
}: {
  label: string;
  value: number;
  display: string;
  color?: string;
  size?: number;
  onPress?: () => void;
}) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <Pressable onPress={onPress} style={[styles.appleRingWrap, { width: size + 18 }]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.10)" strokeWidth={8} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference - (circumference * clamped) / 100}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.appleRingCenter}>
        <Text style={styles.appleRingValue}>{display}</Text>
      </View>
      <Text style={styles.appleRingLabel}>{label}</Text>
    </Pressable>
  );
}

function BottomSheetPanel({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.bottomSheetBackdrop} onPress={onClose}>
        <Pressable style={styles.bottomSheetCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.bottomSheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeCircle}>
              <Text style={styles.closeX}>×</Text>
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type EquityRange = "7D" | "30D" | "90D" | "YTD" | "ALL";
const EQUITY_RANGES: EquityRange[] = ["7D", "30D", "90D", "YTD", "ALL"];

function filteredByEquityRange(trades: Trade[], range: EquityRange) {
  if (range === "ALL") return trades;
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const lastDate = sorted[sorted.length - 1]?.date;
  if (!lastDate) return trades;
  const end = safeDateFromISO(lastDate);
  const start = new Date(end);
  if (range === "YTD") start.setUTCMonth(0, 1);
  else start.setUTCDate(start.getUTCDate() - Number(range.replace("D", "")));
  return trades.filter((trade) => safeDateFromISO(trade.date) >= start);
}

function buildEquityPoints(trades: Trade[], width: number, height: number) {
  const daily = buildDailySeries(trades);
  let cumulative = 0;
  const rows = daily.map((day, index) => ({ ...day, index, cumulative: (cumulative += day.value) }));
  if (!rows.length) return [];
  const values = rows.map((row) => row.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = Math.max(1, max - min);
  const padX = 18;
  const padY = 16;
  return rows.map((row, index) => ({
    ...row,
    x: padX + (rows.length === 1 ? (width - padX * 2) / 2 : (index / (rows.length - 1)) * (width - padX * 2)),
    y: padY + (height - padY * 2) - ((row.cumulative - min) / range) * (height - padY * 2),
    tradeCount: trades.filter((trade) => trade.date === row.label).length,
  }));
}

function smoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  return points.reduce((path, point, index) => {
    if (index === 0) return `M${point.x},${point.y}`;
    const prev = points[index - 1];
    const midX = (prev.x + point.x) / 2;
    return `${path} C${midX},${prev.y} ${midX},${point.y} ${point.x},${point.y}`;
  }, "");
}

function TerminalEquitySection({ trades, stats, weekPnl, monthPnl }: { trades: Trade[]; stats: ReturnType<typeof calcStats>; weekPnl: number; monthPnl: number }) {
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<EquityRange>("30D");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const chartWidth = Math.max(300, Math.min(720, width - 56));
  const chartHeight = 250;
  const rangedTrades = useMemo(() => filteredByEquityRange(trades, range), [range, trades]);
  const points = useMemo(() => buildEquityPoints(rangedTrades, chartWidth, chartHeight), [chartHeight, chartWidth, rangedTrades]);
  const selected = selectedIndex != null ? points[selectedIndex] : points[points.length - 1];
  const path = smoothPath(points);
  const fillPath = points.length ? `${path} L${points[points.length - 1].x},${chartHeight - 12} L${points[0].x},${chartHeight - 12} Z` : "";
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const x = event.nativeEvent.locationX;
          const nearest = points.reduce((best, point, index) => (Math.abs(point.x - x) < Math.abs(points[best]?.x - x || 9999) ? index : best), 0);
          setSelectedIndex(nearest);
        },
        onPanResponderMove: (event) => {
          const x = event.nativeEvent.locationX;
          const nearest = points.reduce((best, point, index) => (Math.abs(point.x - x) < Math.abs(points[best]?.x - x || 9999) ? index : best), 0);
          setSelectedIndex(nearest);
        },
      }),
    [points],
  );

  return (
    <TerminalGlassCard style={styles.terminalHeroCard}>
      <View style={styles.terminalHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.terminalHeroTitle}>Equity Curve</Text>
          <Text style={styles.terminalSub}>Live account story from your journal</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.terminalKpi, { color: stats.pnl >= 0 ? C.green : C.red }]}>{moneyCompact(stats.pnl)}</Text>
          <Text style={styles.terminalSub}>Net P&L</Text>
        </View>
      </View>
      <SegmentedTimeFilter options={EQUITY_RANGES} value={range} onChange={(value) => setRange(value as EquityRange)} />
      <View style={styles.terminalChartWrap} {...panResponder.panHandlers}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="terminalEquityLine" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={C.purple} stopOpacity="0.72" />
              <Stop offset="1" stopColor={C.green} stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="terminalEquityFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.green} stopOpacity="0.18" />
              <Stop offset="1" stopColor={C.purple} stopOpacity="0.015" />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75].map((line) => (
            <Line key={line} x1={18} x2={chartWidth - 18} y1={chartHeight * line} y2={chartHeight * line} stroke="rgba(255,255,255,0.055)" strokeWidth={1} />
          ))}
          {fillPath ? <Path d={fillPath} fill="url(#terminalEquityFill)" /> : null}
          {path ? <Path d={path} stroke="url(#terminalEquityLine)" strokeWidth={4} strokeLinecap="round" fill="none" /> : null}
          {points.map((point, index) => (
            <Circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r={index === points.length - 1 ? 7 : 3.5} fill={point.value >= 0 ? C.green : C.red} stroke="rgba(0,0,0,0.85)" strokeWidth={2} />
          ))}
          {selected ? <Circle cx={selected.x} cy={selected.y} r={13} fill="none" stroke={C.green} strokeWidth={2} opacity={0.75} /> : null}
        </Svg>
        {selected ? (
          <View style={[styles.terminalTooltip, { left: Math.min(chartWidth - 178, Math.max(10, selected.x - 82)), top: Math.max(8, selected.y - 86) }]}>
            <Text style={styles.terminalTooltipDate}>{selected.label}</Text>
            <Text style={[styles.terminalTooltipPnl, { color: selected.value >= 0 ? C.green : C.red }]}>{moneyCompact(selected.value)}</Text>
            <Text style={styles.terminalTooltipMeta}>Trade #{selected.tradeCount || 1} • Equity {moneyCompact(selected.cumulative)}</Text>
          </View>
        ) : null}
      </View>
      <MetricPillRow
        items={[
          { label: "Today", value: moneyCompact(trades.filter((trade) => trade.date === todayISO()).reduce((sum, trade) => sum + trade.pnl, 0)), tone: trades.filter((trade) => trade.date === todayISO()).reduce((sum, trade) => sum + trade.pnl, 0) >= 0 ? "green" : "red" },
          { label: "Weekly", value: moneyCompact(weekPnl), tone: weekPnl >= 0 ? "green" : "red" },
          { label: "Monthly", value: moneyCompact(monthPnl), tone: monthPnl >= 0 ? "green" : "red" },
          { label: "Max DD", value: moneyCompact(stats.maxDd), tone: stats.maxDd < 0 ? "red" : "grey" },
          { label: "Avg Day", value: moneyCompact(buildDailySeries(trades).length ? stats.pnl / buildDailySeries(trades).length : 0), tone: "grey" },
          { label: "PF", value: stats.pf ? stats.pf.toFixed(2) : "—", tone: stats.pf >= 1.5 ? "green" : "purple" },
        ]}
      />
    </TerminalGlassCard>
  );
}

function TerminalTradingDna({
  stats,
  consistency,
  recoveryFactor,
  drawdownControl,
}: {
  stats: ReturnType<typeof calcStats>;
  consistency: number;
  recoveryFactor: number;
  drawdownControl: number;
}) {
  const [selected, setSelected] = useState<{ title: string; current: string; target: string; explanation: string } | null>(null);
  const rings = [
    { label: "Win Rate", value: Math.min(100, stats.wr), display: `${stats.wr.toFixed(0)}%`, color: C.green, target: "55%+", explanation: "Percentage of closed trades that finished green." },
    { label: "Risk", value: drawdownControl, display: `${drawdownControl.toFixed(0)}%`, color: drawdownControl >= 70 ? C.green : C.yellow, target: "70%+", explanation: "How well your drawdown is controlled relative to current profit and buffer." },
    { label: "Consistency", value: consistency, display: `${consistency.toFixed(0)}%`, color: C.purple, target: "70%+", explanation: "Green day rate plus daily P&L stability." },
    { label: "Recovery", value: Math.min(100, Math.max(0, recoveryFactor / 4) * 100), display: recoveryFactor ? recoveryFactor.toFixed(1) : "—", color: C.green, target: "3.0+", explanation: "Net P&L divided by max drawdown." },
    { label: "Profit Factor", value: Math.min(100, (stats.pf / 2.5) * 100), display: stats.pf ? stats.pf.toFixed(2) : "—", color: C.green, target: "1.5+", explanation: "Gross wins divided by gross losses." },
    { label: "Reward Risk", value: Math.min(100, (stats.avgWinLoss / 2.5) * 100), display: stats.avgWinLoss ? stats.avgWinLoss.toFixed(2) : "—", color: C.purple, target: "1.5+", explanation: "Average win size divided by average loss size." },
  ];
  const profileScore = Math.round(rings.reduce((sum, ring) => sum + Math.max(0, Math.min(100, ring.value)), 0) / rings.length);
  const strengths = rings.filter((ring) => ring.value >= 65).slice(0, 3);
  const weakest = [...rings].sort((a, b) => a.value - b.value)[0];

  return (
    <TerminalGlassCard>
      <Text style={styles.terminalEyebrow}>Trading DNA</Text>
      <View style={styles.dnaHero}>
        <View style={styles.dnaScoreCircle}>
          <Text style={styles.dnaScore}>{profileScore}</Text>
          <Text style={styles.dnaScoreLabel}>DNA Score</Text>
        </View>
        <View style={styles.dnaRingGrid}>
          {rings.map((ring) => (
            <AppleRing
              key={ring.label}
              label={ring.label}
              value={ring.value}
              display={ring.display}
              color={ring.color}
              onPress={() => setSelected({ title: ring.label, current: ring.display, target: ring.target, explanation: ring.explanation })}
            />
          ))}
        </View>
      </View>
      <View style={styles.dnaInsightRow}>
        <View style={styles.dnaInsightBlock}>
          <Text style={styles.terminalSmallLabel}>Strengths</Text>
          <View style={styles.terminalChipRow}>
            {(strengths.length ? strengths : rings.slice(0, 2)).map((ring) => (
              <Text key={ring.label} style={styles.terminalChip}>● {ring.label}</Text>
            ))}
          </View>
        </View>
        <View style={styles.dnaWeakBlock}>
          <Text style={styles.terminalSmallLabel}>Weakest Area</Text>
          <Text style={styles.dnaWeakText}>{weakest.label}</Text>
          <Text style={styles.terminalSub}>Target {weakest.target}</Text>
        </View>
      </View>
      <BottomSheetPanel visible={!!selected} title={selected?.title || "Metric"} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            <Text style={styles.bottomSheetBig}>{selected.current}</Text>
            <Text style={styles.bottomSheetText}>{selected.explanation}</Text>
            <Text style={styles.bottomSheetText}>Target: {selected.target}</Text>
          </>
        ) : null}
      </BottomSheetPanel>
    </TerminalGlassCard>
  );
}

function PremiumPerformanceRadar({
  stats,
  consistency,
  recoveryFactor,
  drawdownControl,
}: {
  stats: ReturnType<typeof calcStats>;
  consistency: number;
  recoveryFactor: number;
  drawdownControl: number;
}) {
  const [selected, setSelected] = useState<{ label: string; value: string; target: string; explanation: string } | null>(null);
  const size = 286;
  const center = size / 2;
  const maxR = 102;
  const axes = [
    { label: "Win Rate", value: `${stats.wr.toFixed(0)}%`, score: Math.min(100, stats.wr), target: "55%+", explanation: "Percent of trades closed green." },
    { label: "Risk Ctrl", value: `${drawdownControl.toFixed(0)}%`, score: drawdownControl, target: "70%+", explanation: "Drawdown control relative to total performance and risk buffer." },
    { label: "Consistency", value: `${consistency.toFixed(0)}%`, score: consistency, target: "70%+", explanation: "Green-day quality plus daily P&L stability." },
    { label: "Recovery", value: recoveryFactor ? recoveryFactor.toFixed(1) : "—", score: Math.min(100, (recoveryFactor / 4) * 100), target: "3.0+", explanation: "Net P&L divided by max drawdown." },
    { label: "Profit Factor", value: stats.pf ? stats.pf.toFixed(2) : "—", score: Math.min(100, (stats.pf / 2.5) * 100), target: "1.5+", explanation: "Gross wins divided by gross losses." },
    { label: "Reward Risk", value: stats.avgWinLoss ? stats.avgWinLoss.toFixed(2) : "—", score: Math.min(100, (stats.avgWinLoss / 2.5) * 100), target: "1.5+", explanation: "Average win size divided by average loss size." },
  ];
  const points = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axes.length;
    const r = Math.max(18, Math.min(100, axis.score)) / 100 * maxR;
    return {
      ...axis,
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
      lx: center + Math.cos(angle) * (maxR + 34),
      ly: center + Math.sin(angle) * (maxR + 34),
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
  const profileScore = Math.round(axes.reduce((sum, axis) => sum + Math.max(0, Math.min(100, axis.score)), 0) / axes.length);
  const strongest = [...axes].sort((a, b) => b.score - a.score).slice(0, 3);
  const weakest = [...axes].sort((a, b) => a.score - b.score)[0];

  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSectionTitle}>Trading Radar</Text>
      <View style={styles.premiumRadarWrap}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.green} stopOpacity="0.22" />
              <Stop offset="1" stopColor={C.purple} stopOpacity="0.12" />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75, 1].map((ring) => (
            <Circle key={ring} cx={center} cy={center} r={maxR * ring} stroke="rgba(255,255,255,0.08)" strokeWidth={1} fill="none" />
          ))}
          {points.map((point) => (
            <Line key={`axis-${point.label}`} x1={center} y1={center} x2={point.lx} y2={point.ly} stroke="rgba(255,255,255,0.055)" strokeWidth={1} />
          ))}
          <Polygon points={polygon} fill="url(#radarFill)" stroke={C.green} strokeWidth={3} />
          {points.map((point) => (
            <Circle key={`dot-${point.label}`} cx={point.x} cy={point.y} r={5.5} fill={C.green} stroke="rgba(0,0,0,0.72)" strokeWidth={2} />
          ))}
        </Svg>
        <View style={styles.premiumRadarCenter}>
          <Text style={styles.premiumRadarScore}>{profileScore}</Text>
          <Text style={styles.premiumRadarLabel}>PROFILE</Text>
        </View>
        {points.map((point) => (
          <Pressable
            key={`label-${point.label}`}
            onPress={() => setSelected({ label: point.label, value: point.value, target: point.target, explanation: point.explanation })}
            style={[styles.premiumRadarAxisLabel, { left: Math.max(0, Math.min(size - 86, point.lx - 43)), top: Math.max(0, Math.min(size - 38, point.ly - 18)) }]}
          >
            <Text style={styles.premiumRadarAxisText}>{point.label}</Text>
            <Text style={styles.premiumRadarAxisValue}>{point.value}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.radarSummaryRow}>
        <View style={styles.radarSummaryBlock}>
          <Text style={styles.terminalSmallLabel}>Strengths</Text>
          <View style={styles.terminalChipRow}>
            {strongest.map((item) => <Text key={item.label} style={styles.terminalChip}>● {item.label}</Text>)}
          </View>
        </View>
        <View style={styles.radarWeakBlock}>
          <Text style={styles.terminalSmallLabel}>Weakest Area</Text>
          <Text style={styles.dnaWeakText}>{weakest.label}</Text>
          <Text style={styles.terminalSub}>Target {weakest.target}</Text>
        </View>
      </View>
      <MetricPillRow items={axes.map((axis) => ({ label: axis.label, value: axis.value, tone: axis.score >= 65 ? "green" : "grey" }))} />
      <BottomSheetPanel visible={!!selected} title={selected?.label || "Metric"} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            <Text style={styles.bottomSheetBig}>{selected.value}</Text>
            <Text style={styles.bottomSheetText}>{selected.explanation}</Text>
            <Text style={styles.bottomSheetText}>Target: {selected.target}</Text>
          </>
        ) : null}
      </BottomSheetPanel>
    </TerminalGlassCard>
  );
}

type SessionMode = "Hours" | "Sessions" | "Days" | "Months";
const SESSION_MODES: SessionMode[] = ["Hours", "Sessions", "Days", "Months"];

function buildSessionCells(trades: Trade[], mode: SessionMode) {
  const keyFn =
    mode === "Hours"
      ? hourKeyForTrade
      : mode === "Sessions"
        ? sessionLabelForTrade
        : mode === "Days"
          ? dayKeyForTrade
          : (trade: Trade) => safeDateFromISO(trade.date).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const rows = buildAnalysisBreakdown(trades, keyFn);
  const orderedKeys =
    mode === "Hours"
      ? Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`)
      : mode === "Sessions"
        ? ["Morning", "Midday", "Afternoon"]
        : mode === "Days"
          ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
          : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const expanded = orderedKeys.map((key) => byKey.get(key) || emptyBreakdown(key));
  const maxAbs = Math.max(1, ...expanded.map((row) => Math.abs(row.netPnl)));
  return expanded.map((item) => ({
    ...item,
    intensity: Math.min(1, Math.abs(item.netPnl) / maxAbs),
  }));
}

function heatCellColor(pnl: number, intensity: number) {
  if (pnl > 0) return intensity > 0.65 ? "rgba(163,255,18,0.78)" : "rgba(90,145,34,0.58)";
  if (pnl < 0) return intensity > 0.65 ? "rgba(255,59,95,0.70)" : "rgba(255,149,0,0.46)";
  return "rgba(255,255,255,0.065)";
}

function TerminalSessionIntelligence({ trades }: { trades: Trade[] }) {
  const [mode, setMode] = useState<SessionMode>("Hours");
  const [selected, setSelected] = useState<ReturnType<typeof buildSessionCells>[number] | null>(null);
  const cells = useMemo(() => buildSessionCells(trades, mode), [mode, trades]);

  return (
    <TerminalGlassCard>
      <View style={styles.terminalHeaderRow}>
        <View>
          <Text style={styles.terminalSectionTitle}>Heatmap</Text>
        </View>
      </View>
      <SegmentedTimeFilter options={SESSION_MODES} value={mode} onChange={(value) => setMode(value as SessionMode)} />
      <View style={styles.calendarHeatmapGrid}>
        {cells.length ? cells.map((cell) => (
          <Pressable key={cell.key} onPress={() => setSelected(cell)} style={[styles.calendarHeatmapCell, { backgroundColor: heatCellColor(cell.netPnl, cell.intensity) }]}>
            <Text style={styles.calendarHeatmapKey} numberOfLines={1}>{cell.key}</Text>
            <Text style={styles.calendarHeatmapValue} numberOfLines={1}>{cell.trades ? moneyCompact(cell.netPnl) : "—"}</Text>
            <Text style={styles.calendarHeatmapMeta}>{cell.trades} trades</Text>
          </Pressable>
        )) : (
          <Text style={styles.terminalSub}>Log trades to build session intelligence.</Text>
        )}
      </View>
      <BottomSheetPanel visible={!!selected} title={selected?.key || "Session"} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            <MetricPillRow
              items={[
                { label: "Trades", value: `${selected.trades}`, tone: "grey" },
                { label: "Win Rate", value: `${selected.winRate.toFixed(0)}%`, tone: selected.winRate >= 50 ? "green" : "red" },
                { label: "Profit", value: moneyCompact(selected.netPnl), tone: selected.netPnl >= 0 ? "green" : "red" },
                { label: "Avg", value: moneyCompact(selected.avgPnl), tone: "grey" },
              ]}
            />
            <Text style={styles.bottomSheetText}>Best setup: {selected.netPnl >= 0 ? "Repeat this window with strict checklist quality." : "Wait for cleaner context before sizing up."}</Text>
            <Text style={styles.bottomSheetText}>Mistakes: watch overtrading, weak notes and trades outside your best session.</Text>
          </>
        ) : null}
      </BottomSheetPanel>
    </TerminalGlassCard>
  );
}

function TerminalTraderStatus({
  achievements,
  level,
  trades,
  selectedDate,
  isPremium,
  session,
}: {
  achievements: Achievement[];
  level: TraderLevel;
  trades: Trade[];
  selectedDate: string;
  isPremium: boolean;
  session: Session | null;
}) {
  const [shareTarget, setShareTarget] = useState<Achievement | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const achievementShareRef = useRef<View>(null);
  const shareStats = useMemo(() => {
    const stats = calcStats(trades);
    return {
      tradesLogged: stats.count,
      winRate: stats.wr,
      totalPnl: stats.pnl,
      dateLabel: achievementShareDateLabel(selectedDate),
    };
  }, [selectedDate, trades]);
  const allUnlocked = achievements.filter((item) => item.unlocked);
  const freeUnlockLimitReached = !isPremium && allUnlocked.length > 5;
  const unlocked = isPremium ? allUnlocked : allUnlocked.slice(0, 5);
  const next = achievements.filter((item) => !item.unlocked).slice(0, 4);
  const waitForCard = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 220)));
    });
  const shareAchievement = async (item: Achievement) => {
    if (!item.unlocked) return;
    try {
      setShareBusy(true);
      await checkAndRecordAchievementShareUsage({ session, isPremium, achievement: item });
      setShareTarget(item);
      await waitForCard();
      const { shareCapturedView } = await import("./src/components/insights/shareExport");
      await shareCapturedView(achievementShareRef, "Share YouTrader achievement", { width: 1080, height: 1920 });
      trackEvent("achievement_share_generated", { achievement_id: item.id, achievement_title: item.title, is_pro: isPremium });
    } catch (error) {
      alertExportError("Achievement share failed", error);
      logger.error(error, { feature: "achievements", action: "terminal_share", userId: session?.user.id });
    } finally {
      setShareTarget(null);
      setShareBusy(false);
    }
  };
  return (
    <TerminalGlassCard>
      <View style={styles.traderStatusHero}>
        <View>
          <Text style={styles.traderRank}>{level.title}</Text>
          <Text style={styles.terminalSub}>{level.phrase}</Text>
        </View>
      </View>
      {shareBusy ? <ActivityIndicator color={C.green} style={{ marginVertical: 10 }} /> : null}
      <Text style={styles.terminalSmallLabel}>Unlocked</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementRail}>
        {unlocked.map((item) => (
          <Pressable key={item.id} onPress={() => shareAchievement(item)} style={styles.achievementRailCard}>
            <Text style={styles.achievementRailStatus}>Unlocked</Text>
            <Text style={styles.achievementRailTitle}>{item.title}</Text>
            <Text style={styles.achievementRailMeta}>{item.progressLabel}</Text>
            <Text style={styles.achievementRailTap}>Tap to share</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.terminalSmallLabel}>Next Targets</Text>
      <View style={styles.nextTargetList}>
        {next.map((item) => (
          <View key={item.id} style={styles.nextTargetRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextTargetTitle}>{item.title}</Text>
              <Text style={styles.terminalSub}>{item.condition}</Text>
            </View>
            <Text style={styles.nextTargetProgress}>{item.progressLabel}</Text>
          </View>
        ))}
      </View>
      {shareTarget ? (
        <View style={styles.offscreenShareCard} collapsable={false}>
          <View ref={achievementShareRef} collapsable={false} style={styles.achievementShareCaptureFrame}>
            <AchievementShareCard item={shareTarget} level={level} stats={shareStats} />
          </View>
        </View>
      ) : null}
    </TerminalGlassCard>
  );
}
function RadarProfile({
  winRate,
  profitFactor,
  avgWinLoss,
  recoveryFactor,
  drawdownControl,
  consistency,
  locked = false,
}: {
  winRate: number;
  profitFactor: number;
  avgWinLoss: number;
  recoveryFactor: number;
  drawdownControl: number;
  consistency: number;
  locked?: boolean;
}) {
  const size = 286;
  const center = size / 2;
  const maxR = 104;
  const minR = 22;

	  const axes = [
	    { label: "Win %", value: `${winRate.toFixed(0)}%`, score: Math.min(100, winRate) },
	    { label: "PF", value: profitFactor ? profitFactor.toFixed(2) : "—", score: Math.min(100, (profitFactor / 2.4) * 100) },
    { label: "Avg W/L", value: avgWinLoss ? avgWinLoss.toFixed(2) : "—", score: Math.min(100, (avgWinLoss / 2.4) * 100) },
    { label: "Recovery", value: recoveryFactor ? recoveryFactor.toFixed(2) : "—", score: Math.min(100, (Math.max(0, recoveryFactor) / 3.2) * 100) },
    { label: "Risk Ctrl", value: `${drawdownControl.toFixed(0)}%`, score: Math.min(100, Math.max(0, drawdownControl)) },
	    { label: "Consistency", value: `${consistency.toFixed(0)}%`, score: Math.min(100, consistency) },
	  ];
	  const scoreForAxis = (axis: { score: number }, i: number) => {
	    const score = locked && i > 1 ? Math.max(28, axis.score * 0.35) : axis.score;
	    return Math.max(0, Math.min(100, score));
	  };
	  const profileScore = Math.round(
	    axes.reduce((total, axis) => total + Math.max(0, Math.min(100, axis.score)), 0) /
	      axes.length,
	  );

	  const pts = axes.map((axis, i) => {
	    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / axes.length;
	    const r = minR + (scoreForAxis(axis, i) / 100) * (maxR - minR);
	    return {
      ...axis,
      angle,
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
      lx: center + Math.cos(angle) * (maxR + 31),
      ly: center + Math.sin(angle) * (maxR + 31),
    };
  });

  return (
    <View style={styles.radarOuter}>
      <View style={{ width: size, height: size }}>
        {[1, 2, 3, 4].map((ring) => (
          <View
            key={ring}
            style={{
              position: "absolute",
              left: center - (maxR * ring) / 4,
              top: center - (maxR * ring) / 4,
              width: (maxR * ring * 2) / 4,
              height: (maxR * ring * 2) / 4,
              borderRadius: (maxR * ring) / 4,
              borderWidth: 1,
              borderColor: "rgba(176,38,255,0.22)",
            }}
          />
        ))}

	        {pts.map((pt, i) => (
	          <View
            key={`axis-${i}`}
            style={{
              position: "absolute",
              left: center,
              top: center,
              width: 1,
              height: maxR,
              backgroundColor: "rgba(176,38,255,0.2)",
              transform: [
                { rotate: `${(pt.angle + Math.PI / 2) * (180 / Math.PI)}deg` },
                { translateY: -maxR / 2 },
              ],
            }}
          />
        ))}

        {pts.map((pt, i) => {
          const next = pts[(i + 1) % pts.length];
          const dx = next.x - pt.x;
          const dy = next.y - pt.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View
              key={`line-${i}`}
              style={{
                position: "absolute",
                left: pt.x,
                top: pt.y,
                width: length,
                height: 5,
                borderRadius: 8,
                backgroundColor: locked && i > 1 ? "rgba(176,38,255,0.35)" : C.purple,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: "left center",
              }}
            />
          );
        })}

        {pts.map((pt, i) => (
          <View
            key={`point-${i}`}
            style={{
              position: "absolute",
              left: pt.x - 8,
              top: pt.y - 8,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: locked && i > 1 ? "rgba(163,255,18,0.35)" : C.green,
              borderWidth: 3,
              borderColor: C.purple,
            }}
	          />
	        ))}

	        <View style={styles.radarCenterBadge}>
	          <Text style={styles.radarCenterScore}>{locked ? "PRO" : profileScore}</Text>
	          <Text style={styles.radarCenterLabel}>PROFILE</Text>
	        </View>

	        {pts.map((pt, i) => (
          <View
            key={`label-${i}`}
            style={{
              position: "absolute",
              left: Math.max(0, Math.min(size - 82, pt.lx - 41)),
              top: Math.max(0, Math.min(size - 35, pt.ly - 17)),
              width: 82,
              alignItems: "center",
              opacity: locked && i > 1 ? 0.45 : 1,
            }}
          >
            <Text style={styles.radarLabel}>{pt.label}</Text>
            <Text style={[styles.radarValue, { color: i === 4 ? C.red : C.purple }]} numberOfLines={1}>
              {locked && i > 1 ? "PRO" : pt.value}
            </Text>
          </View>
        ))}

        {locked && (
          <View style={styles.radarLockLayer}>
            <Text style={styles.radarLockTitle}>PRO RADAR</Text>
            <Text style={styles.radarLockSub}>Unlock full profile</Text>
          </View>
	        )}
	      </View>
	      <View style={styles.profileMetricGrid}>
	        {axes.map((axis, i) => {
	          const lockedAxis = locked && i > 1;
	          const score = scoreForAxis(axis, i);
	          const color = lockedAxis ? C.purple : score >= 55 ? C.green : C.red;
	          return (
	            <View key={axis.label} style={styles.profileMetricCard}>
	              <View style={styles.profileMetricTop}>
	                <Text style={styles.profileMetricLabel}>{axis.label}</Text>
	                <Text style={[styles.profileMetricValue, { color }]}>
	                  {lockedAxis ? "PRO" : axis.value}
	                </Text>
	              </View>
	              <View style={styles.profileMetricTrack}>
	                <View style={[styles.profileMetricFill, { width: `${score}%`, backgroundColor: color }]} />
	              </View>
	            </View>
	          );
	        })}
	      </View>
	    </View>
	  );
	}



function TradeAnalysisCard({ result }: { result: TradeAnalysisResult }) {
  const sections = [
    { title: "Mistakes", tone: C.red, items: result.mistakes.map((item) => ({ title: item.title, body: item.evidence ? `${item.explanation} Evidence: ${item.evidence}` : item.explanation })) },
    { title: "Strengths", tone: C.green, items: result.strengths.map((item) => ({ title: item.title, body: item.evidence ? `${item.explanation} Evidence: ${item.evidence}` : item.explanation })) },
    { title: "Actions", tone: C.purple, items: result.recommendations.map((item) => ({ title: item.title, body: item.why ? `${item.action} Why: ${item.why}` : item.action })) },
  ];
  return (
    <>
      <GlassCard style={styles.aiAnalysisCard} intensity={42}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.aiAnalysisTitle}>AI Journal Review</Text>
            <Text style={styles.aiAnalysisSummary} numberOfLines={2}>{result.summary}</Text>
          </View>
          <Text style={styles.aiAnalysisSource}>SAVED</Text>
        </View>
        <View style={styles.aiInsightGrid}>
          {sections.map((section) => (
            <View key={section.title} style={styles.aiInsightSection}>
              <View style={styles.aiInsightHeader}>
                <View style={[styles.metricDot, { backgroundColor: section.tone }]} />
                <Text style={[styles.aiAnalysisHeading, { color: section.tone }]}>{section.title}</Text>
              </View>
              {section.items.slice(0, 3).map((item, index) => (
                <View key={`${section.title}-${index}`} style={styles.aiInsightRow}>
                  <Text style={styles.aiInsightIndex}>{index + 1}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.aiInsightTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.aiInsightBody} numberOfLines={2}>{item.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
        <Text style={[styles.sub, { marginTop: 10 }]} numberOfLines={2}>{result.disclaimer}</Text>
      </GlassCard>
      <PatternDetectiveCard result={result} />
    </>
  );
}

function PatternDetectiveCard({ result }: { result: TradeAnalysisResult }) {
  const [openAgents, setOpenAgents] = useState<Record<string, boolean>>({ riskAgent: true, propFirmAgent: true });
  const agentRows: Array<{ key: keyof typeof result.agentFindings; title: string; tone: string }> = [
    { key: "riskAgent", title: "Risk Agent", tone: C.red },
    { key: "disciplineAgent", title: "Discipline Agent", tone: C.yellow },
    { key: "propFirmAgent", title: "Prop Firm Agent", tone: C.green },
    { key: "sessionAgent", title: "Session Agent", tone: C.purple },
    { key: "psychologyAgent", title: "Psychology Agent", tone: C.yellow },
    { key: "instrumentAgent", title: "Instrument Agent", tone: C.green },
    { key: "streakAgent", title: "Streak Agent", tone: C.red },
    { key: "executionAgent", title: "Execution Agent", tone: C.purple },
    { key: "consistencyAgent", title: "Consistency Agent", tone: C.green },
  ];
  const toggleAgent = (key: string, title: string) => {
    setOpenAgents((current) => ({ ...current, [key]: !current[key] }));
    trackEvent("ai_pattern_card_opened", { agent: title });
  };
  return (
    <GlassCard style={styles.detectiveCard} intensity={42}>
      <View style={styles.detectiveHero}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.detectiveTitle}>Your journal is exposing hidden patterns.</Text>
        </View>
        <View style={styles.detectiveScoreBox}>
          <Text style={styles.edgeMiniLabel}>Score</Text>
          <Text style={styles.detectiveScore}>{result.detectiveScore}</Text>
        </View>
      </View>

      <View style={styles.detectiveBlindSpot}>
        <Text style={styles.detectiveSectionLabel}>Main Blind Spot</Text>
        <Text style={styles.detectiveBlindTitle}>{result.mainBlindSpot.title}</Text>
        <Text style={styles.detectiveEvidence}>{result.mainBlindSpot.evidence}</Text>
        <Text style={styles.detectiveBody}>{result.mainBlindSpot.whyItMatters}</Text>
        <Text style={styles.detectiveAction}>{result.mainBlindSpot.action}</Text>
      </View>

      <Text style={styles.detectiveSectionLabel}>Hidden Patterns</Text>
      {result.hiddenPatterns.slice(0, 7).map((pattern, index) => {
        const impactColor = pattern.impact === "high" ? C.red : pattern.impact === "medium" ? C.yellow : C.green;
        return (
          <View key={`${pattern.title}-${index}`} style={styles.detectivePatternCard}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.detectivePatternTitle} numberOfLines={1}>{pattern.title}</Text>
                <Text style={styles.detectiveEvidence} numberOfLines={2}>{pattern.evidence}</Text>
              </View>
              <View style={[styles.detectiveImpactPill, { borderColor: impactColor }]}>
                <Text style={[styles.detectiveImpactText, { color: impactColor }]}>{pattern.impact}</Text>
              </View>
            </View>
            <Text style={styles.detectiveBody} numberOfLines={2}>{pattern.action}</Text>
            <Text style={styles.detectiveConfidence}>Confidence: {pattern.confidence.toUpperCase()}</Text>
          </View>
        );
      })}

      <Text style={styles.detectiveSectionLabel}>Agent Findings</Text>
      {agentRows.map((agent) => {
        const finding = result.agentFindings[agent.key];
        const isOpen = Boolean(openAgents[agent.key]);
        return (
          <Pressable
            key={agent.key}
            onPress={() => toggleAgent(agent.key, agent.title)}
            style={styles.detectiveAgentCard}
          >
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.detectiveAgentTitle, { color: agent.tone }]} numberOfLines={1}>{agent.title}</Text>
                <Text style={styles.detectivePatternTitle} numberOfLines={1}>{finding.finding}</Text>
              </View>
              <Text style={styles.detectiveChevron}>{isOpen ? "-" : "+"}</Text>
            </View>
            {isOpen ? (
              <View style={styles.detectiveAgentBody}>
                <Text style={styles.detectiveEvidence}>{finding.evidence}</Text>
                <Text style={styles.detectiveAction}>{finding.action}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}

      <View style={styles.detectiveRuleCard}>
        <Text style={styles.detectiveSectionLabel}>Next Trading Rule</Text>
        <Text style={styles.detectiveRuleText}>{result.nextTradingRule}</Text>
      </View>
    </GlassCard>
  );
}

function TradingScoreCard({ score }: { score: TradingScoreResult }) {
  return (
    <GlassCard style={styles.tradingScoreHeroCard} intensity={38}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.scoreLabel}>Trading Score</Text>
          <Text style={styles.scoreHeroNumber}>{score.score}</Text>
        </View>
        <View style={styles.scoreGradePill}>
          <Text style={styles.scoreGradeText}>Grade {score.grade}</Text>
          <Text style={styles.scorePercentile}>{score.percentileLabel}</Text>
        </View>
      </View>
      <View style={styles.scoreInsightRow}>
        <View style={styles.scoreInsightBox}>
          <Text style={styles.edgeMiniLabel}>Strength</Text>
          <Text style={styles.scoreInsightText}>{score.strengths[0] || "Keep building your sample."}</Text>
        </View>
        <View style={styles.scoreInsightBox}>
          <Text style={styles.edgeMiniLabel}>Focus</Text>
          <Text style={styles.scoreInsightText}>{score.weaknesses[0] || "Maintain consistency."}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

function TradingScoreMini({ score, label = "Trading Score" }: { score: TradingScoreResult; label?: string }) {
  return (
    <View style={styles.tradingScoreMini}>
      <Text style={styles.tradingScoreMiniLabel}>{label}</Text>
      <Text style={styles.tradingScoreMiniValue}>{score.score}</Text>
      <Text style={styles.tradingScoreMiniSub}>{score.grade}</Text>
    </View>
  );
}

function PatternDetectionCard({ result, locked }: { result: PatternDetectionResult; locked: boolean }) {
  const renderInsight = (item: PatternDetectionResult["strengths"][number], index: number) => {
    const color = item.tone === "green" ? C.green : item.tone === "red" ? C.red : C.purple;
    return (
      <View key={`${item.title}-${index}`} style={styles.patternInsightCard}>
        <View style={[styles.metricDot, { backgroundColor: color }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.patternInsightTitle}>{locked && index > 0 ? "Pro Pattern" : item.title}</Text>
          <Text style={styles.patternInsightText}>{locked && index > 0 ? "Unlock Pro to reveal deeper pattern detection." : item.detail}</Text>
        </View>
      </View>
    );
  };
  return (
    <GlassCard style={styles.patternCard} intensity={34}>
      <View style={styles.rowBetween}>
        <Text style={styles.myStatsTitle}>Pattern Prediction</Text>
        {locked ? <Text style={styles.aiAnalysisSource}>PRO</Text> : <Text style={styles.aiAnalysisSource}>LIVE</Text>}
      </View>
      <Text style={styles.breakdownHint}>Top strength patterns</Text>
      {result.strengths.map(renderInsight)}
      <Text style={[styles.breakdownHint, { marginTop: 12 }]}>Top risk patterns</Text>
      {result.risks.map(renderInsight)}
      <View style={styles.patternOpportunity}>
        <Text style={styles.edgeMiniLabel}>Top Opportunity</Text>
        <Text style={styles.scoreInsightText}>{locked ? "Unlock Pro to see the highest-impact improvement." : result.opportunity.detail}</Text>
      </View>
    </GlassCard>
  );
}

function formatCoachStatus(value: string) {
  return value.replace(/_/g, " ");
}

function PassProbabilityCard({ result }: { result: PassProbabilityResult }) {
  const statusColor =
    result.status === "EXCELLENT" || result.status === "ON_TRACK"
      ? C.green
      : result.status === "AT_RISK"
        ? C.yellow
        : C.red;
  return (
    <GlassCard style={styles.aiCoachModuleCard} intensity={34}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.edgeMiniLabel}>Pass Probability</Text>
          <Text style={[styles.survivalValue, { color: statusColor }]}>{result.probability}%</Text>
        </View>
        <View style={[styles.riskStatusPill, { borderColor: statusColor, backgroundColor: result.status === "DANGER" ? C.redSoft : result.status === "AT_RISK" ? C.yellowSoft : C.greenSoft }]}>
          <Text style={[styles.riskStatusText, { color: statusColor }]}>{formatCoachStatus(result.status)}</Text>
        </View>
      </View>
      <View style={styles.aiMetricExplainBox}>
        <Text style={styles.edgeMiniLabel}>What it means</Text>
        <Text style={styles.aiCompactText} numberOfLines={2}>{result.explanation}</Text>
      </View>
      <Text style={[styles.breakdownHint, { marginTop: 8 }]}>Confidence: {result.confidence}</Text>
    </GlassCard>
  );
}

function RevengeTradingCard({ result }: { result: RevengeTradingResult }) {
  const color = result.detected ? C.red : C.green;
  return (
    <GlassCard style={[styles.aiCoachModuleCard, result.detected && styles.revengeAlertCard]} intensity={34}>
      <View style={styles.rowBetween}>
        <Text style={[styles.aiModuleTitle, { color }]}>
          {result.detected ? "Revenge Trading Alert" : "Revenge Trading Check"}
        </Text>
        <View style={[styles.riskStatusPill, { borderColor: color, backgroundColor: result.detected ? C.redSoft : C.greenSoft }]}>
          <Text style={[styles.riskStatusText, { color }]}>{result.severity}</Text>
        </View>
      </View>
      <Text style={styles.aiCompactText} numberOfLines={2}>{result.reason}</Text>
      <View style={styles.patternOpportunity}>
        <Text style={styles.edgeMiniLabel}>Recommendation</Text>
        <Text style={styles.scoreInsightText} numberOfLines={2}>{result.recommendation}</Text>
      </View>
    </GlassCard>
  );
}

function HiddenLeaksCard({ leaks }: { leaks: HiddenLeak[] }) {
  return (
    <GlassCard style={styles.aiCoachModuleCard} intensity={34}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.aiModuleTitle}>Hidden Leaks</Text>
          <Text style={styles.breakdownHint}>Highest-impact behavior patterns to fix first</Text>
        </View>
        <Text style={styles.aiAnalysisSource}>LIVE</Text>
      </View>
      {leaks.length === 0 ? (
        <Text style={styles.aiCompactText}>More trade history is needed before patterns can be detected.</Text>
      ) : (
        leaks.map((leak, index) => (
          <View key={`${leak.title}-${index}`} style={styles.patternInsightCard}>
            <View style={[styles.metricDot, { backgroundColor: C.red }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.patternInsightTitle}>Leak #{index + 1}: {leak.title}</Text>
              <Text style={styles.patternInsightText} numberOfLines={1}>{leak.impact}</Text>
              <Text style={[styles.scoreInsightText, { marginTop: 6 }]} numberOfLines={2}>Action: {leak.recommendation}</Text>
            </View>
          </View>
        ))
      )}
    </GlassCard>
  );
}

type AchievementShareStats = {
  tradesLogged: number;
  winRate: number;
  totalPnl: number;
  dateLabel: string;
};

function achievementRarity(item: Achievement, level: TraderLevel): "COMMON" | "RARE" | "EPIC" | "LEGENDARY" {
  const title = item.title.toLowerCase();
  if (
    title.includes("apex") ||
    title.includes("five figure") ||
    title.includes("$10k") ||
    title.includes("funding hunter") ||
    level.score >= 95
  ) {
    return "LEGENDARY";
  }
  if (
    title.includes("elite") ||
    title.includes("risk master") ||
    title.includes("quant") ||
    title.includes("funded") ||
    level.score >= 90
  ) {
    return "EPIC";
  }
  if (title.includes("10 trades") || title.includes("$1k") || title.includes("sniper") || level.score >= 75) {
    return "RARE";
  }
  return "COMMON";
}

function achievementShareDateLabel(selectedDate: string) {
  const d = safeDateFromISO(selectedDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

function monthRangeIso(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function achievementShareUsageStorageKey(userId: string | null, date = new Date()) {
  const month = date.toISOString().slice(0, 7);
  return `achievement-share-usage:${userId || "local"}:${month}`;
}

async function checkAndRecordLocalAchievementShareUsage(limit: number, userId: string | null) {
  const key = achievementShareUsageStorageKey(userId);
  const raw = await AsyncStorage.getItem(key);
  const used = Number(raw || "0");
  if (Number.isFinite(used) && used >= limit) {
    throw new Error(limit > 5 ? "Your monthly achievement sharing allowance has been used." : "Free users can unlock and share 5 achievement cards. Upgrade to Pro.");
  }
  await AsyncStorage.setItem(key, String((Number.isFinite(used) ? used : 0) + 1));
}

async function checkAndRecordAchievementShareUsage({
  session,
  isPremium,
  achievement,
}: {
  session: Session | null;
  isPremium: boolean;
  achievement: Achievement;
}) {
  const limit = isPremium ? 15 : 5;
  if (!supabase || !session?.user.id) {
    await checkAndRecordLocalAchievementShareUsage(limit, session?.user.id || null);
    return;
  }
  const { start, end } = monthRangeIso();
  const { count, error: countError } = await supabase
    .from("achievement_share_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .gte("shared_at", start)
    .lt("shared_at", end);
  if (countError) {
    logger.warn("Falling back to local achievement share limits", { feature: "achievements", action: "share_limit_count", userId: session.user.id });
    await checkAndRecordLocalAchievementShareUsage(limit, session.user.id);
    return;
  }
  if ((count || 0) >= limit) {
    throw new Error(isPremium ? "Your monthly achievement sharing allowance has been used." : "Free users can unlock and share 5 achievement cards. Upgrade to Pro.");
  }
  const { error: insertError } = await supabase.from("achievement_share_usage").insert({
    user_id: session.user.id,
    achievement_id: achievement.id,
    achievement_title: achievement.title,
    is_pro_snapshot: isPremium,
  });
  if (insertError) {
    logger.warn("Falling back to local achievement share limits", { feature: "achievements", action: "share_limit_insert", userId: session.user.id });
    await checkAndRecordLocalAchievementShareUsage(limit, session.user.id);
  }
}

function rarityColor(rarity: ReturnType<typeof achievementRarity>) {
  if (rarity === "LEGENDARY") return "#FFD447";
  if (rarity === "EPIC") return "#B84DFF";
  if (rarity === "RARE") return "#5AD7FF";
  return "#B8FF00";
}

function prestigeStatement(item: Achievement) {
  const title = item.title.toLowerCase();
  if (title.includes("risk") || title.includes("discipline") || title.includes("rule")) return "Discipline over emotion.";
  if (title.includes("fund") || title.includes("evaluation")) return "Protect the account. Earn the next level.";
  if (title.includes("month") || title.includes("figure")) return "Consistency compounds when it is tracked.";
  return "Discipline creates consistency.";
}

function AchievementShareCard({
  item,
  level,
  stats,
}: {
  item: Achievement;
  level: TraderLevel;
  stats: AchievementShareStats;
}) {
  const rarity = achievementRarity(item, level);
  const rarityAccent = rarityColor(rarity);
  const title = item.title.toUpperCase();
  const isFundingBadge = item.title.toLowerCase().includes("fund");
  const particles = Array.from({ length: 34 }, (_, index) => ({
    left: 52 + ((index * 89) % 980),
    top: 190 + ((index * 137) % 1450),
    size: 3 + (index % 4),
    opacity: 0.16 + (index % 5) * 0.07,
  }));
  return (
    <View style={styles.achievementShareCard}>
      <View style={styles.shareGlowGreen} />
      <View style={styles.shareGlowPurple} />
      <View style={styles.shareGlowTopLine} />
      {particles.map((particle, index) => (
        <View
          key={`particle-${index}`}
          style={[
            styles.shareParticle,
            {
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              borderRadius: particle.size / 2,
              opacity: particle.opacity,
            },
          ]}
        />
      ))}
      <Svg width={1080} height={1920} style={styles.shareSvgBackdrop}>
        <Defs>
          <LinearGradient id="candleGlow" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#B8FF00" stopOpacity="0.38" />
            <Stop offset="1" stopColor="#B84DFF" stopOpacity="0.18" />
          </LinearGradient>
        </Defs>
        {Array.from({ length: 28 }, (_, index) => {
          const x = 40 + index * 38;
          const h = 42 + ((index * 31) % 160);
          const y = 1640 - h / 2 + ((index % 3) * 26);
          return (
            <React.Fragment key={`candle-bg-${index}`}>
              <Line x1={x + 8} y1={y - 30} x2={x + 8} y2={y + h + 30} stroke="url(#candleGlow)" strokeWidth="3" opacity="0.26" />
              <Rect x={x} y={y} width="16" height={h} rx="5" fill="url(#candleGlow)" opacity="0.22" />
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={styles.shareCardFrame}>
        <View style={styles.shareBrandRow}>
          <View style={styles.shareCandleMark}>
            <View style={[styles.shareCandle, { height: 46, backgroundColor: C.green }]} />
            <View style={[styles.shareCandle, { height: 64, backgroundColor: C.purple }]} />
            <View style={[styles.shareCandle, { height: 54, backgroundColor: C.green }]} />
          </View>
          <View>
            <Text style={styles.shareBrandText}>YouTrader</Text>
            <Text style={styles.shareBrandSub}>TRADE. ANALYZE. IMPROVE.</Text>
          </View>
        </View>
        <Text style={styles.shareUnlockedText}>ACHIEVEMENT UNLOCKED</Text>
        <View style={[styles.shareBadgeStage, isFundingBadge && styles.shareBadgeStageShield]}>
          <View style={styles.shareBadgeHalo} />
          <View style={styles.shareBadgeOrbitOne} />
          <View style={styles.shareBadgeOrbitTwo} />
          <Svg width={560} height={560} style={styles.shareBadgeSvg}>
            <Defs>
              <LinearGradient id="hexMain" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#9CFF00" stopOpacity="0.96" />
                <Stop offset="0.52" stopColor="#101418" stopOpacity="0.98" />
                <Stop offset="1" stopColor="#8A2BE2" stopOpacity="0.94" />
              </LinearGradient>
              <LinearGradient id="hexGlass" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.42" />
                <Stop offset="0.42" stopColor="#9CFF00" stopOpacity="0.2" />
                <Stop offset="1" stopColor="#8A2BE2" stopOpacity="0.42" />
              </LinearGradient>
            </Defs>
            {isFundingBadge ? (
              <>
                <Polygon points="280,18 490,102 458,346 280,536 102,346 70,102" fill="url(#hexMain)" opacity="0.94" />
                <Polygon points="280,54 456,126 430,326 280,492 130,326 104,126" fill="#05070A" opacity="0.78" />
                <Polygon points="280,84 426,144 404,308 280,452 156,308 134,144" fill="url(#hexGlass)" opacity="0.34" />
              </>
            ) : (
              <>
                <Polygon points="280,24 502,150 502,410 280,536 58,410 58,150" fill="url(#hexMain)" opacity="0.94" />
                <Polygon points="280,54 474,166 474,394 280,506 86,394 86,166" fill="#05070A" opacity="0.78" />
                <Polygon points="280,78 452,178 452,382 280,482 108,382 108,178" fill="url(#hexGlass)" opacity="0.34" />
              </>
            )}
            <Circle cx="280" cy="280" r="184" fill="#000000" opacity="0.26" />
            <Circle cx="280" cy="280" r="222" fill="none" stroke="#9CFF00" strokeWidth="3" opacity="0.3" />
            <Circle cx="280" cy="280" r="250" fill="none" stroke="#8A2BE2" strokeWidth="3" opacity="0.24" />
            <Line x1="88" y1="164" x2="472" y2="396" stroke="#9CFF00" strokeWidth="3" opacity="0.28" />
            <Line x1="472" y1="164" x2="88" y2="396" stroke="#8A2BE2" strokeWidth="3" opacity="0.28" />
            <Line x1="158" y1="280" x2="402" y2="280" stroke="#FFFFFF" strokeWidth="2" opacity="0.16" />
            <Line x1="280" y1="126" x2="280" y2="434" stroke="#FFFFFF" strokeWidth="2" opacity="0.14" />
          </Svg>
          <View style={[styles.shareLogoOrb, isFundingBadge && styles.shareLogoOrbShield]}>
            <Image source={YOU_TRADER_BULL_LOGO} style={styles.shareLogoImage} resizeMode="cover" />
            <View style={styles.shareLogoShine} />
          </View>
          <View style={styles.shareHudRail}>
            <View style={styles.shareHudTick} />
            <View style={[styles.shareHudTick, styles.shareHudTickPurple]} />
            <View style={styles.shareHudTick} />
          </View>
        </View>
        <Text style={styles.shareBadgeTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.62}>{title}</Text>
        <Text style={styles.sharePrestigeText}>{prestigeStatement(item)}</Text>
        <View style={styles.shareMetricPanel}>
          <View style={styles.shareStatsGrid}>
            <View style={styles.shareStatGlass}>
              <Text style={styles.shareMetricLabel}>TRADES LOGGED</Text>
              <Text style={styles.shareMetricValue}>{stats.tradesLogged} / {Math.max(10, stats.tradesLogged)}</Text>
            </View>
            <View style={styles.shareStatGlass}>
              <Text style={styles.shareMetricLabel}>WIN RATE</Text>
              <Text style={styles.shareMetricValue}>{stats.winRate.toFixed(0)}%</Text>
            </View>
            <View style={styles.shareStatGlass}>
              <Text style={styles.shareMetricLabel}>P/L</Text>
              <Text style={[styles.shareMetricValue, { color: stats.totalPnl >= 0 ? "#9CFF00" : "#FF3B5F" }]}>{money(stats.totalPnl)}</Text>
            </View>
            <View style={styles.shareStatGlass}>
              <Text style={styles.shareMetricLabel}>DATE</Text>
              <Text style={styles.shareMetricValue}>{stats.dateLabel}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.shareRarityTag, { borderColor: rarityAccent, backgroundColor: `${rarityAccent}22` }]}>
          <Text style={[styles.shareRarityText, { color: rarityAccent }]}>{rarity}</Text>
        </View>
        <Text style={styles.shareMadeBy}>MADE BY A TRADER, FOR TRADERS</Text>
      </View>
    </View>
  );
}

function AchievementBadgeCard({ item, onShare }: { item: Achievement; onShare: (item: Achievement) => void }) {
  const pct = Math.max(0, Math.min(100, (item.progress / Math.max(1, item.target)) * 100));
  const unlocked = item.status === "unlocked";
  const next = item.status === "next_target";
  return (
    <Pressable
      disabled={!unlocked}
      onPress={() => onShare(item)}
      style={({ pressed }) => [styles.achievementStatusPressable, pressed && styles.achievementStatusPressed]}
    >
      <GlassCard
        compact
        style={[
          styles.achievementStatusItem,
          unlocked && styles.achievementStatusUnlocked,
          next && styles.achievementStatusNext,
        ]}
      >
      <View style={styles.safeRowBetween}>
        <SafeText style={[styles.achievementStatusTag, unlocked ? { color: C.green } : next ? { color: C.purple } : null]}>
          {unlocked ? "UNLOCKED" : next ? "NEXT TARGET" : "LOCKED"}
        </SafeText>
        <SafeText style={styles.achievementCategory}>{item.category.replace("_", " ").toUpperCase()}</SafeText>
      </View>
      <SafeText style={styles.achievementStatusTitle} lines={2}>{item.title}</SafeText>
      <SafeText style={styles.achievementCondition} lines={2}>{item.condition}</SafeText>
      <View style={styles.insightTrack}>
        <View style={[styles.insightFill, { width: `${pct}%`, backgroundColor: unlocked ? C.green : next ? C.purple : "rgba(165,173,186,0.42)" }]} />
      </View>
      <View style={styles.achievementFooterRow}>
        <SafeText style={styles.achievementProgress}>{item.progressLabel}</SafeText>
        <SafeMetricLabel style={styles.achievementShareHint}>{unlocked ? "Tap to share" : item.metricLabel}</SafeMetricLabel>
      </View>
      </GlassCard>
    </Pressable>
  );
}

function AchievementSection({
  achievements,
  level,
  trades,
  selectedDate,
  isPremium,
  session,
}: {
  achievements: Achievement[];
  level: TraderLevel;
  trades: Trade[];
  selectedDate: string;
  isPremium: boolean;
  session: Session | null;
}) {
  const [shareTarget, setShareTarget] = useState<Achievement | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const achievementShareRef = useRef<View>(null);
  const shareStats = useMemo(() => {
    const stats = calcStats(trades);
    return {
      tradesLogged: stats.count,
      winRate: stats.wr,
      totalPnl: stats.pnl,
      dateLabel: achievementShareDateLabel(selectedDate),
    };
  }, [selectedDate, trades]);
  const allUnlocked = achievements.filter((item) => item.unlocked);
  const freeUnlockLimitReached = !isPremium && allUnlocked.length > 5;
  const unlocked = isPremium ? allUnlocked : allUnlocked.slice(0, 5);
  const nextTargets = achievements.filter((item) => !item.unlocked && item.status === "next_target").slice(0, 4);
  const locked = achievements.filter((item) => !item.unlocked && item.status === "locked").slice(0, Math.max(0, 4 - nextTargets.length));
  const waitForCard = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 220)));
    });
  const shareAchievement = async (item: Achievement) => {
    try {
      setShareBusy(true);
      await checkAndRecordAchievementShareUsage({ session, isPremium, achievement: item });
      setShareTarget(item);
      await waitForCard();
      const { shareCapturedView } = await import("./src/components/insights/shareExport");
      await shareCapturedView(achievementShareRef, "Share YouTrader achievement", { width: 1080, height: 1920 });
      trackEvent("achievement_share_generated", { achievement_id: item.id, achievement_title: item.title, is_pro: isPremium });
    } catch (error) {
      alertExportError("Achievement share failed", error);
      logger.error(error, { feature: "achievements", action: "share", userId: session?.user.id });
    } finally {
      setShareTarget(null);
      setShareBusy(false);
    }
  };
  return (
    <GlassCard style={styles.achievementCard} intensity={34}>
      <View style={styles.safeRowBetween}>
        <View style={styles.flexShrink}>
          <SafeText style={styles.myStatsTitle}>Trader Status</SafeText>
          <SafeText style={styles.breakdownHint}>Share-worthy badges from real journal data</SafeText>
        </View>
      </View>
      <View style={styles.traderLevelHero}>
        <View style={styles.flexShrink}>
          <SafeText style={styles.traderLevelLabel}>Current Trader Level</SafeText>
          <SafeText style={styles.traderLevelTitle}>{level.title}</SafeText>
          <SafeText style={styles.traderLevelPhrase} lines={2}>{level.phrase}</SafeText>
        </View>
        <View style={styles.traderLevelScoreBox}>
          <SafeMetricLabel style={styles.traderLevelScoreLabel}>Score</SafeMetricLabel>
          <SafeText style={styles.traderLevelScore}>{level.score}</SafeText>
          <SafeText style={styles.traderLevelTop}>{level.topLabel}</SafeText>
        </View>
      </View>
      {shareBusy ? <ActivityIndicator color={C.green} style={{ marginVertical: 10 }} /> : null}
      {unlocked.length ? (
        <>
          <Text style={styles.achievementSectionLabel}>Unlocked Status Badges</Text>
          <View style={styles.achievementGrid}>
            {unlocked.map((item) => <AchievementBadgeCard key={item.id} item={item} onShare={shareAchievement} />)}
          </View>
          {freeUnlockLimitReached ? (
            <Text style={styles.breakdownEmptyText}>Free users can unlock and share 5 achievement cards. Upgrade to Pro.</Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.breakdownEmptyText}>Keep logging trades to unlock your first trader-status badge.</Text>
      )}
      <Text style={styles.achievementSectionLabel}>Next Targets</Text>
      <View style={styles.achievementGrid}>
        {[...nextTargets, ...locked].map((item) => <AchievementBadgeCard key={item.id} item={item} onShare={shareAchievement} />)}
      </View>
      {shareTarget ? (
        <View style={styles.offscreenShareCard} collapsable={false}>
          <View ref={achievementShareRef} collapsable={false} style={styles.achievementShareCaptureFrame}>
            <AchievementShareCard item={shareTarget} level={level} stats={shareStats} />
          </View>
        </View>
      ) : null}
    </GlassCard>
  );
}

function heatmapColor(cell: HourHeatmapCell) {
  if (!cell.tradeCount) return "rgba(255,255,255,0.032)";
  if (cell.pnl <= -500) return "rgba(255,59,95,0.72)";
  if (cell.pnl < 0) return "rgba(255,59,95,0.34)";
  if (cell.winRate < 50) return "rgba(255,159,10,0.34)";
  if (cell.pnl < 1000) return "rgba(150,255,0,0.24)";
  return "rgba(91,176,0,0.56)";
}

function SessionHeatmapCard({ cells }: { cells: HourHeatmapCell[] }) {
  const tradedCells = cells.filter((cell) => cell.tradeCount > 0);
  const best = [...tradedCells].sort((a, b) => b.pnl - a.pnl)[0];
  const losingCells = tradedCells.filter((cell) => cell.pnl < 0);
  const worst = [...(losingCells.length ? losingCells : tradedCells)].sort((a, b) => a.pnl - b.pnl)[0];
  const active = [...tradedCells].sort((a, b) => b.tradeCount - a.tradeCount)[0];
  return (
    <Card style={styles.heatmapCard}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.myStatsTitle}>Session Heatmap</Text>
          <Text style={styles.breakdownHint}>P&L, win rate, and trade volume by hour</Text>
        </View>
        <Text style={styles.heatmapTimeBadge}>6AM-8PM</Text>
      </View>
      <View style={styles.heatmapSummaryRow}>
        <View style={styles.heatmapSummaryBox}>
          <Text style={styles.edgeMiniLabel}>Best</Text>
          <Text style={styles.heatmapSummaryValue} numberOfLines={1}>{best ? `${best.label} ${moneyCompact(best.pnl)}` : "Need trades"}</Text>
        </View>
        <View style={styles.heatmapSummaryBox}>
          <Text style={styles.edgeMiniLabel}>Risk</Text>
          <Text style={[styles.heatmapSummaryValue, { color: worst && worst.pnl < 0 ? C.red : C.sub }]} numberOfLines={1}>
            {worst ? `${worst.label} ${moneyCompact(worst.pnl)}` : "Need trades"}
          </Text>
        </View>
        <View style={styles.heatmapSummaryBox}>
          <Text style={styles.edgeMiniLabel}>Volume</Text>
          <Text style={styles.heatmapSummaryValue} numberOfLines={1}>{active ? `${active.label} ${active.tradeCount}` : "Need trades"}</Text>
        </View>
      </View>
      <View style={styles.heatmapLegend}>
        <Text style={styles.heatmapLegendItem}>Loss leak</Text>
        <Text style={styles.heatmapLegendItem}>Weak win rate</Text>
        <Text style={styles.heatmapLegendItem}>Strong edge</Text>
      </View>
      <View style={styles.heatmapGrid}>
        {cells.map((cell) => (
          <View key={cell.hour} style={[styles.heatmapCell, { backgroundColor: heatmapColor(cell) }]}>
            <Text style={styles.heatmapLabel}>{cell.label}</Text>
            <Text style={styles.heatmapValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>
              {cell.tradeCount ? moneyCompact(cell.pnl) : "—"}
            </Text>
            {cell.tradeCount ? (
              <View style={styles.heatmapMetaRow}>
                <SafeText style={styles.heatmapMeta}>{cell.tradeCount} trades</SafeText>
                <SafeText style={styles.heatmapMetaPercent}>{cell.winRate.toFixed(0)}%</SafeText>
              </View>
            ) : (
              <SafeText style={styles.heatmapMeta}>0 trades</SafeText>
            )}
          </View>
        ))}
      </View>
    </Card>
  );
}

function Stats({
  trades,
  lang,
  selectedDate,
  isPremium,
  packages,
  storeProducts,
  purchaseBusy,
  paywallError,
  showRestorePurchases,
  onPurchase,
  onRestore,
  session,
}: {
  trades: Trade[];
  lang: Lang;
  selectedDate: string;
  isPremium: boolean;
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
  session: Session | null;
}) {
  const visibleTrades = trades;
  const s = useMemo(() => calcStats(visibleTrades), [visibleTrades]);
  const consistency = s.consistency;
  const recoveryFactor = s.recoveryFactor;
  const drawdownControl = s.drawdownControl;
  const monthPnl = periodPnlFromTrades(visibleTrades, selectedDate, "month");
  const weekPnl = periodPnlFromTrades(visibleTrades, selectedDate, "week");

  return (
    <View style={styles.terminalScreenStack}>
      <TerminalEquitySection trades={visibleTrades} stats={s} weekPnl={weekPnl} monthPnl={monthPnl} />
      <StatsMetricDashboard
        stats={s}
        trades={visibleTrades}
        weekPnl={weekPnl}
        monthPnl={monthPnl}
        consistency={consistency}
        isPremium={isPremium}
      />
      <PremiumPerformanceRadar
        stats={s}
        consistency={consistency}
        recoveryFactor={recoveryFactor}
        drawdownControl={drawdownControl}
      />
      <TerminalSessionIntelligence trades={visibleTrades} />

      {!isPremium && (
        <PaywallPreview
          packages={packages}
          storeProducts={storeProducts}
          purchaseBusy={purchaseBusy}
          paywallError={paywallError}
          onPurchase={onPurchase}
          onRestore={onRestore}
          showRestorePurchases={showRestorePurchases}
        />
      )}
    </View>
  );
}

function StatsScreen({
  trades,
  lang,
  propTemplates,
  isPremium,
  packages,
  storeProducts,
  purchaseBusy,
  paywallError,
  showRestorePurchases,
  onPurchase,
  onRestore,
  session,
}: {
  trades: Trade[];
  lang: Lang;
  propTemplates: RiskTemplate[];
  isPremium: boolean;
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
  session: Session | null;
}) {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [selectedDate] = useState(todayISO());
  const [exportBusy, setExportBusy] = useState(false);
  const [shareCardMounted, setShareCardMounted] = useState(false);
  const [tradeAnalysisBusy, setTradeAnalysisBusy] = useState(false);
  const [tradeAnalysis, setTradeAnalysis] = useState<TradeAnalysisResult | null>(null);
  const [tradeAnalysisError, setTradeAnalysisError] = useState("");
  const shareCardRef = useRef<View>(null);
  const periodTrades = trades.filter((trade) => periodFilter(trade, selectedDate, period));
  const periodStats = useMemo(() => calcStats(periodTrades), [periodTrades]);
  const weekPnl = periodPnlFromTrades(trades, selectedDate, "week");
  const safePropTemplates = propTemplates.length ? propTemplates : FALLBACK_PROP_RULES;
  const [propTemplateKey, setPropTemplateKey] = useState(FALLBACK_PROP_RULES[0].key);
  const [propMode, setPropMode] = useState<FirmMode>("evaluation");
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("prop-risk-template-v1"),
      AsyncStorage.getItem("prop-risk-mode-v1"),
    ]).then(([savedTemplate, savedMode]) => {
      if (savedTemplate && safePropTemplates.some((template) => template.key === savedTemplate)) {
        setPropTemplateKey(savedTemplate);
      }
      if (savedMode === "evaluation" || savedMode === "funded") setPropMode(savedMode);
    });
  }, [safePropTemplates]);
  const propSnapshot = useMemo(
    () =>
      computePropRiskSnapshot({
        trades,
        selectedDate,
        templateKey: propTemplateKey,
        mode: propMode,
        templates: safePropTemplates,
      }),
    [trades, selectedDate, propTemplateKey, propMode, safePropTemplates],
  );

  const shareCardData = useMemo(
    () => ({
      periodLabel: `${period.toUpperCase()} • ${selectedDate}`,
      netPnl: periodStats.pnl,
      winRate: periodStats.wr,
      profitFactor: periodStats.pf,
      tradingScore: tradingScoreForTrades(periodTrades).score,
      dateLabel: achievementShareDateLabel(selectedDate),
      weekPnl,
      trades: periodStats.count,
      dailyBuffer: moneyCompact(propSnapshot.dailyRemaining),
      propStatus: `${propSnapshot.template.label} • ${propSnapshot.status}`,
    }),
    [period, selectedDate, periodStats, periodTrades, weekPnl, propSnapshot],
  );

  const waitForShareCardLayout = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  const runExport = async (action: "share" | "save" | "pdf") => {
    try {
      const limit = await checkClientRateLimit("export:generate", "stats-local");
      if (!limit.allowed) {
        Alert.alert("Export", SECURITY_MESSAGES.rateLimited);
        return;
      }
      setExportBusy(true);
      const { shareCapturedView, saveCapturedViewToPhotos, shareMonthlyPdfReport } = await import(
        "./src/components/insights/shareExport"
      );
      if (action === "share" || action === "save") {
        setShareCardMounted(true);
        await waitForShareCardLayout();
      }
      const exportKey = { action, period, selectedDate, count: periodTrades.length, pnl: periodStats.pnl };
      if (action === "share") {
        await runIdempotentLocal("export:generate", "stats-local", exportKey, () => shareCapturedView(shareCardRef));
        return;
      }
      if (action === "save") {
        await runIdempotentLocal("export:generate", "stats-local", exportKey, () => saveCapturedViewToPhotos(shareCardRef));
        Alert.alert("Saved", "P&L card saved to Photos.");
        return;
      }
      const monthTrades = trades.filter((trade) => periodFilter(trade, selectedDate, "month"));
      const monthStats = calcStats(monthTrades);
      const best = monthStats.weekday[0];
      const worst = [...monthStats.weekday].sort((a, b) => a.pnl - b.pnl)[0];
      const bestSession = monthStats.session[0];
      const worstSession = [...monthStats.session].sort((a, b) => a.pnl - b.pnl)[0];
      const monthScore = tradingScoreForTrades(monthTrades);
      const monthPatterns = detectTradingPatterns(monthTrades);
      const monthSurvival = calculatePropSurvival({
        consistency: monthStats.consistency,
        drawdown: monthStats.maxDd,
        dailyRemaining: propSnapshot.dailyRemaining,
        dailyLossLimit: propSnapshot.template.dailyLossLimit,
        accountRemaining: propSnapshot.accountRemaining,
        maxLossLimit: propSnapshot.template.maxLossLimit,
        expectancy: monthStats.exp,
        avgLoss: Math.abs(monthStats.avgLoss),
        lossStreak: Math.round(monthStats.avgLossStreak),
        dayPnl: propSnapshot.dayPnl,
      });
      const monthAchievements = calculateAchievements({
        trades: monthTrades,
        selectedDate,
        tradingScore: monthScore.score,
        winRate: monthStats.wr,
        profitFactor: monthStats.pf,
        riskControl: monthStats.drawdownControl,
        propSurvivalScore: monthSurvival.probability,
        propTargetRemainingPct:
          propSnapshot.template.evaluationTarget > 0
            ? (propSnapshot.remainingToPass / propSnapshot.template.evaluationTarget) * 100
            : 100,
        monthlyPnl: monthStats.pnl,
        bestMonthPnl: Math.max(0, monthStats.pnl),
        dailyLossLimit: propSnapshot.template.dailyLossLimit,
      }).filter((item) => item.unlocked).map((item) => item.title);
      const start = periodStart(safeDateFromISO(selectedDate), "month");
      const end = addDays(addMonths(start, 1), -1);
      await runIdempotentLocal("export:generate", "stats-local", exportKey, () => shareMonthlyPdfReport({
        title: "YouTrader Monthly Report",
        rangeLabel: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        netPnl: monthStats.pnl,
        winRate: monthStats.wr,
        profitFactor: monthStats.pf,
        trades: monthStats.count,
        expectancy: monthStats.exp,
        equityCurve: monthStats.curve,
        drawdown: monthStats.maxDd,
        consistency: monthStats.consistency,
        recoveryFactor: monthStats.recoveryFactor,
        riskControl: monthStats.drawdownControl,
        bestDay: best ? fullWeekdayName(best.label) : "—",
        worstDay: worst ? fullWeekdayName(worst.label) : "—",
        tradingScore: monthScore.score,
        grade: monthScore.grade,
        bestSession: bestSession?.label || "—",
        worstSession: worstSession?.label || "—",
        patternOpportunity: monthPatterns.opportunity.detail,
        achievementsEarned: monthAchievements,
        aiSummary: tradeAnalysis?.summary,
        nextFocus: monthScore.weaknesses[0] || monthPatterns.opportunity.detail,
      }));
    } catch (error) {
      alertExportError("Export failed", error);
    } finally {
      setShareCardMounted(false);
      setExportBusy(false);
    }
  };

  const runTradeAnalysis = async () => {
    if (!isPremium) {
      Alert.alert("YouTrader Pro", "AI Trade Analysis is included in YouTrader Pro.", [
        { text: "OK" },
        { text: "Unlock Pro", onPress: () => onPurchase(packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null, YOU_TRADER_MONTHLY_PRODUCT_ID) },
      ]);
      return;
    }
    if (!periodTrades.length) {
      Alert.alert("AI Trade Analysis", "Add trades first, then run analysis.");
      return;
    }
    try {
      setTradeAnalysisBusy(true);
      setTradeAnalysisError("");
      trackEvent("ai_trade_analysis_opened", { period, trade_count: periodTrades.length });
      const payload = buildTradeAnalysisPayload(periodTrades, periodStats, period, { propSnapshot });
      const result = await analyzeTrades(payload);
      setTradeAnalysis(result);
      trackEvent("ai_trade_analysis_generated", { period, source: "edge_function", trade_count: periodTrades.length });
      trackEvent("ai_pattern_detective_generated", {
        period,
        trade_count: periodTrades.length,
        detective_score: result.detectiveScore,
      });
      recordMetric("ai_trade_analysis_completed", 1, { source: "edge_function" });
    } catch (error) {
      trackEvent("ai_trade_analysis_failed", { period, trade_count: periodTrades.length });
      trackEvent("ai_pattern_detective_failed", { period, trade_count: periodTrades.length });
      logger.error(error, { feature: "ai_trade_analysis", action: "generate_failed", period });
      const fallback = buildLocalTradeAnalysisResult(periodStats, buildMistakePatterns(periodStats));
      setTradeAnalysis(fallback);
      setTradeAnalysisError("Cloud AI is unavailable right now. Generated a local journal analysis instead.");
    } finally {
      setTradeAnalysisBusy(false);
    }
  };

  const aiAnalysisBlock = (
    <>
      <Card>
        <Text style={styles.h2}>AI Trade Analysis</Text>
        <Text style={styles.sub}>Generate mistakes, strengths, and recommendations from the selected period.</Text>
        <Pressable
          disabled={tradeAnalysisBusy || !isPremium}
          onPress={runTradeAnalysis}
          style={[styles.secondaryBig, styles.purpleAction, (tradeAnalysisBusy || !isPremium) && styles.disabledBtn]}
        >
          <Text style={styles.secondaryText}>{tradeAnalysisBusy ? "Analyzing..." : "Analyze My Trades"}</Text>
        </Pressable>
        {tradeAnalysisError ? (
          <Text style={[styles.sub, { color: C.yellow, marginTop: 10 }]}>{tradeAnalysisError}</Text>
        ) : null}
        {tradeAnalysis ? (
          <Text style={[styles.sub, { color: C.green, marginTop: 10 }]}>Analysis ready below.</Text>
        ) : null}
      </Card>
      {tradeAnalysis ? <TradeAnalysisCard result={tradeAnalysis} /> : null}
    </>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: 46 }]}>
      <View style={[styles.segment, { marginTop: 0 }]}>
        {(["day", "week", "month", "year"] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => setPeriod(item)}
            style={[styles.segBtn, period === item && styles.segActive]}
          >
            <Text style={[styles.segText, period === item && styles.segTextActive]}>
              {item.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
      {isPremium ? (
        <View style={styles.statsActionsRow}>
          <Pressable
            disabled={exportBusy}
            onPress={() => runExport("share")}
            style={[styles.statsActionBtn, exportBusy && styles.disabledBtn]}
          >
            <Text style={styles.statsActionText}>Share P&L card</Text>
          </Pressable>
          <Pressable
            disabled={exportBusy}
            onPress={() => runExport("save")}
            style={[styles.statsActionBtn, exportBusy && styles.disabledBtn]}
          >
            <Text style={styles.statsActionText}>Save image</Text>
          </Pressable>
          <Pressable
            disabled={exportBusy}
            onPress={() => runExport("pdf")}
            style={[styles.statsActionBtn, exportBusy && styles.disabledBtn]}
          >
            <Text style={styles.statsActionText}>Monthly PDF</Text>
          </Pressable>
        </View>
      ) : null}
      {exportBusy ? <ActivityIndicator color={C.green} style={{ marginBottom: 10 }} /> : null}
      {shareCardMounted ? (
        <View style={styles.offscreenShareCard} collapsable={false}>
          <View ref={shareCardRef} collapsable={false}>
            <SharePnLCard data={shareCardData} />
          </View>
        </View>
      ) : null}
      <Stats
        trades={periodTrades}
        lang={lang}
        selectedDate={selectedDate}
        isPremium={isPremium}
        packages={packages}
        storeProducts={storeProducts}
        purchaseBusy={purchaseBusy}
        paywallError={paywallError}
        showRestorePurchases={showRestorePurchases}
        onPurchase={onPurchase}
        onRestore={onRestore}
        session={session}
      />
    </ScrollView>
  );
}

function buildAiCommandCenter({
  trades,
  propSnapshot,
  passProbability,
  revengeTrading,
  hiddenLeaks,
}: {
  trades: Trade[];
  propSnapshot: ReturnType<typeof computePropRiskSnapshot>;
  passProbability: PassProbabilityResult;
  revengeTrading: RevengeTradingResult;
  hiddenLeaks: HiddenLeak[];
}) {
  if (!trades.length) {
    return {
      title: "Build a clean trading sample",
      status: "SETUP",
      color: C.purple,
      softColor: C.purpleSoft,
      action: "Log each trade with entry time, exit time, symbol, result, and tags. The coach becomes useful once your journal has enough clean data.",
    };
  }

  const dailyRiskRatio = propSnapshot.dailyRemaining / Math.max(1, propSnapshot.template.dailyLossLimit);
  const accountRiskRatio = propSnapshot.accountRemaining / Math.max(1, propSnapshot.template.maxLossLimit);

  if (propSnapshot.status === "STOP" || (revengeTrading.detected && revengeTrading.severity === "HIGH")) {
    return {
      title: "Protect the account first",
      status: "STOP",
      color: C.red,
      softColor: C.redSoft,
      action: `${revengeTrading.detected ? revengeTrading.recommendation : "Stop trading today and switch to review-only mode."} Do not increase size while the account is under pressure.`,
    };
  }

  if (passProbability.status === "DANGER" || dailyRiskRatio <= 0.25 || accountRiskRatio <= 0.25) {
    return {
      title: "Evaluation is in danger mode",
      status: "DANGER",
      color: C.red,
      softColor: C.redSoft,
      action: "Cut risk, protect remaining buffer, and take only checklist-perfect setups. The goal is survival before progress.",
    };
  }

  if (propSnapshot.status === "CAUTION" || passProbability.status === "AT_RISK" || revengeTrading.detected) {
    return {
      title: "Trade smaller and slower",
      status: "CAUTION",
      color: C.yellow,
      softColor: C.yellowSoft,
      action: revengeTrading.detected
        ? revengeTrading.recommendation
        : "Keep size fixed, avoid chasing the pass target, and stop immediately if another loss reduces your daily buffer.",
    };
  }

  if (hiddenLeaks[0]) {
    return {
      title: "Clear conditions, one leak to watch",
      status: "CLEAR",
      color: C.green,
      softColor: C.greenSoft,
      action: hiddenLeaks[0].recommendation,
    };
  }

  if (passProbability.status === "EXCELLENT") {
    return {
      title: "Protect a strong pass path",
      status: "EXCELLENT",
      color: C.green,
      softColor: C.greenSoft,
      action: "Your pass path is strong. Keep size stable, avoid overtrading after green days, and protect the account buffer.",
    };
  }

  return {
    title: "Conditions are clear",
    status: "ON TRACK",
    color: C.green,
    softColor: C.greenSoft,
    action: "Trade only your best setups with fixed risk. The current plan is to preserve discipline and let expectancy work.",
  };
}

function FloatingPanel({
  enabled,
  children,
  delay = 0,
}: {
  enabled: boolean;
  children: React.ReactNode;
  delay?: number;
}) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      drift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(drift, { toValue: 1, duration: 3200, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 3200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, drift, enabled]);

  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  return <Animated.View style={enabled ? { transform: [{ translateY }] } : undefined}>{children}</Animated.View>;
}

function DailyCoachCard({
  trades,
  selectedDate,
  width,
}: {
  trades: Trade[];
  selectedDate: string;
  width?: number;
}) {
  const message = useMemo(() => {
    const selectedTrades = trades.filter((trade) => trade.date === selectedDate);
    const recent = [...trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    const selectedPnl = selectedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const recentLosses = recent.filter((trade) => trade.pnl < 0).length;
    const recentWins = recent.filter((trade) => trade.pnl > 0).length;
    const latestMistake = recent.find((trade) => /revenge|tilt|fomo|overtrade/i.test(`${trade.tags} ${trade.notes}`));

    if (!trades.length) {
      return {
        tone: "green" as const,
        title: "Daily Coach",
        body: "Log your first trade today. The coach will start reading your edge from real journal data.",
        action: "Start with one clean setup.",
      };
    }
    if (latestMistake) {
      return {
        tone: "red" as const,
        title: "Risk Coach",
        body: "Your recent journal mentions tilt, FOMO, overtrading or revenge risk.",
        action: "Cut size and wait for only A+ setups.",
      };
    }
    if (selectedTrades.length >= 3 && selectedPnl < 0) {
      return {
        tone: "red" as const,
        title: "Protect Today",
        body: "Today is red after multiple trades. The premium move is to stop digging.",
        action: "Review screenshots before adding another trade.",
      };
    }
    if (recentWins >= recentLosses && recentWins >= 4) {
      return {
        tone: "green" as const,
        title: "Edge Is Showing",
        body: "Recent trades are leaning green. Keep execution boring and avoid adding random size.",
        action: "Repeat your best setup, not every setup.",
      };
    }
    return {
      tone: "purple" as const,
      title: "Daily Coach",
      body: "Your journal has enough signal to keep the next trade simple.",
      action: "Define entry, invalidation and target before tapping save.",
    };
  }, [selectedDate, trades]);

  const glow = message.tone === "red" ? "red" : message.tone === "green" ? "green" : "purple";

  return (
    <PremiumGlassCard glow={glow} style={[styles.dailyCoachCard, width ? { width } : null]}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.dailyCoachTitle, { color: message.tone === "red" ? C.red : message.tone === "green" ? C.green : C.purple }]}>
            {message.title}
          </Text>
          <Text style={styles.dailyCoachBody}>{message.body}</Text>
        </View>
      </View>
      <Text style={styles.dailyCoachAction}>{message.action}</Text>
    </PremiumGlassCard>
  );
}

type AIResultMap = {
  dailyPlan: AIResponse<AIDailyPlan> | null;
  riskPredictor: AIResponse<AIRiskPredictor> | null;
  weeklyCoach: AIResponse<AIWeeklyCoach> | null;
  journalSummary: AIResponse<AIJournalSummary> | null;
  dailyChallenge: AIResponse<AIDailyChallenge> | null;
};

function ProviderBadge({ status }: { status: AIProviderStatus }) {
  const label =
    status === "nvidia"
      ? "NVIDIA"
      : status === "quota_exceeded"
        ? "LIMIT"
        : status === "free_preview"
          ? "PREVIEW"
          : "LOCAL";
  const color = status === "nvidia" ? C.green : status === "quota_exceeded" ? C.yellow : C.purple;
  return (
    <View style={[styles.aiProviderBadge, { borderColor: color, backgroundColor: `${color}18` }]}>
      <Text style={[styles.aiProviderBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

function AIResultCard({
  title,
  subtitle,
  response,
  loading,
  onRefresh,
  children,
}: {
  title: string;
  subtitle: string;
  response: AIResponse<any> | null;
  loading: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}) {
  return (
    <PremiumGlassCard glow={response?.providerStatus === "nvidia" ? "green" : "purple"} style={styles.aiCoachFeatureCard}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.aiModuleTitle}>{title}</Text>
          <Text style={styles.sub}>{subtitle}</Text>
        </View>
        {response ? <ProviderBadge status={response.providerStatus} /> : null}
      </View>
      <View style={styles.aiCoachResultBody}>{children}</View>
      {response?.message ? <Text style={styles.aiFallbackMessage}>{response.message}</Text> : null}
      {response?.generatedAt ? (
        <Text style={styles.aiGeneratedAt}>Generated {new Date(response.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
      ) : null}
      <Pressable disabled={loading} onPress={onRefresh} style={[styles.secondaryBig, styles.aiRefreshButton, loading && styles.disabledBtn]}>
        <Text style={styles.secondaryText}>{loading ? "Generating..." : response ? "Refresh" : "Generate"}</Text>
      </Pressable>
    </PremiumGlassCard>
  );
}

function BulletList({ items }: { items?: string[] }) {
  const visible = (items || []).slice(0, 4);
  return (
    <View style={styles.aiBulletList}>
      {visible.map((item, index) => (
        <Text key={`${item}-${index}`} style={styles.aiBulletText}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

function TerminalPatternDetective({
  stats,
}: {
  stats: ReturnType<typeof calcStats>;
}) {
  const rows = [
    { label: "Morning", data: stats.session.find((item) => item.label === "Morning") },
    { label: "Lunch", data: stats.session.find((item) => item.label === "Midday") },
    { label: "Power Hour", data: stats.session.find((item) => item.label === "Afternoon") },
    { label: "News", data: stats.weekday[0] },
  ];
  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSectionTitle}>Signal Timeline</Text>
      <View style={styles.patternTimeline}>
        {rows.map((row) => {
          const pnl = row.data?.pnl || 0;
          const winRate = row.data?.wr || 0;
          const confidence = Math.min(96, Math.max(42, Math.round((row.data?.count || 0) * 12 + Math.abs(winRate - 50))));
          return (
            <View key={row.label} style={styles.patternTimelineRow}>
              <Text style={styles.patternTimelineLabel}>{row.label}</Text>
              <View style={styles.patternTimelineTrack}>
                <View style={[styles.patternTimelineFill, { width: `${Math.min(100, Math.max(8, Math.abs(pnl) / Math.max(1, Math.abs(stats.pnl)) * 100))}%`, backgroundColor: pnl >= 0 ? C.green : C.red }]} />
              </View>
              <Text style={[styles.patternTimelineValue, { color: pnl >= 0 ? C.green : C.red }]}>{confidence}%</Text>
            </View>
          );
        })}
      </View>
    </TerminalGlassCard>
  );
}

function TerminalTradingCoach({
  aiResults,
  stats,
}: {
  aiResults: AIResultMap;
  stats: ReturnType<typeof calcStats>;
}) {
  const daily = aiResults.dailyPlan?.data;
  const weekly = aiResults.weeklyCoach?.data;
  const challenge = aiResults.dailyChallenge?.data;
  const focusScore = Math.max(35, Math.min(95, Math.round(stats.wr * 0.45 + Math.min(stats.pf, 3) * 16 + (stats.exp > 0 ? 12 : 0))));
  return (
    <TerminalGlassCard>
      <View style={styles.aiCoachUnifiedRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.terminalSectionTitle}>Today's Coaching</Text>
          <Text style={styles.aiCoachVoice}>{weekly?.coachMessage || daily?.coachMessage || "Protect clean execution. Trade less, but with better rules."}</Text>
          <Text style={styles.terminalSmallLabel}>Next improvement</Text>
          <Text style={styles.aiCoachNext}>{challenge?.challengeTitle || "Reduce size after emotional trades."}</Text>
        </View>
        <AppleRing label="Focus" value={focusScore} display={`${focusScore}`} size={112} color={C.green} />
      </View>
      <Text style={styles.terminalSmallLabel}>Action Plan</Text>
      <BulletList items={daily?.tradeRules || weekly?.nextWeekFocus || ["Trade only best session", "Stop after rule breaks", "Journal every trade with reason"]} />
    </TerminalGlassCard>
  );
}

function TerminalPropFirmMission({
  propSnapshot,
  passProbability,
}: {
  propSnapshot: ReturnType<typeof computePropRiskSnapshot>;
  passProbability: PassProbabilityResult;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const maxContracts = propSnapshot.mode === "funded" ? propSnapshot.template.liveContracts : propSnapshot.template.evaluationContracts;
  const bufferRatio = propSnapshot.accountRemaining / Math.max(1, propSnapshot.template.maxLossLimit);
  const contractPlan =
    bufferRatio < 0.5 || propSnapshot.status !== "CLEAR"
      ? `Use micro contracts or 1-${Math.max(1, Math.ceil(maxContracts / 3))} contracts until buffer recovers.`
      : `Firm cap is ${maxContracts}. Keep size stable; do not jump contracts after green trades.`;
  return (
    <TerminalGlassCard>
      <View style={styles.terminalHeaderRow}>
        <View>
          <Text style={styles.terminalSectionTitle}>Eval</Text>
          <Text style={styles.terminalSub}>{propSnapshot.template.label}</Text>
        </View>
        <AppleRing label="PASS" value={passProbability.probability} display={`${passProbability.probability}%`} size={118} color={passProbability.probability >= 70 ? C.green : C.yellow} />
      </View>
      <MetricPillRow
        items={[
          { label: "Daily Buffer", value: moneyCompact(propSnapshot.dailyRemaining), tone: propSnapshot.dailyRemaining > 0 ? "green" : "red" },
          { label: "Account Buffer", value: moneyCompact(propSnapshot.accountRemaining), tone: propSnapshot.accountRemaining > 0 ? "green" : "red" },
          { label: "To Pass", value: moneyCompact(propSnapshot.remainingToPass), tone: propSnapshot.remainingToPass > 0 ? "purple" : "green" },
          { label: "Daily Limit", value: moneyCompact(propSnapshot.template.dailyLossLimit), tone: "grey" },
          { label: "Max Loss", value: moneyCompact(propSnapshot.template.maxLossLimit), tone: "grey" },
          { label: "Contracts", value: `${maxContracts} max`, tone: "purple" },
        ]}
      />
      <Pressable onPress={() => setDetailsOpen(true)} style={styles.missionCta}>
        <Text style={styles.missionCtaText}>Protect Pass Path</Text>
      </Pressable>
      <BottomSheetPanel visible={detailsOpen} title="Protect Pass Path" onClose={() => setDetailsOpen(false)}>
        <MetricPillRow
          items={[
            { label: "Pass", value: `${passProbability.probability}%`, tone: passProbability.probability >= 70 ? "green" : "purple" },
            { label: "Daily Buffer", value: moneyCompact(propSnapshot.dailyRemaining), tone: propSnapshot.dailyRemaining > 0 ? "green" : "red" },
            { label: "Account Buffer", value: moneyCompact(propSnapshot.accountRemaining), tone: propSnapshot.accountRemaining > 0 ? "green" : "red" },
          ]}
        />
        <Text style={styles.bottomSheetText}>1. Keep size stable while pass probability is strong.</Text>
        <Text style={styles.bottomSheetText}>2. Stop trading if daily buffer drops below 25%.</Text>
        <Text style={styles.bottomSheetText}>3. Protect the account buffer before chasing the remaining target.</Text>
        <Text style={styles.bottomSheetText}>Contract plan: {contractPlan}</Text>
      </BottomSheetPanel>
    </TerminalGlassCard>
  );
}

function TerminalMonthlyIntelligence({
  tradeAnalysis,
  patterns,
  stats,
}: {
  tradeAnalysis: TradeAnalysisResult | null;
  patterns: PatternDetectionResult;
  stats: ReturnType<typeof calcStats>;
}) {
  const bestDay = stats.weekday[0];
  const worstDay = [...stats.weekday].sort((a, b) => a.pnl - b.pnl)[0];
  const bestSession = stats.session[0];
  const worstSession = [...stats.session].sort((a, b) => a.pnl - b.pnl)[0];
  const rows = [
    { label: "Strength", value: tradeAnalysis?.strengths[0]?.title || patterns.strengths[0]?.title || "Best setup forming" },
    { label: "Mistake", value: tradeAnalysis?.mistakes[0]?.title || patterns.risks[0]?.title || "No major mistake detected" },
    { label: "Best Setup", value: stats.bySetup[0]?.label || "Add tags" },
    { label: "Worst Setup", value: [...stats.bySetup].sort((a, b) => a.pnl - b.pnl)[0]?.label || "—" },
    { label: "Best Day", value: bestDay ? fullWeekdayName(bestDay.label) : "—" },
    { label: "Worst Day", value: worstDay ? fullWeekdayName(worstDay.label) : "—" },
    { label: "Best Session", value: bestSession?.label || "—" },
    { label: "Weak Session", value: worstSession?.label || "—" },
  ];
  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSectionTitle}>Performance Intelligence</Text>
      <View style={styles.monthlyTimeline}>
        {rows.map((row, index) => (
          <View key={`${row.label}-${index}`} style={styles.monthlyTimelineRow}>
            <View style={styles.monthlyTimelineDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.terminalSmallLabel}>{row.label}</Text>
              <Text style={styles.monthlyTimelineValue}>{row.value}</Text>
            </View>
          </View>
        ))}
      </View>
    </TerminalGlassCard>
  );
}

function TerminalFundedPanel({
  snapshot,
  mode,
  onModeChange,
}: {
  snapshot: ReturnType<typeof computePropRiskSnapshot>;
  mode: FirmMode;
  onModeChange: (mode: FirmMode) => void;
}) {
  const isFunded = mode === "funded";
  const maxContracts = isFunded ? snapshot.template.liveContracts : snapshot.template.evaluationContracts;
  const riskPct = isFunded ? snapshot.template.liveRiskPct : snapshot.template.evaluationRiskPct;
  const modeLabel = isFunded ? "Funded" : "Evaluation";
  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSectionTitle}>{modeLabel}</Text>
      <Text style={styles.terminalSub}>
        {isFunded ? "Live account safety mode, buffers, and contract cap" : "Evaluation pass-path risk plan, buffers, and contract cap"}
      </Text>
      <View style={styles.propModeRail}>
        {(["evaluation", "funded"] as FirmMode[]).map((item) => {
          const active = item === mode;
          return (
            <Pressable
              key={item}
              onPress={() => onModeChange(item)}
              style={[styles.propModeChip, active && styles.propModeChipActive]}
            >
              <Text style={[styles.propModeChipText, active && styles.propModeChipTextActive]}>
                {item === "evaluation" ? "Evaluation" : "Funded"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <MetricPillRow
        items={[
          { label: "Daily Buffer", value: moneyCompact(snapshot.dailyRemaining), tone: snapshot.dailyRemaining > 0 ? "green" : "red" },
          { label: "Account Buffer", value: moneyCompact(snapshot.accountRemaining), tone: snapshot.accountRemaining > 0 ? "green" : "red" },
          { label: isFunded ? "Live Cap" : "To Pass", value: isFunded ? `${maxContracts} max` : moneyCompact(snapshot.remainingToPass), tone: isFunded ? "purple" : snapshot.remainingToPass <= 0 ? "green" : "purple" },
          { label: "Contracts", value: `${maxContracts} max`, tone: "purple" },
          { label: "Risk / Trade", value: `${Math.round(riskPct * 100)}%`, tone: "grey" },
          { label: "Status", value: snapshot.status, tone: snapshot.status === "CLEAR" ? "green" : snapshot.status === "STOP" ? "red" : "purple" },
        ]}
      />
      <Text style={styles.terminalSub}>
        {snapshot.status === "CLEAR"
          ? isFunded
            ? "Keep live size stable and protect buffers before increasing contracts."
            : "Keep evaluation size consistent and protect the pass path before increasing risk."
          : "Reduce size, protect remaining buffer, and trade only checklist-perfect setups."}
      </Text>
    </TerminalGlassCard>
  );
}

function AiAnalysisScreen({
  trades,
  propTemplates,
  isPremium,
  packages,
  storeProducts,
  purchaseBusy,
  paywallError,
  showRestorePurchases,
  onPurchase,
  onRestore,
  session,
}: {
  trades: Trade[];
  propTemplates: RiskTemplate[];
  isPremium: boolean;
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
  session: Session | null;
}) {
  const period: "month" = "month";
  const [selectedDate] = useState(todayISO());
  const [tradeAnalysisBusy, setTradeAnalysisBusy] = useState(false);
  const [tradeAnalysis, setTradeAnalysis] = useState<TradeAnalysisResult | null>(null);
  const [tradeAnalysisError, setTradeAnalysisError] = useState("");
  const [aiResults, setAiResults] = useState<AIResultMap>({
    dailyPlan: null,
    riskPredictor: null,
    weeklyCoach: null,
    journalSummary: null,
    dailyChallenge: null,
  });
  const [aiBusy, setAiBusy] = useState<Record<keyof AIResultMap, boolean>>({
    dailyPlan: false,
    riskPredictor: false,
    weeklyCoach: false,
    journalSummary: false,
    dailyChallenge: false,
  });
  const safeAnalysisTemplates = propTemplates.length ? propTemplates : FALLBACK_PROP_RULES;
  const [analysisTemplateKey, setAnalysisTemplateKey] = useState(FALLBACK_PROP_RULES[0].key);
  const [propMode, setPropMode] = useState<FirmMode>("evaluation");

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("prop-risk-template-v1"),
      AsyncStorage.getItem("prop-risk-mode-v1"),
    ]).then(([savedTemplate, savedMode]) => {
      if (savedTemplate && safeAnalysisTemplates.some((template) => template.key === savedTemplate)) {
        setAnalysisTemplateKey(savedTemplate);
      }
      if (savedMode === "evaluation" || savedMode === "funded") setPropMode(savedMode);
    });
  }, [safeAnalysisTemplates]);
  const changeAnalysisTemplate = useCallback((key: string) => {
    setAnalysisTemplateKey(key);
    AsyncStorage.setItem("prop-risk-template-v1", key).catch(() => {});
  }, []);
  const changePropMode = useCallback((mode: FirmMode) => {
    setPropMode(mode);
    AsyncStorage.setItem("prop-risk-mode-v1", mode).catch(() => {});
  }, []);

  const periodTrades = trades.filter((trade) => periodFilter(trade, selectedDate, period));
  const periodStats = useMemo(() => calcStats(periodTrades), [periodTrades]);
  const tradingScore = useMemo(() => tradingScoreForTrades(periodTrades), [periodTrades]);
  const patterns = useMemo(() => detectTradingPatterns(periodTrades), [periodTrades]);
  const activeTemplate =
    safeAnalysisTemplates.find((template) => template.key === analysisTemplateKey) ||
    safeAnalysisTemplates[0] ||
    FALLBACK_PROP_RULES[0];
  const propSnapshot = useMemo(
    () =>
      computePropRiskSnapshot({
        trades,
        selectedDate,
        templateKey: activeTemplate.key,
        mode: "evaluation",
        templates: safeAnalysisTemplates,
      }),
    [trades, selectedDate, activeTemplate.key, safeAnalysisTemplates],
  );
  const fundedSnapshot = useMemo(
    () =>
      computePropRiskSnapshot({
        trades,
        selectedDate,
        templateKey: activeTemplate.key,
        mode: "funded",
        templates: safeAnalysisTemplates,
      }),
    [trades, selectedDate, activeTemplate.key, safeAnalysisTemplates],
  );
  const selectedPropSnapshot = propMode === "funded" ? fundedSnapshot : propSnapshot;
  const passProbability = useMemo(
    () => calculatePassProbability({ trades, selectedDate, template: activeTemplate }),
    [trades, selectedDate, activeTemplate],
  );
  const revengeTrading = useMemo(
    () => detectRevengeTrading({ trades, selectedDate, dangerMode: passProbability.status === "DANGER" }),
    [trades, selectedDate, passProbability.status],
  );
  const hiddenLeaks = useMemo(() => detectHiddenLeaks(trades), [trades]);
  const aiCoachPayload = useMemo(
    () => ({
      period,
      selectedDate,
      stats: periodStats,
      analyticsContext: buildAIAnalyticsContext(periodTrades),
      tradeAnalysisPayload: buildTradeAnalysisPayload(periodTrades, periodStats, period, { passProbability, propSnapshot }),
      propSnapshot,
      passProbability,
      revengeTrading,
      hiddenLeaks,
      recentTrades: trades
        .slice(0, 30)
        .map((trade) => ({
          date: trade.date,
          symbol: trade.symbol,
          direction: trade.direction,
          pnl: trade.pnl,
          mood: trade.mood,
          tags: trade.tags,
          notes: trade.notes ? trade.notes.slice(0, 220) : "",
        })),
    }),
    [hiddenLeaks, passProbability, periodStats, periodTrades, propSnapshot, revengeTrading, selectedDate, trades],
  );
  const achievementList = useMemo(
    () =>
      calculateAchievements({
        trades: periodTrades,
        selectedDate,
        tradingScore: tradingScore.score,
        winRate: periodStats.wr,
        profitFactor: periodStats.pf,
        riskControl: periodStats.drawdownControl,
        propSurvivalScore: passProbability.probability,
        propTargetRemainingPct:
          propSnapshot.template.evaluationTarget > 0
            ? (propSnapshot.remainingToPass / propSnapshot.template.evaluationTarget) * 100
            : 100,
        monthlyPnl: periodStats.pnl,
        bestMonthPnl: Math.max(0, periodStats.pnl),
        dailyLossLimit: propSnapshot.template.dailyLossLimit,
      }),
    [passProbability.probability, periodStats, periodTrades, propSnapshot, selectedDate, tradingScore.score],
  );
  const traderLevel = useMemo(() => traderLevelFromScore(tradingScore.score, selectedDate), [selectedDate, tradingScore.score]);

  const runCoachFeature = async (key: keyof AIResultMap) => {
    if (!isPremium) {
      warningHaptic();
      Alert.alert("YouTrader Pro", "NVIDIA AI coaching is included in YouTrader Pro.");
      return;
    }
    lightHaptic();
    setAiBusy((prev) => ({ ...prev, [key]: true }));
    try {
      const response =
        key === "dailyPlan"
          ? await fetchAIDailyPlan(aiCoachPayload)
          : key === "riskPredictor"
            ? await fetchAIRiskPredictor(aiCoachPayload)
            : key === "weeklyCoach"
              ? await fetchAIWeeklyCoach(aiCoachPayload)
              : key === "journalSummary"
                ? await fetchAIJournalSummary(aiCoachPayload)
                : await fetchAIDailyChallenge(aiCoachPayload);
      setAiResults((prev) => ({ ...prev, [key]: response }));
      trackEvent("ai_coach_feature_generated", {
        feature: key,
        provider_status: response.providerStatus,
        used_fallback: response.usedFallback,
      });
    } finally {
      setAiBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  const runTradeAnalysis = async () => {
    if (!isPremium) {
      Alert.alert("YouTrader Pro", "AI Trade Analysis is included in YouTrader Pro.", [
        { text: "OK" },
        { text: "Unlock Pro", onPress: () => onPurchase(packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null, YOU_TRADER_MONTHLY_PRODUCT_ID) },
      ]);
      return;
    }
    if (!periodTrades.length) {
      Alert.alert("AI Trade Analysis", "Add trades first, then run analysis.");
      return;
    }
    try {
      setTradeAnalysisBusy(true);
      setTradeAnalysisError("");
      trackEvent("ai_trade_analysis_opened", { period, trade_count: periodTrades.length });
      const payload = buildTradeAnalysisPayload(periodTrades, periodStats, period, { passProbability, propSnapshot });
      const result = await analyzeTrades(payload);
      setTradeAnalysis(result);
      trackEvent("ai_trade_analysis_generated", { period, source: "edge_function", trade_count: periodTrades.length });
      trackEvent("ai_pattern_detective_generated", {
        period,
        trade_count: periodTrades.length,
        detective_score: result.detectiveScore,
      });
      recordMetric("ai_trade_analysis_completed", 1, { source: "edge_function" });
    } catch (error) {
      trackEvent("ai_trade_analysis_failed", { period, trade_count: periodTrades.length });
      trackEvent("ai_pattern_detective_failed", { period, trade_count: periodTrades.length });
      logger.error(error, { feature: "ai_trade_analysis", action: "generate_failed", period });
      const fallback = buildLocalTradeAnalysisResult(periodStats, buildMistakePatterns(periodStats));
      setTradeAnalysis(fallback);
      setTradeAnalysisError("Cloud AI is unavailable right now. Generated a local journal analysis instead.");
    } finally {
      setTradeAnalysisBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: 46 }]}>
      <PropTemplateSelector
        templates={safeAnalysisTemplates}
        value={activeTemplate.key}
        onChange={changeAnalysisTemplate}
      />
      <View style={!isPremium ? styles.analysisLockedWrap : undefined}>
        <View pointerEvents={!isPremium ? "none" : "auto"} style={!isPremium ? styles.analysisLockedContent : undefined}>
          <View style={styles.terminalScreenStack}>
            <TerminalPropFirmMission propSnapshot={propSnapshot} passProbability={passProbability} />
            <TerminalTradingCoach aiResults={aiResults} stats={periodStats} />
            <TerminalPatternDetective stats={periodStats} />
            <TerminalMonthlyIntelligence tradeAnalysis={tradeAnalysis} patterns={patterns} stats={periodStats} />
            <TerminalFundedPanel snapshot={selectedPropSnapshot} mode={propMode} onModeChange={changePropMode} />
            <AchievementSection
              achievements={achievementList}
              level={traderLevel}
              trades={periodTrades}
              selectedDate={selectedDate}
              isPremium={isPremium}
              session={session}
            />
            {tradeAnalysisError ? <Text style={styles.aiSingleStatusNote}>{tradeAnalysisError}</Text> : null}
          </View>
        </View>
        {!isPremium ? (
          <View style={styles.analysisLockPinned}>
            <PremiumLockOverlay
              title="Unlock AI Analytics"
              subtitle="Reveal AI Coach, pass probability, hidden leaks, revenge trading alerts, prop firm insights and risk coaching."
              cta="Upgrade to Pro"
              secondary="See all features"
              onUpgrade={() => onPurchase(packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null, YOU_TRADER_MONTHLY_PRODUCT_ID)}
              onSecondary={() =>
                Alert.alert(
                  "YouTrader Pro features",
                  "AI Coach, Pass Probability, Hidden Leaks, Revenge Trading Alerts, Prop Firm Insights, Risk Coach, Advanced Stats, Performance Profile, premium exports and full calendar access.",
                )
              }
            />
          </View>
        ) : null}
      </View>

      {!isPremium && (
        <PaywallPreview
          packages={packages}
          storeProducts={storeProducts}
          purchaseBusy={purchaseBusy}
          paywallError={paywallError}
          onPurchase={onPurchase}
          onRestore={onRestore}
          showRestorePurchases={showRestorePurchases}
        />
      )}
    </ScrollView>
  );
}
function periodStart(date: Date, period: "day" | "week" | "month" | "year") {
  const d = new Date(date);
  if (period === "day")
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (period === "week") {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - x.getDay());
    return x;
  }
  if (period === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
  return new Date(d.getFullYear(), 0, 1);
}
function periodFilter(
  trade: Trade,
  selectedDate: string,
  period: "day" | "week" | "month" | "year",
) {
  const d = new Date(selectedDate + "T00:00:00");
  const start = periodStart(d, period);
  const end =
    period === "day"
      ? addDays(start, 1)
      : period === "week"
        ? addDays(start, 7)
        : period === "month"
          ? addMonths(start, 1)
          : new Date(start.getFullYear() + 1, 0, 1);
  const td = new Date(trade.date + "T00:00:00");
  return td >= start && td < end;
}

function InstrumentButton({
  symbol,
  active,
  onPress,
}: {
  symbol: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.instrumentBtn, active && styles.instrumentBtnActive]}
    >
      <Text style={styles.instrumentSymbol}>{symbol}</Text>
      <Text style={styles.instrumentName}>
        {INSTRUMENTS[symbol]?.name || symbol}
      </Text>
    </Pressable>
  );
}

function JournalScreen({
  lang,
  trades,
  propTemplates,
  setTrades,
  isPremium,
  onOpenPropRisk,
  onUpgrade,
  onTradeDeleted,
}: {
  lang: Lang;
  trades: Trade[];
  propTemplates: RiskTemplate[];
  setTrades: React.Dispatch<React.SetStateAction<Trade[]>>;
  isPremium: boolean;
  onOpenPropRisk: (date: string) => void;
  onUpgrade: () => void;
  onTradeDeleted: (tradeId: string) => void;
}) {
  const t = (k: string) => tText(lang, k);
  const { width } = useWindowDimensions();
  const isTabletLayout = width >= 768;
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [audioReady, setAudioReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [viewMonth, setViewMonth] = useState(new Date());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [photoView, setPhotoView] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [pnlSide, setPnlSide] = useState<"plus" | "minus">("plus");
  const [savingTrade, setSavingTrade] = useState(false);
  const lastSaveAtRef = useRef(0);
  const emptyForm = {
    symbol: "MES",
    direction: "LONG" as Direction,
    entryTime: "",
    exitTime: "",
    entry: "",
    exit: "",
    contracts: "1",
    stopLoss: "",
    takeProfit: "",
    pnl: "",
    mood: "Focused",
    notes: "",
    tags: "",
    photoUri: "",
    voiceUri: "",
    voiceName: "",
  };
  const [form, setForm] = useState(emptyForm);
  const calendarGap = isTabletLayout ? 10 : 5;
  const calendarWidth = Math.min(width - 8, isTabletLayout ? 760 : 520);
  const dayCellWidth = Math.floor((calendarWidth - calendarGap * 6) / 7);
  const dayCellHeight = Math.max(92, Math.min(isTabletLayout ? 132 : 124, Math.round(dayCellWidth * 1.82)));
  const years = Array.from({ length: 9 }, (_, index) => viewMonth.getFullYear() - 4 + index);
  useEffect(() => {
    (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (status.granted) {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
          setAudioReady(true);
        }
      } catch {}
    })();
  }, []);
  const filtered = trades.filter((x) => x.date === selectedDate);
  const showProGate = useCallback(
    (feature: string) => {
      Alert.alert("YouTrader Pro", `${feature} is included in YouTrader Pro.`, [
        { text: t("close"), style: "cancel" },
        { text: "Unlock Pro", onPress: onUpgrade },
      ]);
    },
    [onUpgrade, t],
  );
  const monthDays = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) =>
      isoFromDate(new Date(y, m, i + 1)),
    );
  }, [viewMonth]);
  const monthRows = useMemo(() => {
    const cells = [...monthDays];
    while (cells.length % 7 !== 0) cells.push("");
    const rows: string[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [monthDays]);
  const openNew = (date = selectedDate) => {
    setSelectedDate(date);
    setEditId(null);
    setPnlSide("plus");
    setForm({ ...emptyForm, entryTime: formatClockFromDate() });
    setModal(true);
  };
  const openEdit = (tr: Trade) => {
    setEditId(tr.id);
    setPnlSide(tr.pnl < 0 ? "minus" : "plus");
    setForm({
      symbol: tr.symbol,
      direction: tr.direction,
      entryTime: tr.entryTime || "",
      exitTime: tr.exitTime || "",
      entry: tr.entry != null ? String(tr.entry) : "",
      exit: tr.exit != null ? String(tr.exit) : "",
      contracts: String(tr.contracts || 1),
      stopLoss: tr.stopLoss != null ? String(tr.stopLoss) : "",
      takeProfit: tr.takeProfit != null ? String(tr.takeProfit) : "",
      pnl: String(Math.abs(tr.pnl)),
      mood: tr.mood,
      notes: tr.notes || "",
      tags: tagsToInput(tr.tags),
      photoUri: tr.photoUri || "",
      voiceUri: tr.voiceUri || "",
      voiceName: tr.voiceName || "",
    });
    setModal(true);
  };
  const calcPnl = () => {
    if (form.pnl.trim()) {
      const amount = Math.min(MAX_ABS_PNL, Math.abs(toNum(form.pnl)));
      return Number((pnlSide === "minus" ? -amount : amount).toFixed(2));
    }
    const i = INSTRUMENTS[normalizeSymbolInput(form.symbol)];
    if (!i || !form.entry || !form.exit) return 0;
    const diff =
      form.direction === "LONG"
        ? toNum(form.exit) - toNum(form.entry)
        : toNum(form.entry) - toNum(form.exit);
    return Number(
      ((diff / i.tickSize) * i.tickValue * Number(form.contracts || 1)).toFixed(
        2,
      ),
    );
  };
  const save = async () => {
    if (savingTrade) return;
    setSavingTrade(true);
    try {
      const action = editId ? "trade:update" : "trade:create";
      const limit = await checkClientRateLimit(action, "journal-local");
      if (!limit.allowed) {
        Alert.alert("YouTrader", SECURITY_MESSAGES.rateLimited);
        return;
      }
      const now = Date.now();
      if (now - lastSaveAtRef.current < TRADE_SAVE_DEBOUNCE_MS) return;
      lastSaveAtRef.current = now;
      const validated = validateTradeForm(form, pnlSide);
      if ("error" in validated) {
        Alert.alert("Could not save trade", validated.error || "Check the trade details and try again.");
        return;
      }
      const safe = validated.value;
      if (!safe) {
        Alert.alert("Could not save trade", "Check the trade details and try again.");
        return;
      }
      const securityTrade = validateTradeInput({
        symbol: safe.symbol,
        direction: form.direction,
        entry: safe.entry,
        exit: safe.exit,
        contracts: safe.contracts,
        stopLoss: safe.stopLoss,
        takeProfit: safe.takeProfit,
        pnl: safe.pnl,
        mood: safe.mood,
        notes: safe.notes,
        tags: safe.tags,
      });
      if (!securityTrade.ok) {
        await recordSecurityEvent("invalid_trade_input", action, "journal-local");
        Alert.alert("YouTrader", SECURITY_MESSAGES.invalidTrade);
        return;
      }
      const previousTrade = editId ? trades.find((x) => x.id === editId) : null;
      const item: Trade = {
      id: editId || uid(),
      date: selectedDate,
      symbol: safe.symbol,
      direction: form.direction,
      entryTime: safe.entryTime || null,
      exitTime: safe.exitTime || null,
      entry: safe.entry,
      exit: safe.exit,
      contracts: safe.contracts,
      stopLoss: safe.stopLoss,
      takeProfit: safe.takeProfit,
      pnl: safe.pnl,
      mood: safe.mood,
      notes: safe.notes,
      tags: safe.tags,
      photoUri: isPremium ? safe.photoUri || null : null,
      voiceUri: isPremium ? safe.voiceUri || null : null,
      voiceName: isPremium && safe.voiceUri ? safeText(form.voiceName || "Voice note", 128) : null,
      createdAt: editId ? (previousTrade?.createdAt || now) : now,
      updatedAt: now,
    };
      await runIdempotentLocal(action, "journal-local", item, () => {
        setTrades((prev) =>
          editId ? prev.map((x) => (x.id === editId ? item : x)) : [item, ...prev],
        );
        return { tradeId: item.id, updatedAt: item.updatedAt };
      });
      setModal(false);
    } finally {
      setSavingTrade(false);
    }
  };
  const remove = () => {
    if (!editId) return;
    Alert.alert(t("deleteQuestion"), t("cannotUndo"), [
      { text: t("close"), style: "cancel" },
      {
        text: t("deleteTrade"),
        style: "destructive",
        onPress: async () => {
          const limit = await checkClientRateLimit("trade:delete", "journal-local");
          if (!limit.allowed) {
            Alert.alert("YouTrader", SECURITY_MESSAGES.rateLimited);
            return;
          }
          onTradeDeleted(editId);
          setTrades((prev) => prev.filter((x) => x.id !== editId));
          setModal(false);
        },
      },
    ]);
  };
  const pnlPreview = calcPnl();
  const pickImage = async (camera: boolean) => {
    if (!isPremium) {
      showProGate("Trade screenshots and photo uploads");
      return;
    }
    try {
      if (camera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) return Alert.alert("Camera permission needed");
        const r = await ImagePicker.launchCameraAsync({
          quality: 0.75,
          allowsEditing: false,
        });
        if (!r.canceled) {
          const asset = r.assets[0];
          const limit = await checkClientRateLimit("upload:screenshot", "journal-local");
          const uploadCheck = await validateSecureUploadInput({
            uri: asset.uri,
            category: "screenshot",
            originalName: asset.fileName || "camera.jpg",
            mimeType: asset.mimeType || "image/jpeg",
          });
          if (!limit.allowed || !uploadCheck.ok) {
            await recordSecurityEvent("invalid_upload", "upload:screenshot", "journal-local");
            return Alert.alert("YouTrader", !limit.allowed ? SECURITY_MESSAGES.rateLimited : SECURITY_MESSAGES.invalidUpload);
          }
          setForm({ ...form, photoUri: asset.uri });
        }
      } else {
        const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!p.granted) return Alert.alert("Photo permission needed");
        const r = await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          allowsEditing: false,
        });
        if (!r.canceled) {
          const asset = r.assets[0];
          const limit = await checkClientRateLimit("upload:screenshot", "journal-local");
          const uploadCheck = await validateSecureUploadInput({
            uri: asset.uri,
            category: "screenshot",
            originalName: asset.fileName || "screenshot.jpg",
            mimeType: asset.mimeType || "image/jpeg",
          });
          if (!limit.allowed || !uploadCheck.ok) {
            await recordSecurityEvent("invalid_upload", "upload:screenshot", "journal-local");
            return Alert.alert("YouTrader", !limit.allowed ? SECURITY_MESSAGES.rateLimited : SECURITY_MESSAGES.invalidUpload);
          }
          setForm({ ...form, photoUri: asset.uri });
        }
      }
    } catch {
      Alert.alert("Photo upload failed");
    }
  };
  const pickAudio = async () => {
    if (!isPremium) {
      showProGate("Voice notes");
      return;
    }
    try {
      if (recorderState.isRecording) {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        if (!uri) return Alert.alert("Recording failed");
        const limit = await checkClientRateLimit("upload:voice", "journal-local");
        const uploadCheck = await validateSecureUploadInput({
          uri,
          category: "voice-note",
          originalName: "voice-note.m4a",
          mimeType: "audio/x-m4a",
        });
        if (!limit.allowed || !uploadCheck.ok) {
          await recordSecurityEvent("invalid_upload", "upload:voice", "journal-local");
          return Alert.alert("YouTrader", !limit.allowed ? SECURITY_MESSAGES.rateLimited : SECURITY_MESSAGES.invalidUpload);
        }
        const safeName = `${Date.now()}-voice-note.m4a`;
        // expo-audio already saves the file in app storage. Keep its native URI directly.
        setForm({ ...form, voiceUri: uri, voiceName: safeName });
        return;
      }
      if (!audioReady) {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) return Alert.alert("Microphone permission needed");
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        setAudioReady(true);
      }
      await audioRecorder.prepareToRecordAsync();
      await audioRecorder.record();
    } catch (e) {
      Alert.alert("Audio recording failed");
    }
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        styles.journalContent,
        isTabletLayout && styles.journalTabletContent,
      ]}
    >
      <View style={[styles.calendarCard, { width: calendarWidth }]}>
        <View style={styles.monthControlRow}>
          <Pressable
            accessibilityLabel="Previous month"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setViewMonth(addMonths(viewMonth, -1))}
            style={styles.monthNavBtn}
          >
            <Text style={styles.monthNavText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Select month"
            accessibilityRole="button"
            onPress={() => setMonthPickerOpen(true)}
            style={styles.monthTitlePill}
          >
            <CalendarDays size={24} color={C.sub} strokeWidth={2.8} />
            <Text style={styles.monthTitleText} numberOfLines={1} adjustsFontSizeToFit>
              {monthTitle(viewMonth)}
            </Text>
            <Text style={styles.monthChevron}>⌄</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Next month"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setViewMonth(addMonths(viewMonth, 1))}
            style={styles.monthNavBtn}
          >
            <Text style={styles.monthNavText}>›</Text>
          </Pressable>
        </View>
        <View style={[styles.weekdayHeader, { gap: calendarGap }]}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <SafeText key={d} style={[styles.weekdayHeaderText, { width: dayCellWidth }]}>{d}</SafeText>
          ))}
        </View>
        <View style={[styles.calendarGrid, { gap: calendarGap }]}>
          {monthRows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={[styles.calendarRow, { gap: calendarGap }]}>
              {row.map((d, cellIndex) => {
                if (!d) return <View key={`empty-${rowIndex}-${cellIndex}`} style={[styles.daySpacer, { width: dayCellWidth, height: dayCellHeight }]} />;
                const dayTrades = trades.filter((x) => x.date === d);
                const pnl = dayTrades.reduce((a, x) => a + x.pnl, 0);
                const active = d === selectedDate;
                return (
                  <Pressable
                    key={d}
                    onPress={() => {
                      if (dayTrades.length === 0) {
                        openNew(d);
                      } else if (selectedDate === d) {
                        openNew(d);
                      } else {
                        setSelectedDate(d);
                      }
                    }}
                    style={[
                      styles.day,
                      { width: dayCellWidth, height: dayCellHeight },
                      dayTrades.length > 0 && (pnl >= 0 ? styles.dayProfit : styles.dayLoss),
                      active && styles.dayActive,
                    ]}
                  >
                    <SafeText style={[styles.dayNum, active && { color: C.white }]} minScale={0.72}>
                      {Number(d.slice(8, 10))}
                    </SafeText>
                    <SafeText
                      style={[
                        styles.dayPnlText,
                        {
                          color: active ? C.white : dayTrades.length ? (pnl >= 0 ? C.green : C.red) : C.sub,
                        },
                      ]}
                      minScale={0.6}
                    >
                      {dayTrades.length > 0 ? dayMoney(pnl) : ""}
                    </SafeText>
                    {d === todayISO() ? (
                      <View style={styles.todayMiniBadge}>
                        <SafeText style={styles.todayMiniBadgeText} minScale={0.7}>TODAY</SafeText>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
      {!isTabletLayout ? (
        <View style={styles.journalScrollCue}>
          <View style={styles.journalScrollCueGlass}>
            <Text style={styles.journalScrollCueChevron}>⌄</Text>
          </View>
        </View>
      ) : null}
      <Modal visible={monthPickerOpen} transparent animationType="fade">
        <Pressable style={styles.monthPickerBackdrop} onPress={() => setMonthPickerOpen(false)}>
          <Pressable style={styles.monthPickerCard}>
            <Text style={styles.monthPickerTitle}>Select Month</Text>
            <View style={styles.monthPickerYears}>
              {years.map((year) => (
                <Pressable
                  key={year}
                  onPress={() => setViewMonth(new Date(year, viewMonth.getMonth(), 1))}
                  style={[styles.monthPickerYear, year === viewMonth.getFullYear() && styles.monthPickerYearActive]}
                >
                  <Text style={[styles.monthPickerYearText, year === viewMonth.getFullYear() && styles.monthPickerYearTextActive]}>{year}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.monthPickerMonths}>
              {Array.from({ length: 12 }, (_, index) => (
                <Pressable
                  key={index}
                  onPress={() => {
                    setViewMonth(new Date(viewMonth.getFullYear(), index, 1));
                    setMonthPickerOpen(false);
                  }}
                  style={[styles.monthPickerMonth, index === viewMonth.getMonth() && styles.monthPickerMonthActive]}
                >
                  <Text style={[styles.monthPickerMonthText, index === viewMonth.getMonth() && styles.monthPickerMonthTextActive]}>
                    {new Date(2026, index, 1).toLocaleDateString([], { month: "short" })}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Text style={styles.tradesTodayTitle}>
        TRADES TODAY • {eventDateLabel(selectedDate)}
      </Text>
      {filtered.map((tr) => (
        <Pressable key={tr.id} onPress={() => openEdit(tr)}>
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.tradeSymbolTitle}>{tr.symbol}</Text>
              <Pill
                text={tr.direction}
                tone={tr.direction === "LONG" ? "long" : "short"}
              />
            </View>
            {tr.entry != null && tr.exit != null && (
              <Text style={styles.sub}>
                {tr.entry} → {tr.exit}
              </Text>
            )}
            {(tr.entryTime || tr.exitTime || (tr.tags || []).length > 0) ? (
              <View style={styles.tradeMetaWrap}>
                {tr.entryTime ? <Text style={styles.tradeMetaChip}>IN {tr.entryTime}</Text> : null}
                {tr.exitTime ? <Text style={styles.tradeMetaChip}>OUT {tr.exitTime}</Text> : null}
                {(tr.tags || []).slice(0, 4).map((tag) => (
                  <Text key={`${tr.id}-${tag}`} style={styles.tradeTagChip}>#{tag}</Text>
                ))}
              </View>
            ) : null}
            <View style={styles.rowBetween}>
              <Text style={styles.sub}>P&L</Text>
              <Value color={tr.pnl >= 0 ? C.green : C.red}>
                {moneyCompact(tr.pnl)}
              </Value>
            </View>
            <Text style={styles.sub}>
              {t("mood")}: {moodLabel(tr.mood)}
            </Text>
            {tr.photoUri ? (
              <Pressable onPress={() => setPhotoView(tr.photoUri || null)}>
                <Image
                  source={{ uri: tr.photoUri }}
                  style={styles.tradeThumb}
                />
              </Pressable>
            ) : null}
            {tr.notes ? <Text style={styles.notes}>{tr.notes}</Text> : null}
            {tr.voiceUri ? (
              <Pressable onPress={() => Linking.openURL(tr.voiceUri || "")}>
                <Text style={styles.tapHint}>🎙 {t("openAudio")}</Text>
              </Pressable>
            ) : null}
            <Text style={styles.tapHint}>Tap to view / edit</Text>
          </Card>
        </Pressable>
      ))}
      <Modal visible={modal} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={() => setModal(false)}
                  style={styles.closeCircle}
                >
                  <Text style={styles.closeX}>×</Text>
                </Pressable>
              </View>
              <Text style={styles.label}>{t("symbol")}</Text>
              <Text style={styles.sectionLabel}>{t("miniContracts")}</Text>
              <View style={styles.instrumentGrid}>
                {MINI_INSTRUMENTS.map((s) => (
                  <InstrumentButton
                    key={s}
                    symbol={s}
                    active={form.symbol === s}
                    onPress={() => setForm({ ...form, symbol: s })}
                  />
                ))}
              </View>
              <Text style={styles.sectionLabel}>{t("microContracts")}</Text>
              <View style={styles.instrumentGrid}>
                {MICRO_INSTRUMENTS.map((s) => (
                  <InstrumentButton
                    key={s}
                    symbol={s}
                    active={form.symbol === s}
                    onPress={() => setForm({ ...form, symbol: s })}
                  />
                ))}
              </View>
              <Input
                label={t("customSymbol")}
                value={form.symbol}
                onChangeText={(v: string) =>
                  setForm({ ...form, symbol: normalizeSymbolInput(v) })
                }
              />
              <Text style={styles.label}>{t("direction")}</Text>
              <View style={styles.row}>
                {(["LONG", "SHORT"] as Direction[]).map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setForm({ ...form, direction: d })}
                    style={[
                      styles.option,
                      form.direction === d && (d === "SHORT" ? styles.optionShortActive : styles.optionActive),
                    ]}
                  >
                    <Text style={styles.optionText}>{d}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.formTwoCol}>
                <View style={styles.formTwoColItem}>
                  <Input
                    label="Entry time"
                    value={form.entryTime}
                    onChangeText={(v: string) => setForm({ ...form, entryTime: v })}
                    placeholder="09:30"
                    style={styles.compactInput}
                  />
                </View>
                <View style={styles.formTwoColItem}>
                  <Input
                    label="Exit time"
                    value={form.exitTime}
                    onChangeText={(v: string) => setForm({ ...form, exitTime: v })}
                    placeholder="10:15"
                    style={styles.compactInput}
                  />
                </View>
              </View>
              <Text style={styles.label}>Tags</Text>
              <View style={styles.tagChipGrid}>
                {COMMON_TRADE_TAGS.map((tag) => {
                  const currentTags = parseTagsInput(form.tags);
                  const active = currentTags.includes(tag.toUpperCase());
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => {
                        const next = active
                          ? currentTags.filter((item) => item !== tag.toUpperCase())
                          : [...currentTags, tag.toUpperCase()].slice(0, 8);
                        setForm({ ...form, tags: tagsToInput(next) });
                      }}
                      style={[styles.tradeTagButton, active && styles.tradeTagButtonActive]}
                    >
                      <Text style={[styles.tradeTagButtonText, active && styles.tradeTagButtonTextActive]}>#{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Input
                label="Custom tags"
                value={form.tags}
                onChangeText={(v: string) => setForm({ ...form, tags: v })}
                placeholder="#ORB #APlus #NYOpen"
              />
              <Input
                label={t("entry")}
                keyboardType="decimal-pad"
                value={form.entry}
                onChangeText={(v: string) => setForm({ ...form, entry: v })}
              />
              <Input
                label={t("exit")}
                keyboardType="decimal-pad"
                value={form.exit}
                onChangeText={(v: string) => setForm({ ...form, exit: v })}
              />
              <Input
                label={t("contracts")}
                keyboardType="number-pad"
                value={form.contracts}
                onChangeText={(v: string) => setForm({ ...form, contracts: v })}
              />
              <Input
                label={t("stopLoss")}
                keyboardType="decimal-pad"
                value={form.stopLoss}
                onChangeText={(v: string) => setForm({ ...form, stopLoss: v })}
              />
              <Input
                label={t("takeProfit")}
                keyboardType="decimal-pad"
                value={form.takeProfit}
                onChangeText={(v: string) =>
                  setForm({ ...form, takeProfit: v })
                }
              />
              <Text style={styles.label}>{t("mood")}</Text>
              <View style={styles.moodGrid}>
                {MOODS.map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => setForm({ ...form, mood: m.key })}
                    style={[
                      styles.moodBtn,
                      form.mood === m.key && styles.optionActive,
                    ]}
                  >
                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                    <Text style={styles.moodText}>{m.key}</Text>
                  </Pressable>
                ))}
              </View>
              <Input
                label={t("notes")}
                value={form.notes}
                onChangeText={(v: string) => setForm({ ...form, notes: v.slice(0, MAX_NOTES_LENGTH) })}
                multiline
              />
              <Text style={styles.label}>{t("voiceNote")}</Text>
              <View style={styles.row}>
                <Pressable style={[styles.secondaryPhoto, styles.purpleAction, recorderState.isRecording && { borderColor: C.red, backgroundColor: C.redSoft }]} onPress={pickAudio}>
                  <Text style={[styles.secondaryText, recorderState.isRecording && { color: C.red }]}>{recorderState.isRecording ? t("stopRecording") : t("recordVoice")}</Text>
                </Pressable>
                {form.voiceUri ? (
                  <Pressable style={[styles.secondaryPhoto, styles.purpleAction]} onPress={() => Linking.openURL(form.voiceUri)}>
                    <Text style={styles.secondaryText}>{t("openAudio")}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.sub}>{t("noAudio")}</Text>
                )}
              </View>
              <Text style={styles.label}>{t("photo")}</Text>
              <View style={styles.row}>
                {form.photoUri ? (
                  <Image
                    source={{ uri: form.photoUri }}
                    style={styles.tradePhoto}
                  />
                ) : null}
                <Pressable
                  style={[styles.secondaryPhoto, styles.purpleAction]}
                  onPress={() => pickImage(true)}
                >
                  <Text style={styles.secondaryText}>{t("takePhoto")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryPhoto, styles.purpleAction]}
                  onPress={() => pickImage(false)}
                >
                  <Text style={styles.secondaryText}>{t("uploadPhoto")}</Text>
                </Pressable>
              </View>
              <View style={styles.pnlToggleRow}>
                <Pressable
                  onPress={() => setPnlSide("plus")}
                  style={[
                    styles.pnlToggle,
                    pnlSide === "plus" && styles.pnlPlusActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pnlToggleText,
                      pnlSide === "plus" && { color: C.bg },
                    ]}
                  >
                    + {t("plusPnl")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPnlSide("minus")}
                  style={[
                    styles.pnlToggle,
                    pnlSide === "minus" && styles.pnlMinusActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pnlToggleText,
                      pnlSide === "minus" && { color: C.white },
                    ]}
                  >
                    − {t("minusPnl")}
                  </Text>
                </Pressable>
              </View>
              <View
                style={[
                  styles.resultBox,
                  pnlPreview < 0 && styles.resultBoxRed,
                ]}
              >
                <Text style={styles.label}>{t("pnl")}</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={form.pnl}
                  onChangeText={(v: string) => setForm({ ...form, pnl: v })}
                  placeholder={money(Math.abs(pnlPreview))}
                  placeholderTextColor={pnlPreview < 0 ? C.red : C.green}
                  style={[
                    styles.resultInput,
                    pnlPreview < 0 && { color: C.red },
                  ]}
                  textAlign="center"
                />
              </View>
              <Pressable style={styles.primaryBig} onPress={save}>
                <Text style={styles.primaryText}>
                  {editId ? t("updateTrade") : t("saveTrade")}
                </Text>
              </Pressable>
              {editId && (
                <Pressable style={styles.deleteBig} onPress={remove}>
                  <Text style={styles.deleteText}>{t("deleteTrade")}</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.secondaryBig}
                onPress={() => setModal(false)}
              >
                <Text style={styles.secondaryText}>{t("close")}</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!photoView}
        animationType="fade"
        onRequestClose={() => setPhotoView(null)}
      >
        <SafeAreaView style={styles.photoModal}>
          <Pressable
            onPress={() => setPhotoView(null)}
            style={styles.photoClose}
          >
            <Text style={styles.closeX}>×</Text>
          </Pressable>
          {photoView ? (
            <Image
              source={{ uri: photoView }}
              style={styles.fullPhoto}
              resizeMode="contain"
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

function MarketSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.marketSection}>
      <Text style={styles.marketSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MarketEmpty({ text }: { text: string }) {
  return <Text style={styles.marketEmptyText}>{text}</Text>;
}

function NewsScreen({
  lang,
  isPremium,
  onUpgrade,
}: {
  lang: Lang;
  isPremium: boolean;
  onUpgrade: () => void;
}) {
  const [intel, setIntel] = useState<MarketIntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    const data = await loadMarketIntelligence();
    setIntel(data);
    setLoading(false);
  };
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, []);

  if (loading && !intel) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={C.green} size="large" style={{ marginTop: 60 }} />
      </View>
    );
  }

  const data = intel || { brief: null, watchlist: [], summary: null, events: [], propUpdates: [], headlines: [] };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.newsList, styles.newsListNoTitle]}>
      <MarketSection title="Daily Brief">
        {data.brief ? (
          <GlassCard style={styles.marketHeroCard} intensity={30}>
            <View style={styles.rowBetween}>
              <Pill text={data.brief.marketRegime} tone="med" />
              <Text style={styles.sub}>{data.brief.generatedAt ? new Date(data.brief.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Cached"}</Text>
            </View>
            <Text style={styles.newsTitle}>{data.brief.title}</Text>
            <Text style={styles.newsSummary}>{data.brief.summary}</Text>
            {!!data.brief.whatNotToDo && <Text style={styles.marketCaution}>Do not: {data.brief.whatNotToDo}</Text>}
          </GlassCard>
        ) : <MarketEmpty text="Daily brief will appear after the worker publishes cached data." />}
      </MarketSection>

      <MarketSection title="AI Watchlist">
        {data.watchlist.length ? (
          <View style={styles.marketGrid}>
            {data.watchlist.map((item) => (
              <GlassCard key={item.asset} style={styles.marketMiniCard} intensity={22}>
                <View style={styles.rowBetween}>
                  <Text style={styles.marketAsset}>{item.asset}</Text>
                  <Text style={[styles.marketBias, { color: item.bias === "LONG" ? C.green : item.bias === "SHORT" ? C.red : C.sub }]}>{item.bias}</Text>
                </View>
                <Text style={styles.marketTinyLabel}>{item.confidence} confidence</Text>
                <Text style={styles.marketBodyText}>{item.reason}</Text>
              </GlassCard>
            ))}
          </View>
        ) : <MarketEmpty text="Watchlist cache is empty." />}
      </MarketSection>

      <MarketSection title="Market Summary">
        {data.summary ? (
          <GlassCard style={styles.marketCard} intensity={24}>
            <View style={styles.marketSummaryRow}>
              <SmallMetric l="Macro" v={data.summary.macroTone} />
              <SmallMetric l="Risk" v={data.summary.riskMode} />
            </View>
            {data.summary.strongestHeadlines.slice(0, 3).map((item) => <Text key={item} style={styles.marketListText}>• {item}</Text>)}
          </GlassCard>
        ) : <MarketEmpty text="Market summary cache is empty." />}
      </MarketSection>

      <MarketSection title="Economic Calendar">
        {data.events.length ? data.events.slice(0, 6).map((event) => (
          <GlassCard key={event.id} style={styles.marketCard} intensity={22}>
            <View style={styles.rowBetween}>
              <Pill text={event.impact} tone={event.impact === "HIGH" ? "high" : event.impact === "MED" ? "med" : "low"} />
              <Text style={styles.sub}>{event.date} • {event.time}</Text>
            </View>
            <Text style={styles.newsTitle}>{event.name}</Text>
            <Text style={styles.newsSummary}>Previous {event.previous || "—"} • Forecast {event.forecast || "—"} • Actual {event.actual || "—"}</Text>
          </GlassCard>
        )) : <MarketEmpty text="Calendar cache is empty. The worker has a deterministic fallback if no source is configured." />}
      </MarketSection>

      <MarketSection title="Prop Firm Monitor">
        {data.propUpdates.length ? data.propUpdates.slice(0, 5).map((item) => (
          <Pressable key={item.id} onPress={() => item.url ? Linking.openURL(item.url) : undefined}>
            <GlassCard style={styles.marketCard} intensity={22}>
              <View style={styles.rowBetween}>
                <Text style={styles.marketAsset}>{item.firm}</Text>
                <Text style={styles.sub}>{item.category}</Text>
              </View>
              <Text style={styles.newsSummary}>{item.detectedChangeSummary}</Text>
              {!!item.keyText && <Text style={styles.marketBodyText}>{item.keyText.slice(0, 220)}</Text>}
            </GlassCard>
          </Pressable>
        )) : <MarketEmpty text="Prop firm monitor cache is empty." />}
      </MarketSection>

      <MarketSection title="Latest Market Headlines">
        {data.headlines.length ? data.headlines.slice(0, 12).map((item) => (
          <Pressable key={item.id} onPress={() => (item.url ? Linking.openURL(item.url) : undefined)}>
            <GlassCard style={styles.purpleNewsCard} intensity={28}>
              <View style={styles.rowBetween}>
                <Pill text={item.impact} tone={item.impact === "HIGH" ? "high" : item.impact === "MED" ? "med" : "low"} />
                <Text style={styles.sub}>{item.source} • {item.time}</Text>
              </View>
              <Text style={styles.newsTitle}>{item.title}</Text>
              {!!item.summary && <Text style={styles.newsSummary}>{item.summary.slice(0, 240)}</Text>}
            </GlassCard>
          </Pressable>
        )) : <MarketEmpty text="Headline cache is empty." />}
      </MarketSection>

      <MarketSection title="Cost Safety">
        <GlassCard style={styles.marketCostCard} intensity={18}>
          <Text style={styles.marketBodyText}>Cached market intelligence is shared by all users. The app is read-only, does not run crawlers, and does not trigger paid AI or per-user generation.</Text>
        </GlassCard>
      </MarketSection>
    </ScrollView>
  );
}

function SmallMetric({ l, v }: any) {
  return (
    <View style={styles.smallMetric}>
      <Text style={styles.label}>{l}</Text>
      <Text style={styles.metric}>{v}</Text>
    </View>
  );
}
function CalendarScreen({
  lang,
  trades,
  isPremium,
  onUpgrade,
}: {
  lang: Lang;
  trades: Trade[];
  isPremium: boolean;
  onUpgrade: () => void;
}) {
  const t = (k: string) => tText(lang, k);
  const { width } = useWindowDimensions();
  const isTabletLayout = width >= 768;
  const [events, setEvents] = useState<EconEvent[]>([]);
  const [selected, setSelected] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    const d = await loadCalendarEvents();
    setEvents(d);
    setLoading(false);
  };
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, []);
  const today = todayISO();
  const dayStrip = Array.from({ length: 31 }, (_, i) => isoFromDate(addDays(new Date(), i)));
  const agendaDate = selected;
  const shown = events.filter((e) => e.date === agendaDate);
  const dayAgenda = shown;
  const orderedAgenda = [...dayAgenda].sort(
    (a, b) => calendarTimeMinutes(a.time) - calendarTimeMinutes(b.time) || a.name.localeCompare(b.name),
  );
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        isTabletLayout && styles.calendarTabletContent,
        { paddingTop: 8, paddingBottom: 46 },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[{ marginBottom: 12 }, isTabletLayout && { marginBottom: 16 }]}
      >
        {dayStrip.map((d) => (
          <Pressable
            key={d}
            onPress={() => {
              setSelected(d);
            }}
            style={[
              styles.weekChip,
              isTabletLayout && styles.weekChipTablet,
              selected === d && styles.weekChipActive,
            ]}
          >
            <Text
              style={[
                styles.weekChipDay,
                isTabletLayout && styles.weekChipDayTablet,
                selected === d && { color: C.bg },
              ]}
            >
              {safeDateFromISO(d).toLocaleDateString([], {
                weekday: "short",
              })}
            </Text>
            <Text
              style={[
                styles.weekChipDate,
                isTabletLayout && styles.weekChipDateTablet,
                selected === d && { color: C.bg },
              ]}
            >
              {safeDateFromISO(d).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {loading && !events.length ? (
        <ActivityIndicator
          color={C.green}
          size="large"
          style={{ marginTop: 24 }}
        />
      ) : (
        orderedAgenda.length ? orderedAgenda.map((e) => {
          const timeParts = splitTimeLabel(e.time);
          return (
          <Card key={e.id} style={[styles.calendarEventCard, isTabletLayout && styles.calendarEventCardTablet]}>
            <View style={styles.calendarEventTop}>
              <View style={[styles.calendarTimeBox, isTabletLayout && styles.calendarTimeBoxTablet]}>
                <Text
                  style={[styles.calendarEventTime, isTabletLayout && styles.calendarEventTimeTablet]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.74}
                  ellipsizeMode="clip"
                >
                  {timeParts.clock}
                  {!!timeParts.meridiem && (
                    <Text style={[styles.calendarEventMeridiem, isTabletLayout && styles.calendarEventMeridiemTablet]}>
                      {" "}{timeParts.meridiem}
                    </Text>
                  )}
                </Text>
                <Text style={[styles.calendarEventDate, isTabletLayout && styles.calendarEventDateTablet]} numberOfLines={1}>Eastern Time</Text>
              </View>
              <View style={styles.calendarEventBody}>
                <Text style={[styles.calendarEventTitle, isTabletLayout && styles.calendarEventTitleTablet]} numberOfLines={2}>{e.name}</Text>
                <View style={[styles.calendarMetricRow, isTabletLayout && styles.calendarMetricRowTablet]}>
                  <Text style={[styles.calendarMetricText, isTabletLayout && styles.calendarMetricTextTablet, { color: calendarMetricColor(e, "actual") }]}>Act {e.actual}</Text>
                  <Text style={[styles.calendarMetricText, isTabletLayout && styles.calendarMetricTextTablet, { color: calendarMetricColor(e, "forecast") }]}>Fcst {e.forecast}</Text>
                  <Text style={[styles.calendarMetricText, isTabletLayout && styles.calendarMetricTextTablet, { color: calendarMetricColor(e, "previous") }]}>Prev {e.previous}</Text>
                </View>
              </View>
              <Pill
                text={e.impact}
                tone={
                  e.impact === "HIGH"
                    ? "high"
                    : e.impact === "MED"
                      ? "med"
                      : "low"
                }
              />
            </View>
            <View style={[styles.calendarBiasGrid, isTabletLayout && styles.calendarBiasGridTablet]}>
              {ASSETS.map((a) => (
                <View key={a} style={[styles.calendarBiasCell, isTabletLayout && styles.calendarBiasCellTablet]}>
                  <Text style={[styles.asset, styles.calendarAssetLabel, isTabletLayout && styles.calendarAssetLabelTablet]}>{a}</Text>
                  <Text
                    style={[
                      styles.calendarBiasValue,
                      isTabletLayout && styles.calendarBiasValueTablet,
                      {
                        color:
                          e.bias[a] === "LONG"
                            ? C.green
                            : e.bias[a] === "SHORT"
                              ? C.red
                              : C.sub,
                      },
                    ]}
                  >
                    {e.bias[a] === "LONG" ? "LONG ↑" : e.bias[a] === "SHORT" ? "SHORT ↓" : "NEUTRAL"}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
          );
        }) : (
          <Card style={styles.calendarEventCard}>
            <Text style={styles.calendarEventTitle}>No scheduled events for this day yet.</Text>
            <Text style={[styles.sub, { marginTop: 6 }]}>Tap Refresh to pull the latest live calendar data. If the provider has not published events for this date, YouTrader will leave the day empty instead of showing demo events.</Text>
          </Card>
        )
      )}
    </ScrollView>
  );
}
function CalcScreen({ lang }: { lang: Lang }) {
  const t = (k: string) => tText(lang, k);
  const [symbol, setSymbol] = useState("MES");
  const [mode, setMode] = useState<"ticks" | "points">("ticks");
  const [amount, setAmount] = useState("20");
  const [contracts, setContracts] = useState("1");
  const [sl, setSl] = useState("20");
  const [tp, setTp] = useState("40");
  const [balance, setBalance] = useState("50000");
  const [riskPct, setRiskPct] = useState("1");
  const i = INSTRUMENTS[symbol] || INSTRUMENTS.MES;
  const unitValue = mode === "ticks" ? i.tickValue : i.tickValue / i.tickSize;
  const result = Number(amount || 0) * unitValue * Number(contracts || 1);
  const risk = Number(sl || 0) * unitValue * Number(contracts || 1);
  const reward = Number(tp || 0) * unitValue * Number(contracts || 1);
  const rr = risk ? reward / risk : 0;
  const maxRiskDollars = (Number(balance || 0) * Number(riskPct || 0)) / 100;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.label}>{t("miniContracts")}</Text>
        <View style={styles.instrumentGrid}>
          {MINI_INSTRUMENTS.map((s) => (
            <InstrumentButton key={s} symbol={s} active={symbol === s} onPress={() => setSymbol(s)} />
          ))}
        </View>
        <Text style={[styles.label, { marginTop: 14 }]}>{t("microContracts")}</Text>
        <View style={styles.instrumentGrid}>
          {MICRO_INSTRUMENTS.map((s) => (
            <InstrumentButton key={s} symbol={s} active={symbol === s} onPress={() => setSymbol(s)} />
          ))}
        </View>
        <Input label={t("customInstrument")} value={symbol} onChangeText={(v: string) => setSymbol(v.toUpperCase())} />
        <Text style={styles.label}>{t("mode")}</Text>
        <View style={styles.row}>
          {(["ticks", "points"] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.option, mode === m && { backgroundColor: C.purpleSoft, borderColor: C.purple }]}>
              <Text style={[styles.optionText, mode === m && { color: C.text }]}>{m === "ticks" ? t("ticks") : t("points")}</Text>
            </Pressable>
          ))}
        </View>
        <Input label={mode === "ticks" ? t("ticks") : t("points")} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <Input label={t("contracts")} keyboardType="number-pad" value={contracts} onChangeText={setContracts} />
        <View style={styles.resultBox}>
          <Text style={styles.label}>{t("resultInUsd")}</Text>
          <Text style={styles.result} numberOfLines={1} adjustsFontSizeToFit>
            ${result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.sub}>{amount} {mode} × ${unitValue.toFixed(2)} × {contracts} contracts • {i.name}</Text>
        </View>
      </Card>
      <Card>
        <Text style={[styles.h2, styles.purpleSectionTitle]}>{t("rrCalculator")}</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Input label={t("slAmount")} keyboardType="decimal-pad" value={sl} onChangeText={setSl} /></View>
          <View style={{ flex: 1 }}><Input label={t("tpAmount")} keyboardType="decimal-pad" value={tp} onChangeText={setTp} /></View>
        </View>
        <View style={styles.row}>
          <SmallMetric l="Risk $" v={`$${risk.toFixed(2)}`} />
          <SmallMetric l="Reward $" v={`$${reward.toFixed(2)}`} />
          <SmallMetric l="RR" v={rr ? `1:${rr.toFixed(2)}` : "—"} />
        </View>
      </Card>
      <Card>
        <Text style={[styles.h2, styles.purpleSectionTitle]}>{t("percentRiskCalculator")}</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Input label={t("accountBalance")} keyboardType="decimal-pad" value={balance} onChangeText={setBalance} /></View>
          <View style={{ flex: 1 }}><Input label={t("riskPercent")} keyboardType="decimal-pad" value={riskPct} onChangeText={setRiskPct} /></View>
        </View>
        <View style={styles.resultBox}>
          <Text style={styles.label}>{t("maxRisk")}</Text>
          <Text style={styles.result} numberOfLines={1} adjustsFontSizeToFit>
            ${maxRiskDollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.sub}>Balance ${Number(balance || 0).toLocaleString()} × {riskPct || 0}%</Text>
        </View>
      </Card>
    </ScrollView>
  );
}
function PremiumScreen({
  lang,
  onClose,
  packages,
  storeProducts,
  purchaseBusy,
  paywallError,
  showRestorePurchases,
  onPurchase,
  onRestore,
}: {
  lang: Lang;
  onClose: () => void;
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
}) {
  const t = (k: string) => tText(lang, k);
  const monthly = packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null;
  const yearly = packages.find((pkg) => packageTitle(pkg) === "YEARLY") || null;
  const monthlyProduct =
    storeProducts.find((product) => product.identifier === YOU_TRADER_MONTHLY_PRODUCT_ID) || null;
  const yearlyProduct =
    storeProducts.find((product) => product.identifier === YOU_TRADER_YEARLY_PRODUCT_ID) || null;
  const yearlyPriceLabel = yearly
    ? packagePrice(yearly)
    : yearlyProduct?.priceString || PREMIUM_PRICE_YEARLY;
  useEffect(() => {
    trackEvent("paywall_viewed", { screen: "premium_screen" });
  }, []);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.modalHeader}>
        <Text style={styles.h1NoMargin}>{t("premiumLocked")}</Text>
        <Pressable onPress={onClose} style={styles.closeCircle}>
          <Text style={styles.closeX}>×</Text>
        </Pressable>
      </View>
      <Card>
        <Text style={styles.h2}>{t("premiumAccess")}</Text>
        <Text style={styles.sub}>{t("premiumLockedText")}</Text>
        {[
          "premiumBenefit1",
          "premiumBenefit2",
          "premiumBenefit3",
          "premiumBenefit4",
          "premiumBenefit5",
          "premiumBenefit6",
          "premiumBenefit7",
          "premiumBenefit8",
        ].map((k) => (
          <Text key={k} style={styles.benefit}>
            ✓ {t(k)}
          </Text>
        ))}
        <View style={styles.planRow}>
          <Pressable
            disabled={purchaseBusy}
            onPress={() => onPurchase(monthly, YOU_TRADER_MONTHLY_PRODUCT_ID)}
            style={[styles.monthlyPlan, purchaseBusy && styles.disabledBtn]}
          >
            <Text style={styles.planName}>MONTHLY</Text>
            <Text style={styles.planPrice}>{packagePrice(monthly)}</Text>
          </Pressable>
          <Pressable
            disabled={purchaseBusy}
            onPress={() => onPurchase(yearly, YOU_TRADER_YEARLY_PRODUCT_ID)}
            style={[styles.yearlyPlan, purchaseBusy && styles.disabledBtn]}
          >
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <Text style={styles.planName}>YEARLY</Text>
            <Text style={styles.planPrice}>{yearlyPriceLabel}</Text>
          </Pressable>
        </View>
        <Pressable
          disabled={purchaseBusy}
          onPress={() => onPurchase(monthly, YOU_TRADER_MONTHLY_PRODUCT_ID)}
          style={[styles.primaryBig, purchaseBusy && styles.disabledBtn]}
        >
          <Text style={styles.primaryText}>
            {purchaseBusy ? "Connecting..." : `Unlock Pro • ${packagePrice(monthly)}`}
          </Text>
        </Pressable>
        <SubscriptionLegalDisclosure
          monthlyPackage={monthly}
          monthlyProduct={monthlyProduct}
          yearlyPackage={yearly}
          yearlyProduct={yearlyProduct}
        />
        {(showRestorePurchases || !!paywallError) ? (
          <Pressable
            disabled={purchaseBusy}
            onPress={onRestore}
            style={[styles.secondaryBig, styles.restorePurchaseBtn, purchaseBusy && styles.disabledBtn]}
          >
            <Text style={styles.secondaryText}>{purchaseBusy ? "Checking..." : "Restore Purchases"}</Text>
          </Pressable>
        ) : null}
        {paywallError ? (
          <Text style={[styles.sub, { color: C.red, marginTop: 10 }]}>{paywallError}</Text>
        ) : null}
      </Card>
    </ScrollView>
  );
}

function SettingsBenefitLine({ children }: { children: React.ReactNode }) {
  return (
    <Text style={styles.settingsBenefit}>
      <Text style={styles.settingsBenefitCheck}>✓ </Text>
      <Text style={styles.settingsBenefitText}>{children}</Text>
    </Text>
  );
}

function SettingsScreen({
  lang,
  setLang,
  session,
  authBusy,
  authConfigured,
  isPremium,
  packages,
  storeProducts,
  purchaseBusy,
  revenueCatConfigured,
  paywallError,
  showRestorePurchases,
  cloudSyncEnabled,
  cloudSyncStatus,
  cloudSyncMessage,
  lastCloudSyncAt,
  lockScreenBufferEnabled,
  onPurchase,
  onRestore,
  onSyncNow,
  onToggleLockScreenBuffer,
  onImportTradesCsv,
  onSignIn,
  onSignOut,
}: {
  lang: Lang;
  setLang: (x: Lang) => void;
  session: Session | null;
  authBusy: boolean;
  authConfigured: boolean;
  isPremium: boolean;
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  revenueCatConfigured: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  cloudSyncEnabled: boolean;
  cloudSyncStatus: "off" | "syncing" | "synced" | "error";
  cloudSyncMessage: string;
  lastCloudSyncAt: string | null;
  lockScreenBufferEnabled: boolean;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
  onSyncNow: () => void;
  onToggleLockScreenBuffer: (enabled: boolean) => void;
  onImportTradesCsv: () => void;
  onSignIn: (provider: AuthProvider) => void;
  onSignOut: () => void;
}) {
  const t = (k: string) => tText(lang, k);
  const choose = (l: Lang) => {
    setLang(l);
    AsyncStorage.setItem(LANG_STORAGE_KEY, l);
  };
  const [calendarAlertsEnabled, setCalendarAlertsEnabled] = useState(false);
  const [propRiskAlertsEnabled, setPropRiskAlertsEnabled] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("calendar-alerts-v1").then((v) => setCalendarAlertsEnabled(v === "on"));
    AsyncStorage.getItem("prop-risk-alerts-v1").then((v) => setPropRiskAlertsEnabled(v === "on"));
  }, []);

  const togglePropRiskAlerts = async () => {
    if (propRiskAlertsEnabled) {
      const existingId = await AsyncStorage.getItem(PROP_RISK_ALERT_ID_KEY);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId);
        await AsyncStorage.removeItem(PROP_RISK_ALERT_ID_KEY);
      }
      await AsyncStorage.setItem("prop-risk-alerts-v1", "off");
      setPropRiskAlertsEnabled(false);
      return;
    }
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Notifications", "Allow notifications to receive risk alerts.");
      return;
    }
    const existingId = await AsyncStorage.getItem(PROP_RISK_ALERT_ID_KEY);
    if (existingId) await Notifications.cancelScheduledNotificationAsync(existingId);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "YouTrader Risk Coach",
        body: "Review your prop firm risk status before trading.",
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 15,
      },
    });
    await AsyncStorage.setItem(PROP_RISK_ALERT_ID_KEY, id);
    await AsyncStorage.setItem("prop-risk-alerts-v1", "on");
    setPropRiskAlertsEnabled(true);
  };

  const toggleCalendarAlerts = async (enabled: boolean) => {
    setCalendarAlertsEnabled(enabled);
    try {
      if (!enabled) {
        const existingId = await AsyncStorage.getItem(CALENDAR_ALERT_ID_KEY);
        if (existingId) {
          await Notifications.cancelScheduledNotificationAsync(existingId);
          await AsyncStorage.removeItem(CALENDAR_ALERT_ID_KEY);
        }
        await AsyncStorage.setItem("calendar-alerts-v1", "off");
        return;
      }

      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setCalendarAlertsEnabled(false);
        Alert.alert("Notifications", "Allow notifications to receive economic calendar alerts.");
        return;
      }
      const existingId = await AsyncStorage.getItem(CALENDAR_ALERT_ID_KEY);
      if (existingId) await Notifications.cancelScheduledNotificationAsync(existingId);
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "YouTrader Economic Calendar",
          body: "Check today's high-impact events before trading.",
          sound: false,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 7,
          minute: 45,
        },
      });
      await AsyncStorage.setItem(CALENDAR_ALERT_ID_KEY, id);
      await AsyncStorage.setItem("calendar-alerts-v1", "on");
    } catch (error) {
      setCalendarAlertsEnabled(!enabled);
      Alert.alert("Calendar alerts", "Could not update economic calendar alerts. Please try again.");
      captureAppError(error, { feature: "settings", action: "toggle_calendar_alerts" });
    }
  };

  const legalInfo = `YouTrader: Terms of Service, Risk Disclosure & Privacy Policy

IMPORTANT LEGAL NOTICE: PLEASE READ THIS DOCUMENT CAREFULLY BEFORE USING THE YOUTRADER APPLICATION. BY CREATING AN ACCOUNT, LOGGING IN, OR USING ANY PART OF THE APPLICATION, YOU EXPRESSLY AGREE TO BE BOUND BY THESE TERMS.

PART I: TERMS OF SERVICE & RISK DISCLOSURE

1. Educational and Informational Use Only
YouTrader is an educational journaling tool and market-information aggregator. YouTrader is not a registered broker-dealer, financial advisor, commodity trading advisor (CTA), or investment analyst. The application does not provide financial, investment, legal, tax, brokerage, or trading advice. No content, analytics, trade logs, bias labels, metrics, or custom tags within the app constitute a recommendation, endorsement, or solicitation to buy or sell any financial instrument, futures contract, stock, option, or cryptocurrency.

2. Assumption of Trading Risk and No Liability
Day trading, scalping, and trading leveraged financial instruments, including but not limited to E-mini/Micro E-mini futures like ES/MES and NQ/MNQ, involve substantial risk and a high potential for significant financial loss. It is not suitable for every investor. You agree that all trades, risk management strategies, investments, and market actions are made solely at your own risk.

YouTrader, its owners, developers, and affiliates shall not be held liable or responsible for any direct, indirect, incidental, special, or consequential losses, missed profits, trading losses, account liquidations, margin calls, data errors, execution decisions, or outcomes resulting from the use or inability to use this software.

3. Market Data & Third-Party Content Disclaimer
Market data, economic calendar events, news feeds, bias labels, and analytical metrics displayed within YouTrader are provided on an "as-is" and "as-available" basis for informational purposes only. This data may be delayed, incomplete, or inaccurate due to technological latencies or third-party provider errors. YouTrader does not guarantee the precision, timeliness, or reliability of any market data or news feed. You explicitly agree never to rely on the information provided in the app as the sole or primary basis for making any live trading or investment decisions. Past performance is not indicative of future results.

PART II: PRIVACY POLICY

1. Information We Collect
To provide performance analytics, YouTrader collects the following information:

Account Data: If account features are enabled in a future version, YouTrader may collect your name and email address for account access.

User-Generated Data: We securely store the trading logs, dates, times, contract types, execution prices, screenshots, and custom tags that you manually input or import via file uploads (CSV/Excel).

Usage & Device Data: We may automatically collect anonymized technical data, including device model, operating system, app version, and crash logs to monitor and optimize application performance.

Note: YouTrader does not collect, request, or store your live brokerage passwords, API secret keys, or live execution credentials.

2. Data Use, Security, and Protection
Your trading data is used strictly to generate your personal statistics, charts, and subscription status. We do not sell, rent, trade, or share your personal identity or specific trading data with third-party advertisers.

3. Data Ownership and Deletion Rights (GDPR & CCPA Compliance)
You retain full ownership of your data. In compliance with data privacy regulations, including GDPR and CCPA, you have the right to access, export, or permanently delete your account and all associated trading logs at any time. This action can be executed directly via the Application Settings. Once initiated, all account records are physically and permanently purged from our active databases.

4. Children's Privacy (COPPA)
YouTrader does not knowingly collect data from or market to individuals under the age of 18. If you are under 18, you are not authorized to use this application.`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { flexGrow: 1, justifyContent: "space-between", paddingBottom: 36 }]}>
      <View>
        <Card>
          <Text style={styles.h2}>Notifications</Text>
          <View style={styles.settingsSwitchRow}>
            <View style={styles.settingsSwitchCopy}>
              <Text style={styles.settingsSwitchTitle}>Daily prop firm reminder</Text>
              <Text style={styles.sub}>Morning notification with your daily buffer and risk status.</Text>
            </View>
            <Switch
              value={lockScreenBufferEnabled}
              onValueChange={(enabled) => onToggleLockScreenBuffer(enabled)}
              trackColor={{ false: "#222936", true: "rgba(150,255,0,0.45)" }}
              thumbColor={lockScreenBufferEnabled ? "#96FF00" : "#7D8795"}
            />
          </View>
          <View style={styles.settingsSwitchDivider} />
          <View style={styles.settingsSwitchRow}>
            <View style={styles.settingsSwitchCopy}>
              <Text style={styles.settingsSwitchTitle}>Risk alerts</Text>
              <Text style={styles.sub}>Daily risk coach reminder before trading.</Text>
            </View>
            <Switch
              value={propRiskAlertsEnabled}
              onValueChange={togglePropRiskAlerts}
              trackColor={{ false: "#222936", true: "rgba(150,255,0,0.45)" }}
              thumbColor={propRiskAlertsEnabled ? "#96FF00" : "#7D8795"}
            />
          </View>
          <View style={styles.settingsSwitchDivider} />
          <View style={styles.settingsSwitchRow}>
            <View style={styles.settingsSwitchCopy}>
              <Text style={styles.settingsSwitchTitle}>Economic calendar alerts</Text>
              <Text style={styles.sub}>Morning reminder to check high-impact events.</Text>
            </View>
            <Switch
              value={calendarAlertsEnabled}
              onValueChange={toggleCalendarAlerts}
              trackColor={{ false: "#222936", true: "rgba(150,255,0,0.45)" }}
              thumbColor={calendarAlertsEnabled ? "#96FF00" : "#7D8795"}
            />
          </View>
        </Card>

        <Card>
          <Text style={styles.h2}>Import trades</Text>
          <Text style={styles.sub}>
            Import a CSV journal from another platform. Pro feature.
          </Text>
          <Pressable
            onPress={() =>
              isPremium
                ? onImportTradesCsv()
                : Alert.alert("YouTrader Pro", "CSV import is available in YouTrader Pro.")
            }
            style={[styles.secondaryBig, { marginTop: 14 }, !isPremium && styles.disabledBtn]}
          >
            <Text style={styles.secondaryText}>
              {isPremium ? "Import trades (CSV)" : "Import trades (CSV) — Pro"}
            </Text>
          </Pressable>
        </Card>

        <GlassCard style={styles.proSubscriptionCard} intensity={42}>
          <Text style={[styles.h2, styles.proSubscriptionTitle]}>YouTrader Pro</Text>
          <View style={[styles.proStatusBox, isPremium ? styles.proStatusActive : styles.proStatusLocked]}>
            <View style={[styles.proStatusIcon, isPremium ? styles.proStatusIconActive : styles.proStatusIconLocked]}>
              {isPremium ? <Unlock size={26} color={C.green} strokeWidth={2.8} /> : <Lock size={26} color={C.purple} strokeWidth={2.8} />}
            </View>
            <View style={styles.proStatusCopy}>
              <Text style={[styles.proStatusTitle, isPremium ? styles.proStatusTitleActive : styles.proStatusTitleLocked]}>
                {isPremium ? "Your Pro subscription is active" : "YouTrader Pro is locked"}
              </Text>
              <Text style={styles.proStatusText}>
                {isPremium ? "All premium analytics, AI tools, news, calendar, import, and export features are unlocked." : "Unlock AI analysis, full analytics, Market Pulse news, CSV import, and premium journal tools."}
              </Text>
            </View>
          </View>
          {!isPremium && (
            <>
              <SettingsBenefitLine>AI Trade Analysis with educational feedback</SettingsBenefitLine>
              <SettingsBenefitLine>AI Pattern Detective — surface hidden blind spots and recurring patterns</SettingsBenefitLine>
              <SettingsBenefitLine>Prop Firm Coach: survival score, pass probability, and daily buffer</SettingsBenefitLine>
              <SettingsBenefitLine>Rule-violation risk alerts and revenge-trading detection</SettingsBenefitLine>
              <SettingsBenefitLine>Hidden leak detection to protect your edge</SettingsBenefitLine>
              <SettingsBenefitLine>Unlimited trade journaling</SettingsBenefitLine>
              <SettingsBenefitLine>Save screenshots, photos, and voice notes for every setup</SettingsBenefitLine>
              <SettingsBenefitLine>Cloud sync and backup across all your devices</SettingsBenefitLine>
              <SettingsBenefitLine>Import your trading history with CSV</SettingsBenefitLine>
              <SettingsBenefitLine>Export and share journal reports</SettingsBenefitLine>
              <SettingsBenefitLine>Track Profit Factor, Expectancy, Sharpe Ratio, Consistency, and Drawdown</SettingsBenefitLine>
              <SettingsBenefitLine>Discover your most profitable symbols, sessions, and trading hours</SettingsBenefitLine>
              <SettingsBenefitLine>Session heatmap and trading-hour edge analysis</SettingsBenefitLine>
              <SettingsBenefitLine>Trading Score, achievements, and trader status progression</SettingsBenefitLine>
              <SettingsBenefitLine>Advanced performance analytics and edge tracking</SettingsBenefitLine>
              <SettingsBenefitLine>Full trader performance profile and radar analysis</SettingsBenefitLine>
              <SettingsBenefitLine>Daily prop firm risk reminders and notifications</SettingsBenefitLine>
              <SettingsBenefitLine>Real-time Market Pulse news and financial updates</SettingsBenefitLine>
              <SettingsBenefitLine>Multi-day economic calendar with CPI, PPI, FOMC, NFP, GDP, and more</SettingsBenefitLine>
              <SubscriptionLegalDisclosure
                monthlyPackage={packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null}
                monthlyProduct={storeProducts.find((product) => product.identifier === YOU_TRADER_MONTHLY_PRODUCT_ID) || null}
                yearlyPackage={packages.find((pkg) => packageTitle(pkg) === "YEARLY") || null}
                yearlyProduct={storeProducts.find((product) => product.identifier === YOU_TRADER_YEARLY_PRODUCT_ID) || null}
                compact
              />
            </>
          )}
          {!isPremium ? (
            <View style={styles.subscriptionPlanGrid}>
              <Pressable
                disabled={purchaseBusy}
                onPress={() =>
                  onPurchase(
                    packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null,
                    YOU_TRADER_MONTHLY_PRODUCT_ID,
                  )
                }
                style={[styles.secondaryBig, styles.purpleAction, { flex: 1 }, purchaseBusy && styles.disabledBtn]}
              >
                <Text style={styles.secondaryText}>Monthly • $12.99</Text>
              </Pressable>
              <Pressable
                disabled={purchaseBusy}
                onPress={() =>
                  onPurchase(
                    packages.find((pkg) => packageTitle(pkg) === "YEARLY") || null,
                    YOU_TRADER_YEARLY_PRODUCT_ID,
                  )
                }
                style={[styles.secondaryBig, styles.greenProAction, { flex: 1 }, purchaseBusy && styles.disabledBtn]}
              >
                <Text style={[styles.secondaryText, styles.greenActionText]}>Yearly • $99.99</Text>
              </Pressable>
            </View>
          ) : null}
          {!isPremium && (showRestorePurchases || !!paywallError) ? (
            <Pressable
              disabled={purchaseBusy}
              onPress={onRestore}
              style={[styles.secondaryBig, styles.restorePurchaseBtn, purchaseBusy && styles.disabledBtn]}
            >
              <Text style={styles.secondaryText}>{purchaseBusy ? "Checking..." : "Restore Purchases"}</Text>
            </Pressable>
          ) : null}
          {!!paywallError && <Text style={[styles.sub, { color: C.red, marginTop: 8 }]}>{paywallError}</Text>}
        </GlassCard>

        <Card>
          <Text style={styles.h2}>{t("language")}</Text>
          <View style={styles.langRow}>
            {(["en", "ru", "es", "fr", "it", "uk", "de"] as Lang[]).map((l) => (
              <Pressable
                key={l}
                onPress={() => choose(l)}
                style={[styles.optionSmall, lang === l && styles.optionActive]}
              >
                <Text style={styles.optionText}>{l.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.h2}>Legal</Text>
          <Pressable onPress={() => Alert.alert("Terms, Risk Disclosure & Privacy", legalInfo)} style={styles.legalRow}>
            <Text style={styles.legalText}>Terms, Risk Disclosure & Privacy</Text>
            <Text style={styles.legalArrow}>›</Text>
          </Pressable>
          <Pressable onPress={() => openLegalUrl(TERMS_OF_USE_EULA_URL, "Terms of Use (EULA)")} style={[styles.legalRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.legalText}>Terms of Use (EULA)</Text>
            <Text style={styles.legalArrow}>›</Text>
          </Pressable>
        </Card>

        <Card>
          <Text style={styles.h2}>Support</Text>
          <Text style={styles.sub}>
            Contact us or report bugs and app issues.
          </Text>
          <Pressable
            onPress={() => Linking.openURL("mailto:support@borovikgroup.com?subject=YouTrader Support")}
            style={[styles.secondaryBig, { marginTop: 14 }]}
          >
            <Text style={styles.secondaryText}>support@borovikgroup.com</Text>
          </Pressable>
        </Card>

      </View>

      <View>
        <Text style={styles.versionText}>v1.5.4 (51) • Review</Text>
        <Text style={styles.madeByText}>MADE BY A TRADER, FOR TRADERS</Text>
      </View>
    </ScrollView>
  );
}

function TabGlyph({ id, active }: { id: Tab; active: boolean }) {
  const color = active ? "#96FF00" : "#7D8795";
  const iconProps = { size: 27.8, color, strokeWidth: 2.35 };
  if (id === "journal") return <BookOpen {...iconProps} />;
  if (id === "stats") return <ChartColumnIncreasing {...iconProps} />;
  if (id === "ai") return <BrainCircuit {...iconProps} />;
  if (id === "calc") return <CalculatorIcon {...iconProps} />;
  if (id === "news") return <Newspaper {...iconProps} />;
  if (id === "calendar") return <CalendarDays {...iconProps} />;
  if (id === "settings") return <SettingsIcon {...iconProps} />;
  return null;
}

function TabButton({
  id,
  label,
  active,
  onPress,
}: {
  id: Tab;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const activeAnim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(activeAnim, {
      toValue: active ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [active, activeAnim]);

  const scale = activeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1] });
  const indicatorScale = activeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Animated.View
        style={[
          styles.tabIconWrap,
          active && styles.tabIconGlow,
          { transform: [{ scale }] },
        ]}
      >
        <TabGlyph id={id} active={active} />
      </Animated.View>
      <Text
        style={[styles.tabText, active && styles.tabTextActive]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.56}
      >
        {label}
      </Text>
      <Animated.View
        style={[
          styles.tabActiveUnderline,
          {
            opacity: activeAnim,
            transform: [{ scaleX: indicatorScale }],
          },
        ]}
      />
    </Pressable>
  );
}

type AppErrorBoundaryState = { error: Error | null };

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureAppError(error, { componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <SafeAreaProvider>
          <SafeAreaView style={styles.app}>
            <View style={[styles.lockScreen, { padding: 24 }]}>
              <Text style={styles.h1}>YouTrader</Text>
              <Text style={[styles.sub, { marginTop: 10 }]}>
                The app could not start after the update. Please reinstall from the App Store once a new build is available.
              </Text>
              <Text style={[styles.sub, { color: C.red, marginTop: 12 }]}>
                Something went wrong. Please try again after restarting the app.
              </Text>
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [tab, setTab] = useState<Tab>("journal");
  const [lang, setLang] = useState<Lang>("en");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesHydrated, setTradesHydrated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [revenueCatReady, setRevenueCatReady] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [proAccess, setProAccess] = useState<ProAccessState>(() => emptyProAccessState());
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [storeProducts, setStoreProducts] = useState<PurchasesStoreProduct[]>([]);
  const [paywallError, setPaywallError] = useState("");
  const [showRestorePurchases, setShowRestorePurchases] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"off" | "syncing" | "synced" | "error">("off");
  const [cloudSyncMessage, setCloudSyncMessage] = useState("Sign in and upgrade to Pro to sync your journal.");
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [propRiskOpen, setPropRiskOpen] = useState(false);
  const [propRiskDate, setPropRiskDate] = useState(todayISO());
  const [propTemplates, setPropTemplates] = useState<RiskTemplate[]>(FALLBACK_PROP_RULES);
  const [propRulesMeta, setPropRulesMeta] = useState<{ source: "remote" | "cache" | "fallback"; updatedAt?: string }>({
    source: "fallback",
  });
  const [lockScreenBufferEnabled, setLockScreenBufferEnabled] = useState(false);
  const purchasesConfigured = useRef(false);
  const cloudSyncInFlight = useRef(false);
  const customerInfoRef = useRef<CustomerInfo | null>(null);
  const serverEntitlementActiveRef = useRef(false);

  const authConfigured = false;
  const revenueCatConfigured = isRevenueCatConfigured;
  const isPremium = proAccess.isPro;
  const cloudSyncEnabled = false;
  const currentTradeSignature = useMemo(() => tradesSignature(trades), [trades]);

  useEffect(() => {
    trackEvent("app_opened");
  }, []);

  useEffect(() => {
    trackScreen(tab);
    logCrashlyticsBreadcrumb("screen_view", { tab });
  }, [tab]);

  useEffect(() => {
    if (tradesHydrated) recordMetric("journal_trade_count", trades.length);
  }, [trades.length, tradesHydrated]);

  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(PROP_RULES_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as { templates?: unknown[]; updatedAt?: string };
          const normalized = Array.isArray(parsed.templates)
            ? parsed.templates
                .map((row) => normalizeRemoteTemplate(row))
                .filter((x): x is RiskTemplate => Boolean(x))
            : [];
          if (normalized.length) {
            setPropTemplates(normalized);
            setPropRulesMeta({ source: "cache", updatedAt: parsed.updatedAt });
          }
        }
      } catch {
        // ignore cache parsing issues
      }
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from("prop_firms")
          .select("slug,name,account_name,account_size,daily_loss_limit,max_loss_limit,evaluation_contracts,live_contracts,trailing_drawdown,rules,created_at")
          .order("account_size", { ascending: true });
        if (error) throw error;
        const normalized = (data || [])
          .map((row) => normalizeRemoteTemplate(row))
          .filter((x): x is RiskTemplate => Boolean(x));
        if (normalized.length) {
          const updatedAt = new Date().toISOString();
          setPropTemplates(normalized);
          setPropRulesMeta({ source: "remote", updatedAt });
          await AsyncStorage.setItem(
            PROP_RULES_CACHE_KEY,
            JSON.stringify({ templates: data, updatedAt }),
          );
        }
      } catch (error) {
        logger.error(error, { feature: "supabase", action: "load_prop_firms", table: "prop_firms" });
        // keep cache/fallback if remote request fails
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(LANG_STORAGE_KEY).then((v) => {
      if (v && ["en", "ru", "es", "fr", "it", "uk", "de"].includes(v))
        setLang(v as Lang);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(TRADES_STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        try {
          setTrades(normalizeTrades(JSON.parse(value)));
        } catch {
          AsyncStorage.removeItem(TRADES_STORAGE_KEY);
        }
      })
      .finally(() => setTradesHydrated(true));
    const safety = setTimeout(() => setTradesHydrated(true), 4000);
    return () => clearTimeout(safety);
  }, []);

  useEffect(() => {
    if (!tradesHydrated) return;
    AsyncStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(normalizeTrades(trades)));
  }, [trades, tradesHydrated]);

  const applyCustomerInfo = useCallback((info: CustomerInfo, reason: string) => {
    customerInfoRef.current = info;
    setCustomerInfo(info);
    const nextAccess = buildProAccessState(info, serverEntitlementActiveRef.current);
    setProAccess(nextAccess);
    if (nextAccess.isPro) {
      setPaywallError("");
      setShowRestorePurchases(false);
    }
    billingDebugLog("customer info updated", {
      reason,
      ...summarizeCustomerInfo(info),
      finalIsPro: nextAccess.isPro,
      source: nextAccess.source,
    });
    return nextAccess.isPro;
  }, []);

  const applyServerEntitlement = useCallback((active: boolean, reason: string) => {
    serverEntitlementActiveRef.current = active;
    const nextAccess = buildProAccessState(customerInfoRef.current, active);
    setProAccess(nextAccess);
    billingDebugLog("server entitlement updated", {
      reason,
      serverEntitlementActive: active,
      finalIsPro: nextAccess.isPro,
      source: nextAccess.source,
    });
    return nextAccess.isPro;
  }, []);

  const refreshRevenueCat = useCallback(async () => {
    if (!purchasesConfigured.current) {
      return { packages: [] as PurchasesPackage[], storeProducts: [] as PurchasesStoreProduct[] };
    }
    try {
      const [nextCustomerInfo, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      const availablePackages = offerings.current?.availablePackages || [];
      // Safe diagnostics (no user PII) — confirm the default offering exposes both
      // monthly + yearly packages and the shared entitlement is wired correctly.
      billingDebugLog("offerings received", {
        currentOfferingId: offerings.current?.identifier || null,
        allOfferingIds: Object.keys(offerings.all || {}),
        availablePackageIds: availablePackages.map((pkg) => pkg.identifier),
        availableProductIds: availablePackages.map((pkg) => pkg.product.identifier),
        expectedProductIds: YOU_TRADER_PRO_PRODUCT_IDS,
        entitlement: summarizeCustomerInfo(nextCustomerInfo),
      });
      applyCustomerInfo(nextCustomerInfo, "refreshRevenueCat");
      setPackages(availablePackages);
      if (availablePackages.length) {
        setStoreProducts([]);
        setPaywallError("");
        return { packages: availablePackages, storeProducts: [] as PurchasesStoreProduct[] };
      }
      // Fallback when no offering is configured: load both products directly.
      const products = await Purchases.getProducts(YOU_TRADER_PRO_PRODUCT_IDS);
      billingDebugLog("products fallback loaded", {
        requestedProductIds: YOU_TRADER_PRO_PRODUCT_IDS,
        loadedProductIds: products.map((product) => product.identifier),
      });
      setStoreProducts(products);
      setPaywallError(
        products.length
          ? ""
          : "Subscription is being prepared. Please try again in a moment.",
      );
      return { packages: [] as PurchasesPackage[], storeProducts: products };
    } catch (error: any) {
      logger.error(error, { feature: "revenuecat", action: "refresh_catalog" });
      const message = userFacingBillingError(error?.message || "RevenueCat connection failed.");
      setPaywallError(message);
      return { packages: [] as PurchasesPackage[], storeProducts: [] as PurchasesStoreProduct[] };
    }
  }, [applyCustomerInfo]);

  useEffect(() => {
    if (!revenueCatConfigured || purchasesConfigured.current) return;
    try {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.WARN);
      Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      purchasesConfigured.current = true;
      setRevenueCatReady(true);
      refreshRevenueCat();
      const listener = (info: CustomerInfo) => {
        applyCustomerInfo(info, "customerInfoUpdateListener");
      };
      Purchases.addCustomerInfoUpdateListener(listener);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(listener);
      };
    } catch (error: any) {
      logger.error(error, { feature: "revenuecat", action: "configure" });
      setPaywallError(userFacingBillingError(error?.message || "RevenueCat setup failed."));
    }
  }, [refreshRevenueCat, revenueCatConfigured]);

  useEffect(() => {
    if (!purchasesConfigured.current || !session?.user.id) return;
    Purchases.logIn(session.user.id)
      .then(({ customerInfo: nextCustomerInfo }) => applyCustomerInfo(nextCustomerInfo, "logIn"))
      .then(refreshRevenueCat)
      .catch((error) => {
        logger.error(error, { feature: "revenuecat", action: "log_in" });
      });
  }, [applyCustomerInfo, refreshRevenueCat, session?.user.id]);

  const refreshLockScreenBufferReminder = useCallback(async () => {
    const [enabledRaw, templateKeyRaw, modeRaw] = await Promise.all([
      AsyncStorage.getItem(LOCK_SCREEN_BUFFER_KEY),
      AsyncStorage.getItem("prop-risk-template-v1"),
      AsyncStorage.getItem("prop-risk-mode-v1"),
    ]);
    const enabled = enabledRaw === "on";
    setLockScreenBufferEnabled(enabled);
    if (!enabled) {
      await scheduleDailyPropRiskNotification({ enabled: false, title: "", body: "" });
      return;
    }
    const templateKey = templateKeyRaw || propTemplates[0]?.key || FALLBACK_PROP_RULES[0].key;
    const mode: FirmMode = modeRaw === "funded" ? "funded" : "evaluation";
    const snapshot = computePropRiskSnapshot({
      trades,
      selectedDate: todayISO(),
      templateKey,
      mode,
      templates: propTemplates,
    });
    await scheduleDailyPropRiskNotification({
      enabled: true,
      title: `YouTrader • ${snapshot.template.label}`,
      body: `Daily buffer ${moneyCompact(snapshot.dailyRemaining)} • ${snapshot.status} • Day P&L ${moneyCompact(snapshot.dayPnl)}`,
    });
  }, [trades, propTemplates]);

  useEffect(() => {
    AsyncStorage.getItem(LOCK_SCREEN_BUFFER_KEY).then((value) => {
      setLockScreenBufferEnabled(value === "on");
    });
  }, []);

  useEffect(() => {
    if (!tradesHydrated) return;
    refreshLockScreenBufferReminder().catch(() => {});
  }, [tradesHydrated, refreshLockScreenBufferReminder]);

  const importTradesFromCsv = useCallback(async () => {
    try {
      const limit = await checkClientRateLimit("csv:import", session?.user.id || "local");
      if (!limit.allowed) {
        Alert.alert("Import trades", SECURITY_MESSAGES.rateLimited);
        return;
      }
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "text/plain",
          "application/vnd.ms-excel",
          "public.comma-separated-values-text",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
      const asset = picked.assets[0];
      const csvUploadCheck = await validateSecureUploadInput({
        uri: asset.uri,
        category: "csv",
        originalName: asset.name || "trades.csv",
        mimeType: asset.mimeType || "text/csv",
      });
      if (!csvUploadCheck.ok) {
        await recordSecurityEvent("invalid_csv_import", "csv:import", session?.user.id || "local");
        Alert.alert("Import trades", SECURITY_MESSAGES.invalidUpload);
        return;
      }
      const text = await readCsvFileAsText(asset.uri);
      const byteLength = new TextEncoder().encode(text).length;
      const sourceRows = text.split(/\r?\n/).filter(Boolean).length;
      const importCheck = validateImportedRows(sourceRows, byteLength);
      if (!importCheck.ok) {
        await recordSecurityEvent("invalid_csv_import", "csv:import", session?.user.id || "local");
        Alert.alert(
          "Import trades",
          importCheck.reason === "too_large" ? SECURITY_MESSAGES.csvTooLarge : SECURITY_MESSAGES.csvTooManyRows,
        );
        return;
      }
      const rows = parseTradesCsvText(text);
      if (!rows.length) {
        Alert.alert(
          "Import trades",
          "No trades found. Use header row: date, symbol, direction, pnl (optional: entry, exit, contracts, notes).",
        );
        return;
      }
      const imported: Trade[] = rows.flatMap((row) => {
        const validated = validateTradeInput({
          ...row,
          stopLoss: null,
          takeProfit: null,
          notes: row.notes || "Imported from CSV",
        });
        if (!validated.ok) return [];
        return [{
          id: uid(),
          date: row.date,
          symbol: validated.value.symbol,
          direction: validated.value.direction as Direction,
          entry: validated.value.entry,
          exit: validated.value.exit,
          contracts: validated.value.contracts,
          pnl: validated.value.pnl,
          mood: validated.value.mood,
          notes: validated.value.notes || "Imported from CSV",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }];
      });
      if (!imported.length) {
        await recordSecurityEvent("invalid_csv_rows", "csv:import", session?.user.id || "local");
        Alert.alert("Import trades", SECURITY_MESSAGES.invalidTrade);
        return;
      }
      const claimed = await claimRemoteIdempotency("csv:import", session?.user.id, {
        sourceHash: stableSecurityHash(text),
        rowCount: imported.length,
      });
      if (!claimed) {
        Alert.alert("Import trades", SECURITY_MESSAGES.duplicateRequest);
        return;
      }
      setTrades((prev) => [...imported, ...prev]);
      Alert.alert("Import complete", `${imported.length} trades added to your journal.`);
    } catch (error) {
      alertExportError("CSV import failed", error);
    }
  }, [session?.user.id]);

  const toggleLockScreenBuffer = useCallback(
    async (enabled: boolean) => {
      setLockScreenBufferEnabled(enabled);
      await AsyncStorage.setItem(LOCK_SCREEN_BUFFER_KEY, enabled ? "on" : "off");
      await refreshLockScreenBufferReminder();
    },
    [refreshLockScreenBufferReminder],
  );

  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((error) => {
        logger.error(error, { feature: "supabase", action: "get_session" });
      });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshServerEntitlement = async () => {
      if (!supabase || !session?.user.id) {
        if (!cancelled) applyServerEntitlement(false, "no-session");
        return;
      }
      try {
        const { data, error } = await supabase
          .from("user_subscriptions")
          .select("status,expires_at")
          .eq("user_id", session.user.id)
          .eq("entitlement_id", REVENUECAT_ENTITLEMENT_ID)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) applyServerEntitlement(serverSubscriptionHasPro(data as ServerSubscriptionRow | null), "supabase");
      } catch (error) {
        logger.error(error, { feature: "supabase", action: "refresh_server_entitlement", table: "user_subscriptions" });
        if (!cancelled) applyServerEntitlement(false, "supabase-error");
      }
    };
    refreshServerEntitlement();
    return () => {
      cancelled = true;
    };
  }, [applyServerEntitlement, session?.user.id]);

  useEffect(() => {
    if (!supabase || Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const handleUrl = (url: string) => {
      createSessionFromAuthUrl(url).catch((error) => {
        logger.error(error, { feature: "supabase", action: "create_session_from_url" });
        Alert.alert("Sign in failed", "Please try again.");
      });
    };
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  const syncTradesWithCloud = useCallback(async () => {
    if (!supabase || !session?.user.id || !isPremium || !tradesHydrated) {
      setCloudSyncStatus("off");
      setCloudSyncMessage(
        !session?.user.id
          ? "Sign in to sync your journal across devices."
          : !isPremium
            ? "Pro journal tools are active."
            : "Journal is waiting for local data to load.",
      );
      return;
    }
    if (cloudSyncInFlight.current) return;
    cloudSyncInFlight.current = true;
    setCloudSyncStatus("syncing");
    setCloudSyncMessage("Syncing journal with cloud...");
    try {
      const { data, error } = await withTimeout(supabase
        .from("trade_journal")
        .select("*")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false }));
      if (error) throw error;

      const cloudRows = (data || []) as TradeJournalRow[];
      const activeCloudSignature = tradesSignature(
        cloudRows.filter((row) => !row.deleted_at).map(cloudRowToTrade),
      );
      const merged = mergeLocalAndCloudTrades(trades, cloudRows);
      const mergedSignature = tradesSignature(merged);
      if (mergedSignature !== currentTradeSignature) {
        setTrades(merged);
      }

      if (merged.length && mergedSignature !== activeCloudSignature) {
        const safeTrades = merged.filter((trade) =>
          validateTradeInput({
            symbol: trade.symbol,
            direction: trade.direction,
            entry: trade.entry ?? null,
            exit: trade.exit ?? null,
            contracts: trade.contracts,
            stopLoss: trade.stopLoss ?? null,
            takeProfit: trade.takeProfit ?? null,
            pnl: trade.pnl,
            mood: trade.mood,
            notes: trade.notes,
            tags: trade.tags || [],
          }).ok,
        );
        if (safeTrades.length !== merged.length) {
          await recordSecurityEvent("invalid_trade_blocked_cloud_sync", "trade:update", session.user.id);
        }
        const rows = safeTrades.map((trade) => tradeToCloudRow(trade, session.user.id));
        if (rows.length) {
          const claimed = await claimRemoteIdempotency("trade:cloud-upsert", session.user.id, rows);
          if (claimed) {
            const { error: upsertError } = await withTimeout(supabase
              .from("trade_journal")
              .upsert(rows, { onConflict: "user_id,client_id" }));
            if (upsertError) throw upsertError;
          }
        }
      }

      const syncedAt = new Date().toISOString();
      setLastCloudSyncAt(syncedAt);
      setCloudSyncStatus("synced");
      setCloudSyncMessage(`Synced ${merged.length} trades across devices.`);
    } catch (error: any) {
      logger.error(error, { feature: "supabase", action: "sync_trades", table: "trade_journal", userId: session?.user.id });
      setCloudSyncStatus("error");
      setCloudSyncMessage("Journal update failed. Please try again.");
    } finally {
      cloudSyncInFlight.current = false;
    }
  }, [currentTradeSignature, isPremium, session?.user.id, trades, tradesHydrated]);

  const markCloudTradeDeleted = useCallback(async (tradeId: string) => {
    if (!supabase || !session?.user.id || !isPremium) return;
    try {
      const now = new Date().toISOString();
      const claimed = await claimRemoteIdempotency("trade:cloud-delete", session.user.id, { tradeId, now });
      if (!claimed) return;
      await withTimeout(supabase
        .from("trade_journal")
        .update({ deleted_at: now, updated_at: now })
        .eq("user_id", session.user.id)
        .eq("client_id", tradeId));
    } catch (error) {
      logger.error(error, { feature: "supabase", action: "mark_trade_deleted", table: "trade_journal", userId: session?.user.id });
    }
  }, [isPremium, session?.user.id]);

  useEffect(() => {
    if (!cloudSyncEnabled || !tradesHydrated) {
      setCloudSyncStatus("off");
      setCloudSyncMessage(
        !session?.user.id
          ? "Sign in to sync your journal across devices."
          : !isPremium
            ? "Pro journal tools are active."
            : "Journal is waiting for local data to load.",
      );
      return;
    }
    const timeout = setTimeout(syncTradesWithCloud, 900);
    return () => clearTimeout(timeout);
  }, [cloudSyncEnabled, currentTradeSignature, isPremium, session?.user.id, syncTradesWithCloud, tradesHydrated]);

  useEffect(() => {
    if (!cloudSyncEnabled || !supabase || !session?.user.id) return;
    const channel = supabase
      .channel(`trade-journal-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trade_journal",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          syncTradesWithCloud();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [cloudSyncEnabled, session?.user.id, syncTradesWithCloud]);

  useEffect(() => {
    if (!cloudSyncEnabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncTradesWithCloud();
    });
    return () => subscription.remove();
  }, [cloudSyncEnabled, syncTradesWithCloud]);

  const signInWithProvider = useCallback(async (provider: AuthProvider) => {
    if (!supabase || !authConfigured) {
      Alert.alert(
        "Sign-in unavailable",
        "Cloud sign-in is not available in this build. You can still use the journal on this device.",
      );
      return;
    }

    setAuthBusy(true);
    try {
      const limit = await checkClientRateLimit("auth", provider);
      if (!limit.allowed) {
        Alert.alert("Sign in failed", SECURITY_MESSAGES.rateLimited);
        return;
      }
      trackEvent("signup_started", { provider });
      if (
        enableNativeAppleSignIn &&
        provider === "apple" &&
        Platform.OS === "ios" &&
        await AppleAuthentication.isAvailableAsync()
      ) {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) throw new Error("Apple did not return an identity token.");
        const { error } = await withTimeout(supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        }));
        if (error) throw error;
        if (credential.fullName?.givenName || credential.fullName?.familyName) {
          const fullName = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ");
          await supabase.auth.updateUser({
            data: {
              full_name: fullName,
              given_name: credential.fullName.givenName,
              family_name: credential.fullName.familyName,
            },
          });
        }
        trackEvent("signup_completed", { provider });
        return;
      }

      const { data, error } = await withTimeout(supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: AUTH_REDIRECT_TO,
          skipBrowserRedirect: true,
        },
      }));
      if (error) throw error;
      const result = await WebBrowser.openAuthSessionAsync(data.url || "", AUTH_REDIRECT_TO);
      if (result.type === "success") {
        await createSessionFromAuthUrl(result.url);
        trackEvent("signup_completed", { provider });
      }
    } catch (error: any) {
      if (error?.code !== "ERR_REQUEST_CANCELED") {
        logger.error(error, { feature: "supabase", action: "sign_in", provider });
        Alert.alert("Sign in failed", "Please try again.");
      }
    } finally {
      setAuthBusy(false);
    }
  }, [authConfigured]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.error(error, { feature: "supabase", action: "sign_out" });
      Alert.alert("Sign out failed", "Please try again.");
    }
  }, []);

  const refreshCurrentEntitlements = useCallback(async (reason: string, retryDelays = ENTITLEMENT_RETRY_DELAYS_MS) => {
    if (!purchasesConfigured.current) return null;
    let latestInfo: CustomerInfo | null = null;
    for (const [attempt, delay] of retryDelays.entries()) {
      if (delay > 0) await sleep(delay);
      try {
        await Purchases.invalidateCustomerInfoCache();
      } catch (error: any) {
        logger.error(error, { feature: "revenuecat", action: "invalidate_customer_info_cache", attempt: attempt + 1 });
        billingDebugLog("customer info cache invalidation failed", {
          reason,
          attempt: attempt + 1,
          message: error?.message,
        });
      }
      latestInfo = await Purchases.getCustomerInfo();
      const hasPro = applyCustomerInfo(latestInfo, `${reason}:attempt-${attempt + 1}`);
      billingDebugLog("entitlement refresh result", {
        reason,
        attempt: attempt + 1,
        ...summarizeCustomerInfo(latestInfo),
        finalIsPro: hasPro,
      });
      if (hasPro) return latestInfo;
    }
    return latestInfo;
  }, [applyCustomerInfo]);

  const finishPurchaseFlow = useCallback(async (result: MakePurchaseResult, reason: string) => {
    const resultProductId = result.productIdentifier || result.transaction?.productIdentifier || "";
    await claimRemoteIdempotency("subscription:purchase-verify", session?.user.id, {
      productId: resultProductId,
      entitlement: REVENUECAT_ENTITLEMENT_ID,
      hasPro: customerHasPro(result.customerInfo),
    });
    billingDebugLog("purchase result", {
      reason,
      productId: resultProductId,
      transactionId: result.transaction?.transactionIdentifier,
      transactionProductId: result.transaction?.productIdentifier,
      transactionDate: result.transaction?.purchaseDate,
      ...summarizeCustomerInfo(result.customerInfo),
    });

    if (resultProductId !== YOU_TRADER_MONTHLY_PRODUCT_ID) {
      const message = "Purchase completed for a different product. Please contact support.";
      setPaywallError(message);
      setShowRestorePurchases(true);
      trackEvent("purchase_failed", { reason: "wrong_product" });
      Alert.alert("Purchase issue", message);
      return;
    }

    if (applyCustomerInfo(result.customerInfo, `${reason}:purchase-result`)) {
      logger.info("RevenueCat purchase unlocked Pro", { feature: "revenuecat", action: "purchase_success", reason });
      trackEvent("purchase_success", { reason });
      Alert.alert("YouTrader Pro", "YouTrader Pro unlocked.");
      return;
    }

    const refreshedInfo = await refreshCurrentEntitlements(reason);
    if (customerHasPro(refreshedInfo)) {
      logger.info("RevenueCat entitlement refresh unlocked Pro", { feature: "revenuecat", action: "purchase_success_after_refresh", reason });
      trackEvent("purchase_success", { reason });
      Alert.alert("YouTrader Pro", "YouTrader Pro unlocked.");
      return;
    }

    setShowRestorePurchases(true);
    setPaywallError("Purchase completed, but the subscription is not readable yet. Tap Restore Purchases.");
    logger.warn("RevenueCat purchase completed without readable entitlement", { feature: "revenuecat", action: "entitlement_unreadable" });
    trackEvent("purchase_failed", { reason: "entitlement_unreadable" });
    Alert.alert(
      "Purchase complete",
      "The purchase completed, but the subscription is not readable yet. Tap Restore Purchases.",
    );
  }, [applyCustomerInfo, refreshCurrentEntitlements, session?.user.id]);

  const purchasePackage = useCallback(async (pkg?: PurchasesPackage | null, productId = YOU_TRADER_MONTHLY_PRODUCT_ID) => {
    if (!revenueCatConfigured || !purchasesConfigured.current) {
      Alert.alert(
        "YouTrader Pro",
        "Subscriptions are not available in this build. Please update the app from the App Store.",
      );
      return;
    }
    // Accept any known Pro product id (monthly OR yearly). Both unlock the same entitlement.
    if (!YOU_TRADER_PRO_PRODUCT_IDS.includes(productId)) {
      const message = "Subscription product is not configured correctly for this build.";
      setPaywallError(message);
      trackEvent("purchase_failed", { reason: "product_config_mismatch" });
      billingDebugLog("product id mismatch", {
        expectedProductIds: YOU_TRADER_PRO_PRODUCT_IDS,
        requestedProductId: productId,
      });
      Alert.alert("YouTrader Pro", message);
      return;
    }
    const isYearly = productId === YOU_TRADER_YEARLY_PRODUCT_ID;

    setPurchaseBusy(true);
    setShowRestorePurchases(false);
    try {
      const limit = await checkClientRateLimit("purchase", session?.user.id || "local");
      if (!limit.allowed) {
        Alert.alert("YouTrader Pro", SECURITY_MESSAGES.rateLimited);
        return;
      }
      logger.info("RevenueCat purchase started", { feature: "revenuecat", action: "purchase_started" });
      trackEvent("subscribe_pressed");
      billingDebugLog("purchase started", { productId });
      let catalogPackages = packages;
      let catalogProducts = storeProducts;
      const needsCatalog =
        !catalogPackages.length &&
        !catalogProducts.some((product) => product.identifier === productId);
      if (needsCatalog) {
        const refreshed = await refreshRevenueCat();
        catalogPackages = refreshed.packages;
        catalogProducts = refreshed.storeProducts;
      }

      const requestedPackage = pkg?.product.identifier === productId ? pkg : null;
      const selectedPackage =
        requestedPackage ||
        findProPackage(catalogPackages, productId);

      if (selectedPackage) {
        const result = await withTimeout(Purchases.purchasePackage(selectedPackage));
        await finishPurchaseFlow(result, "purchasePackage");
        return;
      }

      // Only fall back to the SAME product id (never silently buy monthly when yearly
      // was requested). For yearly, if it isn't in the offering yet, surface a friendly
      // message instead of a developer-style error or wrong-product purchase.
      const selectedProduct =
        catalogProducts.find((product) => product.identifier === productId) || null;
      if (selectedProduct) {
        const result = await withTimeout(Purchases.purchaseStoreProduct(selectedProduct));
        await finishPurchaseFlow(result, "purchaseStoreProduct");
        return;
      }

      if (isYearly) {
        const message = "Yearly plan temporarily unavailable. Please try again later.";
        setPaywallError(message);
        trackEvent("purchase_failed", { reason: "yearly_product_unavailable" });
        billingDebugLog("yearly product unavailable", {
          requestedProductId: productId,
          catalogPackageIds: catalogPackages.map((item) => item.product.identifier),
          catalogProductIds: catalogProducts.map((product) => product.identifier),
        });
        Alert.alert("YouTrader Pro", message);
        return;
      }

      const result = await withTimeout(Purchases.purchaseProduct(productId));
      await finishPurchaseFlow(result, "purchaseProduct");
    } catch (error: any) {
      if (!error?.userCancelled) {
        logger.error(error, { feature: "revenuecat", action: "purchase" });
        const message = userFacingBillingError(error?.message || "Purchase failed. Please try again.");
        setPaywallError(message);
        trackEvent("purchase_failed", { reason: "purchase_error" });
        Alert.alert("Purchase failed", message);
      }
      await refreshRevenueCat();
    } finally {
      setPurchaseBusy(false);
    }
  }, [finishPurchaseFlow, packages, refreshRevenueCat, revenueCatConfigured, session?.user.id, storeProducts]);

  const restorePurchases = useCallback(async () => {
    if (!revenueCatConfigured || !purchasesConfigured.current) {
      Alert.alert(
        "Restore Purchases",
        "Subscriptions are not available in this build. Please update the app from the App Store.",
      );
      return;
    }

    setPurchaseBusy(true);
    try {
      const limit = await checkClientRateLimit("restore", session?.user.id || "local");
      if (!limit.allowed) {
        Alert.alert("Restore Purchases", SECURITY_MESSAGES.rateLimited);
        return;
      }
      billingDebugLog("restore started", { productId: YOU_TRADER_MONTHLY_PRODUCT_ID });
      const info = await withTimeout(Purchases.restorePurchases());
      await claimRemoteIdempotency("subscription:restore", session?.user.id, {
        entitlement: REVENUECAT_ENTITLEMENT_ID,
        hasPro: customerHasPro(info),
        hour: new Date().toISOString().slice(0, 13),
      });
      billingDebugLog("restore result", summarizeCustomerInfo(info));
      const hasPro = applyCustomerInfo(info, "restorePurchases");
      const refreshedInfo = hasPro ? info : await refreshCurrentEntitlements("restorePurchases", [0, 1200, 2400]);
      if (customerHasPro(refreshedInfo)) {
        logger.info("RevenueCat restore unlocked Pro", { feature: "revenuecat", action: "restore_success" });
        setPaywallError("");
        setShowRestorePurchases(false);
        Alert.alert("YouTrader Pro", "YouTrader Pro unlocked.");
      } else {
        logger.warn("RevenueCat restore found no active subscription", { feature: "revenuecat", action: "restore_no_active_subscription" });
        setShowRestorePurchases(true);
        Alert.alert("Restore Purchases", "No active subscription found.");
      }
    } catch (error: any) {
      logger.error(error, { feature: "revenuecat", action: "restore" });
      billingDebugLog("restore failed", { message: error?.message });
      const message = "Could not restore purchases. Please try again.";
      setPaywallError(message);
      Alert.alert("Restore Purchases", message);
    } finally {
      setPurchaseBusy(false);
    }
  }, [applyCustomerInfo, refreshCurrentEntitlements, revenueCatConfigured, session?.user.id]);

  const appReady = tradesHydrated;

  if (!appReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.app}>
          <StatusBar style="light" backgroundColor="#000000" />
          <View style={styles.lockScreen}>
            <Text style={styles.h1}>YouTrader</Text>
            <ActivityIndicator color={C.green} style={{ marginTop: 18 }} />
            <Text style={[styles.sub, { marginTop: 12 }]}>Loading your journal…</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "journal", label: tText(lang, "journal") },
    { id: "stats", label: tText(lang, "stats") },
    { id: "calc", label: tText(lang, "calc") },
    { id: "ai", label: "AI Analytics" },
    { id: "news", label: tText(lang, "news") },
    { id: "calendar", label: tText(lang, "calendar") },
    { id: "settings", label: tText(lang, "settings") },
  ];
  const premiumTabs: Tab[] = [];
  const locked = !isPremium && premiumTabs.includes(tab);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.app}>
        <StatusBar style="light" backgroundColor="#000000" />
        <View style={styles.body}>
          {locked ? (
            <PremiumScreen
              lang={lang}
              onClose={() => setTab("calc")}
              packages={packages}
              storeProducts={storeProducts}
              purchaseBusy={purchaseBusy}
              paywallError={paywallError}
              showRestorePurchases={showRestorePurchases}
              onPurchase={purchasePackage}
              onRestore={restorePurchases}
            />
          ) : tab === "journal" ? (
            <JournalScreen
              lang={lang}
              trades={trades}
              propTemplates={propTemplates}
              setTrades={setTrades}
              isPremium={isPremium}
              onOpenPropRisk={(date) => {
                setPropRiskDate(date);
                setPropRiskOpen(true);
              }}
              onUpgrade={() => purchasePackage(packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null, YOU_TRADER_MONTHLY_PRODUCT_ID)}
              onTradeDeleted={markCloudTradeDeleted}
            />
          ) : tab === "stats" ? (
            <StatsScreen
              lang={lang}
              trades={trades}
              propTemplates={propTemplates}
              isPremium={isPremium}
              packages={packages}
              storeProducts={storeProducts}
              purchaseBusy={purchaseBusy}
              paywallError={paywallError}
              showRestorePurchases={showRestorePurchases}
              onPurchase={purchasePackage}
              onRestore={restorePurchases}
              session={session}
            />
          ) : tab === "ai" ? (
            <AiAnalysisScreen
              trades={trades}
              propTemplates={propTemplates}
              isPremium={isPremium}
              packages={packages}
              storeProducts={storeProducts}
              purchaseBusy={purchaseBusy}
              paywallError={paywallError}
              showRestorePurchases={showRestorePurchases}
              onPurchase={purchasePackage}
              onRestore={restorePurchases}
              session={session}
            />
          ) : tab === "news" ? (
            <NewsScreen
              lang={lang}
              isPremium={isPremium}
              onUpgrade={() => purchasePackage(packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null, YOU_TRADER_MONTHLY_PRODUCT_ID)}
            />
          ) : tab === "calendar" ? (
            <CalendarScreen lang={lang} trades={trades} isPremium={isPremium} onUpgrade={() => purchasePackage(packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null, YOU_TRADER_MONTHLY_PRODUCT_ID)} />
          ) : tab === "calc" ? (
            <CalcScreen lang={lang} />
          ) : (
            <SettingsScreen
              lang={lang}
              setLang={setLang}
              session={session}
              authBusy={authBusy}
              authConfigured={authConfigured}
              isPremium={isPremium}
              packages={packages}
              storeProducts={storeProducts}
              purchaseBusy={purchaseBusy}
              revenueCatConfigured={revenueCatConfigured}
              paywallError={paywallError}
              showRestorePurchases={showRestorePurchases}
              cloudSyncEnabled={cloudSyncEnabled}
              cloudSyncStatus={cloudSyncStatus}
              cloudSyncMessage={cloudSyncMessage}
              lastCloudSyncAt={lastCloudSyncAt}
              onPurchase={purchasePackage}
              onRestore={restorePurchases}
              onSyncNow={syncTradesWithCloud}
              lockScreenBufferEnabled={lockScreenBufferEnabled}
              onToggleLockScreenBuffer={toggleLockScreenBuffer}
              onImportTradesCsv={importTradesFromCsv}
              onSignIn={signInWithProvider}
              onSignOut={signOut}
            />
          )}
        </View>
        <Modal visible={propRiskOpen} animationType="slide">
          <SafeAreaView style={styles.modal}>
            <View style={styles.propModalTopBar}>
              <Pressable onPress={() => setPropRiskOpen(false)} style={styles.closeCircleProp}>
                <Text style={styles.closeX}>×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={[styles.content, styles.propModalScroll]}>
              <PropFirmRiskCoach trades={trades} selectedDate={propRiskDate} templates={propTemplates} />
            </ScrollView>
          </SafeAreaView>
        </Modal>
        <View style={styles.tabbar}>
          {tabs.map((x) => (
            <TabButton
              key={x.id}
              id={x.id}
              label={x.label}
              active={tab === x.id}
              onPress={() => setTab(x.id)}
            />
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function AppRoot() {
  const app = (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
  if (!posthogClient) return app;
  return (
    <PostHogProvider client={posthogClient} autocapture={false}>
      {app}
    </PostHogProvider>
  );
}

export default wrapAppWithSentry(AppRoot);

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1, backgroundColor: C.bg },
  screen: { flex: 1, backgroundColor: C.bg, width: "100%" },
  content: { padding: 16, paddingBottom: 24, width: "100%", maxWidth: 980, alignSelf: "center" },
  journalContent: { flexGrow: 1, paddingTop: 8, paddingBottom: 46 },
  journalTabletContent: { paddingTop: 0, maxWidth: 1280 },
  calendarTabletContent: { maxWidth: 1280, paddingHorizontal: 24, paddingTop: 22 },
  calendarLiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(12,13,18,0.88)",
    padding: 14,
    marginBottom: 12,
  },
  calendarRefreshBtn: {
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.44)",
    backgroundColor: C.greenSoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  calendarRefreshText: {
    color: C.green,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  list: { padding: 16, paddingBottom: 24, width: "100%", maxWidth: 980, alignSelf: "center" },
  newsList: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24, width: "100%", maxWidth: 980, alignSelf: "center" },
  newsListNoTitle: { paddingTop: 14 },
  h1: {
    color: C.text,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -1,
    marginBottom: 12,
  },
  newsTitleHeader: { marginBottom: 0 },
  calendarTabletTitle: { fontSize: 38, lineHeight: 46, marginBottom: 22 },
  h1NoMargin: {
    color: C.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
    flex: 1,
  },
  h2: { color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  safeCard: {
    overflow: "hidden",
    maxWidth: "100%",
    minWidth: 0,
  },
  safeText: {
    minWidth: 0,
    maxWidth: "100%",
    flexShrink: 1,
  },
  safeMetricLabel: {
    minWidth: 0,
    maxWidth: "100%",
    flexShrink: 1,
    textTransform: "uppercase",
  },
  label: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  value: { fontSize: 21, fontWeight: "900" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  stat: { width: "48%", marginBottom: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  safeRowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },
  flexShrink: { flex: 1, minWidth: 0, maxWidth: "100%" },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pillText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  sub: { color: C.sub, fontSize: 12, lineHeight: 18 },
  notes: { color: C.text, fontSize: 14, lineHeight: 21, marginTop: 8 },
  tapHint: { color: C.green, fontSize: 11, fontWeight: "800", marginTop: 10 },
  tradeMetaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  tradeMetaChip: {
    color: C.green,
    fontSize: 10,
    fontWeight: "900",
    borderWidth: 1,
    borderColor: "rgba(150,255,0,0.34)",
    backgroundColor: C.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tradeTagChip: {
    color: C.purple,
    fontSize: 10,
    fontWeight: "900",
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.36)",
    backgroundColor: C.purpleSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  benefit: {
    color: C.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    marginTop: 6,
  },
  primaryBig: {
    backgroundColor: C.green,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  primaryText: { color: C.bg, fontWeight: "900", fontSize: 16 },
  secondaryBig: {
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  restorePurchaseBtn: {
    borderColor: "rgba(163,255,18,0.42)",
    backgroundColor: C.greenSoft,
  },
  subscriptionPlanGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  syncStatusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.muted,
    marginLeft: 10,
  },
  secondaryText: { color: C.text, fontWeight: "800" },
  authButtonStack: { gap: 10, marginTop: 14 },
  authProviderBtn: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.42)",
    backgroundColor: C.greenSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  authAppleBtn: {
    backgroundColor: C.card2,
    borderColor: "rgba(255,255,255,0.28)",
  },
  authProviderIcon: {
    width: 24,
    color: C.green,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  authProviderText: { color: C.green, fontSize: 15, fontWeight: "900" },
  disabledBtn: { opacity: 0.55 },
  faceIdButton: {
    borderColor: "rgba(176,38,255,0.42)",
    backgroundColor: C.purpleSoft,
    marginTop: 12,
  },
  lockScreen: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  lockCard: {
    width: "100%",
    maxWidth: 420,
    marginBottom: 0,
  },
  deleteBig: {
    borderColor: C.red,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    backgroundColor: C.redSoft,
  },
  deleteText: { color: C.red, fontWeight: "900" },
  segment: {
    flexDirection: "row",
    backgroundColor: C.card2,
    borderRadius: 16,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: "center",
  },
  segActive: { backgroundColor: C.purple },
  segText: { color: C.sub, fontSize: 10, fontWeight: "900" },
  segTextActive: { color: C.white },
  monthBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  monthBtnText: {
    color: C.green,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 34,
  },
  ghostBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  ghostText: { color: C.green, fontWeight: "900" },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  weekText: {
    color: C.muted,
    width: "13.2%",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 10,
  },
  journalHeader: { display: "none" },
  statsActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  statsActionBtn: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statsActionText: {
    color: C.text,
    fontWeight: "800",
    fontSize: 12,
  },
  offscreenShareCard: {
    position: "absolute",
    left: -1400,
    top: 0,
    width: 1080,
    height: 1920,
    opacity: 1,
    zIndex: -1,
    pointerEvents: "none",
  },
  achievementShareCaptureFrame: {
    width: 1080,
    height: 1920,
    backgroundColor: "#000000",
  },
  todayTop: { alignItems: "flex-end", maxWidth: 190, paddingTop: 6 },
  todayTopTitle: { color: C.text, fontSize: 16, fontWeight: "900" },
  todayTopDate: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "right",
  },
  calendarCard: {
    paddingHorizontal: 2,
    paddingTop: 14,
    paddingBottom: 8,
    marginBottom: 24,
    alignSelf: "center",
  },
  journalDateCorner: {
    position: "absolute",
    right: 18,
    top: 14,
    maxWidth: "58%",
    alignItems: "flex-end",
  },
  journalDateCornerText: {
    color: C.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    textAlign: "right",
  },
  calendarGrid: { marginTop: 10 },
  calendarRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  daySpacer: {
    marginBottom: 5,
  },
  day: {
    borderRadius: 18,
    backgroundColor: "rgba(18,20,27,0.72)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    marginBottom: 7,
    overflow: "hidden",
    paddingHorizontal: 2,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  dayProfit: { backgroundColor: "rgba(94,132,36,0.28)", borderColor: "rgba(163,255,18,0.44)" },
  dayLoss: { backgroundColor: "rgba(110,22,40,0.34)", borderColor: "rgba(255,59,95,0.42)" },
  dayActive: {
    backgroundColor: "rgba(255,255,255,0.11)",
    borderColor: "rgba(255,255,255,0.72)",
    borderWidth: 2,
  },
  dayPnlText: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "900",
    marginTop: 5,
    maxWidth: "100%",
    minWidth: 0,
    textAlign: "center",
  },
  todayMiniBadge: {
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    maxWidth: "92%",
    overflow: "hidden",
  },
  todayMiniBadgeText: {
    color: C.white,
    fontSize: 6.5,
    lineHeight: 9,
    fontWeight: "900",
    textAlign: "center",
  },
  journalScrollCue: {
    alignItems: "center",
    marginTop: -2,
    marginBottom: 18,
  },
  journalScrollCueGlass: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.55,
  },
  journalScrollCueChevron: {
    color: C.sub,
    fontSize: 14,
    lineHeight: 14,
    fontWeight: "600",
    marginTop: 1,
  },
  dayMuted: { opacity: 0.48 },
  dayNum: {
    color: "#B7BDC8",
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: "100%",
  },
  journalAddTradeButton: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.82)",
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginBottom: 18,
  },
  journalAddTradePlus: {
    color: C.green,
    fontSize: 35,
    lineHeight: 38,
    fontWeight: "400",
  },
  journalAddTradeText: {
    color: C.green,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
  },
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    paddingTop: 34,
  },
  propModalTopBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    paddingTop: 8,
    paddingRight: 16,
    paddingBottom: 0,
  },
  propModalScroll: {
    paddingTop: 4,
  },
  closeCircleProp: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.card2,
    borderColor: C.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  closeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.card2,
    borderColor: C.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  closeX: { color: C.green, fontSize: 25, fontWeight: "900", lineHeight: 26 },
  input: {
    backgroundColor: C.card2,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    color: C.text,
    padding: 14,
    fontSize: 16,
  },
  compactInput: {
    paddingVertical: 12,
    fontSize: 15,
  },
  formTwoCol: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  formTwoColItem: {
    flex: 1,
  },
  tagChipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  tradeTagButton: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card2,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  tradeTagButtonActive: {
    borderColor: C.purple,
    backgroundColor: C.purpleSoft,
  },
  tradeTagButtonText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "900",
  },
  tradeTagButtonTextActive: {
    color: C.purple,
  },
  option: {
    flex: 1,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    backgroundColor: C.card2,
  },
  optionSmall: {
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.card2,
    minWidth: 76,
    alignItems: "center",
  },
  optionActive: { backgroundColor: C.greenSoft, borderColor: C.green },
  optionShortActive: { backgroundColor: C.redSoft, borderColor: C.red },
  optionText: { color: C.text, fontWeight: "800" },
  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  moodBtn: {
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: C.card2,
    alignItems: "center",
    width: "23.3%",
    minHeight: 72,
  },
  moodEmoji: { fontSize: 22, marginBottom: 4 },
  moodText: { color: C.text, fontWeight: "800", fontSize: 10 },
  marketSection: { marginBottom: 18, gap: 10 },
  marketSectionTitle: { color: C.text, fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0, opacity: 0.92 },
  marketHeroCard: { backgroundColor: "rgba(10,18,22,0.82)", borderColor: "rgba(163,255,18,0.26)", gap: 8 },
  marketCard: { backgroundColor: "rgba(255,255,255,0.045)", borderColor: "rgba(255,255,255,0.1)", marginBottom: 8 },
  marketCostCard: { backgroundColor: "rgba(163,255,18,0.055)", borderColor: "rgba(163,255,18,0.18)" },
  marketGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  marketMiniCard: { width: "48.5%", minHeight: 138, backgroundColor: "rgba(255,255,255,0.045)", borderColor: "rgba(255,255,255,0.1)", gap: 6 },
  marketSummaryRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  marketAsset: { color: C.text, fontSize: 15, fontWeight: "900" },
  marketBias: { fontSize: 12, fontWeight: "900" },
  marketTinyLabel: { color: C.sub, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  marketBodyText: { color: C.sub, fontSize: 12, lineHeight: 18, marginTop: 6 },
  marketListText: { color: C.sub, fontSize: 12, lineHeight: 18, marginTop: 4 },
  marketCaution: { color: C.yellow, fontSize: 12, lineHeight: 18, fontWeight: "800", marginTop: 8 },
  marketEmptyText: { color: C.sub, fontSize: 12, lineHeight: 18, fontWeight: "800", paddingVertical: 8 },
  newsTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 25,
    marginTop: 10,
  },
  tradeSymbolTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
    marginTop: 2,
  },
  newsSummary: { color: C.sub, fontSize: 13, lineHeight: 20, marginTop: 8 },
  refresh: {
    borderColor: C.green,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshText: { color: C.green, fontWeight: "900" },
  assetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  assetCell: {
    width: "31.5%",
    backgroundColor: C.card2,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 7,
  },
  asset: { color: C.sub, fontSize: 10, fontWeight: "900", marginBottom: 4 },
  bigTime: {
    color: C.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -1,
  },
  dateText: { color: C.sub, fontSize: 12, fontWeight: "800", marginTop: 2 },
  intelCard: { backgroundColor: C.purpleSoft },
  smallMetric: {
    flex: 1,
    backgroundColor: C.card2,
    borderRadius: 12,
    padding: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  metric: { color: C.text, fontWeight: "800" },
  weekChip: {
    width: 88,
    borderRadius: 18,
    borderColor: C.border,
    borderWidth: 1,
    backgroundColor: C.card2,
    padding: 11,
    marginRight: 8,
    alignItems: "center",
  },
  weekChipTablet: { width: 118, minHeight: 84, paddingVertical: 16, marginRight: 12, borderRadius: 22 },
  weekChipActive: { backgroundColor: C.green, borderColor: C.green },
  weekChipDay: { color: C.text, fontWeight: "900", fontSize: 12 },
  weekChipDayTablet: { fontSize: 15 },
  weekChipDate: { color: C.sub, fontWeight: "800", fontSize: 11, marginTop: 3 },
  weekChipDateTablet: { fontSize: 14, marginTop: 5 },
  weekChipLocked: { opacity: 0.62, borderColor: "rgba(176,38,255,0.45)" },
  weekChipLock: { marginTop: 4, color: C.purple, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  weekChipLockTablet: { fontSize: 11, marginTop: 6 },
  dayAgendaCard: {
    borderColor: "rgba(163,255,18,0.24)",
    backgroundColor: "rgba(163,255,18,0.035)",
  },
  dayAgendaList: { marginTop: 12, gap: 8 },
  dayAgendaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.card2,
    padding: 10,
  },
  dayAgendaTime: {
    width: 72,
    color: C.green,
    fontSize: 12,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  dayAgendaBody: { flex: 1, minWidth: 0 },
  dayAgendaTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  dayAgendaMeta: { color: C.sub, fontSize: 11, lineHeight: 16, marginTop: 2 },
  resultBox: {
    backgroundColor: C.greenSoft,
    borderColor: C.green,
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    alignItems: "center",
    marginTop: 8,
  },
  resultBoxRed: { backgroundColor: C.redSoft, borderColor: C.red },
  result: {
    color: C.green,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1,
  },
  resultInput: {
    color: C.green,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1,
    width: "100%",
    padding: 0,
    marginTop: 4,
  },
  pnlToggleRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  pnlToggle: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: C.card2,
  },
  pnlPlusActive: { backgroundColor: C.green, borderColor: C.green },
  pnlMinusActive: { backgroundColor: C.red, borderColor: C.red },
  pnlToggleText: { color: C.text, fontWeight: "900" },
  sectionLabel: {
    color: C.green,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
    marginBottom: 4,
  },
  instrumentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    columnGap: 0,
    marginTop: 8,
    marginBottom: 10,
  },
  instrumentBtn: {
    width: "23%",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 8,
    backgroundColor: C.card2,
    minHeight: 68,
    justifyContent: "center",
  },
  instrumentSymbol: { color: C.text, fontSize: 16, fontWeight: "900" },
  instrumentName: {
    color: C.sub,
    fontSize: 9,
    fontWeight: "700",
    marginTop: 4,
  },
  tradePhoto: {
    width: 86,
    height: 86,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card2,
  },
  tradeThumb: {
    width: "100%",
    height: 220,
    borderRadius: 18,
    marginTop: 10,
    backgroundColor: C.card2,
  },
  secondaryPhoto: {
    flex: 1,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  photoModal: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  photoClose: {
    position: "absolute",
    top: 54,
    right: 20,
    zIndex: 3,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  fullPhoto: { width: "100%", height: "82%" },

  iconTile: {
    width: 30,
    height: 30,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  iconTileLarge: {
    width: 42,
    height: 42,
    borderWidth: 3,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconTileFrameless: {
    width: 48,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  journalBookmark: {
    position: "absolute",
    left: 7,
    top: -2,
    width: 10,
    height: 15,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  journalLine: {
    height: 3,
    borderRadius: 3,
    marginLeft: 7,
    marginVertical: 2,
  },
  iconLine: {
    width: 16,
    height: 2,
    borderRadius: 2,
  },
  calcGlyphText: {
    fontSize: 12,
    lineHeight: 12,
    fontWeight: "900",
  },
  statsGlyphBar: {
    width: 5,
    borderRadius: 3,
    marginHorizontal: 1,
    alignSelf: "flex-end",
  },
  statsGlyphBars: {
    height: 42,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  glyphBox: {
    width: 24,
    height: 24,
    borderWidth: 1.6,
    borderRadius: 4,
    padding: 4,
    justifyContent: "space-around",
  },
  glyphLine: { height: 2, borderRadius: 2, width: "100%" },
  calcGlyph: {
    width: 24,
    height: 24,
    borderWidth: 1.6,
    borderRadius: 5,
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 3,
    gap: 3,
  },
  calcDot: { width: 5, height: 5, borderRadius: 1.5 },
  calcDisplay: {
    position: "absolute",
    top: 6,
    left: 8,
    right: 8,
    height: 8,
    borderWidth: 2.5,
    borderRadius: 3,
  },
  calcGridLarge: {
    width: 27,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 13,
  },
  calcDotLarge: { width: 5, height: 5, borderRadius: 2 },
  calGlyph: {
    width: 24,
    height: 24,
    borderWidth: 1.6,
    borderRadius: 5,
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 4,
    paddingTop: 7,
    gap: 4,
    position: "relative",
  },
  calTop: {
    position: "absolute",
    top: 3,
    left: 4,
    right: 4,
    height: 2,
    borderRadius: 2,
  },
  calDot: { width: 5, height: 5, borderRadius: 1.5 },
  calendarRingLeft: {
    position: "absolute",
    top: -6,
    left: 10,
    width: 4,
    height: 12,
    borderRadius: 3,
  },
  calendarRingRight: {
    position: "absolute",
    top: -6,
    right: 10,
    width: 4,
    height: 12,
    borderRadius: 3,
  },
  calendarMiniGridLarge: {
    width: 25,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  calendarDotMiniLarge: { width: 5, height: 5, borderRadius: 2 },
  newsGlyph: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brainGlyph: {
    width: 48,
    height: 42,
    position: "relative",
  },
  brainHalf: {
    position: "absolute",
    top: 3,
    width: 23,
    height: 31,
    borderWidth: 3,
    borderRadius: 14,
  },
  brainStem: {
    position: "absolute",
    left: 23,
    top: 5,
    width: 3,
    height: 31,
    borderRadius: 3,
  },
  brainDot: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  newsPaperGlyph: {
    width: 48,
    height: 42,
    position: "relative",
  },
  newsPaperBack: {
    position: "absolute",
    left: 5,
    top: 8,
    width: 28,
    height: 30,
    borderWidth: 3,
    borderRadius: 6,
  },
  newsPaperFront: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 31,
    height: 34,
    borderWidth: 3,
    borderRadius: 6,
    padding: 6,
    gap: 4,
  },
  newsPaperSquare: { width: 9, height: 9, borderRadius: 2 },
  newsPaperLine: { height: 3, borderRadius: 2 },
  newsWave: {
    width: 22,
    height: 10,
    borderTopWidth: 2,
    borderRadius: 10,
    position: "absolute",
  },
  mathGlyph: { width: 25, height: 25, borderWidth: 1.6, borderRadius: 5, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  mathGlyphText: { fontSize: 10, lineHeight: 10, fontWeight: "900", letterSpacing: 0.5 },
  settingsGlyph: { fontSize: 22, lineHeight: 24, fontWeight: "900" },

  edgeCard: { borderColor: "rgba(176,38,255,0.28)", backgroundColor: "rgba(176,38,255,0.045)" },
  betaPill: { backgroundColor: C.yellow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  betaText: { color: C.bg, fontSize: 10, fontWeight: "900" },
  radarBox: { marginTop: 14, height: 210, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.018)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(176,38,255,0.18)" },
  radarTop: { top: 12, alignSelf: "center" },
  radarLeft: { left: 24, bottom: 48 },
  radarRight: { right: 18, bottom: 48 },
  radarTriangleOuter: { width: 220, height: 140, marginTop: 8, position: "relative" },
  radarTriangleLineA: { position: "absolute", left: 27, bottom: 12, width: 166, height: 2, backgroundColor: "rgba(176,38,255,0.42)" },
  radarTriangleLineB: { position: "absolute", left: 40, bottom: 12, width: 120, height: 2, backgroundColor: "rgba(176,38,255,0.42)", transform: [{ rotate: "-58deg" }] },
  radarTriangleLineC: { position: "absolute", right: 40, bottom: 12, width: 120, height: 2, backgroundColor: "rgba(176,38,255,0.42)", transform: [{ rotate: "58deg" }] },
  radarTriangleInner: { position: "absolute", left: 49, bottom: 33, width: 122, height: 78 },
  radarInnerLineA: { position: "absolute", left: 0, bottom: 0, width: 122, height: 1, backgroundColor: "rgba(176,38,255,0.18)" },
  radarInnerLineB: { position: "absolute", left: 8, bottom: 0, width: 76, height: 1, backgroundColor: "rgba(176,38,255,0.18)", transform: [{ rotate: "-58deg" }] },
  radarInnerLineC: { position: "absolute", right: 8, bottom: 0, width: 76, height: 1, backgroundColor: "rgba(176,38,255,0.18)", transform: [{ rotate: "58deg" }] },
  radarDot: { position: "absolute", width: 9, height: 9, borderRadius: 5, backgroundColor: C.green, borderWidth: 2, borderColor: C.purple },
  edgeScore: { marginTop: 2, color: C.sub, fontWeight: "800" },
  edgeMiniGrid: { flexDirection: "row", gap: 8, marginTop: 12 },
  edgeMini: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  edgeMiniLabel: { color: C.sub, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  edgeMiniValue: { color: C.green, fontSize: 17, fontWeight: "900", marginTop: 4 },
  noteTop: { width: 20, height: 22, borderWidth: 2, borderRadius: 4, position: "absolute" },
  noteLine: { height: 2, borderRadius: 2, marginLeft: -1 },
  notePen: { width: 15, height: 3, borderRadius: 2, position: "absolute", right: 4, bottom: 5, transform: [{ rotate: "-45deg" }] },
  globeCircle: { width: 22, height: 22, borderWidth: 2, borderRadius: 11, position: "absolute" },
  globeVertical: { width: 2, height: 20, borderRadius: 2, position: "absolute" },
  globeHorizontal: { width: 20, height: 2, borderRadius: 2, position: "absolute" },
  settingsCogBox: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsCogTooth: {
    position: "absolute",
    width: 5,
    height: 10,
    borderRadius: 1.5,
  },
  settingsCogRing: {
    position: "absolute",
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 3,
    backgroundColor: "transparent",
  },
  settingsCogHub: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 3,
    backgroundColor: "transparent",
  },
  calendarTopBar: { position: "absolute", top: 5, left: 6, right: 6, height: 2, borderRadius: 3 },
  bullHead: { width: 17, height: 13, borderWidth: 2, borderRadius: 7, position: "absolute", top: 9 },
  bullHornLeft: { width: 10, height: 10, borderLeftWidth: 2, borderTopWidth: 2, borderRadius: 8, position: "absolute", left: 7, top: 5, transform: [{ rotate: "-25deg" }] },
  bullHornRight: { width: 10, height: 10, borderRightWidth: 2, borderTopWidth: 2, borderRadius: 8, position: "absolute", right: 7, top: 5, transform: [{ rotate: "25deg" }] },
  bullNose: { width: 5, height: 3, borderRadius: 3, position: "absolute", bottom: 8 },

  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: C.purple,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  termsRowVisible: {
    borderWidth: 1,
    borderColor: C.purple,
    backgroundColor: C.purpleSoft,
    padding: 12,
    borderRadius: 16,
    marginTop: 12,
  },
  langRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 10,
    marginTop: 10,
  },
  settingsSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 12,
  },
  settingsSwitchCopy: {
    flex: 1,
    minWidth: 0,
  },
  settingsSwitchTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
    marginBottom: 4,
  },
  settingsSwitchDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  purpleAction: {
    borderColor: C.purple,
    backgroundColor: C.purpleSoft,
  },
  proSubscriptionCard: {
    borderColor: "rgba(176,38,255,0.55)",
    backgroundColor: "rgba(176,38,255,0.055)",
  },
  proSubscriptionTitle: {
    color: C.purple,
  },
  proStatusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginTop: 12,
    marginBottom: 12,
  },
  proStatusActive: {
    borderColor: "rgba(150,255,0,0.62)",
    backgroundColor: "rgba(150,255,0,0.10)",
  },
  proStatusLocked: {
    borderColor: "rgba(178,44,255,0.45)",
    backgroundColor: "rgba(178,44,255,0.09)",
  },
  proStatusIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  proStatusIconActive: {
    borderColor: "rgba(150,255,0,0.58)",
    backgroundColor: "rgba(150,255,0,0.12)",
  },
  proStatusIconLocked: {
    borderColor: "rgba(178,44,255,0.50)",
    backgroundColor: "rgba(178,44,255,0.12)",
  },
  proStatusCopy: {
    flex: 1,
    minWidth: 0,
  },
  proStatusTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  proStatusTitleActive: {
    color: C.green,
  },
  proStatusTitleLocked: {
    color: C.purple,
  },
  proStatusText: {
    color: C.sub,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 4,
  },
  greenProAction: {
    borderColor: "rgba(163,255,18,0.72)",
    backgroundColor: C.greenSoft,
  },
  calendarMiniGrid: {
    width: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginTop: 5,
    justifyContent: "center",
  },
  calendarDotMini: { width: 4, height: 4, borderRadius: 1 },

  myStatsCard: { borderColor: "rgba(176,38,255,0.35)", backgroundColor: "rgba(176,38,255,0.035)" },
  myStatsDashboard: { borderColor: "rgba(176,38,255,0.42)", backgroundColor: "rgba(176,38,255,0.045)", overflow: "hidden" },
  dashboardHeader: { flexDirection: "row", gap: 12, alignItems: "stretch", marginBottom: 14 },
  tradingScoreCard: { width: 118, borderRadius: 22, backgroundColor: C.card2, borderWidth: 1, borderColor: "rgba(176,38,255,0.4)", alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 8 },
  scoreLabel: { color: C.sub, fontSize: 10, fontWeight: "900", textTransform: "uppercase", textAlign: "center" },
  scoreBig: { color: C.purple, fontWeight: "900", fontSize: 34, letterSpacing: -1, marginTop: 2 },
  tradingScoreMini: {
    minWidth: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.45)",
    backgroundColor: C.greenSoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
  },
  tradingScoreMiniLabel: { color: C.sub, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  tradingScoreMiniValue: { color: C.green, fontSize: 22, fontWeight: "900", lineHeight: 25 },
  tradingScoreMiniSub: { color: C.text, fontSize: 10, fontWeight: "900" },
  tradingScoreHeroCard: {
    borderColor: "rgba(163,255,18,0.38)",
    backgroundColor: "rgba(163,255,18,0.055)",
    marginBottom: 12,
  },
  scoreHeroNumber: { color: C.green, fontSize: 56, fontWeight: "900", lineHeight: 62, letterSpacing: -2 },
  scoreGradePill: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.green,
    backgroundColor: C.greenSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  scoreGradeText: { color: C.green, fontSize: 16, fontWeight: "900" },
  scorePercentile: { color: C.text, fontSize: 12, fontWeight: "800", marginTop: 3 },
  scoreInsightRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  scoreInsightBox: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card2,
    padding: 11,
  },
  scoreInsightText: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "800", marginTop: 5 },
  patternCard: { borderColor: "rgba(176,38,255,0.34)", backgroundColor: "rgba(176,38,255,0.055)", marginTop: 12 },
  patternInsightCard: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card2,
    padding: 11,
    marginTop: 8,
  },
  patternInsightTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  patternInsightText: { color: C.sub, fontSize: 12, lineHeight: 17, fontWeight: "800", marginTop: 3 },
  patternOpportunity: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.28)",
    backgroundColor: C.purpleSoft,
    padding: 12,
  },
  achievementCard: { borderColor: "rgba(163,255,18,0.26)", backgroundColor: "rgba(255,255,255,0.035)", marginTop: 12, overflow: "hidden" },
  achievementGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8, minWidth: 0, maxWidth: "100%" },
  traderLevelHero: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.42)",
    backgroundColor: "rgba(176,38,255,0.09)",
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
    maxWidth: "100%",
  },
  traderLevelLabel: {
    color: C.sub,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  traderLevelTitle: {
    color: C.text,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "900",
    marginTop: 4,
  },
  traderLevelPhrase: {
    color: C.sub,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 5,
    maxWidth: 230,
  },
  traderLevelScoreBox: {
    width: 78,
    minHeight: 78,
    borderWidth: 1,
    borderColor: "rgba(150,255,0,0.56)",
    backgroundColor: C.greenSoft,
    borderRadius: 18,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  traderLevelScoreLabel: { color: C.sub, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  traderLevelScore: { color: C.green, fontSize: 34, lineHeight: 39, fontWeight: "900" },
  traderLevelTop: { color: C.text, fontSize: 11, fontWeight: "900" },
  achievementSectionLabel: {
    color: C.sub,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 16,
  },
  achievementStatusPressable: {
    width: "47%",
    flexBasis: "47%",
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "100%",
  },
  achievementStatusPressed: {
    opacity: 0.86,
  },
  achievementStatusItem: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 12,
    overflow: "hidden",
  },
  achievementStatusUnlocked: { borderColor: "rgba(150,255,0,0.72)", backgroundColor: "rgba(150,255,0,0.11)" },
  achievementStatusNext: { borderColor: "rgba(176,38,255,0.60)", backgroundColor: "rgba(176,38,255,0.10)" },
  achievementStatusTag: {
    color: C.sub,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  achievementCategory: {
    color: C.muted,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: "900",
  },
  achievementStatusTitle: {
    color: C.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    marginTop: 8,
  },
  achievementCondition: {
    color: C.sub,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    marginTop: 5,
    minHeight: 30,
  },
  achievementFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minWidth: 0,
    overflow: "hidden",
  },
  achievementItem: {
    flex: 1,
    minWidth: 145,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 12,
  },
  achievementUnlocked: { borderColor: C.green, backgroundColor: C.greenSoft },
  achievementIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.45)",
    backgroundColor: C.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  achievementIconText: { color: C.green, fontSize: 18, fontWeight: "900" },
  achievementTitle: { color: C.green, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  achievementSub: { color: C.text, fontSize: 15, lineHeight: 19, fontWeight: "900", marginTop: 5 },
  achievementProgress: { color: C.sub, fontSize: 11, fontWeight: "800", marginTop: 6, flex: 1, minWidth: 0 },
  achievementShareHint: { color: C.purple, fontSize: 10, fontWeight: "900", marginTop: 6, textAlign: "right", flex: 1, minWidth: 0 },
  achievementShareCard: {
    width: 1080,
    height: 1920,
    backgroundColor: "#030507",
    padding: 42,
    overflow: "hidden",
  },
  shareGlowGreen: {
    position: "absolute",
    width: 760,
    height: 760,
    borderRadius: 380,
    backgroundColor: "rgba(156,255,0,0.18)",
    left: -220,
    top: -170,
  },
  shareGlowPurple: {
    position: "absolute",
    width: 820,
    height: 820,
    borderRadius: 410,
    backgroundColor: "rgba(138,43,226,0.24)",
    right: -260,
    bottom: -190,
  },
  shareGlowTopLine: {
    position: "absolute",
    left: 70,
    right: 70,
    top: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    shadowColor: "#B84DFF",
    shadowOpacity: 0.9,
    shadowRadius: 30,
  },
  shareParticle: {
    position: "absolute",
    backgroundColor: "#9CFF00",
    shadowColor: "#9CFF00",
    shadowOpacity: 0.95,
    shadowRadius: 18,
  },
  shareSvgBackdrop: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  shareCardFrame: {
    flex: 1,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 46,
    backgroundColor: "rgba(8,6,15,0.9)",
    paddingHorizontal: 58,
    paddingTop: 70,
    paddingBottom: 54,
    alignItems: "center",
    shadowColor: "#B84DFF",
    shadowOpacity: 0.34,
    shadowRadius: 34,
  },
  shareBrandRow: { flexDirection: "row", alignItems: "center", gap: 22, marginTop: 6 },
  shareCandleMark: { width: 82, height: 96, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 8 },
  shareCandle: { width: 14, borderRadius: 8 },
  shareBrandText: { color: C.text, fontSize: 58, lineHeight: 64, fontWeight: "900" },
  shareBrandSub: { color: C.sub, fontSize: 14, lineHeight: 20, fontWeight: "900", letterSpacing: 4 },
  shareUnlockedText: {
    color: "#9CFF00",
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: 9,
    marginTop: 64,
    textShadowColor: "rgba(156,255,0,0.78)",
    textShadowRadius: 18,
  },
  shareBadgeStage: {
    width: 610,
    height: 610,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 36,
    shadowColor: "#B84DFF",
    shadowOpacity: 0.8,
    shadowRadius: 58,
  },
  shareBadgeStageShield: {
    shadowColor: "#9CFF00",
  },
  shareBadgeHalo: {
    position: "absolute",
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: "rgba(138,43,226,0.2)",
    shadowColor: "#8A2BE2",
    shadowOpacity: 0.95,
    shadowRadius: 70,
  },
  shareBadgeOrbitOne: {
    position: "absolute",
    width: 530,
    height: 530,
    borderRadius: 265,
    borderWidth: 2,
    borderColor: "rgba(156,255,0,0.26)",
    transform: [{ rotate: "-12deg" }],
  },
  shareBadgeOrbitTwo: {
    position: "absolute",
    width: 470,
    height: 470,
    borderRadius: 235,
    borderWidth: 2,
    borderColor: "rgba(138,43,226,0.32)",
    transform: [{ rotate: "17deg" }],
  },
  shareBadgeSvg: {
    position: "absolute",
    left: 25,
    top: 25,
  },
  shareLogoOrb: {
    width: 318,
    height: 318,
    borderRadius: 159,
    borderWidth: 3,
    borderColor: "rgba(156,255,0,0.76)",
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#9CFF00",
    shadowOpacity: 0.95,
    shadowRadius: 40,
  },
  shareLogoOrbShield: {
    borderColor: "rgba(138,43,226,0.82)",
    shadowColor: "#8A2BE2",
  },
  shareLogoImage: {
    width: 330,
    height: 330,
  },
  shareLogoShine: {
    position: "absolute",
    left: -46,
    top: -20,
    width: 120,
    height: 380,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.13)",
    transform: [{ rotate: "24deg" }],
  },
  shareHudRail: {
    position: "absolute",
    bottom: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  shareHudTick: {
    width: 72,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#9CFF00",
    shadowColor: "#9CFF00",
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },
  shareHudTickPurple: {
    width: 96,
    backgroundColor: "#8A2BE2",
    shadowColor: "#8A2BE2",
  },
  shareMarkerStack: {
    width: 310,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  shareTradeMarker: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#B8FF00",
    shadowOpacity: 0.64,
    shadowRadius: 18,
  },
  shareTradeMarkerText: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "900",
    textShadowColor: "rgba(184,255,0,0.72)",
    textShadowRadius: 16,
  },
  shareBadgeTitle: {
    color: C.text,
    fontSize: 108,
    lineHeight: 118,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 18,
    minHeight: 236,
    textShadowColor: "rgba(184,77,255,0.72)",
    textShadowRadius: 24,
  },
  sharePrestigeText: {
    color: "rgba(245,247,250,0.88)",
    fontSize: 28,
    lineHeight: 38,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 2,
  },
  shareMetricPanel: {
    width: "100%",
    marginTop: 30,
  },
  shareStatsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
  },
  shareStatGlass: {
    width: "48%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.055)",
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 22,
    minHeight: 138,
    justifyContent: "center",
  },
  shareMetricLabel: { color: C.sub, fontSize: 17, lineHeight: 22, fontWeight: "900", letterSpacing: 3 },
  shareMetricValue: { color: "#B8FF00", fontSize: 42, lineHeight: 50, fontWeight: "900", marginTop: 10 },
  shareMetricSub: { color: C.text, fontSize: 17, fontWeight: "900", letterSpacing: 2 },
  shareMiniGrid: { width: "100%", flexDirection: "row", gap: 12, marginTop: 16 },
  shareMiniMetric: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(150,255,0,0.32)",
    backgroundColor: "rgba(150,255,0,0.075)",
    borderRadius: 16,
    padding: 13,
    alignItems: "center",
  },
  shareMiniLabel: { color: C.sub, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  shareMiniValue: { color: C.text, fontSize: 14, lineHeight: 19, fontWeight: "900", marginTop: 4, textAlign: "center" },
  shareRarityTag: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 28,
  },
  shareRarityText: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: 6,
  },
  sharePhrase: { color: C.text, fontSize: 17, lineHeight: 24, fontWeight: "800", textAlign: "center", marginTop: 24 },
  shareMadeBy: { color: "#B8FF00", fontSize: 17, lineHeight: 24, fontWeight: "900", letterSpacing: 4, marginTop: "auto" },
  youTraderBadge: {
    color: C.green,
    fontSize: 11,
    fontWeight: "900",
    maxWidth: 96,
    flexShrink: 0,
    textAlign: "center",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.38)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: "hidden",
  },
  heatmapCard: {
    borderColor: "rgba(176,38,255,0.3)",
    backgroundColor: "rgba(176,38,255,0.04)",
    marginTop: 12,
  },
  heatmapTimeBadge: {
    color: C.sub,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  heatmapLegend: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 8 },
  heatmapLegendItem: {
    color: C.sub,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  heatmapGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 6 },
  heatmapCell: {
    flexGrow: 1,
    width: "31%",
    minWidth: 0,
    minHeight: 74,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 9,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  heatmapLabel: { color: C.text, fontSize: 12, fontWeight: "900" },
  heatmapValue: { color: C.text, fontSize: 17, lineHeight: 21, fontWeight: "900", marginTop: 8 },
  heatmapMeta: { color: C.sub, fontSize: 10, fontWeight: "900", marginTop: 5, flexShrink: 1 },
  heatmapMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, minWidth: 0, overflow: "hidden" },
  heatmapMetaPercent: { color: C.purple, fontSize: 10, fontWeight: "900", flexShrink: 0 },
  heatmapSummaryRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  heatmapSummaryBox: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card2,
    borderRadius: 14,
    padding: 10,
  },
  heatmapSummaryValue: { color: C.text, fontSize: 12, lineHeight: 16, fontWeight: "900", marginTop: 4 },
  dashboardMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12, minWidth: 0, maxWidth: "100%" },
  dashboardMetric: { width: "47%", flexBasis: "47%", minWidth: 0, maxWidth: "100%", flexGrow: 1, flexShrink: 1, borderRadius: 18, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, padding: 12, overflow: "hidden" },
  dashboardMetricLabel: { color: C.sub, fontSize: 14, fontWeight: "900", textTransform: "uppercase", minWidth: 0, flexShrink: 1 },
  dashboardMetricValue: { fontSize: 25, fontWeight: "900", marginTop: 8, letterSpacing: -0.8, minWidth: 0, flexShrink: 1 },
  dashboardMetricHelper: { color: C.sub, fontSize: 11, marginTop: 4, fontWeight: "700", minWidth: 0, flexShrink: 1 },
  lockedMetricPreview: {
    opacity: 0.18,
    transform: [{ scale: 0.98 }],
  },
  metricLockGlass: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.30)",
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  metricDot: { width: 8, height: 8, borderRadius: 4 },
  chartGrid: { gap: 10 },
  chartCard: { borderWidth: 1, borderColor: "rgba(176,38,255,0.22)", backgroundColor: "rgba(255,255,255,0.035)", borderRadius: 20, padding: 12, marginTop: 8 },
  performanceCard: { borderWidth: 1, borderColor: "rgba(176,38,255,0.22)", backgroundColor: "rgba(176,38,255,0.045)", borderRadius: 20, padding: 12, marginTop: 8 },
  lockedPreviewShell: {
    minHeight: 360,
    overflow: "hidden",
    opacity: 0.95,
  },
  profileTitle: { color: C.text, fontWeight: "900", fontSize: 18, marginTop: 4, marginBottom: 8 },
  myStatsTitle: { color: C.text, fontWeight: "900", fontSize: 14, marginTop: 4, marginBottom: 8 },
  dashboardChartBox: { height: 118, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.18)", padding: 10, flexDirection: "row", alignItems: "flex-end", gap: 5, overflow: "hidden" },
  dashboardBarSlot: { flex: 1, minWidth: 5, alignItems: "center", justifyContent: "flex-end" },
  dashboardBar: { width: "100%", maxWidth: 22, borderRadius: 999 },
  equityCurveBox: {
    alignSelf: "center",
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.18)",
    overflow: "hidden",
  },
  equityGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  equityZeroLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(176,38,255,0.34)",
  },
  equityCurveSegment: {
    position: "absolute",
    height: 3,
    borderRadius: 999,
  },
  equityCurvePoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: C.bg,
  },
  equityBox: { height: 96, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(176,38,255,0.2)", padding: 10, flexDirection: "row", alignItems: "flex-end", gap: 4, overflow: "hidden" },
  equityBar: { flex: 1, minWidth: 4, borderRadius: 999, opacity: 0.9 },
  insightGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  insightCard: { flex: 1, minWidth: 145, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 12, backgroundColor: C.card2 },
  insightBig: { color: C.green, fontSize: 21, fontWeight: "900", marginVertical: 4 },
  insightRow: { marginBottom: 10 },
  insightLabel: { color: C.sub, fontWeight: "900", fontSize: 12 },
  insightValue: { color: C.text, fontWeight: "900", fontSize: 12 },
  insightTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: 6 },
  insightFill: { height: 8, borderRadius: 999 },
  breakdownSection: { marginTop: 16, gap: 9 },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  breakdownHeaderLocked: { paddingRight: 8 },
  breakdownProBadge: {
    position: "absolute",
    right: 0,
    top: -8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.purple,
    backgroundColor: C.purpleSoft,
  },
  breakdownProBadgeText: { color: C.purple, fontSize: 9, fontWeight: "900" },
  breakdownTitle: { color: C.text, fontSize: 19, fontWeight: "900" },
  breakdownHint: { color: C.sub, fontSize: 11, fontWeight: "800" },
  breakdownCard: {
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.22)",
    backgroundColor: C.card2,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  breakdownTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  breakdownNameRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  breakdownRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.035)",
    alignItems: "center",
    justifyContent: "center",
  },
  breakdownRankText: { fontSize: 12, fontWeight: "900" },
  breakdownName: { color: C.text, fontSize: 15, fontWeight: "900" },
  breakdownMeta: { color: C.sub, fontSize: 11, fontWeight: "800", marginTop: 3 },
  breakdownPnl: { width: 96, textAlign: "right", fontSize: 16, fontWeight: "900" },
  breakdownTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  breakdownFill: { height: 9, borderRadius: 999 },
  breakdownEmpty: {
    minHeight: 68,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  breakdownEmptyText: { color: C.sub, fontSize: 13, fontWeight: "800", textAlign: "center" },
  propEntryCard: {
    borderColor: "rgba(176,38,255,0.48)",
    backgroundColor: "rgba(176,38,255,0.055)",
  },
  propEntryTitle: { color: C.purple, fontSize: 18, fontWeight: "900", marginBottom: 4 },
  propEntryStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  propEntryStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.card2,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  propEntryValue: {
    color: C.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    marginTop: 5,
    includeFontPadding: false,
  },
  propEntryHint: {
    color: C.purple,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 8,
    textAlign: "right",
  },
  propRulesMetaRow: {
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  riskCoachCard: {
    borderColor: "rgba(163,255,18,0.34)",
    backgroundColor: "rgba(163,255,18,0.04)",
  },
  riskCoachTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 5,
  },
  survivalCard: {
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.34)",
    backgroundColor: C.purpleSoft,
    borderRadius: 18,
    padding: 13,
  },
  survivalValue: {
    color: C.green,
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 42,
    marginTop: 4,
  },
  riskStatusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  riskStatusText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  riskTemplateRail: { marginTop: 14, marginBottom: 12 },
  riskTemplateBtn: {
    width: 154,
    minHeight: 62,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: C.card2,
    padding: 11,
    marginRight: 8,
    justifyContent: "center",
  },
  riskTemplateActive: {
    borderColor: C.green,
    backgroundColor: C.greenSoft,
  },
  riskTemplateLabel: { color: C.text, fontSize: 13, fontWeight: "900" },
  riskTemplateSub: { color: C.sub, fontSize: 11, fontWeight: "800", marginTop: 4 },
  riskModeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  riskModeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: C.card2,
  },
  riskModeActive: { backgroundColor: C.green, borderColor: C.green },
  riskModeText: { color: C.text, fontSize: 11, fontWeight: "900" },
  riskStopTicksInputWrap: {
    width: 142,
    minHeight: 56,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.34)",
    borderRadius: 18,
    backgroundColor: C.card2,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  riskStopTicksInput: {
    color: C.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  coachCallout: {
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.36)",
    backgroundColor: "rgba(163,255,18,0.08)",
    borderRadius: 18,
    padding: 13,
    marginBottom: 4,
  },
  coachCalloutText: {
    color: C.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    marginTop: 6,
  },
  riskBarBlock: { marginTop: 10 },
  riskBarLabel: {
    color: C.sub,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  riskBarValue: { fontSize: 14, fontWeight: "900" },
  riskTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginTop: 7,
  },
  riskFill: { height: 10, borderRadius: 999 },
  riskMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  riskMetricBox: {
    flex: 1,
    minWidth: 145,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: C.card2,
    padding: 11,
  },
  riskMetricValue: {
    color: C.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 5,
    lineHeight: 22,
  },
  weeklyReviewBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.28)",
    backgroundColor: C.purpleSoft,
    borderRadius: 18,
    padding: 12,
  },
  weeklyReviewText: {
    color: C.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    marginTop: 6,
  },
  riskAlertsBtn: {
    borderColor: "rgba(163,255,18,0.42)",
    backgroundColor: C.greenSoft,
    marginTop: 12,
  },
  proNote: { marginTop: 12, borderRadius: 16, padding: 12, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: "rgba(176,38,255,0.25)" },
  proNoteText: { color: C.text, fontWeight: "800", lineHeight: 19, fontSize: 12 },
  aiCommandCard: {
    borderColor: "rgba(150,255,0,0.34)",
    backgroundColor: "rgba(150,255,0,0.045)",
    marginBottom: 12,
  },
  aiCommandTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  aiCommandEyebrow: {
    color: C.sub,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  aiCommandTitle: {
    color: C.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    marginTop: 5,
  },
  aiCommandStatus: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  aiCommandStatusText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  aiCommandScoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 14,
    marginTop: 18,
  },
  aiCommandScoreLabel: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  aiCommandScore: {
    fontSize: 52,
    lineHeight: 58,
    fontWeight: "900",
    letterSpacing: -1.4,
  },
  aiCommandMiniStack: {
    minWidth: 126,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    backgroundColor: C.card2,
    padding: 12,
  },
  aiCommandMiniLabel: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  aiCommandMiniValue: {
    color: C.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    marginTop: 3,
    marginBottom: 8,
  },
  aiCommandActionBox: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.28)",
    backgroundColor: C.purpleSoft,
    padding: 13,
  },
  aiCommandActionLabel: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  aiCommandActionText: {
    color: C.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    marginTop: 6,
  },
  aiAnalysisCard: {
    borderColor: "rgba(176,38,255,0.42)",
    backgroundColor: "rgba(176,38,255,0.08)",
  },
  aiAnalysisTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "900",
  },
  aiAnalysisSummary: {
    color: C.sub,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 4,
  },
  aiAnalysisSource: {
    color: C.green,
    fontSize: 11,
    fontWeight: "900",
  },
  aiAnalysisSection: {
    marginTop: 12,
  },
  aiAnalysisHeading: {
    color: C.purple,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  aiAnalysisItem: {
    color: C.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    marginTop: 5,
  },
  aiGenerateCard: {
    borderColor: "rgba(176,38,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  aiModuleTitle: {
    color: C.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
  },
  aiCompactText: {
    color: C.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    marginTop: 8,
  },
  aiMetricExplainBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: C.card2,
    borderRadius: 14,
    padding: 10,
  },
  aiInsightGrid: { gap: 10, marginTop: 14 },
  aiInsightSection: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7,10,15,0.72)",
    borderRadius: 16,
    padding: 11,
  },
  aiInsightHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  aiInsightRow: {
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.055)",
  },
  aiInsightIndex: {
    color: C.bg,
    backgroundColor: C.green,
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: "center",
    lineHeight: 20,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "900",
  },
  aiInsightTitle: { color: C.text, fontSize: 13, lineHeight: 17, fontWeight: "900" },
  aiInsightBody: { color: C.sub, fontSize: 12, lineHeight: 16, fontWeight: "800", marginTop: 2 },
  detectiveCard: {
    borderColor: "rgba(176,38,255,0.5)",
    backgroundColor: "rgba(18,0,28,0.72)",
    gap: 14,
  },
  detectiveHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(150,255,0,0.26)",
    backgroundColor: "rgba(150,255,0,0.055)",
    borderRadius: 18,
    padding: 14,
    overflow: "hidden",
  },
  detectiveTitle: {
    color: C.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    marginTop: 5,
  },
  detectiveScoreBox: {
    width: 82,
    minHeight: 82,
    borderWidth: 1,
    borderColor: "rgba(150,255,0,0.5)",
    backgroundColor: "rgba(150,255,0,0.09)",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  detectiveScore: {
    color: C.green,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },
  detectiveBlindSpot: {
    borderWidth: 1,
    borderColor: "rgba(255,59,95,0.42)",
    backgroundColor: "rgba(255,59,95,0.08)",
    borderRadius: 18,
    padding: 14,
    overflow: "hidden",
  },
  detectiveSectionLabel: {
    color: C.sub,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  detectiveBlindTitle: {
    color: C.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    marginTop: 8,
  },
  detectiveEvidence: {
    color: C.sub,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 6,
  },
  detectiveBody: {
    color: C.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    marginTop: 8,
  },
  detectiveAction: {
    color: C.green,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "900",
    marginTop: 8,
  },
  detectivePatternCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7,10,15,0.82)",
    borderRadius: 16,
    padding: 12,
    overflow: "hidden",
  },
  detectivePatternTitle: {
    color: C.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
  },
  detectiveImpactPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginLeft: 8,
  },
  detectiveImpactText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detectiveConfidence: {
    color: C.purple,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    marginTop: 7,
    textTransform: "uppercase",
  },
  detectiveAgentCard: {
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderRadius: 16,
    padding: 12,
    overflow: "hidden",
  },
  detectiveAgentTitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  detectiveChevron: {
    color: C.green,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "900",
    marginLeft: 10,
  },
  detectiveAgentBody: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  detectiveRuleCard: {
    borderWidth: 1,
    borderColor: "rgba(150,255,0,0.32)",
    backgroundColor: "rgba(150,255,0,0.06)",
    borderRadius: 18,
    padding: 14,
    overflow: "hidden",
  },
  detectiveRuleText: {
    color: C.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    marginTop: 8,
  },
  aiCoachModuleCard: {
    borderColor: "rgba(176,38,255,0.32)",
    backgroundColor: "rgba(176,38,255,0.045)",
    marginTop: 12,
  },
  terminalScreenStack: {
    gap: 12,
    position: "relative",
  },
  terminalCard: {
    borderRadius: 32,
    padding: 18,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(12,13,18,0.88)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 20 },
  },
  terminalCardGlow: {
    position: "absolute",
    left: 1,
    right: 1,
    top: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.34)",
  },
  terminalCardTopSheen: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 10,
    height: 42,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  terminalCardBottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  terminalHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  terminalEyebrow: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  terminalHeroTitle: {
    color: C.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -1.2,
    marginTop: 6,
  },
  terminalSectionTitle: {
    color: C.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 6,
  },
  propTemplateSelector: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(12,13,18,0.86)",
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  propTemplateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  propTemplateHint: {
    color: C.sub,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    flex: 1,
    textAlign: "right",
  },
  propTemplateRail: {
    gap: 8,
    paddingRight: 4,
  },
  propTemplateChip: {
    minWidth: 112,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  propTemplateChipActive: {
    borderColor: "rgba(163,255,18,0.62)",
    backgroundColor: "rgba(163,255,18,0.12)",
  },
  propTemplateChipText: {
    color: C.text,
    fontSize: 13,
    fontWeight: "900",
  },
  propTemplateChipTextActive: {
    color: C.green,
  },
  propTemplateChipSub: {
    color: C.sub,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    marginTop: 3,
  },
  propModeRail: {
    flexDirection: "row",
    gap: 8,
  },
  propModeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    paddingVertical: 9,
    alignItems: "center",
  },
  propModeChipActive: {
    borderColor: "rgba(176,38,255,0.58)",
    backgroundColor: C.purpleSoft,
  },
  propModeChipText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  propModeChipTextActive: {
    color: C.white,
  },
  statsMetricDashboard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(12,13,18,0.90)",
    padding: 16,
    gap: 14,
  },
  statsMetricHeader: {
    gap: 2,
  },
  statsMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statsMetricTile: {
    width: "48.6%",
    minHeight: 68,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: "space-between",
  },
  statsMetricTileLocked: {
    opacity: 0.72,
  },
  statsMetricLabel: {
    color: C.sub,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  statsMetricValue: {
    color: C.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    marginTop: 6,
  },
  terminalSub: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
  },
  terminalSmallLabel: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  terminalKpi: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1,
  },
  terminalSegment: {
    flexDirection: "row",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.055)",
    padding: 4,
    marginTop: 16,
    gap: 4,
  },
  terminalSegmentBtn: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 8,
  },
  terminalSegmentActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.22)",
  },
  terminalSegmentText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "900",
  },
  terminalSegmentTextActive: {
    color: C.green,
  },
  terminalHeroCard: {
    paddingBottom: 20,
  },
  terminalChartWrap: {
    marginTop: 18,
    alignItems: "center",
    minHeight: 250,
  },
  terminalTooltip: {
    position: "absolute",
    width: 168,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(8,9,13,0.88)",
    padding: 11,
  },
  terminalTooltipDate: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "900",
  },
  terminalTooltipPnl: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },
  terminalTooltipMeta: {
    color: C.text,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  metricPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  metricPill: {
    flexGrow: 1,
    minWidth: 96,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.045)",
    padding: 11,
  },
  metricPillLabel: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metricPillValue: {
    fontSize: 16,
    fontWeight: "900",
    marginTop: 5,
  },
  appleRingWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  appleRingCenter: {
    position: "absolute",
    top: 26,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  appleRingValue: {
    color: C.text,
    fontSize: 17,
    fontWeight: "900",
  },
  appleRingLabel: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 2,
  },
  bottomSheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.68)",
    padding: 14,
  },
  bottomSheetCard: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(13,14,20,0.96)",
    padding: 18,
  },
  bottomSheetTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: "900",
  },
  bottomSheetBig: {
    color: C.green,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 12,
  },
  bottomSheetText: {
    color: C.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    marginTop: 10,
  },
  dnaHero: {
    marginTop: 16,
    gap: 18,
  },
  dnaScoreCircle: {
    alignSelf: "center",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.26)",
    backgroundColor: "rgba(163,255,18,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  dnaScore: {
    color: C.green,
    fontSize: 48,
    fontWeight: "900",
  },
  dnaScoreLabel: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  dnaRingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  dnaInsightRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  dnaInsightBlock: {
    flex: 1,
  },
  dnaWeakBlock: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.045)",
    padding: 12,
  },
  terminalChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 8,
  },
  terminalChip: {
    color: C.green,
    fontSize: 12,
    fontWeight: "900",
  },
  dnaWeakText: {
    color: C.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
  },
  premiumRadarWrap: {
    width: 286,
    height: 286,
    alignSelf: "center",
    marginTop: 16,
    borderRadius: 143,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  premiumRadarCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  premiumRadarScore: {
    color: C.green,
    fontSize: 34,
    fontWeight: "900",
  },
  premiumRadarLabel: {
    color: C.sub,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  premiumRadarAxisLabel: {
    position: "absolute",
    width: 86,
    minHeight: 36,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
  },
  premiumRadarAxisText: {
    color: C.text,
    fontSize: 9,
    fontWeight: "900",
  },
  premiumRadarAxisValue: {
    color: C.green,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 1,
  },
  radarSummaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  radarSummaryBlock: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
  },
  radarWeakBlock: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.045)",
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  calendarHeatmapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 16,
  },
  calendarHeatmapCell: {
    width: "22.7%",
    minHeight: 72,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: 9,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  calendarHeatmapKey: {
    color: C.text,
    fontSize: 11,
    fontWeight: "900",
  },
  calendarHeatmapValue: {
    color: C.white,
    fontSize: 13,
    fontWeight: "900",
  },
  calendarHeatmapMeta: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "900",
  },
  traderStatusHero: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  traderRank: {
    color: C.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  traderScorePill: {
    minWidth: 92,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.28)",
    backgroundColor: "rgba(163,255,18,0.07)",
    alignItems: "center",
    padding: 12,
  },
  traderScoreNumber: {
    color: C.green,
    fontSize: 36,
    fontWeight: "900",
  },
  traderScoreLabel: {
    color: C.text,
    fontSize: 11,
    fontWeight: "900",
  },
  achievementRail: {
    gap: 10,
    paddingVertical: 12,
  },
  achievementRailCard: {
    width: 150,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.18)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
  },
  achievementRailStatus: {
    color: C.green,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  achievementRailTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 8,
  },
  achievementRailMeta: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 8,
  },
  achievementRailTap: {
    color: C.purple,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 10,
  },
  nextTargetList: {
    gap: 8,
    marginTop: 10,
  },
  nextTargetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
  },
  nextTargetTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "900",
  },
  nextTargetProgress: {
    color: C.purple,
    fontSize: 12,
    fontWeight: "900",
  },
  aiFocusText: {
    color: C.text,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "900",
    marginTop: 6,
  },
  aiActionChip: {
    color: C.text,
    fontSize: 11,
    fontWeight: "900",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  patternTimeline: {
    gap: 10,
    marginTop: 14,
  },
  patternTimelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  patternTimelineLabel: {
    color: C.text,
    width: 86,
    fontSize: 12,
    fontWeight: "900",
  },
  patternTimelineTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  patternTimelineFill: {
    height: 10,
    borderRadius: 999,
  },
  patternTimelineValue: {
    width: 42,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "900",
  },
  aiTwoColumn: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  aiInsightTile: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.045)",
    padding: 12,
  },
  terminalInsightTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 8,
  },
  aiCoachUnifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
  },
  aiCoachVoice: {
    color: C.text,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 14,
  },
  aiCoachNext: {
    color: C.green,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    marginTop: 6,
  },
  missionCta: {
    marginTop: 14,
    borderRadius: 22,
    backgroundColor: "rgba(163,255,18,0.09)",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.24)",
    padding: 14,
    alignItems: "center",
  },
  missionCtaText: {
    color: C.green,
    fontSize: 15,
    fontWeight: "900",
  },
  monthlyTimeline: {
    gap: 12,
    marginTop: 16,
  },
  monthlyTimelineRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingBottom: 4,
  },
  monthlyTimelineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.green,
    marginTop: 6,
  },
  monthlyTimelineValue: {
    color: C.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
  },
  aiSingleStatusNote: {
    color: C.yellow,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  aiCoachFeatureCard: {
    borderColor: "rgba(163,255,18,0.20)",
    backgroundColor: "rgba(255,255,255,0.035)",
    marginTop: 12,
    borderRadius: 22,
  },
  aiProviderBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  aiProviderBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  aiCoachResultBody: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  aiResultHeadline: {
    color: C.text,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 21,
  },
  aiResultText: {
    color: C.sub,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    fontWeight: "800",
  },
  aiRiskScore: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  aiBulletList: {
    marginTop: 8,
    gap: 5,
  },
  aiBulletText: {
    color: C.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
  },
  aiFallbackMessage: {
    color: C.yellow,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
    fontWeight: "800",
  },
  aiGeneratedAt: {
    color: C.sub,
    fontSize: 10,
    marginTop: 8,
    fontWeight: "800",
  },
  aiRefreshButton: {
    marginTop: 12,
  },
  dailyCoachCard: {
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 22,
    padding: 14,
    overflow: "hidden",
  },
  dailyCoachTitle: {
    fontSize: 15,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dailyCoachBody: {
    color: C.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    fontWeight: "800",
  },
  dailyCoachAction: {
    color: C.sub,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    fontWeight: "800",
  },
  analysisLockedWrap: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
  },
  analysisLockedContent: {
    // Strong obfuscation for free users: content is recognizable in shape but not
    // readable. Lower opacity + slight downscale approximates a frosted/blurred look
    // without requiring a native blur dependency.
    opacity: 0.12,
    transform: [{ scale: 0.985 }],
  },
  analysisLockOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(2,0,8,0.74)",
  },
  analysisLockPinned: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 430,
    zIndex: 4,
  },
  analysisLockTitle: {
    color: "#96FF00",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  analysisLockText: {
    color: C.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 8,
    maxWidth: 320,
  },
  revengeAlertCard: {
    borderColor: "rgba(255,59,48,0.55)",
    backgroundColor: "rgba(255,59,48,0.08)",
  },
  edgeProfileBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.22)",
    backgroundColor: "rgba(176,38,255,0.045)",
    borderRadius: 22,
    padding: 16,
    gap: 14,
  },
  edgeScoreCircle: {
    alignSelf: "center",
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: C.purple,
    backgroundColor: "rgba(176,38,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  edgeScoreSmall: { color: C.sub, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  edgeScoreBig: { color: C.green, fontWeight: "900", fontSize: 44, letterSpacing: -1 },
  edgeBarRow: { gap: 7 },
  edgeBarLabel: { color: C.sub, fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
  edgeBarValue: { color: C.text, fontWeight: "900", fontSize: 13 },
  edgeBarTrack: { height: 9, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  edgeBarFill: { height: 9, borderRadius: 999, backgroundColor: C.purple },
  newsBolt: { fontSize: 28, lineHeight: 30, fontWeight: "900" },
  tabbar: {
    flexDirection: "row",
    height: 92,
    paddingHorizontal: 4,
    paddingTop: 9,
    paddingBottom: 8,
    backgroundColor: "#05070A",
    borderTopColor: "#111827",
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
    paddingHorizontal: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  tabActive: { backgroundColor: "transparent" },
  tabIconWrap: {
    width: 31,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconGlow: {
    shadowColor: "#96FF00",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  tabIcon: {
    fontSize: 22,
    lineHeight: 24,
    marginBottom: 2,
    color: C.green,
    fontWeight: "900",
  },
  tabIconActive: { color: C.purple },
  tabText: {
    color: "#7D8795",
    fontSize: 8.4,
    lineHeight: 10,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
    width: "100%",
    flexShrink: 1,
    includeFontPadding: false,
  },
  tabTextActive: {
    color: "#96FF00",
    textShadowColor: "rgba(150,255,0,0.25)",
    textShadowRadius: 7,
    textShadowOffset: { width: 0, height: 0 },
  },
  tabActiveUnderline: {
    width: 36,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#96FF00",
    marginTop: 8,
  },

  lockOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: C.purpleSoft,
    borderWidth: 1,
    borderColor: C.purple,
  },
  lockOverlayProfile: { top: 12, right: 12, maxWidth: 120 },
  profileProBadgeRow: { alignItems: "flex-end", marginBottom: 6 },
  profileProBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.purple,
    backgroundColor: C.purpleSoft,
  },
  profileProBadgeText: { color: C.purple, fontSize: 9, fontWeight: "900" },
  lockText: { color: C.purple, fontSize: 10, fontWeight: "900" },
  freeNotice: {
    marginTop: 12,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.purpleSoft,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.35)",
  },
  freeNoticeTitle: { color: C.purple, fontSize: 15, fontWeight: "900" },
  freeNoticeText: { color: C.sub, fontSize: 13, marginTop: 5, lineHeight: 18 },
  paywallPreview: {
    marginTop: 16,
    borderRadius: 22,
    padding: 16,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.48)",
  },
  paywallTitle: { color: C.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  paywallSub: { color: C.sub, fontSize: 13, lineHeight: 19, marginTop: 7 },
  planRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  monthlyPlan: {
    flex: 1,
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    opacity: 0.68,
  },
  yearlyPlan: {
    flex: 1.18,
    borderRadius: 18,
    padding: 13,
    borderWidth: 1.5,
    borderColor: C.purple,
    backgroundColor: C.purpleSoft,
  },
  bestValueBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: C.purple,
    marginBottom: 7,
  },
  bestValueText: { color: C.white, fontSize: 9, fontWeight: "900" },
  planName: { color: C.sub, fontSize: 11, fontWeight: "900" },
  planPrice: { color: C.text, fontSize: 17, fontWeight: "900", marginTop: 4 },
  lockedNewsIntel: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.28)",
    backgroundColor: C.greenSoft,
    padding: 12,
  },
  lockedNewsTitle: { color: C.green, fontSize: 13, fontWeight: "900" },
  lockedNewsText: { color: C.sub, fontSize: 12, lineHeight: 17, marginTop: 4 },
  lockedNewsList: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 10,
  },
  lockedNewsPreview: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.28)",
    backgroundColor: "rgba(176,38,255,0.05)",
    padding: 14,
    overflow: "hidden",
  },
  lockedNewsPreviewDim: {
    opacity: 1,
    transform: [{ scale: 1.014 }],
  },
  lockedNewsFuzzyTitle: {
    color: "rgba(245,245,250,0.13)",
    textShadowColor: "rgba(245,245,250,0.42)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  lockedNewsFuzzyText: {
    color: "rgba(170,170,185,0.12)",
    textShadowColor: "rgba(170,170,185,0.36)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  lockedNewsBlurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,0,8,0.46)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.18)",
  },
  lockedNewsProBadge: {
    position: "absolute",
    right: 12,
    top: 12,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.65)",
    backgroundColor: "rgba(5,16,0,0.74)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  lockedNewsProBadgeText: {
    color: C.green,
    fontSize: 10,
    fontWeight: "900",
  },
  radarOuter: { alignItems: "center", justifyContent: "center", marginTop: 16 },
  radarLabel: { color: C.text, fontSize: 11, fontWeight: "900", textAlign: "center" },
  radarValue: { fontSize: 11, fontWeight: "900", marginTop: 2, textAlign: "center" },
  radarCenterBadge: {
    position: "absolute",
    left: 105,
    top: 105,
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.38)",
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  radarCenterScore: { color: C.green, fontSize: 23, fontWeight: "900" },
  radarCenterLabel: { color: C.sub, fontSize: 9, fontWeight: "900", marginTop: 2 },
  profileMetricGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  profileMetricCard: {
    width: "48%",
    flexGrow: 1,
    minWidth: 130,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(0,0,0,0.20)",
    borderRadius: 14,
    padding: 10,
  },
  profileMetricTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  profileMetricLabel: { color: C.sub, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  profileMetricValue: { fontSize: 13, fontWeight: "900" },
  profileMetricTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginTop: 8,
  },
  profileMetricFill: { height: 7, borderRadius: 999 },
  radarLockLayer: {
    position: "absolute",
    left: 84,
    top: 107,
    width: 118,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.78)",
    borderWidth: 1,
    borderColor: C.purple,
    alignItems: "center",
  },
  radarLockTitle: { color: C.purple, fontSize: 13, fontWeight: "900" },
  radarLockSub: { color: C.sub, fontSize: 10, marginTop: 2 },
  blurPreview: {
    height: 76,
    borderRadius: 18,
    backgroundColor: "rgba(176,38,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  blurPreviewText: { color: C.purple, fontSize: 15, fontWeight: "900" },

  tradesTodayTitle: {
    color: C.purple,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 140,
    marginBottom: 12,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  legalText: {
    color: C.text,
    fontSize: 15,
    fontWeight: "800",
  },
  legalArrow: {
    color: C.green,
    fontSize: 24,
    fontWeight: "900",
  },
  versionText: {
    color: C.sub,
    opacity: 0.65,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    marginBottom: 4,
  },
  madeByText: {
    color: C.green,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },
  monthControlRow: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  monthNavBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(165,173,186,0.07)",
    borderWidth: 1,
    borderColor: "rgba(165,173,186,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavText: {
    color: C.sub,
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 42,
  },
  monthTitlePill: {
    flex: 1,
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(165,173,186,0.28)",
    backgroundColor: "rgba(165,173,186,0.055)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  monthPillCalendar: {
    width: 23,
    height: 23,
    borderWidth: 2,
    borderColor: C.sub,
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  monthPillCalendarTop: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    height: 2,
    borderRadius: 2,
    backgroundColor: C.sub,
  },
  monthPillCalendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  monthPillCalendarDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.sub,
  },
  monthTitleText: {
    color: C.white,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    minWidth: 0,
  },
  monthChevron: {
    color: C.sub,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "900",
  },
  weekdayHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  weekdayHeaderText: {
    color: C.white,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  monthPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  monthPickerCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    padding: 18,
  },
  monthPickerTitle: { color: C.text, fontSize: 20, fontWeight: "900", marginBottom: 14 },
  monthPickerYears: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  monthPickerYear: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  monthPickerYearActive: { borderColor: C.green, backgroundColor: C.greenSoft },
  monthPickerYearText: { color: C.sub, fontWeight: "800" },
  monthPickerYearTextActive: { color: C.green, fontWeight: "900" },
  monthPickerMonths: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthPickerMonth: {
    width: "30.5%",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: C.card2,
  },
  monthPickerMonthActive: { borderColor: C.purple, backgroundColor: C.purpleSoft },
  monthPickerMonthText: { color: C.text, fontWeight: "800" },
  monthPickerMonthTextActive: { color: C.purple, fontWeight: "900" },
  instrumentBtnActive: {
    backgroundColor: C.purpleSoft,
    borderColor: C.purple,
  },
  calendarEventCard: {
    borderColor: "rgba(176,38,255,0.4)",
    backgroundColor: "rgba(176,38,255,0.08)",
    padding: 8,
    borderRadius: 16,
    marginBottom: 7,
  },
  calendarEventCardTablet: { padding: 14, borderRadius: 20, marginBottom: 11 },
  calendarEventTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  calendarTimeBox: { width: 104, alignItems: "flex-start" },
  calendarTimeBoxTablet: { width: 138 },
  calendarEventTime: { color: C.text, fontSize: 20, lineHeight: 24, fontWeight: "900", fontVariant: ["tabular-nums"] },
  calendarEventTimeTablet: { fontSize: 30, lineHeight: 34 },
  calendarEventMeridiem: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  calendarEventMeridiemTablet: { fontSize: 18, lineHeight: 24 },
  calendarEventDate: { color: C.sub, fontSize: 8, fontWeight: "900", marginTop: 1 },
  calendarEventDateTablet: { fontSize: 11, marginTop: 3 },
  calendarEventBody: { flex: 1, minWidth: 0 },
  calendarEventTitle: { color: C.text, fontSize: 13, lineHeight: 17, fontWeight: "900" },
  calendarEventTitleTablet: { fontSize: 17, lineHeight: 23 },
  calendarMetricRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  calendarMetricRowTablet: { gap: 10, marginTop: 7 },
  calendarMetricText: { color: C.sub, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  calendarMetricTextTablet: { fontSize: 15, lineHeight: 21 },
  calendarBiasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 7,
  },
  calendarBiasGridTablet: { gap: 8, marginTop: 12 },
  calendarBiasCell: {
    minWidth: 64,
    flexGrow: 1,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.22)",
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  calendarBiasCellTablet: { minWidth: 118, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  calendarAssetLabel: { color: C.text },
  calendarAssetLabelTablet: { fontSize: 12, marginBottom: 6 },
  calendarBiasValue: { fontWeight: "900", fontSize: 10 },
  calendarBiasValueTablet: { fontSize: 13, lineHeight: 17 },
  riskInstrumentSymbol: { color: C.orange },
  purpleNewsCard: {
    backgroundColor: C.purpleSoft,
    borderColor: "rgba(176,38,255,0.42)",
  },
  newsExplainButton: {
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.35)",
    backgroundColor: "rgba(163,255,18,0.08)",
    paddingVertical: 10,
    alignItems: "center",
  },
  newsExplainButtonText: {
    color: C.green,
    fontSize: 12,
    fontWeight: "900",
  },
  newsExplainerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
    padding: 14,
  },
  newsExplainerModal: {
    borderRadius: 28,
    borderColor: "rgba(163,255,18,0.24)",
    maxHeight: "86%",
  },
  newsExplainerTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: "900",
  },
  newsExplainerHeadline: {
    color: C.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    flex: 1,
    marginRight: 10,
  },
  newsExplainerLabel: {
    color: C.green,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 14,
  },
  newsExplainerText: {
    color: C.text,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    fontWeight: "800",
  },
  newsRiskReminder: {
    color: C.yellow,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    fontWeight: "900",
  },
  newsDisclaimer: {
    color: C.sub,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
    fontWeight: "800",
  },
  purpleSectionTitle: { color: C.purple },
  greenActionBtn: {
    borderColor: "rgba(163,255,18,0.72)",
    backgroundColor: "rgba(163,255,18,0.14)",
  },
  redActionBtn: {
    borderColor: "rgba(255,59,95,0.72)",
    backgroundColor: "rgba(255,59,95,0.14)",
  },
  greenActionText: { color: C.green },
  redActionText: { color: C.red },
  settingsBenefit: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "800",
    marginTop: 6,
  },
  settingsBenefitCheck: { color: C.purple, fontWeight: "900" },
  settingsBenefitText: { color: C.green, fontWeight: "800" },
});
