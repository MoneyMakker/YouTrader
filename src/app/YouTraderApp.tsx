import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { YouTraderSafeAreaProvider } from "./YouTraderSafeAreaProvider";
import { StartupFailureFallback } from "./StartupFailureFallback";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { signInWithAppleNative } from "../auth/appleSignIn";
import { signInWithGoogle, signOutGoogleNative } from "../auth/googleSignIn";
import {
  isAuthCancellation,
  logAuthDev,
  userFacingAuthError,
} from "../auth/authErrors";
import { processAuthDeepLink } from "../auth/authDeepLinkCoordinator";
import {
  beginAppleLifecycleAttempt,
  openAppleAppsUsingAppleIdSettings,
  openSubscriptionManagement,
  requestAccountDeletion,
  storeAppleAuthTokenAfterSignIn,
} from "../auth/accountDeletion";
import { ChangeEmailModal } from "../auth/ChangeEmailModal";
import { ChangePasswordModal } from "../auth/ChangePasswordModal";
import {
  requestPasswordResetEmail,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  updateUserEmail,
  updateUserPassword,
} from "../auth/emailPasswordAuth";
import { EMAIL_PASSWORD_MESSAGES } from "../auth/emailPasswordMessages";
import { buildLocalizedLocalCoachAnalysis } from "../i18n/localCoachAnalysis";
import { changeAppLanguage, getAppLanguage, i18n, initAppI18n, t, type AppLang } from "../i18n";
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
  Alert,
  Animated,
  AppState,
  Easing,
  FlatList,
  Image,
  InteractionManager,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  LogBox,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import {
  BookOpen,
  BrainCircuit,
  Calculator as CalculatorIcon,
  CalendarDays,
  Camera,
  ChartColumnIncreasing,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  ImagePlus,
  Lock,
  Mic,
  Newspaper,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
  Settings as SettingsIcon,
  Target,
  TrendingUp,
  Trophy,
  Unlock,
  Zap,
  Ellipsis,
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
import { AuthScreen } from "../auth/AuthScreen";
import { PostPurchaseAuthContainer } from "../postPurchase/PostPurchaseAuthContainer";
import { migrateGuestTradesToUser } from "../postPurchase/AnonymousDataMigrationService";
import { POST_PURCHASE_LINKING_MARKER_KEY } from "../postPurchase/types";
import type { AuthProvider, AuthScreenCopy, EmailAuthModalCopy } from "../auth/types";
import { clearLocalUserCache, GUEST_TRADES_STORAGE_KEY, userTradesStorageKey } from "../auth/userCache";
import { classifyBootstrapSession, shouldPurgeCachedSession } from "../auth/accountDeletionFlow";
import { StagingQaResetMarkers } from "../qa/StagingQaResetMarkers";
import { hashLocalAiInput, localAiCacheKey, readLocalAiResponse, writeLocalAiResponse } from "../utils/localAiResponseCache";
import { clearOfflineJobsForUser, enqueueOfflineJob } from "../sync/offlineQueue";
import { useNetworkReconnect } from "../sync/networkReconnect";
import { pullUserPreferences, pushUserPreferences } from "../sync/userPreferencesSync";
import { alertExportError } from "../utils/alertExportError";
import { parseTradesCsvText } from "../utils/importTradesCsv";
import { readCsvFileAsText } from "../utils/readCsvFile";
import { scheduleDailyPropRiskNotification } from "../utils/propRiskNotification";
import { configureNotificationHandler } from "../notifications/push";
import { LOCK_SCREEN_BUFFER_KEY } from "../notifications/dailyTradingBrief";
import { SmartNotificationsSection } from "../notifications/SmartNotificationsSection";
import { SettingsAccountSection } from "../components/settings/SettingsAccountSection";
import { registerPropPassSupabaseClient } from "../propPass/gatewayClient";
import { registerPropPassRpcClient } from "../propPass/commandGateway";
import { publishPropPassJournalMutation } from "../propPass/journalRefreshBus";
import { hasActivePropPassEntitlement } from "../billing/propPassEntitlement";
import { YdlTabBar } from "../ydl/shell";
import { useYdlTheme } from "../ydl/tokens";
import { YdlFade } from "../ydl/motion";
import { fetchFinnhubEconomicCalendar, mapFinnhubEconomicRows } from "../api/finnhubCalendar";
import {
  analyzeTrades,
  type DetectiveAgentFinding,
  type TradeAnalysisPayload,
  type TradeAnalysisResult,
  type TradePerformanceBreakdown,
} from "../api/tradeAnalysis";
import {
  fetchAIDailyChallenge,
  fetchAIDailyPlan,
  fetchAIJournalSummary,
  fetchAINewsExplainer,
  fetchAIRiskPredictor,
  fetchAITradeVisionReview,
  fetchAIWeeklyCoach,
  type AIDailyChallenge,
  type AIDailyPlan,
  type AIJournalSummary,
  type AINewsExplainer,
  type AIProviderStatus,
  type AIResponse,
  type AIRiskPredictor,
  type AITradeVisionReview,
  type AIWeeklyCoach,
} from "../api/aiCoach";
import { trackEvent, trackScreen } from "../observability/analytics";
import { identifyAnalyticsUser, resetAnalyticsUser } from "../lib/analytics";
import { captureAppError, logCrashlyticsBreadcrumb, scheduleMonitoringInit, setMonitoringUser, wrapAppWithSentry } from "../observability/monitoring";
import { recordMetric } from "../observability/metrics";
import { getPosthogClient } from "../lib/posthog";
import { logStartupCheckpoint, logStartupError, logStartupPerf, markAppStart } from "../lib/startupPerf";
import { logger } from "../lib/logger";
import { computeCalculatorResults, formatCalcUsd } from "../calc/riskCalculator";
import { ProductOnboardingScreen } from "./startup/ProductOnboardingScreen";
import { ValueOnboarding } from "./startup/ValueOnboarding";
import { AcquisitionPaywall } from "./startup/AcquisitionPaywall";
import { buildSettingsSubscriptionPresentation } from "./startup/settingsSubscriptionPresentation";
import {
  ACQUISITION_AUTH_REQUIRED_KEY,
  ACQUISITION_GUEST_KEY,
  ACQUISITION_ONBOARDING_KEY,
  ACQUISITION_PAYWALL_DEVICE_KEY,
  acquisitionPaywallUserKey,
  mergeExplicitAuthRequiredFlag,
  resolveAcquisitionPhase,
  shouldClearExplicitAuthRequiredOnSessionChange,
} from "./startup/acquisitionState";
import { RevenueCatIdentitySynchronizer } from "../billing/revenueCatIdentity";
import {
  decideEntitlementUiPhase,
  decidePostLoginEntitlementReconcile,
  isActiveEntitlement,
} from "../billing/entitlementReconcile";
import {
  beginExplicitLogoutGuard,
  endExplicitLogoutGuard,
} from "../auth/explicitLogout";
import { MoreScreen, type MoreDestination } from "./MoreScreen";
import { SubscriptionScreen } from "./SubscriptionScreen";
import { StatsDashboard } from "../stats/StatsDashboard";
import {
  isDeviceQaCaptureEnabled,
  useDeviceQaCaptureWalk,
} from "../qa/deviceQaCapture";
import {
  enableCloudSignIn,
  enableNativeAppleSignIn,
  enableNativeGoogleSignIn,
  isGoogleClientIdPairDistinct,
  isExpoGo,
  isRevenueCatConfigured,
  isSupabaseConfigured,
  REVENUECAT_API_KEY,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_IOS_PRODUCT_ID,
  REVENUECAT_IOS_YEARLY_PRODUCT_ID,
  sanitizedRuntimeConfigReport,
  supabase,
  userFacingBillingError,
  appVersionDisplayLabel,
} from "../config/appConfig";
import {
  buildFingerprintDiagnosticLines,
  isStagingBuildFingerprintVisible,
} from "../config/buildFingerprint";
import {
  FEATURE_LIMIT_MESSAGES,
  FREE_LIMITS,
  PRO_LIMITS,
  getLimitsForUser,
} from "../config/featureLimits";
import {
  canAttachTradeImage,
  peekShareCardExportAllowed,
  recordShareCardExportSuccess,
} from "../config/usageLimits";
import { openLegalUrl, PRIVACY_POLICY_URL, TERMS_OF_USE_EULA_URL } from "../config/legalUrls";
import { SubscriptionLegalDisclosure } from "../components/subscription/SubscriptionLegalDisclosure";
import {
  checkClientRateLimit,
  consumeClientRateLimit,
  logExportRateLimitDebug,
  peekClientRateLimit,
  recordSecurityEvent,
  runIdempotentLocal,
  stableSecurityHash,
  withTimeout,
} from "../security/clientSecurity";
import { SECURITY_LIMITS, SECURITY_MESSAGES } from "../security/securityConfig";
import { validateImportedRows, validateTradeInput } from "../security/tradeValidation";
import { secureUploadFile, validateSecureUploadInput } from "../security/uploadSecurity";
import { GlassCard } from "../components/ui/GlassCard";
import { AnimatedEquityCurve } from "../components/charts/AnimatedEquityCurve";
import { PremiumGlassCard } from "../components/ui/PremiumGlassCard";
import { PremiumLockOverlay } from "../components/ui/PremiumLockOverlay";
import {
  AnimatedPressable,
  EmptyStateCard,
  GlowBorderCard,
  NeonDivider,
  CountUpText,
  PremiumCard,
  PremiumLoadingBar,
  SkeletonCard,
  SkeletonStack,
  StatusInlineMessage,
  StatusSpinner,
  TypingText,
} from "../components/ui/premium";
import { AiAnalyticsProScreen } from "../components/traderStatus/AiAnalyticsProScreen";
import { TraderStatusDashboard } from "../components/traderStatus/TraderStatusDashboard";
import { AiNewsSentimentCard } from "../components/news/AiNewsSentimentCard";
import { AiAnalysisLoading } from "../components/ai/AiAnalysisLoading";
import { JournalTradeSwipeCard } from "../components/journal/JournalTradeSwipeCard";
import { JournalCalendarDayPressable } from "../components/journal/JournalCalendarDayPressable";
import { AnimatedEntrance } from "../components/ui/AnimatedEntrance";
import { BottomSheetPanel } from "../components/ui/BottomSheetPanel";
import {
  formatAbsolutePnlAmount,
  inferTradePnlSign,
  resolveSignedTradePnl,
  type TradePnlSign,
} from "../journal/manualPnl";
import { PropPassLockedPreview } from "../propPass/PropPassLockedPreview";
import {
  StatsCharts,
  StatsFocusInsight,
  StatsMetrics,
  StatsOverview,
  buildTradingRadarAxes,
} from "../components/stats";
import {
  buildAnalysisBreakdown,
  dayKeyForTrade,
  hourKeyForTrade,
  roundMetric,
  summarizeTradesForAnalysis,
} from "./utils/tradeBreakdown";
import {
  FREE_MONTHLY_PDF_PREVIEW_LIMIT,
  FREE_MONTHLY_TRADE_LIMIT,
  TRADE_LIMIT_PAYWALL,
} from "../config/monetization";
import { lightHaptic, successHaptic, warningHaptic } from "../components/ui/haptics";
import { calculateAchievements, traderLevelFromScore, type Achievement, type TraderLevel } from "../analytics/achievements";
import { detectTradingPatterns, type PatternDetectionResult } from "../analytics/patternDetector";
import { calculatePropSurvival } from "../analytics/propSurvival";
import { buildSessionHeatmap, type HourHeatmapCell } from "../analytics/sessionHeatmap";
import { calculateTradingScore, type TradingScoreResult } from "../analytics/tradingScore";
import { buildAIAnalyticsContext } from "../analytics/aiContextBuilder";
import { buildUnifiedTradeAnalytics, drawdownControlFromMetrics, infinitySafeMetric } from "../analytics/tradeMetrics";
import {
  resolveTimeRangeStart,
  STATS_TIME_RANGES,
  StatsTimeRangeProvider,
  statsTimeRangeToLegacyPeriod,
  useFilteredTrades,
  useStatsTimeRange,
  type StatsTimeRange,
} from "../analytics/timeRange";
import { calculatePassProbability, type PassProbabilityResult } from "../ai/passProbabilityEngine";
import { detectRevengeTrading, type RevengeTradingResult } from "../ai/revengeTradingDetector";
import { detectHiddenLeaks, type HiddenLeak } from "../ai/hiddenLeakDetector";
import {
  buildAiAchievements,
  buildAiInsights,
  buildAiOperatingSystem,
  type AiDailyMission,
  type AiDailyMissionStatus,
  type AiBenchmarkProfile,
  type AiImprovementTimeline,
  type AiInsight,
  type AiOperatingSystem,
  type AiTradingAchievement,
  type AiTradingDNAProfile,
  type AiWeeklyReport,
} from "../ai/aiInsightEngine";
import {
  applyUserOverrides,
  buildAiPropContextFromEngine,
  buildPropRiskEngine,
  computePropRiskSnapshot,
  loadLocalPropSettings,
  mapLegacyFirmMode,
  mapPhaseToLegacyMode,
  normalizeRemoteTemplate,
  persistPropPhase,
  persistPropTemplateSlug,
  PROP_FIRM_SELECT_COLUMNS,
  PROP_RULES_CACHE_KEY,
  type PropFirmPhase,
  type PropFirmTemplate,
  type RiskTemplate,
  propSnapshotShareMeta,
  resolvePropTemplateKey,
  tryComputePropRiskSnapshot,
} from "../propFirm";
import { PropFirmRiskDashboard } from "../components/propFirm/PropFirmRiskDashboard";
import { PropFirmRiskCoachScreen } from "../components/propFirm/PropFirmRiskCoachScreen";

const LazyStatCardExportHost = React.lazy(() =>
  import("../components/insights/shareCard/StatCardExportHost").then((mod) => ({
    default: mod.StatCardExportHost,
  })),
);


import { C } from "./theme";
import { styles } from "./styles";
import { runYdlMotionHaptic, ydlIconRules, getYdlNumberMotionConfig } from "../ydl";
import type {
  Tab,
  Direction,
  Asset,
  Bias,
  Impact,
  Lang,
  FirmMode,
  ContractFamily,
  EvalStrategy,
  RiskInstrument,
  RiskStatus,
  Trade,
  TradeJournalRow,
  MarketNews,
  EconEvent,
  MarketDailyBrief,
  MarketWatchlistItem,
  MarketSummary,
  PropFirmUpdate,
  MarketIntelData,
  ServerSubscriptionRow,
  ProAccessSource,
  ProAccessState,
} from "./types";
import {
  UI_ICON_SIZE,
  UI_ICON_STROKE,
  RAW_FINNHUB,
  FINNHUB,
  CALENDAR_API_URL,
  YOU_TRADER_BULL_LOGO,
  PREMIUM_PRICE,
  PREMIUM_PRICE_YEARLY,
  YOU_TRADER_MONTHLY_PRODUCT_ID,
  YOU_TRADER_WEEKLY_PRODUCT_ID,
  YOU_TRADER_YEARLY_PRODUCT_ID,
  YOU_TRADER_PRO_PRODUCT_IDS,
  BILLING_DEBUG_LOGS,
  ENTITLEMENT_RETRY_DELAYS_MS,
  TRADES_STORAGE_KEY,
  LANG_STORAGE_KEY,
  FREE_JOURNAL_DAYS,
  MAX_SYMBOL_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_MOOD_LENGTH,
  MAX_CONTRACTS,
  MAX_PRICE,
  MAX_ABS_PNL,
  MAX_LOCAL_TRADES,
  MAX_SCREENSHOT_BYTES,
  MAX_VOICE_NOTE_BYTES,
  TRADE_SAVE_DEBOUNCE_MS,
  JOURNAL_MEDIA_DIR,
  INSTRUMENTS,
  MINI_INSTRUMENTS,
  MICRO_INSTRUMENTS,
  MINI_TO_MICRO_MAP,
  ASSETS,
  COMMON_TRADE_TAGS,
  MOODS,
} from "./constants";
import {
  safeDateFromISO,
  nyNow,
  todayISO,
  uid,
  toNum,
  clampNumber,
  safeText,
  normalizeTradeClock,
  formatClockFromDate,
  tradeTimestampFromClock,
} from "./utils/dates";
import { money, moneyCompact, dayMoney, formatCompactMoney } from "./utils/format";
import {
  usageDayKey,
  usageMonthKey,
  monthlyUsageStorageKey,
  getMonthlyUsageCount,
  incrementMonthlyUsageCount,
  tradeLoggedMonthKey,
  monthlyLoggedTradeCount,
} from "./utils/quota";
import {
  getTradeTime,
  rrForTrade,
  maxDrawdownFromTrades,
  fullWeekdayName,
  groupPerformance,
  calcStats,
  tradingScoreForTrades,
  lowToHighPerformance,
  sessionLabelForTrade,
  primarySetupLabel,
  buildDailySeries,
  sharpeRatioFromDaily,
  dailyWinLossStreaks,
  extractStrategyTags,
} from "./utils/stats";
import { WarningCard } from "./ui/WarningCard";
import {
  AiAnimatedBar,
  AiFlowRail,
  AiGuardianRing,
  AiImageScan,
  AiIntelligencePulse,
} from "./ai/animations";
import { TradeVisionCoachSection } from "./ai/tradeVision";
import {
  PROP_COACH_ACCOUNT_SIZES,
  PROP_COACH_FIRMS,
  PropCoachQuickCard,
  propAggressionLabel,
  propFirmMatches,
  propRuleNeedsReview,
  truncateCoachLine,
  type AiOsPropTool,
  type PropAggression,
} from "./ai/propCoach";
import {
  AiTradingAssistantBlock,
  ProviderBadge,
  type AIResultMap,
} from "./ai/assistant";
import { aiOsUniqueList, AiCoachActionLine, AiCoachProse, AiCoachSectionLabel, AiOsTextBlock, MetricPillRow, TerminalGlassCard } from "./ai/sharedUi";
import { moodLabel, moodTranslationKey } from "./utils/mood";
import type { PerformanceGroup } from "./utils/stats";

const AI_ASSISTANT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Authenticated publishable-key client only — never service_role. No Prop OS I/O here.
// Must never throw during module evaluation (TestFlight black-screen risk).
try {
  registerPropPassSupabaseClient(
    (supabase as unknown as import("../propOs/accounts/authenticatedReadTransport").SupabasePropOsReadClient) ??
      null,
  );
  registerPropPassRpcClient(
    (supabase as unknown as import("../propOs/commands/rpcWriteService").PropOsRpcClient) ?? null,
  );
} catch (error) {
  logStartupError("prop_pass_client_register", error);
}

const LazyPropPassInternalScreen = React.lazy(async () => {
  const mod = await import("../propPass/PropPassInternalScreen");
  return { default: mod.PropPassInternalScreen };
});

logStartupCheckpoint("S06");
logStartupCheckpoint("S07", JSON.stringify(sanitizedRuntimeConfigReport()));
logStartupCheckpoint("S08", isSupabaseConfigured ? "supabase_ready" : "supabase_absent");

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
function normalizeSymbolInput(value: string) {
  const symbol = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9._/-]/g, "")
    .slice(0, MAX_SYMBOL_LENGTH);
  return symbol || "MES";
}
function interpolateI18n(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template,
  );
}
function optionalPositiveNumber(value: string, label: string, lang: Lang, max = MAX_PRICE) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return { value: null as number | null };
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > max) {
    return {
      value: null as number | null,
      error: interpolateI18n(t("valueOutsideSafeRange"), { label }),
    };
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
  lang: Lang = "en",
  options?: {
    pnlSign?: TradePnlSign;
  },
) {
  const symbol = normalizeSymbolInput(form.symbol) || "MES";
  const entryTime = normalizeTradeClock(form.entryTime);
  const exitTime = normalizeTradeClock(form.exitTime);
  if (String(form.entryTime || "").trim() && !entryTime) {
    return { error: t("entryTimeInvalid") };
  }
  if (String(form.exitTime || "").trim() && !exitTime) {
    return { error: t("exitTimeInvalid") };
  }
  const contractsRaw = Number(String(form.contracts || "1").replace(",", "."));
  if (!Number.isFinite(contractsRaw) || contractsRaw <= 0 || contractsRaw > MAX_CONTRACTS) {
    return { error: t("contractsInvalid") };
  }

  const entry = optionalPositiveNumber(form.entry, t("entryPrice"), lang);
  if (entry.error) return { error: entry.error };
  const exit = optionalPositiveNumber(form.exit, t("exitPrice"), lang);
  if (exit.error) return { error: exit.error };
  const stopLoss = optionalPositiveNumber(form.stopLoss, t("stopLossPrice"), lang);
  if (stopLoss.error) return { error: stopLoss.error };
  const takeProfit = optionalPositiveNumber(form.takeProfit, t("takeProfitPrice"), lang);
  if (takeProfit.error) return { error: takeProfit.error };

  // Signed Trade P&L control is authoritative. Entry/exit never required to save.
  const resolved = resolveSignedTradePnl(form.pnl, options?.pnlSign || "plus");
  if (resolved.ok === false) {
    return {
      error:
        resolved.error === "empty" ? t("manualPnlRequired") : t("pnlOutsideSafeRange"),
    };
  }
  if (Math.abs(resolved.pnl) > MAX_ABS_PNL) {
    return { error: t("pnlOutsideSafeRange") };
  }
  const pnl = resolved.pnl;

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
function journalMediaExtension(mimeType?: string | null, originalName?: string | null, fallback = "bin") {
  const fromName = String(originalName || "").toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1];
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic")) return "heic";
  if (mime.includes("heif")) return "heif";
  if (mime.includes("m4a") || mime.includes("mp4")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("aac")) return "aac";
  return fallback;
}
async function persistJournalMediaAsset({
  uri,
  kind,
  mimeType,
  originalName,
}: {
  uri: string;
  kind: "photos" | "voice";
  mimeType?: string | null;
  originalName?: string | null;
}) {
  if (!uri || !JOURNAL_MEDIA_DIR) throw new Error("Media storage is unavailable.");
  if (uri.startsWith(`${JOURNAL_MEDIA_DIR}${kind}/`)) return uri;
  const directory = `${JOURNAL_MEDIA_DIR}${kind}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const ext = journalMediaExtension(mimeType, originalName, kind === "photos" ? "jpg" : "m4a");
  const destination = `${directory}${Date.now()}-${uid()}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  const info = await FileSystem.getInfoAsync(destination);
  const size = info.exists && typeof info.size === "number" ? info.size : 0;
  if (!info.exists || size <= 0) {
    throw new Error("Media file could not be saved.");
  }
  return destination;
}
function isLocalMediaUri(uri?: string | null) {
  return !!uri && (uri.startsWith("file://") || uri.startsWith("content://") || uri.startsWith("ph://"));
}
function inferUploadMimeType(uri?: string | null, fallback?: string) {
  const ext = String(uri || "").split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (["m4a", "mp4"].includes(ext)) return "audio/x-m4a";
  if (ext === "mp3" || ext === "mpeg") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "aac") return "audio/aac";
  return fallback || "application/octet-stream";
}
function filenameFromUri(uri?: string | null, fallback = "upload.bin") {
  const raw = String(uri || "").split("?")[0].split("#")[0].split("/").pop() || fallback;
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  return /^[A-Za-z0-9_.-]{1,100}$/.test(decoded) ? decoded : fallback;
}
function storageRef(bucket: string, path: string) {
  return `supabase://${bucket}/${path}`;
}
function parseStorageRef(uri?: string | null) {
  const value = String(uri || "");
  if (!value.startsWith("supabase://")) return null;
  const rest = value.slice("supabase://".length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  const path = rest.slice(slash + 1);
  if (!bucket || !path || path.includes("..") || /[\u0000-\u001f\u007f]/.test(path)) return null;
  return { bucket, path };
}
async function signedStorageUrl(ref?: string | null) {
  if (!supabase) return null;
  const parsed = parseStorageRef(ref);
  if (!parsed) return null;
  const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60 * 24 * 7);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
function cloudSafeAssetUrl(uri?: string | null) {
  if (!uri) return null;
  if (parseStorageRef(uri)) return uri;
  try {
    const parsed = new URL(uri);
    return parsed.protocol === "https:" ? uri : null;
  } catch {
    return null;
  }
}
function cloudSafeAssetUrlForUser(uri: string | null | undefined, userId: string, kind: "photo" | "voice") {
  if (!uri) return null;
  const parsed = parseStorageRef(uri);
  if (parsed) {
    const expectedBucket = kind === "photo" ? "user-screenshots" : "user-voice-notes";
    return parsed.bucket === expectedBucket && parsed.path.startsWith(`${userId}/`) ? uri : null;
  }
  return cloudSafeAssetUrl(uri);
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
function journalLongDateLabel(date: string) {
  return safeDateFromISO(date).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
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
function billingDebugLog(message: string, details?: Record<string, unknown>) {
  if (!BILLING_DEBUG_LOGS) return;
  logger.info("RevenueCat billing debug", {
    feature: "revenuecat",
    action: "billing_debug",
    message,
    details: details || {},
  });
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
  // CustomerInfo is the only client access source. Server mirrors are diagnostic only.
  const revenueCatEntitlementActive = customerHasRevenueCatProEntitlement(customerInfo);
  const appleMonthlyActive = customerHasActiveProSubscription(customerInfo);
  const isPro = revenueCatEntitlementActive || appleMonthlyActive;
  const source: ProAccessSource = revenueCatEntitlementActive
    ? "revenuecat_entitlement"
    : appleMonthlyActive
      ? "apple_subscription"
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
  if (id.includes("week") || pkg.packageType === "WEEKLY") return "WEEKLY";
  if (id.includes("year") || id.includes("annual") || pkg.packageType === "ANNUAL") return "YEARLY";
  if (id.includes("month") || pkg.packageType === "MONTHLY") return "MONTHLY";
  return pkg.packageType || "PRO";
}

function findProPackage(packages: PurchasesPackage[], productId: string) {
  const yearlyAliases = new Set(["youtrader_pro_yearly", "youtrader_pro_yearly__", YOU_TRADER_YEARLY_PRODUCT_ID]);
  const isYearlyRequest = yearlyAliases.has(productId);
  return (
    packages.find((pkg) => pkg.product.identifier === productId) ||
    packages.find((pkg) =>
      isYearlyRequest
        ? yearlyAliases.has(pkg.product.identifier) || packageTitle(pkg) === "YEARLY"
        : pkg.product.identifier === YOU_TRADER_MONTHLY_PRODUCT_ID || packageTitle(pkg) === "MONTHLY",
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
    photoCloudUri: trade.photoCloudUri ? safeText(trade.photoCloudUri, 2048) : null,
    voiceCloudUri: trade.voiceCloudUri ? safeText(trade.voiceCloudUri, 2048) : null,
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

function parseStoredTrades(raw: string | null): Trade[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeTrades(parsed) : [];
  } catch {
    return [];
  }
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
    screenshot_url: cloudSafeAssetUrlForUser(normalized.photoCloudUri || normalized.photoUri, userId, "photo"),
    voice_url: cloudSafeAssetUrlForUser(normalized.voiceCloudUri || normalized.voiceUri, userId, "voice"),
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
    photoCloudUri: row.screenshot_url || null,
    voiceCloudUri: row.voice_url || null,
    voiceName: row.voice_url ? t("voiceNoteLabel") : null,
    createdAt,
    updatedAt,
  });
}

async function resolveCloudTradeAssets(trade: Trade): Promise<Trade> {
  const photoRef = trade.photoCloudUri || trade.photoUri;
  const voiceRef = trade.voiceCloudUri || trade.voiceUri;
  const [photoSigned, voiceSigned] = await Promise.all([
    parseStorageRef(photoRef) ? signedStorageUrl(photoRef) : Promise.resolve(null),
    parseStorageRef(voiceRef) ? signedStorageUrl(voiceRef) : Promise.resolve(null),
  ]);
  return normalizeTrade({
    ...trade,
    photoUri: photoSigned || trade.photoUri || null,
    voiceUri: voiceSigned || trade.voiceUri || null,
    photoCloudUri: trade.photoCloudUri || (parseStorageRef(trade.photoUri) ? trade.photoUri : null),
    voiceCloudUri: trade.voiceCloudUri || (parseStorageRef(trade.voiceUri) ? trade.voiceUri : null),
  });
}

async function mergeLocalAndCloudTrades(localTrades: Trade[], cloudRows: TradeJournalRow[]) {
  const merged = new Map<string, Trade>();
  normalizeTrades(localTrades).forEach((trade) => merged.set(trade.id, trade));

  for (const row of cloudRows) {
    const clientId = String(row.client_id || row.id || "");
    if (!clientId) continue;
    const deletedAt = row.deleted_at ? Date.parse(row.deleted_at) : 0;
    if (deletedAt) {
      const local = merged.get(clientId);
      if (!local || deletedAt >= (local.updatedAt || 0)) merged.delete(clientId);
      continue;
    }
    const cloudTrade = await resolveCloudTradeAssets(cloudRowToTrade(row));
    const local = merged.get(cloudTrade.id);
    if (!local || (cloudTrade.updatedAt || 0) > (local.updatedAt || 0)) {
      merged.set(cloudTrade.id, cloudTrade);
    } else if (local) {
      const refreshPhoto = !!cloudTrade.photoCloudUri && !isLocalMediaUri(local.photoUri);
      const refreshVoice = !!cloudTrade.voiceCloudUri && !isLocalMediaUri(local.voiceUri);
      if (refreshPhoto || refreshVoice) {
        merged.set(cloudTrade.id, normalizeTrade({
          ...local,
          photoUri: refreshPhoto ? cloudTrade.photoUri : local.photoUri || null,
          voiceUri: refreshVoice ? cloudTrade.voiceUri : local.voiceUri || null,
          photoCloudUri: cloudTrade.photoCloudUri || local.photoCloudUri || null,
          voiceCloudUri: cloudTrade.voiceCloudUri || local.voiceCloudUri || null,
        }));
      }
    }
  }

  return sortTrades([...merged.values()]);
}

function attachmentSignatureUri(trade: Trade, kind: "photo" | "voice") {
  return kind === "photo"
    ? trade.photoCloudUri || trade.photoUri || null
    : trade.voiceCloudUri || trade.voiceUri || null;
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
      photoUri: attachmentSignatureUri(trade, "photo"),
      voiceUri: attachmentSignatureUri(trade, "voice"),
      updatedAt: trade.updatedAt || 0,
    })),
  );
}

async function uploadTradeAttachmentForCloud(
  trade: Trade,
  kind: "photo" | "voice",
): Promise<{ trade: Trade; failed: boolean }> {
  const uri = kind === "photo" ? trade.photoUri : trade.voiceUri;
  const existingCloudRef = kind === "photo" ? trade.photoCloudUri : trade.voiceCloudUri;
  if (!uri || existingCloudRef || !isLocalMediaUri(uri)) return { trade, failed: false };

  try {
    const category = kind === "photo" ? "screenshot" : "voice-note";
    const fallbackName = kind === "photo" ? "trade-screenshot.jpg" : "voice-note.m4a";
    const mimeType = inferUploadMimeType(uri, kind === "photo" ? "image/jpeg" : "audio/x-m4a");
    const result = await secureUploadFile({
      uri,
      category,
      originalName: filenameFromUri(uri, fallbackName),
      mimeType,
    });
    const ref = storageRef(result.bucket, result.path);
    return {
      trade: normalizeTrade({
        ...trade,
        photoCloudUri: kind === "photo" ? ref : trade.photoCloudUri || null,
        voiceCloudUri: kind === "voice" ? ref : trade.voiceCloudUri || null,
      }),
      failed: false,
    };
  } catch {
    return { trade, failed: true };
  }
}

async function uploadTradeAttachmentsForCloud(trade: Trade) {
  const photo = await uploadTradeAttachmentForCloud(trade, "photo");
  const voice = await uploadTradeAttachmentForCloud(photo.trade, "voice");
  return {
    trade: voice.trade,
    failed: photo.failed || voice.failed,
  };
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
      const title = stripHtml(rssTag(block, "title") || t("fallbackMarketUpdate"));
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
        title: String(row.title || t("fallbackMarketUpdate")),
        summary: String(row.summary || ""),
        source: String(row.source || t("fallbackMarketIntel")),
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
async function loadNews(opts?: {
  fault?: import("../qa/stagingQaNewsFault").StagingNewsFaultMode;
}): Promise<{ items: MarketNews[]; errorCode: string | null }> {
  const fault = opts?.fault || "none";
  const { resolveNewsLoadPlan } = await import("../qa/stagingQaNewsFault");
  const plan = resolveNewsLoadPlan(fault);
  if (plan.forceTimeout) {
    await new Promise((r) => setTimeout(r, 50));
    return { items: [], errorCode: "timeout" };
  }
  if (plan.forceEmpty) {
    return { items: [], errorCode: null };
  }
  if (plan.forceMalformed) {
    return { items: [], errorCode: "malformed" };
  }
  if (!plan.useNetwork) {
    const cacheRaw = await AsyncStorage.getItem("news-cache-v6");
    const cached = cacheRaw ? JSON.parse(cacheRaw) : null;
    return {
      items: Array.isArray(cached?.items) ? cached.items : [],
      errorCode: plan.errorCode,
    };
  }

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
  if (marketIntelItems.length) {
    return { items: await persist(marketIntelItems), errorCode: null };
  }

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
      if (!Array.isArray(data)) {
        return { items: cached?.items || [], errorCode: "malformed" };
      }
      const items: MarketNews[] = data.slice(0, 80).map((n: any) => {
        const text = `${n.headline || ""} ${n.summary || ""}`;
        return {
          id: String(n.id || uid()),
          title: n.headline || t("fallbackMarketUpdate"),
          summary: n.summary || "",
          source: n.source || "Finnhub",
          time: fmtTime(n.datetime || Date.now() / 1000),
          url: n.url || "",
          bias: estimateBias(text),
          impact: impactFromText(text),
        };
      });
      if (items.length) return { items: await persist(items), errorCode: null };
    } catch (error: any) {
      clearTimeout(timer);
      if (error?.name === "AbortError") {
        return { items: cached?.items || [], errorCode: "timeout" };
      }
    }
  }

  try {
    const items = await fetchYahooFinanceNews();
    if (items.length) return { items: await persist(items), errorCode: null };
  } catch {
    // Fall back to the latest cached feed before showing offline placeholders.
  }

  const fallback = cached?.items || demoNews;
  return { items: fallback, errorCode: fallback === demoNews ? null : null };
}
function normalizeEvent(e: any, index: number): EconEvent {
  const text = `${e.name || e.event || e.title || ""} ${e.currency || e.country || ""}`;
  return applyCalendarBias({
    id: String(e.id || `${e.date || todayISO()}-${index}`),
    date: String(e.date || todayISO()).slice(0, 10),
    time: String(e.time || "08:30 AM"),
    name: String(e.name || e.event || e.title || t("fallbackEconomicEvent")),
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
        name: String(row.event_name || t("fallbackEconomicEvent")),
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
  if (!supabase) {
    const news = await loadNews();
    return { ...empty, headlines: news.items, events: await loadCalendarEvents() };
  }
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
            title: String(row.title || t("fallbackMarketUpdate")),
            summary: String(row.summary || ""),
            source: String(row.source || t("fallbackMarketIntel")),
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
            name: String(row.event_name || t("fallbackEconomicEvent")),
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
        title: String(briefRow.title || t("dailyBrief")),
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
        reason: String(item.reason || t("fallbackNoCachedReason")),
        caution: String(item.caution || t("fallbackMarketContextCaution")),
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
        firm: String(row.firm || t("fallbackPropFirm")),
        category: String(row.category || "rules"),
        keyText: String(row.key_text || ""),
        detectedChangeSummary: String(row.detected_change_summary || t("fallbackNoChangeSummary")),
        changedAt: String(row.changed_at || ""),
        url: String(row.url || ""),
      })) : [],
      headlines,
    };
  } catch {
    const news = await loadNews();
    return { ...empty, headlines: news.items, events: await loadCalendarEvents() };
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
        const name = String(row.title || row.event || row.name || t("fallbackEconomicEvent"));
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

function Card({ children, style, animated = true, delay = 0 }: any) {
  return (
    <AnimatedEntrance style={[styles.card, styles.safeCard, style]} delay={delay} disabled={!animated}>
      {children}
    </AnimatedEntrance>
  );
}

function AppStartupSkeleton() {
  return (
    <View style={styles.startupSkeletonWrap} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <Text style={styles.h1}>YouTrader</Text>
      <PremiumLoadingBar indeterminate height={4} tone="lime" style={styles.startupSkeletonBar} />
      <SkeletonCard rows={4} tone="lime" style={styles.startupSkeletonCard} />
      <SkeletonCard rows={3} tone="purple" style={styles.startupSkeletonCard} />
    </View>
  );
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
      accessibilityRole="text"
      style={[
        styles.pill,
        { borderColor: color, backgroundColor: color + "18" },
      ]}
    >
      <Text style={[styles.pillText, { color }]} maxFontSizeMultiplier={1.3}>
        {text}
      </Text>
    </View>
  );
}
function Input(props: any) {
  const { testID, accessibilityLabel, label, style, multiline, ...rest } = props;
  const a11y = accessibilityLabel || (typeof label === "string" ? label : undefined);
  const showLabel = typeof label === "string" && label.trim().length > 0;
  const styleObj = style && !Array.isArray(style) ? style : null;
  return (
    <View style={{ marginBottom: showLabel ? 12 : 0, flex: styleObj?.flex === 1 ? 1 : undefined, minWidth: 0 }}>
      {showLabel ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...rest}
        testID={testID}
        accessibilityLabel={a11y}
        placeholderTextColor={C.muted}
        style={[
          styles.input,
          multiline && { height: 96, textAlignVertical: "top" },
          style,
        ]}
        multiline={multiline}
      />
    </View>
  );
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

function riskAmountForTrade(trade: Trade) {
  const entry = Number(trade.entry ?? 0);
  const stop = Number(trade.stopLoss ?? 0);
  const contracts = Number(trade.contracts || 1);
  if (!entry || !stop || !Number.isFinite(entry) || !Number.isFinite(stop)) return null;
  const risk = Math.abs(entry - stop) * Math.max(1, contracts);
  return Number.isFinite(risk) ? roundMetric(risk) : null;
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

function buildTradeAnalysisPayload(
  trades: Trade[],
  stats: ReturnType<typeof calcStats>,
  period: StatsTimeRange,
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
    period: statsTimeRangeToLegacyPeriod(period),
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
  return buildLocalizedLocalCoachAnalysis(stats, patterns, moneyCompact, lowToHighPerformance) as TradeAnalysisResult;
}

function toDateStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
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
          <Text style={styles.breakdownEmptyText}>{t("addTradesRevealEdge")}</Text>
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
                      {t("tradesWinRateMeta", { count: item.count, wr: item.wr.toFixed(0) })}
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

function PropRiskEntryCard({
  title,
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
  const cardTitle = title ?? t("propRiskToday");
  const safeTemplates = templates;
  const [templateKey, setTemplateKey] = useState("");
  const [mode, setMode] = useState<FirmMode>("evaluation");

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("prop-risk-template-v1"),
      AsyncStorage.getItem("prop-risk-mode-v1"),
    ]).then(([savedTemplate, savedMode]) => {
      const nextKey = resolvePropTemplateKey(savedTemplate || "", safeTemplates);
      if (nextKey) setTemplateKey(nextKey);
      if (savedMode === "evaluation" || savedMode === "funded") setMode(savedMode);
    });
  }, [safeTemplates]);

  const snapshot = useMemo(
    () =>
      templateKey && safeTemplates.length
        ? tryComputePropRiskSnapshot({ trades, selectedDate, templateKey, mode, templates: safeTemplates })
        : null,
    [trades, selectedDate, templateKey, mode, safeTemplates],
  );

  if (!snapshot) {
    return (
      <Pressable onPress={onPress}>
        <GlassCard style={styles.propEntryCard} intensity={32}>
          <Text style={styles.propEntryTitle}>{cardTitle}</Text>
          <Text style={styles.sub}>{t("propSyncActivate")}</Text>
        </GlassCard>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.propEntryCard} intensity={32}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.propEntryTitle}>{cardTitle}</Text>
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
            <Text style={styles.edgeMiniLabel}>{t("dailyBuffer")}</Text>
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
            <Text style={styles.edgeMiniLabel}>{t("dayPnl")}</Text>
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
            <Text style={styles.edgeMiniLabel}>{t("toPass")}</Text>
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
        <Text style={styles.propEntryHint}>{t("propEntryHint")}</Text>
      </GlassCard>
    </Pressable>
  );
}

function PropFirmRiskCoach({
  trades,
  selectedDate,
  templates,
  isPremium,
  onUpgrade,
}: {
  trades: Trade[];
  selectedDate: string;
  templates: RiskTemplate[];
  isPremium: boolean;
  onUpgrade?: () => void;
}) {
  return (
    <PropFirmRiskCoachScreen
      trades={trades}
      selectedDate={selectedDate}
      templates={templates}
      isPremium={isPremium}
      onUpgrade={onUpgrade}
    />
  );
}

function MetricGauge({ label, value, helper, tone = "green" }: { label: string; value: string; helper?: string; tone?: "green" | "purple" | "red" | "white" }) {
  const color = tone === "purple" ? C.purple : tone === "red" ? C.red : tone === "white" ? C.text : C.green;
  const numericValue = Number(value.replace(/[$,%]/g, ""));
  const canCount = Number.isFinite(numericValue) && /^[$+-]?\d/.test(value);
  return (
    <GlassCard compact style={styles.dashboardMetric}>
      <View style={styles.rowBetween}>
        <SafeMetricLabel style={styles.dashboardMetricLabel}>{label}</SafeMetricLabel>
        <View style={[styles.metricDot, { backgroundColor: color }]} />
      </View>
      {canCount ? (
        <CountUpText
          value={numericValue}
          durationMs={500}
          formatValue={(next) => value.startsWith("$") ? moneyCompact(next) : value.includes("%") ? `${next.toFixed(0)}%` : next.toFixed(value.includes(".") ? 2 : 0)}
          textStyle={[styles.dashboardMetricValue, { color }]}
        />
      ) : (
        <SafeText style={[styles.dashboardMetricValue, { color }]}>{value}</SafeText>
      )}
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
    <AnimatedEntrance style={[styles.equityCurveBox, { width: chartWidth, height: chartHeight }]} distance={6}>
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
    </AnimatedEntrance>
  );
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

type ProValueModalReason = "trade_limit" | "locked_insight" | "pro_feature" | "usage_limit";

type ProValueModalContent = {
  visible: boolean;
  reason: ProValueModalReason;
  title: string;
  message: string;
  bullets?: string[];
  primaryTrial?: boolean;
};

function ProValueModal({
  lang,
  content,
  packages,
  storeProducts,
  purchaseBusy,
  paywallError,
  showRestorePurchases,
  onPurchase,
  onRestore,
  onClose,
}: {
  lang: Lang;
  content: ProValueModalContent;
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  void showRestorePurchases;
  const monthly = packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null;
  const yearly = packages.find((pkg) => packageTitle(pkg) === "YEARLY") || null;
  const monthlyProduct = storeProducts.find((product) => product.identifier === YOU_TRADER_MONTHLY_PRODUCT_ID) || null;
  const yearlyProduct = storeProducts.find((product) => product.identifier === YOU_TRADER_YEARLY_PRODUCT_ID) || null;
  const monthlyPrice = monthly ? packagePrice(monthly) : monthlyProduct?.priceString || PREMIUM_PRICE;
  const yearlyPrice = yearly ? packagePrice(yearly) : yearlyProduct?.priceString || PREMIUM_PRICE_YEARLY;
  useEffect(() => {
    if (!content.visible) return;
    trackEvent("paywall_viewed", { screen: "value_modal", reason: content.reason });
  }, [content.reason, content.visible]);
  return (
    <Modal visible={content.visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.valueModalBackdrop}>
        <GlassCard style={styles.valueModalCard} intensity={52}>
          <View style={styles.rowBetween}>
            <Text style={styles.valueModalEyebrow}>YouTrader Pro</Text>
            <Pressable onPress={onClose} style={styles.valueModalClose}>
              <Text style={styles.closeX}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.valueModalTitle}>{content.title}</Text>
          <Text style={styles.valueModalText}>{content.message}</Text>
          {(content.bullets || [t("unlimitedTradesMedia"), t("hiddenLeaksBenefit"), t("proToolsBenefit")]).slice(0, 4).map((item) => (
            <View key={item} style={styles.valueModalBulletRow}>
              <Check size={15} color={C.green} strokeWidth={UI_ICON_STROKE} />
              <Text style={styles.valueModalBullet}>{item}</Text>
            </View>
          ))}
          {content.reason === "trade_limit" ? (
            <>
              <Pressable disabled={purchaseBusy} onPress={() => onPurchase(monthly, YOU_TRADER_MONTHLY_PRODUCT_ID)} style={[styles.primaryBig, purchaseBusy && styles.disabledBtn]}>
                <Text style={styles.primaryText}>{purchaseBusy ? t("connecting") : TRADE_LIMIT_PAYWALL.cta}</Text>
              </Pressable>
              <Text style={[styles.sub, { textAlign: "center", marginTop: 10, lineHeight: 18 }]}>{TRADE_LIMIT_PAYWALL.priceHint}</Text>
            </>
          ) : content.primaryTrial ? (
            <Pressable disabled={purchaseBusy} onPress={() => onPurchase(monthly, YOU_TRADER_MONTHLY_PRODUCT_ID)} style={[styles.primaryBig, purchaseBusy && styles.disabledBtn]}>
              <Text style={styles.primaryText}>{purchaseBusy ? t("connecting") : t("startSevenDayPro")}</Text>
            </Pressable>
          ) : null}
          <View style={styles.valueModalPlanRow}>
            <Pressable disabled={purchaseBusy} onPress={() => onPurchase(monthly, YOU_TRADER_MONTHLY_PRODUCT_ID)} style={[styles.valueModalPlan, purchaseBusy && styles.disabledBtn]}>
              <Text style={styles.planName}>{t("monthlyPlan")}</Text>
              <Text style={styles.planPrice}>{t("upgradeMonthly")}</Text>
              <Text style={styles.sub}>{monthlyPrice}</Text>
            </Pressable>
            <Pressable disabled={purchaseBusy} onPress={() => onPurchase(yearly, YOU_TRADER_YEARLY_PRODUCT_ID)} style={[styles.valueModalPlan, styles.valueModalYearlyPlan, purchaseBusy && styles.disabledBtn]}>
              <Text style={styles.planName}>{t("yearlyPlan")}</Text>
              <Text style={styles.planPrice}>{t("upgradeYearly")}</Text>
              <Text style={styles.sub}>{yearlyPrice}</Text>
            </Pressable>
          </View>
          <Pressable disabled={purchaseBusy} onPress={onRestore} style={[styles.secondaryBig, styles.restorePurchaseBtn, purchaseBusy && styles.disabledBtn]}>
            <Text style={styles.secondaryText}>{purchaseBusy ? t("checking") : t("restorePurchases")}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.valueModalLaterBtn}>
            <Text style={styles.valueModalLaterText}>{t("maybeLater")}</Text>
          </Pressable>
          {!!paywallError && <StatusInlineMessage kind="error" message={paywallError} style={{ marginTop: 8 }} />}
          <Text style={styles.newsDisclaimer}>{t("educationalDisclaimer")}</Text>
        </GlassCard>
      </View>
    </Modal>
  );
}

function PaywallPreview({
  lang,
  packages,
  storeProducts,
  purchaseBusy,
  paywallError,
  onPurchase,
  onRestore,
  showRestorePurchases,
}: {
  lang: Lang;
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
      <Text style={styles.paywallTitle}>{t("paywallHeroTitle")}</Text>
      <Text style={styles.paywallSub}>
        {t("paywallPreviewSub")}
      </Text>
      {purchaseBusy ? <SkeletonCard rows={2} tone="purple" style={styles.paywallSkeleton} /> : null}
      <Pressable
        disabled={purchaseBusy}
        onPress={() => onPurchase(monthly, YOU_TRADER_MONTHLY_PRODUCT_ID)}
        style={[styles.primaryBig, purchaseBusy && styles.disabledBtn]}
      >
        <Text style={styles.primaryText}>{purchaseBusy ? t("connecting") : t("unlockPro")}</Text>
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
          <Text style={styles.secondaryText}>{purchaseBusy ? t("checking") : t("restorePurchases")}</Text>
        </Pressable>
      ) : null}
      {paywallError ? (
        <StatusInlineMessage kind="error" message={paywallError} style={{ marginTop: 10 }} />
      ) : null}
    </GlassCard>
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
  const safeTemplates = templates;
  return (
    <View style={styles.propTemplateSelector}>
      <View style={styles.propTemplateHeader}>
        <Text style={styles.terminalSmallLabel}>{t("evalAccount")}</Text>
        <Text style={styles.propTemplateHint}>{t("propTemplateHintLive")}</Text>
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
    { label: t("winRate"), value: Math.min(100, stats.wr), display: `${stats.wr.toFixed(0)}%`, color: C.green, target: "55%+", explanation: t("radarWinRateExp") },
    { label: t("riskLabel"), value: drawdownControl, display: `${drawdownControl.toFixed(0)}%`, color: drawdownControl >= 70 ? C.green : C.yellow, target: "70%+", explanation: t("radarRiskExp") },
    { label: t("consistency"), value: consistency, display: `${consistency.toFixed(0)}%`, color: C.purple, target: "70%+", explanation: t("radarConsistencyExp") },
    { label: t("recovery"), value: Math.min(100, Math.max(0, recoveryFactor / 4) * 100), display: recoveryFactor ? recoveryFactor.toFixed(1) : "—", color: C.green, target: "3.0+", explanation: t("radarRecoveryExp") },
    { label: t("profitFactor"), value: Math.min(100, (stats.pf / 2.5) * 100), display: stats.pf ? stats.pf.toFixed(2) : "—", color: C.green, target: "1.5+", explanation: t("radarProfitFactorExp") },
    { label: t("rewardRiskLabel"), value: Math.min(100, (stats.avgWinLoss / 2.5) * 100), display: stats.avgWinLoss ? stats.avgWinLoss.toFixed(2) : "—", color: C.purple, target: "1.5+", explanation: t("radarRewardRiskExp") },
  ];
  const profileScore = Math.round(rings.reduce((sum, ring) => sum + Math.max(0, Math.min(100, ring.value)), 0) / rings.length);
  const strengths = rings.filter((ring) => ring.value >= 65).slice(0, 3);
  const weakest = [...rings].sort((a, b) => a.value - b.value)[0];

  return (
    <TerminalGlassCard>
      <Text style={styles.terminalEyebrow}>{t("tradingDna")}</Text>
      <View style={styles.dnaHero}>
        <View style={styles.dnaScoreCircle}>
          <Text style={styles.dnaScore}>{profileScore}</Text>
          <Text style={styles.dnaScoreLabel}>{t("dnaScore")}</Text>
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
          <Text style={styles.terminalSmallLabel}>{t("strengths")}</Text>
          <View style={styles.terminalChipRow}>
            {(strengths.length ? strengths : rings.slice(0, 2)).map((ring) => (
              <Text key={ring.label} style={styles.terminalChip}>● {ring.label}</Text>
            ))}
          </View>
        </View>
        <View style={styles.dnaWeakBlock}>
          <Text style={styles.terminalSmallLabel}>{t("weakestArea")}</Text>
          <Text style={styles.dnaWeakText}>{weakest.label}</Text>
          <Text style={styles.terminalSub}>{t("targetPrefix")} {weakest.target}</Text>
        </View>
      </View>
      <BottomSheetPanel visible={!!selected} title={selected?.title || t("metricDefault")} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            <Text style={styles.bottomSheetBig}>{selected.current}</Text>
            <Text style={styles.bottomSheetText}>{selected.explanation}</Text>
            <Text style={styles.bottomSheetText}>{t("targetPrefix")}: {selected.target}</Text>
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
  const [shareBusy, setShareBusy] = useState(false);
  const shareStats = useMemo(() => buildAchievementShareStats(trades, selectedDate), [selectedDate, trades]);
  const allUnlocked = achievements.filter((item) => item.unlocked);
  const freeUnlockLimitReached = !isPremium && allUnlocked.length > 5;
  const unlocked = isPremium ? allUnlocked : allUnlocked.slice(0, 5);
  const next = achievements.filter((item) => !item.unlocked).slice(0, 4);
  const exportAchievementCard = async (item: Achievement, action: "share" | "save") => {
    if (!item.unlocked) return;
    const allowed = await ensureShareCardExportAllowed(isPremium, session?.user.id || null, (message) => {
      Alert.alert(t("shareCardLimitReached"), message);
    });
    if (!allowed) return;
    try {
      setShareBusy(true);
      const { shareAchievementCardFromData, saveAchievementCardFromDataToPhotos } = await import("../components/insights/shareExport");
      if (action === "share") {
        await shareAchievementCardFromData(item, shareStats);
        trackEvent("achievement_share_generated", { achievement_id: item.id, achievement_title: item.title, is_pro: isPremium });
      } else {
        await saveAchievementCardFromDataToPhotos(item, shareStats);
        Alert.alert(t("savedTitle"), t("achievementCardSaved"));
        trackEvent("achievement_card_saved", { achievement_id: item.id, achievement_title: item.title, is_pro: isPremium });
      }
      await recordShareCardExportSuccess(session?.user.id || null, isPremium);
      successHaptic();
      void recordAchievementShareAnalytics({ session, isPremium, achievement: item });
    } catch {
      Alert.alert(action === "share" ? t("achievementShareFailed") : t("achievementSaveFailed"), t("shareCardExportFailed"));
      logger.error(new Error(t("shareCardExportFailed")), { feature: "achievements", action: action === "share" ? "terminal_share" : "terminal_save", userId: session?.user.id });
    } finally {
      setShareBusy(false);
    }
  };
  const promptAchievementExport = (item: Achievement) => {
    if (!item.unlocked) return;
    Alert.alert(item.title, t("exportAchievementCard"), [
      { text: t("sharePnlCard"), onPress: () => void exportAchievementCard(item, "share") },
      { text: t("saveImage"), onPress: () => void exportAchievementCard(item, "save") },
      { text: "Cancel", style: "cancel" },
    ]);
  };
  return (
    <TerminalGlassCard>
      <View style={styles.traderStatusHero}>
        <View>
          <Text style={styles.traderRank}>{level.title}</Text>
          <Text style={styles.terminalSub}>{level.phrase}</Text>
        </View>
      </View>
      {shareBusy ? <StatusSpinner accessibilityLabel="Sharing" style={{ marginVertical: 2 }} /> : null}
      <Text style={styles.terminalSmallLabel}>{t("unlocked")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementRail}>
        {unlocked.map((item) => (
          <Pressable key={item.id} onPress={() => promptAchievementExport(item)} style={styles.achievementRailCard}>
            <Text style={styles.achievementRailStatus}>{t("unlocked")}</Text>
            <Text style={styles.achievementRailTitle}>{item.title}</Text>
            <Text style={styles.achievementRailMeta}>{item.progressLabel}</Text>
            <Text style={styles.achievementRailTap}>{t("tapToShare")}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.terminalSmallLabel}>{t("nextTargets")}</Text>
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
	    { label: t("microWinPct"), value: `${winRate.toFixed(0)}%`, score: Math.min(100, winRate) },
	    { label: t("microPF"), value: profitFactor ? profitFactor.toFixed(2) : "—", score: Math.min(100, (profitFactor / 2.4) * 100) },
    { label: t("microAvgWL"), value: avgWinLoss ? avgWinLoss.toFixed(2) : "—", score: Math.min(100, (avgWinLoss / 2.4) * 100) },
    { label: t("recovery"), value: recoveryFactor ? recoveryFactor.toFixed(2) : "—", score: Math.min(100, (Math.max(0, recoveryFactor) / 3.2) * 100) },
    { label: t("riskCtrl"), value: `${drawdownControl.toFixed(0)}%`, score: Math.min(100, Math.max(0, drawdownControl)) },
	    { key: "consistency", label: t("consistency"), value: `${consistency.toFixed(0)}%`, score: Math.min(100, consistency) },
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
	          <Text style={styles.radarCenterLabel}>{t("radarProfile")}</Text>
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
            <Text style={styles.radarLockTitle}>{t("proRadar")}</Text>
            <Text style={styles.radarLockSub}>{t("unlockFullProfile")}</Text>
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
  // Journey order: What happened (summary) → Why (mistakes) → What to improve (actions) → Strengths
  const sections = [
    { title: t("microMistakes"), tone: C.red, items: result.mistakes.map((item) => ({ title: item.title, body: item.evidence ? `${item.explanation} ${t("microEvidence")} ${item.evidence}` : item.explanation })) },
    { title: t("microActions"), tone: C.green, items: result.recommendations.map((item) => ({ title: item.title, body: item.why ? `${item.action} ${t("microWhy")} ${item.why}` : item.action })) },
    { title: t("strengthsSection"), tone: C.purple, items: result.strengths.map((item) => ({ title: item.title, body: item.evidence ? `${item.explanation} ${t("microEvidence")} ${item.evidence}` : item.explanation })) },
  ];
  return (
    <>
      <AnimatedEntrance distance={8}>
        <GlassCard style={styles.aiAnalysisCard} intensity={42}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, minWidth: 0 }} accessible accessibilityRole="header" accessibilityLabel={`${t("aiJournalReview")}. ${result.summary}`}>
              <Text style={styles.workflowNextLabel} maxFontSizeMultiplier={1.2}>{t("aiJournalReview")}</Text>
              <TypingText text={result.summary} speedMs={9} enabled={result.summary.length <= 220} textStyle={styles.aiAnalysisSummary} numberOfLines={3} />
            </View>
            <Text style={styles.aiAnalysisSource} maxFontSizeMultiplier={1.2}>SAVED</Text>
          </View>
          <View style={styles.aiInsightGrid}>
            {sections.map((section) => (
              <View key={section.title} style={styles.aiInsightSection} accessibilityRole="summary" accessibilityLabel={section.title}>
                <View style={styles.aiInsightHeader}>
                  <View style={[styles.metricDot, { backgroundColor: section.tone }]} />
                  <Text style={[styles.aiAnalysisHeading, { color: section.tone }]} maxFontSizeMultiplier={1.2}>{section.title}</Text>
                </View>
                {section.items.slice(0, section.title === t("microActions") ? 3 : 2).map((item, index) => (
                  <View key={`${section.title}-${index}`} style={styles.aiInsightRow}>
                    <Text style={styles.aiInsightIndex}>{index + 1}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          styles.aiInsightTitle,
                          section.title === t("microActions") && { color: C.green },
                        ]}
                        numberOfLines={2}
                        maxFontSizeMultiplier={1.3}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.aiInsightBody,
                          section.title === t("microActions") && styles.aiInsightActionBody,
                        ]}
                        numberOfLines={section.title === t("microActions") ? 4 : 2}
                        maxFontSizeMultiplier={1.3}
                      >
                        {item.body}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
          <View style={styles.journeyNextRule} accessible accessibilityRole="summary" accessibilityLabel={`${t("nextTradingRule")}. ${result.nextTradingRule}`}>
            <Text style={styles.workflowNextLabel} maxFontSizeMultiplier={1.2} importantForAccessibility="no">{t("nextTradingRule")}</Text>
            <Text style={styles.journeyNextRuleText} maxFontSizeMultiplier={1.3}>{result.nextTradingRule}</Text>
          </View>
          <Text style={[styles.sub, { marginTop: 10 }]} numberOfLines={2} maxFontSizeMultiplier={1.25}>{result.disclaimer}</Text>
        </GlassCard>
      </AnimatedEntrance>
      <PatternDetectiveCard result={result} />
    </>
  );
}

function PatternDetectiveCard({ result }: { result: TradeAnalysisResult }) {
  const [openAgents, setOpenAgents] = useState<Record<string, boolean>>({});
  const agentRows: Array<{ key: keyof typeof result.agentFindings; title: string; tone: string }> = [
    { key: "riskAgent", title: t("agentRisk"), tone: C.red },
    { key: "disciplineAgent", title: t("agentDiscipline"), tone: C.yellow },
    { key: "propFirmAgent", title: t("agentPropFirm"), tone: C.green },
    { key: "sessionAgent", title: t("agentSession"), tone: C.purple },
    { key: "psychologyAgent", title: t("agentPsychology"), tone: C.yellow },
    { key: "instrumentAgent", title: t("agentInstrument"), tone: C.green },
    { key: "streakAgent", title: t("agentStreak"), tone: C.red },
    { key: "executionAgent", title: t("agentExecution"), tone: C.purple },
    { key: "consistencyAgent", title: t("agentConsistency"), tone: C.green },
  ];
  const toggleAgent = (key: string, title: string) => {
    setOpenAgents((current) => ({ ...current, [key]: !current[key] }));
    trackEvent("ai_pattern_card_opened", { agent: title });
  };
  return (
    <GlassCard style={styles.detectiveCard} intensity={42}>
      <View style={styles.detectiveHero}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.detectiveTitle}>{t("detectiveTitle")}</Text>
        </View>
        <View style={styles.detectiveScoreBox}>
          <Text style={styles.edgeMiniLabel}>Score</Text>
          <Text style={styles.detectiveScore}>{result.detectiveScore}</Text>
        </View>
      </View>

      <View
        style={styles.detectiveBlindSpot}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${t("mainBlindSpot")}. ${result.mainBlindSpot.title}. ${result.mainBlindSpot.evidence}. ${result.mainBlindSpot.whyItMatters}. ${result.mainBlindSpot.action}`}
      >
        <Text style={styles.detectiveSectionLabel} maxFontSizeMultiplier={1.2}>{t("mainBlindSpot")}</Text>
        <Text style={styles.detectiveBlindTitle} maxFontSizeMultiplier={1.3}>{result.mainBlindSpot.title}</Text>
        <Text style={styles.detectiveSectionLabel} maxFontSizeMultiplier={1.2}>{t("microWhy")}</Text>
        <Text style={styles.detectiveBody} maxFontSizeMultiplier={1.3}>{result.mainBlindSpot.whyItMatters}</Text>
        <Text style={styles.detectiveSectionLabel} maxFontSizeMultiplier={1.2}>{t("actionLabel")}</Text>
        <Text style={styles.detectiveAction} maxFontSizeMultiplier={1.3}>{result.mainBlindSpot.action}</Text>
      </View>

      <Text style={styles.detectiveSectionLabel}>{t("hiddenPatterns")}</Text>
      {result.hiddenPatterns.slice(0, 4).map((pattern, index) => {
        const impactColor = pattern.impact === "high" ? C.red : pattern.impact === "medium" ? C.yellow : C.green;
        return (
          <View key={`${pattern.title}-${index}`} style={styles.detectivePatternCard}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.detectivePatternTitle} numberOfLines={1}>{pattern.title}</Text>
                <Text style={styles.detectiveEvidence} numberOfLines={1}>{pattern.evidence}</Text>
              </View>
              <View style={[styles.detectiveImpactPill, { borderColor: impactColor }]}>
                <Text style={[styles.detectiveImpactText, { color: impactColor }]}>{pattern.impact}</Text>
              </View>
            </View>
            <Text style={styles.detectiveAction} numberOfLines={2}>{pattern.action}</Text>
          </View>
        );
      })}

      <Text style={styles.detectiveSectionLabel}>{t("agentFindings")}</Text>
      {agentRows.map((agent) => {
        const finding = result.agentFindings[agent.key];
        const isOpen = Boolean(openAgents[agent.key]);
        return (
          <Pressable
            key={agent.key}
            onPress={() => toggleAgent(agent.key, agent.title)}
            style={styles.detectiveAgentCard}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            accessibilityLabel={agent.title}
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
                <Text style={styles.detectiveSectionLabel} maxFontSizeMultiplier={1.2}>{t("microEvidence")}</Text>
                <Text style={styles.detectiveEvidence} maxFontSizeMultiplier={1.3}>{finding.evidence}</Text>
                <Text style={styles.detectiveSectionLabel} maxFontSizeMultiplier={1.2}>{t("actionLabel")}</Text>
                <Text style={styles.detectiveAction} maxFontSizeMultiplier={1.3}>{finding.action}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </GlassCard>
  );
}

function TradingScoreCard({ score }: { score: TradingScoreResult }) {
  return (
    <GlassCard style={styles.tradingScoreHeroCard} intensity={38}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.scoreLabel}>{t("tradingScore")}</Text>
          <Text style={styles.scoreHeroNumber}>{score.score}</Text>
        </View>
        <View style={styles.scoreGradePill}>
          <Text style={styles.scoreGradeText}>Grade {score.grade}</Text>
          <Text style={styles.scorePercentile}>{score.percentileLabel}</Text>
        </View>
      </View>
      <View style={styles.scoreInsightRow}>
        <View style={styles.scoreInsightBox}>
          <Text style={styles.edgeMiniLabel}>{t("strength")}</Text>
          <Text style={styles.scoreInsightText}>{score.strengths[0] || t("keepBuildingSample")}</Text>
        </View>
        <View style={styles.scoreInsightBox}>
          <Text style={styles.edgeMiniLabel}>Focus</Text>
          <Text style={styles.scoreInsightText}>{score.weaknesses[0] || t("maintainConsistency")}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

function TradingScoreMini({ score, label = t("tradingScore") }: { score: TradingScoreResult; label?: string }) {
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
          <Text style={styles.patternInsightTitle}>{locked && index > 0 ? t("proPattern") : item.title}</Text>
          <Text style={styles.patternInsightText}>{locked && index > 0 ? t("unlockProRevealPatterns") : item.detail}</Text>
        </View>
      </View>
    );
  };
  return (
    <GlassCard style={styles.patternCard} intensity={34}>
      <View style={styles.rowBetween}>
        <Text style={styles.myStatsTitle}>{t("patternPrediction")}</Text>
        {locked ? <Text style={styles.aiAnalysisSource}>PRO</Text> : <Text style={styles.aiAnalysisSource}>LIVE</Text>}
      </View>
      <Text style={styles.breakdownHint}>{t("topStrengthPatterns")}</Text>
      {result.strengths.map(renderInsight)}
      <Text style={[styles.breakdownHint, { marginTop: 12 }]}>{t("topRiskPatterns")}</Text>
      {result.risks.map(renderInsight)}
      <View style={styles.patternOpportunity}>
        <Text style={styles.edgeMiniLabel}>{t("topOpportunity")}</Text>
        <Text style={styles.scoreInsightText}>{locked ? t("unlockProSeeImprovement") : result.opportunity.detail}</Text>
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
          <Text style={styles.edgeMiniLabel}>{t("passProbability")}</Text>
          <Text style={[styles.survivalValue, { color: statusColor }]}>{result.probability}%</Text>
        </View>
        <View style={[styles.riskStatusPill, { borderColor: statusColor, backgroundColor: result.status === "DANGER" ? C.redSoft : result.status === "AT_RISK" ? C.yellowSoft : C.greenSoft }]}>
          <Text style={[styles.riskStatusText, { color: statusColor }]}>{formatCoachStatus(result.status)}</Text>
        </View>
      </View>
      <View style={styles.aiMetricExplainBox}>
        <Text style={styles.edgeMiniLabel}>{t("whatItMeans")}</Text>
        <Text style={styles.aiCompactText} numberOfLines={2}>{result.explanation}</Text>
      </View>
      <Text style={[styles.breakdownHint, { marginTop: 8 }]}>{t("confidencePrefix")} {result.confidence}</Text>
    </GlassCard>
  );
}

function RevengeTradingCard({ result }: { result: RevengeTradingResult }) {
  const color = result.detected ? C.red : C.green;
  return (
    <GlassCard style={[styles.aiCoachModuleCard, result.detected && styles.revengeAlertCard]} intensity={34}>
      <View style={styles.rowBetween}>
        <Text style={[styles.aiModuleTitle, { color }]}>
          {result.detected ? t("revengeTradingAlert") : t("revengeTradingCheck")}
        </Text>
        <View style={[styles.riskStatusPill, { borderColor: color, backgroundColor: result.detected ? C.redSoft : C.greenSoft }]}>
          <Text style={[styles.riskStatusText, { color }]}>{result.severity}</Text>
        </View>
      </View>
      <Text style={styles.aiCompactText} numberOfLines={2}>{result.reason}</Text>
      <View style={styles.patternOpportunity}>
        <Text style={styles.edgeMiniLabel}>{t("recommendation")}</Text>
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
          <Text style={styles.aiModuleTitle}>{t("hiddenLeaks")}</Text>
          <Text style={styles.breakdownHint}>{t("hiddenLeaksHint")}</Text>
        </View>
        <Text style={styles.aiAnalysisSource}>LIVE</Text>
      </View>
      {leaks.length === 0 ? (
        <Text style={styles.aiCompactText}>{t("moreTradeHistoryNeeded")}</Text>
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

function buildAchievementShareStats(trades: Trade[], selectedDate: string) {
  const stats = calcStats(trades);
  const score = tradingScoreForTrades(trades).score;
  const ordered = [...trades].sort((a, b) => getTradeTime(a).getTime() - getTradeTime(b).getTime());
  const streaks = currentTradeStreaks(ordered);
  const bestTrade = trades.length ? Math.max(0, ...trades.map((trade) => trade.pnl)) : 0;
  const greenDays = buildDailySeries(trades).filter((day) => day.value > 0).length;
  return {
    tradesLogged: stats.count,
    winRate: stats.wr,
    totalPnl: stats.pnl,
    profitFactor: stats.pf,
    avgWinLoss: stats.avgWinLoss,
    avgRR: stats.avgRR,
    avgWin: stats.avgWin,
    avgLoss: stats.avgLoss,
    expectancy: stats.exp,
    bestTrade,
    currentWinStreak: streaks.currentWinStreak,
    greenDays,
    riskControl: stats.drawdownControl,
    consistency: stats.consistency,
    maxDrawdown: stats.maxDd,
    tradingScore: score,
    bestSession: stats.session[0]?.label || "N/A",
    dateLabel: achievementShareDateLabel(selectedDate),
  };
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

function dayRangeIso(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}


async function recordAchievementShareAnalytics({
  session,
  isPremium,
  achievement,
}: {
  session: Session | null;
  isPremium: boolean;
  achievement: Achievement;
}) {
  if (!supabase || !session?.user.id) return;
  await supabase.from("achievement_share_usage").insert({
    user_id: session.user.id,
    achievement_id: achievement.id,
    achievement_title: achievement.title,
    is_pro_snapshot: isPremium,
  });
}

async function ensureShareCardExportAllowed(
  isPremium: boolean,
  userId: string | null,
  onBlocked: (message: string) => void,
) {
  const check = await peekShareCardExportAllowed(isPremium, userId);
  if (!check.allowed) {
    onBlocked(check.message || FEATURE_LIMIT_MESSAGES.shareCardMonthlyLimit);
    return false;
  }
  return true;
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
          {unlocked ? t("badgeUnlocked") : next ? t("badgeNextTarget") : t("badgeLocked")}
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
        <SafeMetricLabel style={styles.achievementShareHint}>{unlocked ? t("tapToShare") : item.metricLabel}</SafeMetricLabel>
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
  const [shareBusy, setShareBusy] = useState(false);
  const shareStats = useMemo(() => buildAchievementShareStats(trades, selectedDate), [selectedDate, trades]);
  const allUnlocked = achievements.filter((item) => item.unlocked);
  const freeUnlockLimitReached = !isPremium && allUnlocked.length > 5;
  const unlocked = isPremium ? allUnlocked : allUnlocked.slice(0, 5);
  const nextTargets = achievements.filter((item) => !item.unlocked && item.status === "next_target").slice(0, 4);
  const locked = achievements.filter((item) => !item.unlocked && item.status === "locked").slice(0, Math.max(0, 4 - nextTargets.length));
  const exportAchievementCard = async (item: Achievement, action: "share" | "save") => {
    if (!item.unlocked) return;
    const allowed = await ensureShareCardExportAllowed(isPremium, session?.user.id || null, (message) => {
      Alert.alert(t("shareCardLimitReached"), message);
    });
    if (!allowed) return;
    try {
      setShareBusy(true);
      const { shareAchievementCardFromData, saveAchievementCardFromDataToPhotos } = await import("../components/insights/shareExport");
      if (action === "share") {
        await shareAchievementCardFromData(item, shareStats);
        trackEvent("achievement_share_generated", { achievement_id: item.id, achievement_title: item.title, is_pro: isPremium });
      } else {
        await saveAchievementCardFromDataToPhotos(item, shareStats);
        Alert.alert(t("savedTitle"), t("achievementCardSaved"));
        trackEvent("achievement_card_saved", { achievement_id: item.id, achievement_title: item.title, is_pro: isPremium });
      }
      await recordShareCardExportSuccess(session?.user.id || null, isPremium);
      successHaptic();
      void recordAchievementShareAnalytics({ session, isPremium, achievement: item });
    } catch {
      Alert.alert(action === "share" ? t("achievementShareFailed") : t("achievementSaveFailed"), t("shareCardExportFailed"));
      logger.error(new Error(t("shareCardExportFailed")), { feature: "achievements", action: action === "share" ? "share" : "save", userId: session?.user.id });
    } finally {
      setShareBusy(false);
    }
  };
  const promptAchievementExport = (item: Achievement) => {
    if (!item.unlocked) return;
    Alert.alert(item.title, t("exportAchievementCard"), [
      { text: t("sharePnlCard"), onPress: () => void exportAchievementCard(item, "share") },
      { text: t("saveImage"), onPress: () => void exportAchievementCard(item, "save") },
      { text: "Cancel", style: "cancel" },
    ]);
  };
  return (
    <GlassCard style={styles.achievementCard} intensity={34}>
      <View style={styles.safeRowBetween}>
        <View style={styles.flexShrink}>
          <SafeText style={styles.myStatsTitle}>{t("traderStatus")}</SafeText>
          <SafeText style={styles.breakdownHint}>{t("traderStatusShareSub")}</SafeText>
        </View>
      </View>
      <View style={styles.traderLevelHero}>
        <View style={styles.flexShrink}>
          <SafeText style={styles.traderLevelLabel}>{t("currentTraderLevel")}</SafeText>
          <SafeText style={styles.traderLevelTitle}>{level.title}</SafeText>
          <SafeText style={styles.traderLevelPhrase} lines={2}>{level.phrase}</SafeText>
        </View>
        <View style={styles.traderLevelScoreBox}>
          <SafeMetricLabel style={styles.traderLevelScoreLabel}>Score</SafeMetricLabel>
          <SafeText style={styles.traderLevelScore}>{level.score}</SafeText>
          {level.topLabel ? (
            <SafeText style={styles.traderLevelTop}>{level.topLabel}</SafeText>
          ) : level.nextLevel ? (
            <SafeText style={styles.traderLevelTop}>{t("nextLevelPrefix")} {level.nextLevel}</SafeText>
          ) : null}
        </View>
      </View>
      {shareBusy ? <StatusSpinner accessibilityLabel="Sharing" style={{ marginVertical: 2 }} /> : null}
      {unlocked.length ? (
        <>
          <Text style={styles.achievementSectionLabel}>{t("unlockedStatusBadges")}</Text>
          <View style={styles.achievementGrid}>
            {unlocked.map((item) => <AchievementBadgeCard key={item.id} item={item} onShare={promptAchievementExport} />)}
          </View>
          {freeUnlockLimitReached ? (
            <Text style={styles.breakdownEmptyText}>
              {t("shareCardLimitNote", { free: FREE_LIMITS.shareCardsPerMonth, pro: PRO_LIMITS.shareCardsPerMonth })}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.breakdownEmptyText}>{t("keepLoggingBadges")}</Text>
      )}
      <Text style={styles.achievementSectionLabel}>{t("nextTargets")}</Text>
      <View style={styles.achievementGrid}>
        {[...nextTargets, ...locked].map((item) => <AchievementBadgeCard key={item.id} item={item} onShare={promptAchievementExport} />)}
      </View>
    </GlassCard>
  );
}

function heatmapColor(cell: HourHeatmapCell) {
  if (!cell.tradeCount) return "rgba(255,255,255,0.026)";
  if (cell.pnl < 0) return cell.pnl <= -500 ? "rgba(255,59,95,0.74)" : "rgba(255,59,95,0.40)";
  if (cell.pnl === 0) return "rgba(255,255,255,0.055)";
  if (cell.winRate < 50) return "rgba(255,59,95,0.30)";
  if (cell.pnl < 1000) return "rgba(91,176,0,0.30)";
  return "rgba(91,176,0,0.62)";
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
          <Text style={styles.myStatsTitle}>{t("sessionHeatmap")}</Text>
          <Text style={styles.breakdownHint}>{t("sessionHeatmapSub")}</Text>
        </View>
        <Text style={styles.heatmapTimeBadge}>6AM-8PM</Text>
      </View>
      <View style={styles.heatmapSummaryRow}>
        <View style={styles.heatmapSummaryBox}>
          <Text style={styles.edgeMiniLabel}>Best</Text>
          <Text style={styles.heatmapSummaryValue} numberOfLines={1}>{best ? `${best.label} ${moneyCompact(best.pnl)}` : t("needTrades")}</Text>
        </View>
        <View style={styles.heatmapSummaryBox}>
          <Text style={styles.edgeMiniLabel}>Risk</Text>
          <Text style={[styles.heatmapSummaryValue, { color: worst && worst.pnl < 0 ? C.red : C.sub }]} numberOfLines={1}>
            {worst ? `${worst.label} ${moneyCompact(worst.pnl)}` : t("needTrades")}
          </Text>
        </View>
        <View style={styles.heatmapSummaryBox}>
          <Text style={styles.edgeMiniLabel}>{t("volume")}</Text>
          <Text style={styles.heatmapSummaryValue} numberOfLines={1}>{active ? `${active.label} ${active.tradeCount}` : t("needTrades")}</Text>
        </View>
      </View>
      <View style={styles.heatmapLegend}>
        <Text style={styles.heatmapLegendItem}>{t("lossLeak")}</Text>
        <Text style={styles.heatmapLegendItem}>{t("weakWinRate")}</Text>
        <Text style={styles.heatmapLegendItem}>{t("strongEdge")}</Text>
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
  onRadarUpgrade,
  session,
  achievements,
  traderLevel,
  shareStats,
  revealSuppressToken,
  journalTradesSignature,
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
  onRadarUpgrade: () => void;
  session: Session | null;
  achievements: Achievement[];
  traderLevel: TraderLevel;
  shareStats: ReturnType<typeof buildAchievementShareStats>;
  revealSuppressToken: number;
  journalTradesSignature: string;
}) {
  const visibleTrades = trades;
  const s = useMemo(() => calcStats(visibleTrades), [visibleTrades]);
  const consistency = s.consistency;
  const recoveryFactor = s.recoveryFactor;
  const drawdownControl = s.drawdownControl;
  const radarAxes = useMemo(
    () => buildTradingRadarAxes(s, consistency, recoveryFactor, drawdownControl),
    [s, consistency, recoveryFactor, drawdownControl],
  );

  return (
    <View style={styles.terminalScreenStack}>
      {!visibleTrades.length ? (
        <EmptyStateCard
          tone="lime"
          title={t("statsEmptyTitle")}
          message={t("statsEmptyMessage")}
          icon={<ChartColumnIncreasing size={24} color={C.green} strokeWidth={2.4} />}
          style={styles.emptyStateSpacing}
        />
      ) : null}
      <StatsOverview
        stats={s}
        trades={visibleTrades}
        consistency={consistency}
        isPremium={isPremium}
      />
      <StatsFocusInsight
        axes={radarAxes}
        isPremium={isPremium}
        onUpgrade={onRadarUpgrade}
      />
      <StatsMetrics
        stats={s}
        trades={visibleTrades}
        consistency={consistency}
        isPremium={isPremium}
      />
      <StatsCharts
        trades={visibleTrades}
        stats={s}
        axes={radarAxes}
        isPremium={isPremium}
        onRadarUpgrade={onRadarUpgrade}
      />

      <TraderStatusDashboard
        achievements={achievements}
        level={traderLevel}
        trades={visibleTrades}
        selectedDate={selectedDate}
        isPremium={isPremium}
        session={session}
        shareStats={shareStats}
        revealSuppressToken={revealSuppressToken}
        journalTradesSignature={journalTradesSignature}
      />

    </View>
  );
}

function StatsScreen({
  trades,
  lang,
  isPremium,
  packages,
  storeProducts,
  purchaseBusy,
  paywallError,
  showRestorePurchases,
  onPurchase,
  onRestore,
  onLogTrade,
  onOpenReports,
}: {
  trades: Trade[];
  lang: Lang;
  propTemplates?: RiskTemplate[];
  isPremium: boolean;
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
  session?: Session | null;
  onLogTrade?: () => void;
  onOpenReports?: () => void;
}) {
  const { range, setRange } = useStatsTimeRange();
  const handleStatsRangeSelect = useCallback((next: StatsTimeRange) => {
    setRange(next);
  }, [setRange]);
  const [valueModal, setValueModal] = useState<ProValueModalContent>({
    visible: false,
    reason: "usage_limit",
    title: "YouTrader Pro",
    message: t("unlockPremiumExports"),
  });
  useEffect(() => {
    if (isPremium && valueModal.visible) {
      setValueModal((prev) => ({ ...prev, visible: false }));
    }
  }, [isPremium, valueModal.visible]);
  const periodTrades = useFilteredTrades(trades);

  return (
    <>
      <StatsDashboard
        trades={periodTrades}
        period={range}
        onPeriodChange={handleStatsRangeSelect}
        onLogTrade={onLogTrade}
        onOpenReports={onOpenReports}
        isPremium={isPremium}
      />
      <ProValueModal
        lang={lang}
        content={valueModal}
        packages={packages}
        storeProducts={storeProducts}
        purchaseBusy={purchaseBusy}
        paywallError={paywallError}
        showRestorePurchases={showRestorePurchases}
        onPurchase={onPurchase}
        onRestore={onRestore}
        onClose={() => setValueModal((prev) => ({ ...prev, visible: false }))}
      />
    </>
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
  propSnapshot: ReturnType<typeof computePropRiskSnapshot> | null;
  passProbability: PassProbabilityResult;
  revengeTrading: RevengeTradingResult;
  hiddenLeaks: HiddenLeak[];
}) {
  if (!trades.length) {
    return {
      title: t("coachMissionSampleTitle"),
      status: "SETUP",
      color: C.purple,
      softColor: C.purpleSoft,
      action: t("coachActionSampleBody"),
    };
  }

  if (!propSnapshot) {
    return {
      title: t("coachMissionPropTitle"),
      status: "SETUP",
      color: C.purple,
      softColor: C.purpleSoft,
      action: t("coachActionPropBody"),
    };
  }

  const dailyRiskRatio = propSnapshot.dailyRemaining / Math.max(1, propSnapshot.template.dailyLossLimit);
  const accountRiskRatio = propSnapshot.accountRemaining / Math.max(1, propSnapshot.template.maxLossLimit);

  if (propSnapshot.status === "STOP" || (revengeTrading.detected && revengeTrading.severity === "HIGH")) {
    return {
      title: t("coachMissionProtectAccount"),
      status: "STOP",
      color: C.red,
      softColor: C.redSoft,
      action: `${revengeTrading.detected ? revengeTrading.recommendation : t("coachActionStopToday")} ${t("coachActionNoSizePressure")}`,
    };
  }

  if (passProbability.status === "DANGER" || dailyRiskRatio <= 0.25 || accountRiskRatio <= 0.25) {
    return {
      title: t("coachMissionEvalDanger"),
      status: "DANGER",
      color: C.red,
      softColor: C.redSoft,
      action: t("coachActionEvalDangerBody"),
    };
  }

  if (propSnapshot.status === "CAUTION" || passProbability.status === "AT_RISK" || revengeTrading.detected) {
    return {
      title: t("coachMissionTradeSmaller"),
      status: "CAUTION",
      color: C.yellow,
      softColor: C.yellowSoft,
      action: revengeTrading.detected
        ? revengeTrading.recommendation
        : t("coachActionTradeSmallerFallback"),
    };
  }

  if (hiddenLeaks[0]) {
    return {
      title: t("coachMissionClearConditions"),
      status: "CLEAR",
      color: C.green,
      softColor: C.greenSoft,
      action: hiddenLeaks[0].recommendation,
    };
  }

  if (passProbability.status === "EXCELLENT") {
    return {
      title: t("coachMissionProtectPassPath"),
      status: "EXCELLENT",
      color: C.green,
      softColor: C.greenSoft,
      action: t("coachActionProtectPassBody"),
    };
  }

  return {
    title: t("coachMissionConditionsClear"),
    status: "ON TRACK",
    color: C.green,
    softColor: C.greenSoft,
    action: t("coachActionConditionsClearBody"),
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
        title: t("dailyCoachTitle"),
        body: t("dailyCoachBodyEmpty"),
        action: t("dailyCoachActionEmpty"),
      };
    }
    if (latestMistake) {
      return {
        tone: "red" as const,
        title: t("riskCoachTitle"),
        body: t("dailyCoachBodyRisk"),
        action: t("dailyCoachActionRisk"),
      };
    }
    if (selectedTrades.length >= 3 && selectedPnl < 0) {
      return {
        tone: "red" as const,
        title: t("protectTodayTitle"),
        body: t("dailyCoachBodyProtect"),
        action: t("dailyCoachActionProtect"),
      };
    }
    if (recentWins >= recentLosses && recentWins >= 4) {
      return {
        tone: "green" as const,
        title: t("edgeShowingTitle"),
        body: t("dailyCoachBodyEdge"),
        action: t("dailyCoachActionEdge"),
      };
    }
    return {
      tone: "purple" as const,
      title: t("dailyCoachTitle"),
      body: t("dailyCoachBodyDefault"),
      action: t("dailyCoachActionDefault"),
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
      <View style={styles.aiCoachResultBody}>
        {loading && !response ? <AiAnalysisLoading style={styles.aiInlineSkeleton} /> : children}
      </View>
      {response?.message ? <Text style={styles.aiFallbackMessage}>{response.message}</Text> : null}
      {response?.generatedAt ? (
        <Text style={styles.aiGeneratedAt}>Generated {new Date(response.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
      ) : null}
      <AnimatedPressable disabled={loading} onPress={onRefresh} style={styles.aiRefreshPressable} contentStyle={[styles.secondaryBig, styles.aiRefreshButton, loading && styles.disabledBtn]}>
        <Text style={styles.secondaryText}>{loading ? "Generating..." : response ? "Refresh" : "Generate"}</Text>
      </AnimatedPressable>
    </PremiumGlassCard>
  );
}

function BulletList({ items }: { items?: string[] }) {
  const visible = (items || []).slice(0, 4);
  return (
    <View style={styles.aiBulletList} accessible accessibilityRole="summary">
      {visible.map((item, index) => (
        <Text key={`${item}-${index}`} style={styles.aiBulletText} maxFontSizeMultiplier={1.3}>
          {item}
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
    { label: t("sessionMorning"), data: stats.session.find((item) => item.label === t("sessionMorning")) },
    { label: t("microLunch"), data: stats.session.find((item) => item.label === t("sessionMidday")) },
    { label: t("microPowerHour"), data: stats.session.find((item) => item.label === t("sessionAfternoon")) },
    { label: t("news"), data: stats.weekday[0] },
  ];
  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSectionTitle}>{t("signalTimeline")}</Text>
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
  const observation = weekly?.coachMessage || daily?.coachMessage || "Protect clean execution. Trade less, but with better rules.";
  const nextStep = challenge?.challengeTitle || "Reduce size after emotional trades.";
  return (
    <TerminalGlassCard>
      <View style={styles.aiCoachUnifiedRow}>
        <View style={{ flex: 1 }} accessible accessibilityRole="summary" accessibilityLabel={`${t("todaysCoaching")}. ${observation}. ${t("nextImprovement")}. ${nextStep}`}>
          <Text style={styles.terminalSectionTitle} maxFontSizeMultiplier={1.25}>{t("todaysCoaching")}</Text>
          <AiCoachProse>{observation}</AiCoachProse>
          <AiCoachSectionLabel>{t("nextImprovement")}</AiCoachSectionLabel>
          <AiCoachActionLine>{nextStep}</AiCoachActionLine>
        </View>
        <AppleRing label={t("focusLabel")} value={focusScore} display={`${focusScore}`} size={112} color={C.green} />
      </View>
      <AiCoachSectionLabel>{t("actionPlan")}</AiCoachSectionLabel>
      <BulletList items={daily?.tradeRules || weekly?.nextWeekFocus || ["Trade only best session", "Stop after rule breaks", "Journal every trade with reason"]} />
    </TerminalGlassCard>
  );
}

function buildPropCoachRecommendation({
  snapshot,
  stats,
  passProbability,
  revengeTrading,
}: {
  snapshot: ReturnType<typeof computePropRiskSnapshot> | null;
  stats: ReturnType<typeof calcStats>;
  passProbability: PassProbabilityResult;
  revengeTrading: RevengeTradingResult;
}) {
  const revengeRiskScore = revengeTrading.severity === "HIGH" ? 85 : revengeTrading.severity === "MEDIUM" ? 60 : 20;
  if (!snapshot) {
    return {
      headline: "Sync a prop firm template to unlock risk coaching.",
      action: t("microSelectFirm"),
      rules: ["Open Prop Firm Risk Assistant and choose your evaluation account.", "Firm rules load from Supabase — no hardcoded limits in the app."],
      reason: `Based on ${stats.count} trades and ${stats.wr.toFixed(0)}% win rate. Prop-specific buffer coaching activates after a template is selected.`,
    };
  }
  const danger = snapshot.status === "STOP" || snapshot.dailyRemaining <= snapshot.template.dailyLossLimit * 0.15;
  const caution = snapshot.status === "CAUTION" || passProbability.probability < 55 || stats.maxDd < 0 || revengeRiskScore >= 60;
  const headline = danger
    ? "Stop trading today and protect the account."
    : caution
      ? "Reduce size until the buffer and execution quality recover."
      : "Protect the pass path with stable size and fewer decisions.";
  const action = danger ? t("stopTradingToday") : caution ? t("reduceSize") : t("protectPassPath");
  const rules = danger
    ? ["No new trades after a daily or account buffer breach.", "Review the last losing sequence before the next session.", "Return only with fixed risk and one A+ setup." ]
    : caution
      ? ["Cut risk per trade by at least half for the next session.", "Stop after one rule break or two consecutive losses.", "Trade only your best session and skip revenge entries." ]
      : ["Keep contract size stable after green trades.", "Stop if daily buffer falls below 35%.", "Only add risk after clean journal notes and planned exits." ];
  const reason = `Based on ${stats.count} trades, ${stats.wr.toFixed(0)}% win rate, ${moneyCompact(stats.maxDd)} drawdown, ${stats.consistency.toFixed(0)}% consistency, ${snapshot.status.toLowerCase()} buffer status, and ${revengeRiskScore}% revenge-trading risk.`;
  return { headline, action, rules, reason };
}


function UnifiedAiInsightSection({
  title,
  subtitle,
  insights,
  emptyText,
}: {
  title: string;
  subtitle: string;
  insights: AiInsight[];
  emptyText: string;
}) {
  const visible = insights.slice(0, 3);
  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSectionTitle} maxFontSizeMultiplier={1.25}>{title}</Text>
      <Text style={styles.terminalSub} maxFontSizeMultiplier={1.25}>{subtitle}</Text>
      <View style={styles.aiInsightGrid}>
        {visible.length ? visible.map((insight) => {
          const tone = insight.priority === "high" ? C.red : insight.priority === "medium" ? C.purple : C.sub;
          return (
            <View
              key={insight.id}
              style={styles.aiInsightSection}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={`${insight.priority}. ${insight.title}. ${insight.summary}. ${insight.recommendation}`}
            >
              <View style={styles.aiInsightHeader}>
                <View style={[styles.metricDot, { backgroundColor: tone }]} />
                <Text style={[styles.terminalSmallLabel, { color: tone }]} maxFontSizeMultiplier={1.2}>{insight.priority.toUpperCase()}</Text>
              </View>
              <AiCoachProse numberOfLines={3}>{insight.title}</AiCoachProse>
              <TypingText text={insight.summary} speedMs={8} enabled={insight.summary.length <= 180} textStyle={styles.terminalSub} />
              {insight.evidence.slice(0, 2).map((item) => (
                <Text key={`${insight.id}-${item}`} style={styles.aiBulletText} maxFontSizeMultiplier={1.3}>{item}</Text>
              ))}
              <AiCoachActionLine numberOfLines={3}>{insight.recommendation}</AiCoachActionLine>
            </View>
          );
        }) : (
          <Text style={styles.terminalSub}>{emptyText}</Text>
        )}
      </View>
    </TerminalGlassCard>
  );
}

function WeeklyPnlMiniChart({ points }: { points: AiWeeklyReport["chartPoints"] }) {
  const width = 284;
  const height = 92;
  const data = points.length ? points : [{ label: "", value: 0, cumulative: 0 }];
  const values = data.map((point) => point.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = Math.max(1, max - min);
  const coords = data.map((point, index) => ({
    ...point,
    x: data.length === 1 ? width / 2 : (index / (data.length - 1)) * width,
    y: height - ((point.cumulative - min) / range) * height,
  }));
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const zeroY = height - ((0 - min) / range) * height;
  const positive = (coords[coords.length - 1]?.cumulative || 0) >= 0;
  return (
    <View style={{ marginTop: 14, borderRadius: 22, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.035)", padding: 12 }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
        <Path d={path || `M0 ${height / 2} L${width} ${height / 2}`} stroke={positive ? C.green : C.red} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {coords.map((point, index) => (
          <Circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="3.5" fill={point.cumulative >= 0 ? C.green : C.red} />
        ))}
      </Svg>
      <Text style={[styles.terminalSmallLabel, { marginTop: 8 }]}>{points.length > 1 ? "Weekly cumulative P&L" : "Add more trades to build the weekly curve"}</Text>
    </View>
  );
}

function AIWeeklyReportCard({ report }: { report: AiWeeklyReport }) {
  return (
    <TerminalGlassCard>
      <View style={styles.terminalHeaderRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.terminalSectionTitle}>{t("aiWeeklyReport")}</Text>
          <Text style={styles.terminalSub}>{t("aiWeeklyReportSub")}</Text>
        </View>
        <AppleRing label={report.grade} value={report.score} display={`${report.score}`} size={104} color={report.score >= 68 ? C.green : report.score >= 52 ? C.purple : C.red} />
      </View>
      <MetricPillRow
        items={[
          { label: t("microWeeklyPnl"), value: moneyCompact(report.pnl), tone: report.pnl >= 0 ? "green" : "red" },
          { label: t("winRate"), value: `${report.winRate.toFixed(0)}%`, tone: report.winRate >= 50 ? "green" : "purple" },
          { label: t("profitFactor"), value: report.profitFactor.toFixed(2), tone: report.profitFactor >= 1 ? "green" : "red" },
          { label: t("expectancy"), value: moneyCompact(report.expectancy), tone: report.expectancy >= 0 ? "green" : "red" },
          { label: t("trades"), value: String(report.tradeCount), tone: "grey" },
        ]}
      />
      <WeeklyPnlMiniChart points={report.chartPoints} />
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <View style={{ flex: 1, borderRadius: 18, borderWidth: 1, borderColor: "rgba(150,255,0,0.18)", padding: 12, backgroundColor: "rgba(150,255,0,0.045)" }}>
          <Text style={styles.terminalSmallLabel}>Best</Text>
          <Text style={styles.monthlyTimelineValue}>{report.bestDay}</Text>
          <Text style={styles.terminalSub}>{report.bestSession}</Text>
          <Text style={styles.terminalSub}>{report.bestSymbol}</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,69,105,0.22)", padding: 12, backgroundColor: "rgba(255,69,105,0.045)" }}>
          <Text style={styles.terminalSmallLabel}>Worst</Text>
          <Text style={styles.monthlyTimelineValue}>{report.worstDay}</Text>
          <Text style={styles.terminalSub}>{report.worstSession}</Text>
          <Text style={styles.terminalSub}>{report.biggestMistake}</Text>
        </View>
      </View>
      <View style={{ gap: 10, marginTop: 12 }}>
        <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(177,66,255,0.22)", padding: 12, backgroundColor: "rgba(177,66,255,0.055)" }}>
          <Text style={styles.terminalSmallLabel}>{t("bestBehavior")}</Text>
          <Text style={styles.monthlyTimelineValue}>{report.bestBehavior}</Text>
        </View>
        <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", padding: 12, backgroundColor: "rgba(255,255,255,0.035)" }}>
          <Text style={styles.terminalSmallLabel}>{t("mainRiskWarning")}</Text>
          <Text style={styles.monthlyTimelineValue}>{report.mainRiskWarning}</Text>
        </View>
      </View>
      <Text style={[styles.terminalSmallLabel, { marginTop: 14 }]}>3 Key Takeaways</Text>
      <BulletList items={report.takeaways.slice(0, 3)} />
      <View style={styles.propCoachAdviceCard}>
        <Text style={styles.propCoachHeadline}>{t("nextWeekFocus")}</Text>
        <Text style={styles.terminalSub}>{report.nextWeekFocus}</Text>
      </View>
    </TerminalGlassCard>
  );
}

function DailyMissionCard({
  mission,
  status,
  checked,
  onToggle,
  onStatusChange,
}: {
  mission: AiDailyMission;
  status: AiDailyMissionStatus;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
  onStatusChange: (status: AiDailyMissionStatus) => void;
}) {
  const completed = mission.checklist.filter((item) => checked[item.id]).length;
  const progress = mission.checklist.length ? Math.round((completed / mission.checklist.length) * 100) : 0;
  const tone = mission.riskLevel === "high" ? C.red : mission.riskLevel === "medium" ? C.purple : C.green;
  const statusLabel = status === "completed" ? "DONE" : status === "failed" ? "FAIL" : status === "skipped" ? "SKIP" : "LIVE";
  return (
    <TerminalGlassCard>
      <View style={styles.terminalHeaderRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.terminalSectionTitle}>{t("dailyMission")}</Text>
          <Text style={[styles.propCoachHeadline, { color: tone }]}>{mission.title}</Text>
          <Text style={styles.terminalSub}>{mission.reason}</Text>
        </View>
        <AppleRing label={statusLabel} value={status === "completed" ? 100 : progress} display={`${status === "completed" ? 100 : progress}%`} size={104} color={status === "failed" ? C.red : status === "skipped" ? C.sub : tone} />
      </View>
      <View style={{ gap: 10, marginTop: 14 }}>
        {mission.checklist.map((item) => {
          const active = !!checked[item.id];
          return (
            <Pressable key={item.id} onPress={() => onToggle(item.id)} style={{ flexDirection: "row", gap: 10, alignItems: "center", borderWidth: 1, borderColor: active ? "rgba(150,255,0,0.34)" : "rgba(255,255,255,0.10)", backgroundColor: active ? "rgba(150,255,0,0.07)" : "rgba(255,255,255,0.035)", borderRadius: 16, padding: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: active ? C.green : C.sub, alignItems: "center", justifyContent: "center" }}>
                {active ? <Check size={14} color={C.green} strokeWidth={UI_ICON_STROKE} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.monthlyTimelineValue}>{item.text}</Text>
                <Text style={styles.terminalSmallLabel}>Related: {item.sourceMetric.replace("_", " ")}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={() => Alert.alert(t("relatedStats"), mission.relatedStats.join("\n"))} style={{ marginTop: 12, borderRadius: 999, borderWidth: 1, borderColor: "rgba(177,66,255,0.28)", paddingHorizontal: 14, paddingVertical: 10, alignSelf: "flex-start" }}>
        <Text style={[styles.terminalSmallLabel, { color: C.purple }]}>{t("viewRelatedStats")}</Text>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        {(["completed", "failed", "skipped"] as AiDailyMissionStatus[]).map((item) => (
          <Pressable key={item} onPress={() => onStatusChange(item)} style={{ flex: 1, borderRadius: 999, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: status === item ? tone : "rgba(255,255,255,0.12)", backgroundColor: status === item ? "rgba(177,66,255,0.12)" : "rgba(255,255,255,0.035)" }}>
            <Text style={[styles.terminalSmallLabel, { color: status === item ? tone : C.sub }]}>{item.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
    </TerminalGlassCard>
  );
}

function MiniPerformanceChart({ values }: { values: number[] }) {
  const width = 260;
  const height = 72;
  const data = values.length ? values : [0];
  const min = Math.min(0, ...data);
  const max = Math.max(0, ...data);
  const range = Math.max(1, max - min);
  const coords = data.map((value, index) => ({
    x: data.length === 1 ? width / 2 : (index / (data.length - 1)) * width,
    y: height - ((value - min) / range) * height,
    value,
  }));
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const positive = data[data.length - 1] >= data[0];
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <Path d={path || `M0 ${height / 2} L${width} ${height / 2}`} stroke={positive ? C.green : C.red} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function RiskMeter({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const color = danger ? C.red : clamped >= 70 ? C.green : clamped >= 45 ? C.purple : C.red;
  return (
    <View style={{ gap: 7 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text style={styles.terminalSmallLabel}>{label}</Text>
        <Text style={[styles.terminalSmallLabel, { color }]}>{clamped}%</Text>
      </View>
      <PremiumLoadingBar progress={clamped / 100} height={8} tone={danger ? "red" : clamped >= 70 ? "lime" : "purple"} />
    </View>
  );
}

function EvidenceChart({ label, values }: { label: string; values: { name: string; value: number; tone?: "green" | "red" | "purple" }[] }) {
  const max = Math.max(1, ...values.map((item) => Math.abs(item.value)));
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.terminalSmallLabel}>{label}</Text>
      {values.map((item) => {
        const color = item.tone === "red" ? C.red : item.tone === "purple" ? C.purple : item.value >= 0 ? C.green : C.red;
        return (
          <View key={item.name} style={{ gap: 5 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <Text style={styles.terminalSub}>{item.name}</Text>
              <Text style={[styles.terminalSub, { color }]}>{Number.isInteger(item.value) ? item.value : item.value.toFixed(1)}</Text>
            </View>
            <PremiumLoadingBar
              progress={Math.max(0.06, Math.min(1, Math.abs(item.value) / max))}
              height={7}
              tone={item.tone === "red" ? "red" : item.tone === "purple" ? "purple" : "lime"}
            />
          </View>
        );
      })}
    </View>
  );
}


function RuleImpactCard({ title, rule, evidence }: { title: string; rule: string; evidence: string }) {
  return (
    <View
      style={styles.aiMetricExplainBox}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${rule}. ${evidence}`}
    >
      <AiCoachSectionLabel>{title}</AiCoachSectionLabel>
      <AiCoachActionLine numberOfLines={4}>{rule}</AiCoachActionLine>
      <Text style={styles.terminalSub} maxFontSizeMultiplier={1.25}>{evidence}</Text>
    </View>
  );
}

function AIInsightCard({ insight }: { insight: AiInsight }) {
  return (
    <View style={styles.aiInsightSection} accessible accessibilityRole="summary" accessibilityLabel={`${insight.category}. ${insight.title}. ${insight.recommendation}`}>
      <AiCoachSectionLabel>{insight.category.toUpperCase()} · {insight.priority.toUpperCase()}</AiCoachSectionLabel>
      <AiCoachProse numberOfLines={3}>{insight.title}</AiCoachProse>
      <EvidenceChart label="Evidence" values={insight.evidence.slice(0, 3).map((item, index) => ({ name: item, value: 3 - index, tone: insight.priority === "high" ? "red" : "purple" }))} />
      <RuleImpactCard title={t("microRecommendation")} rule={insight.recommendation} evidence={insight.sourceMetrics.join(" · ")} />
    </View>
  );
}

function aiOsConfidenceLabel(confidence: AiOperatingSystem["confidence"]) {
  return confidence === "empty" ? "NO DATA" : confidence === "low" ? "LOW" : confidence === "medium" ? "MEDIUM" : "HIGH";
}

function aiOsStateIsLow(state: "empty" | "low_confidence" | "ready") {
  return state === "empty" || state === "low_confidence";
}

function AiOperatingSystemTodaySection({ operatingSystem }: { operatingSystem: AiOperatingSystem }) {
  const today = operatingSystem.today;
  const lowConfidence = aiOsStateIsLow(today.state);
  const score = today.tradingScore ?? 0;
  const tone = lowConfidence ? C.purple : score >= 70 ? C.green : score >= 50 ? C.purple : C.red;
  const ctaLabel = today.primaryCta === "mark_today_complete" ? "Mark Today Complete" : today.primaryCta === "start_trading_day" ? "Start Trading Day" : "Log More Trades";
  return (
    <TerminalGlassCard>
      <View style={styles.terminalHeaderRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.terminalSmallLabel}>TODAY</Text>
          <Text style={styles.terminalSectionTitle}>What should I do today?</Text>
          <Text style={styles.terminalSub}>
            {lowConfidence
              ? today.emptyState?.message || "YouTrader needs more journal evidence before it can give a strong plan."
              : today.recommendation?.action || today.mission?.reason || "Follow the mission built from your current journal sample."}
          </Text>
        </View>
        <AppleRing
          label={lowConfidence ? "DATA" : "FOCUS"}
          value={lowConfidence ? Math.max(8, operatingSystem.sample.tradeCount * 12) : score}
          display={lowConfidence ? aiOsConfidenceLabel(today.confidence) : `${score}`}
          size={112}
          color={tone}
        />
      </View>
      <MetricPillRow
        items={[
          { label: "Best Session", value: today.bestSession || "Need data", tone: today.bestSession ? "green" : "grey" },
          { label: "Max Trades", value: today.maxTrades != null ? String(today.maxTrades) : "Need data", tone: today.maxTrades != null ? "purple" : "grey" },
          { label: "Daily Loss", value: today.dailyLossLimit != null ? moneyCompact(-Math.abs(today.dailyLossLimit)) : "Not set", tone: today.dailyLossLimit != null ? "red" : "grey" },
          { label: "Confidence", value: aiOsConfidenceLabel(today.confidence), tone: lowConfidence ? "purple" : "green" },
          { label: "Sample", value: `${operatingSystem.sample.tradeCount}T / ${operatingSystem.sample.tradingDays}D`, tone: operatingSystem.sample.tradeCount >= 5 ? "green" : "grey" },
        ]}
      />
      {lowConfidence ? (
        <WarningCard
          title={today.emptyState?.title || "Low-confidence Trading Review sample"}
          body={today.emptyState?.message || "Add more saved trades across multiple trading days to unlock a reliable daily plan."}
        />
      ) : today.mission ? (
        <View style={styles.propCoachAdviceCard}>
          <Text style={styles.terminalSmallLabel}>TODAY'S MISSION</Text>
          <Text style={styles.propCoachHeadline}>{today.mission.title}</Text>
          <BulletList items={today.mission.checklist.map((item) => item.text).slice(0, 3)} />
        </View>
      ) : null}
      {today.evidence.length ? (
        <View style={{ gap: 6, marginTop: 12 }}>
          <Text style={styles.terminalSmallLabel}>Evidence</Text>
          {today.evidence.slice(0, 3).map((item) => (
            <Text key={`today-${item}`} style={styles.aiBulletText}>• {item}</Text>
          ))}
        </View>
      ) : null}
      <Pressable disabled style={[styles.primaryBig, styles.workflowPrimaryInStack, { opacity: lowConfidence ? 0.65 : 1 }]}>
        <Text style={styles.primaryText} maxFontSizeMultiplier={1.25}>{ctaLabel}</Text>
      </Pressable>
    </TerminalGlassCard>
  );
}

function AiCoachOperatingSystemPoint({
  label,
  item,
}: {
  label: string;
  item: AiOperatingSystem["coach"]["biggestEdge"];
}) {
  if (!item) return null;
  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(177,66,255,0.22)", backgroundColor: "rgba(177,66,255,0.055)", padding: 13, gap: 8 }}>
      <Text style={styles.terminalSmallLabel}>{label} · {aiOsConfidenceLabel(item.confidence)}</Text>
      <Text style={styles.propCoachHeadline}>{item.title}</Text>
      <Text style={styles.terminalSub}>{item.action}</Text>
      <View style={{ gap: 5 }}>
        {item.evidence.slice(0, 3).map((evidence) => (
          <Text key={`${label}-${evidence}`} style={styles.aiBulletText}>• {evidence}</Text>
        ))}
      </View>
    </View>
  );
}

function AiOperatingSystemCoachSection({ operatingSystem }: { operatingSystem: AiOperatingSystem }) {
  const coach = operatingSystem.coach;
  const lowConfidence = aiOsStateIsLow(coach.state);
  const seenActions = new Set<string>();
  const points = [
    { label: "Biggest Edge", item: coach.biggestEdge },
    { label: "Biggest Mistake", item: coach.biggestMistake },
    { label: "Next Improvement", item: coach.nextImprovement },
  ].filter(({ item }) => {
    if (!item) return false;
    const key = item.action.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seenActions.has(key)) return false;
    seenActions.add(key);
    return true;
  });
  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSmallLabel}>SESSION REVIEW</Text>
      <Text style={styles.terminalSectionTitle}>What should I improve on the next trade?</Text>
      <Text style={styles.terminalSub}>
        {lowConfidence
          ? coach.emptyState?.message || "The next-trade coach is waiting for a larger saved trade sample."
          : "One edge, one mistake, one improvement. Each point is tied to journal evidence."}
      </Text>
      {lowConfidence ? (
        <WarningCard
          title={coach.emptyState?.title || "Low-confidence coach"}
          body={coach.emptyState?.message || "Log at least 5 trades across 2 trading days before relying on next-trade coaching."}
        />
      ) : (
        <View style={{ gap: 10, marginTop: 14 }}>
          {points.length ? (
            points.map(({ label, item }) => <AiCoachOperatingSystemPoint key={label} label={label} item={item} />)
          ) : (
            <Text style={styles.terminalSub}>No strong next-trade recommendation yet. Keep journaling with setup, mood, and notes.</Text>
          )}
        </View>
      )}
      {!lowConfidence && coach.evidence.length ? (
        <View style={{ gap: 6, marginTop: 12 }}>
          <Text style={styles.terminalSmallLabel}>Coach Evidence</Text>
          {coach.evidence.slice(0, 4).map((item) => (
            <Text key={`coach-${item}`} style={styles.aiBulletText}>• {item}</Text>
          ))}
        </View>
      ) : null}
    </TerminalGlassCard>
  );
}

type CoachConversationState =
  | "idle"
  | "why"
  | "fix"
  | "rule_preview"
  | "mistake_review"
  | "plan"
  | "prop_intro"
  | "prop_simulator"
  | "prop_emergency"
  | "trade_vision_intro"
  | "session_started"
  | "session_complete";

function coachStatusFromSignals({
  operatingSystem,
  revengeTrading,
  snapshot,
  passProbability,
  stats,
}: {
  operatingSystem: AiOperatingSystem;
  revengeTrading: RevengeTradingResult;
  snapshot: ReturnType<typeof computePropRiskSnapshot> | null;
  passProbability: PassProbabilityResult;
  stats: ReturnType<typeof calcStats>;
}): { label: "Ready" | "Caution" | "Emergency" | "Low confidence"; tone: "green" | "purple" | "red" | "grey"; reason: string } {
  const lowConfidence = operatingSystem.confidence === "empty" || operatingSystem.confidence === "low";
  const propEmergency = snapshot?.status === "STOP" || (snapshot ? snapshot.dailyRemaining <= 0 || snapshot.accountRemaining <= 0 : false);
  const propCaution = snapshot?.status === "CAUTION" || passProbability.status === "DANGER" || passProbability.status === "AT_RISK";
  const revengeEmergency = revengeTrading.detected && revengeTrading.severity === "HIGH";
  const drawdownCaution = stats.maxDd < 0 && Math.abs(stats.maxDd) > Math.max(1, Math.abs(stats.avgWin || stats.avgLoss || 0));
  if (propEmergency || revengeEmergency) {
    return { label: "Emergency", tone: "red", reason: propEmergency ? "Prop drawdown protection is triggered." : revengeTrading.reason };
  }
  if (lowConfidence) {
    return { label: "Low confidence", tone: "grey", reason: "More saved trades are needed before strong coaching." };
  }
  if (propCaution || revengeTrading.detected || drawdownCaution) {
    return { label: "Caution", tone: "purple", reason: propCaution ? "Prop account risk needs protection." : revengeTrading.detected ? revengeTrading.reason : "Drawdown pressure is elevated." };
  }
  return { label: "Ready", tone: "green", reason: "Journal evidence supports controlled execution." };
}

function AiCoachConsole({
  operatingSystem,
  trades,
  stats,
  patterns,
  revengeTrading,
  snapshot,
  passProbability,
  userId,
}: {
  operatingSystem: AiOperatingSystem;
  trades: Trade[];
  stats: ReturnType<typeof calcStats>;
  patterns: PatternDetectionResult;
  revengeTrading: RevengeTradingResult;
  snapshot: ReturnType<typeof computePropRiskSnapshot> | null;
  passProbability: PassProbabilityResult;
  userId: string | null;
}) {
  const [coachState, setCoachState] = useState<CoachConversationState>("idle");
  const [riskMathOpen, setRiskMathOpen] = useState(false);
  const [coachThinking, setCoachThinking] = useState(false);
  const panelAnim = useRef(new Animated.Value(1)).current;
  const panelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lowConfidence = operatingSystem.confidence === "empty" || operatingSystem.confidence === "low";
  const nextImprovement = operatingSystem.coach.nextImprovement;
  const biggestMistake = operatingSystem.coach.biggestMistake;
  const today = operatingSystem.today;
  const recentLosingTrades = trades.filter((trade) => trade.pnl < 0).slice(-3).reverse();
  const highRiskPatterns = patterns.risks.slice(0, 3);
  const priority =
    today.recommendation?.action ||
    today.mission?.title ||
    nextImprovement?.action ||
    "Log more trades to unlock a sharper daily priority.";
  const biggestRisk =
    revengeTrading.detected
      ? revengeTrading.reason
      : biggestMistake?.action || highRiskPatterns[0]?.detail || "No high-confidence risk pattern yet.";
  const bestAction =
    nextImprovement?.action ||
    today.mission?.reason ||
    (today.bestSession ? `Trade only your strongest session: ${today.bestSession}.` : "Build a cleaner sample before taking aggressive decisions.");
  const coachSentence = lowConfidence
    ? `I need a few more trades before strong coaching. Current sample: ${stats.count} trades.`
    : "I found the one thing that matters today.";
  const status = coachStatusFromSignals({ operatingSystem, revengeTrading, snapshot, passProbability, stats });
  const actionButtons: { key: CoachConversationState; label: string }[] = [
    { key: "why", label: "Why?" },
    { key: "fix", label: "Fix this" },
    { key: "prop_intro", label: "Prop risk" },
    { key: "plan", label: "Local plan" },
    { key: "mistake_review", label: "Review" },
  ];
  useEffect(() => {
    return () => {
      if (panelTimerRef.current) clearTimeout(panelTimerRef.current);
    };
  }, []);
  const showPanel = (key: CoachConversationState) => {
    lightHaptic();
    if (panelTimerRef.current) clearTimeout(panelTimerRef.current);
    const shouldClose = coachState === key && key !== "session_started" && key !== "session_complete";
    if (shouldClose) {
      setCoachThinking(false);
      setCoachState("idle");
      panelAnim.setValue(1);
      return;
    }
    setCoachThinking(true);
    setCoachState("idle");
    panelAnim.setValue(0);
    panelTimerRef.current = setTimeout(() => {
      setCoachState(key);
      setCoachThinking(false);
      Animated.timing(panelAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 240);
    if (key !== "prop_simulator") setRiskMathOpen(false);
  };
  const panelAnimatedStyle = {
    opacity: panelAnim,
    transform: [{ translateY: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };
  const primaryCtaState: CoachConversationState = coachState === "session_started" ? "session_complete" : "session_started";
  const primaryCtaLabel = coachState === "session_started" ? "Mark session complete" : coachState === "session_complete" ? "Session complete" : "Start trading session";
  const statusLine =
    status.label === "Ready"
      ? "Coach is ready"
      : status.label === "Low confidence"
        ? "Coach is building confidence"
        : "Coach is watching risk";
  const evidenceItems = aiOsUniqueList([
    ...today.evidence,
    ...operatingSystem.coach.evidence,
    ...operatingSystem.evidence.sessionImpact,
    ...operatingSystem.evidence.behaviorPatterns,
  ], 5);
  const fixSteps = aiOsUniqueList([
    nextImprovement?.action || "",
    nextImprovement?.evidence[0] ? `Base the next trade on this evidence: ${nextImprovement.evidence[0]}` : "",
    today.maxTrades != null ? `Cap the session at ${today.maxTrades} trades.` : "",
    today.bestSession ? `Prefer ${today.bestSession}; skip weaker windows.` : "",
  ], 3);
  const ruleText =
    today.maxTrades != null
      ? `Today: maximum ${today.maxTrades} trades. Stop after one rule break.`
      : nextImprovement?.action || "Today: no trade without a written setup and invalidation.";
  const planItems = aiOsUniqueList([
    today.mission?.title || "",
    today.mission?.reason || "",
    ...(today.mission?.checklist.map((item) => item.text) || []),
    today.dailyLossLimit != null ? `Daily loss limit: ${moneyCompact(-Math.abs(today.dailyLossLimit))}` : "",
  ], 5);
  const propDailyBuffer = snapshot ? moneyCompact(snapshot.dailyRemaining) : "Needs setup";
  const propAccountBuffer = snapshot ? moneyCompact(snapshot.accountRemaining) : "Needs setup";
  const propMaxSafeLoss = snapshot ? moneyCompact(Math.floor(Math.max(0, Math.min(snapshot.dailyRemaining, snapshot.accountRemaining) * 0.35))) : "Needs setup";
  const propStatus = snapshot?.status || "SETUP";
  const propAction =
    !snapshot
      ? "Select a synced prop template before relying on account protection."
      : status.label === "Emergency"
        ? "Protect the account now. Stop trading until the risk is reviewed."
        : status.label === "Caution"
          ? "Reduce size and keep only checklist-perfect setups."
          : "Trade within today's limits and protect green progress.";
  const propEvidence = aiOsUniqueList([
    snapshot ? `Daily buffer: ${moneyCompact(snapshot.dailyRemaining)}` : "",
    snapshot ? `Account buffer: ${moneyCompact(snapshot.accountRemaining)}` : "",
    `Pass probability: ${passProbability.probability}% (${passProbability.confidence} confidence)`,
    revengeTrading.detected ? revengeTrading.reason : "",
    `Filtered sample: ${trades.length} trades`,
  ], 5);

  return (
    <TerminalGlassCard style={styles.coachConversationCard}>
      <View style={styles.coachConsoleHero}>
        <View style={[styles.tradeVisionIconOrbSmall, styles.coachConversationOrb, status.tone === "red" ? styles.coachConversationOrbRed : status.tone === "purple" ? styles.coachConversationOrbPurple : status.tone === "grey" ? styles.coachConversationOrbGrey : null]}>
          <BrainCircuit size={17} color={status.tone === "red" ? C.red : status.tone === "purple" ? C.purple : status.tone === "grey" ? C.sub : C.green} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.coachConversationHeaderRow}>
            <Text style={styles.terminalSmallLabel}>YOUTRADER COACH</Text>
            <Text style={[styles.coachConversationStatus, status.tone === "red" ? styles.coachConversationStatusRed : status.tone === "purple" ? styles.coachConversationStatusPurple : status.tone === "grey" ? styles.coachConversationStatusGrey : null]}>
              {status.label}
            </Text>
          </View>
          <Text style={styles.coachCompactHeadline}>{truncateCoachLine(coachSentence, 64)}</Text>
          <Text style={styles.coachCompactSub}>{truncateCoachLine(status.reason, 80)}</Text>
        </View>
      </View>
      <View style={styles.coachFocusGrid}>
        <CoachFocusRow label="Today's priority" value={priority} tone="action" />
        <CoachFocusRow label="Biggest risk" value={biggestRisk} tone="risk" />
        <CoachFocusRow label="Best action now" value={bestAction} tone="action" />
      </View>
      {lowConfidence ? (
        <Text style={styles.coachCompactHint}>Low confidence · {operatingSystem.sample.tradeCount} trades · {operatingSystem.sample.tradingDays} days</Text>
      ) : null}
      <Pressable
        disabled={coachThinking || coachState === "session_complete"}
        onPress={() => showPanel(primaryCtaState)}
        style={[styles.coachPrimaryCta, coachState === "session_started" && styles.coachPrimaryCtaActive, (coachThinking || coachState === "session_complete") && styles.disabledBtn]}
      >
        <Zap size={14} color={coachState === "session_complete" ? C.sub : C.green} strokeWidth={2.5} />
        <Text style={[styles.coachPrimaryCtaText, coachState === "session_complete" && styles.coachPrimaryCtaTextDone]}>{primaryCtaLabel}</Text>
      </Pressable>
      <View style={styles.coachConsoleActionRow}>
        {actionButtons.map((action) => {
          const active = coachState === action.key;
          return (
            <Pressable key={`${action.key}-${action.label}`} onPress={() => showPanel(action.key)} style={[styles.coachConsoleActionChip, active && styles.coachConsoleActionChipActive]}>
              <Text style={[styles.coachConsoleActionText, active && styles.coachConsoleActionTextActive]}>{action.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {coachThinking ? (
        <View style={styles.coachThinkingRow}>
          <StatusSpinner size="sm" accessibilityLabel="Coach is thinking" style={{ marginVertical: 0 }} />
          <Text style={styles.coachThinkingText}>Coach is thinking...</Text>
        </View>
      ) : null}
      {coachState === "session_started" || coachState === "session_complete" ? (
        <Animated.View style={[styles.coachConsoleReveal, panelAnimatedStyle]}>
          <Text style={styles.terminalSmallLabel}>{coachState === "session_complete" ? "Session complete" : "Session started"}</Text>
          <Text style={styles.propCoachHeadline}>{coachState === "session_complete" ? "Review the session before taking another trade." : "Trade the plan. One decision at a time."}</Text>
          <View style={styles.coachConsoleActionRow}>
            {coachState === "session_started" ? (
              <Pressable onPress={() => showPanel("session_complete")} style={[styles.coachConsoleActionChip, styles.coachConsoleActionChipActive]}>
                <Text style={[styles.coachConsoleActionText, styles.coachConsoleActionTextActive]}>Mark session complete</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => showPanel("plan")} style={styles.coachConsoleActionChip}>
              <Text style={styles.coachConsoleActionText}>Generate plan</Text>
            </Pressable>
            <Pressable onPress={() => showPanel("mistake_review")} style={styles.coachConsoleActionChip}>
              <Text style={styles.coachConsoleActionText}>Review mistakes</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      {coachState === "why" ? (
        <Animated.View style={[styles.coachConsoleReveal, panelAnimatedStyle]}>
          <Text style={styles.terminalSmallLabel}>Why this matters</Text>
          {evidenceItems.length ? evidenceItems.map((item) => <Text key={`why-${item}`} style={styles.aiBulletText}>• {item}</Text>) : (
            <Text style={styles.terminalSub}>Not enough evidence yet. Log more trades with notes, setups, and screenshots.</Text>
          )}
          <Pressable onPress={() => showPanel("mistake_review")} style={styles.coachInlineAction}>
            <Text style={styles.coachConsoleActionText}>Review last mistakes</Text>
          </Pressable>
        </Animated.View>
      ) : null}
      {coachState === "fix" ? (
        <Animated.View style={[styles.coachConsoleReveal, panelAnimatedStyle]}>
          <Text style={styles.terminalSmallLabel}>Fix this next</Text>
          {fixSteps.length ? fixSteps.map((item) => <Text key={`fix-${item}`} style={styles.aiBulletText}>• {item}</Text>) : (
            <Text style={styles.terminalSub}>Keep the next trade simple: predefined setup, predefined invalidation, fixed risk.</Text>
          )}
          <View style={styles.coachConsoleActionRow}>
            <Pressable onPress={() => showPanel("rule_preview")} style={styles.coachConsoleActionChip}>
              <Text style={styles.coachConsoleActionText}>Create rule</Text>
            </Pressable>
            <Pressable onPress={() => showPanel("plan")} style={styles.coachConsoleActionChip}>
              <Text style={styles.coachConsoleActionText}>Generate plan</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      {coachState === "rule_preview" ? (
        <Animated.View style={[styles.coachConsoleRulePreview, panelAnimatedStyle]}>
          <Text style={styles.terminalSmallLabel}>Rule Preview</Text>
          <Text style={styles.propCoachHeadline}>{ruleText}</Text>
          <Text style={styles.terminalSub}>Visual preview only. This rule is not saved yet.</Text>
        </Animated.View>
      ) : null}
      {coachState === "mistake_review" ? (
        <Animated.View style={[styles.coachConsoleReveal, panelAnimatedStyle]}>
          <Text style={styles.terminalSmallLabel}>Review mistakes</Text>
          {recentLosingTrades.length ? recentLosingTrades.map((trade) => (
            <View key={trade.id} style={styles.coachConsoleTradeRow}>
              <Text style={styles.terminalSub}>{trade.date} · {trade.symbol} · {trade.direction}</Text>
              <Text style={[styles.metricPillValue, { color: C.red }]}>{moneyCompact(trade.pnl)}</Text>
            </View>
          )) : highRiskPatterns.length ? highRiskPatterns.map((item) => (
            <Text key={`risk-${item.title}`} style={styles.aiBulletText}>• {item.title}: {item.detail}</Text>
          )) : (
            <Text style={styles.terminalSub}>No recent losing trades or high-risk patterns in this filtered sample.</Text>
          )}
        </Animated.View>
      ) : null}
      {coachState === "plan" ? (
        <Animated.View style={[styles.coachConsoleReveal, panelAnimatedStyle]}>
          <Text style={styles.terminalSmallLabel}>Today's local plan</Text>
          {planItems.length ? planItems.map((item) => <Text key={`plan-${item}`} style={styles.aiBulletText}>• {item}</Text>) : (
            <Text style={styles.terminalSub}>Plan is low-confidence. Log more trades before relying on a detailed daily plan.</Text>
          )}
        </Animated.View>
      ) : null}
      {coachState === "prop_intro" || coachState === "prop_simulator" || coachState === "prop_emergency" ? (
        <Animated.View style={[styles.coachConsoleReveal, panelAnimatedStyle]}>
          <Text style={styles.terminalSmallLabel}>Prop risk mentor</Text>
          <Text style={styles.coachCompactValue}>{truncateCoachLine(propAction, 96)}</Text>
          <MetricPillRow
            items={[
              { label: "Status", value: propStatus, tone: propStatus === "STOP" ? "red" : propStatus === "CAUTION" ? "purple" : snapshot ? "green" : "grey" },
              { label: "Daily Buffer", value: propDailyBuffer, tone: snapshot && snapshot.dailyRemaining > 0 ? "green" : "red" },
              { label: "Max Safe Loss", value: propMaxSafeLoss, tone: snapshot ? "purple" : "grey" },
            ]}
          />
          <View style={styles.coachConsoleActionRow}>
            <Pressable onPress={() => showPanel("prop_emergency")} style={[styles.coachConsoleActionChip, coachState === "prop_emergency" && styles.coachConsoleActionChipActive]}>
              <Text style={[styles.coachConsoleActionText, coachState === "prop_emergency" && styles.coachConsoleActionTextActive]}>Emergency mode</Text>
            </Pressable>
            <Pressable onPress={() => showPanel("prop_simulator")} style={[styles.coachConsoleActionChip, coachState === "prop_simulator" && styles.coachConsoleActionChipActive]}>
              <Text style={[styles.coachConsoleActionText, coachState === "prop_simulator" && styles.coachConsoleActionTextActive]}>Run what-if</Text>
            </Pressable>
            <Pressable onPress={() => setRiskMathOpen((prev) => !prev)} style={styles.coachConsoleActionChip}>
              <Text style={styles.coachConsoleActionText}>{riskMathOpen ? "Hide evidence" : "Show evidence"}</Text>
            </Pressable>
          </View>
          {coachState === "prop_emergency" ? (
            <View style={styles.coachConsoleRulePreview}>
              <Text style={styles.coachCompactValue}>{snapshot ? "Stop after one rule break. Reduce size before the next trade." : "Connect a prop template in Prop Coach below."}</Text>
            </View>
          ) : null}
          {riskMathOpen ? (
            <View style={styles.coachConsoleReveal}>
              {propEvidence.slice(0, 3).map((item) => <Text key={`prop-math-${item}`} style={styles.aiBulletText}>• {item}</Text>)}
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </TerminalGlassCard>
  );
}



function AiOperatingSystemTradingDnaSection({ operatingSystem }: { operatingSystem: AiOperatingSystem }) {
  const dna = operatingSystem.tradingDna;
  const profile = dna.profile;
  const lowConfidence = aiOsStateIsLow(dna.state) || !profile || !profile.enoughData;
  return (
    <TerminalGlassCard>
      <View style={styles.terminalHeaderRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.terminalSmallLabel}>TRADING DNA</Text>
          <Text style={styles.terminalSectionTitle}>What type of trader am I?</Text>
          <Text style={styles.terminalSub}>
            {lowConfidence
              ? dna.emptyState?.message || "Not enough journal history yet. Trading DNA needs a larger sample before classifying your style."
              : profile.summary}
          </Text>
        </View>
        <AppleRing
          label="DNA"
          value={lowConfidence ? Math.max(8, operatingSystem.sample.tradeCount * 10) : profile?.metrics.consistency || 0}
          display={aiOsConfidenceLabel(operatingSystem.confidence)}
          size={104}
          color={lowConfidence ? C.purple : C.green}
        />
      </View>
      <MetricPillRow
        items={[
          { label: "Trader Type", value: profile?.traderType || "Building", tone: lowConfidence ? "grey" : "green" },
          { label: "Sample", value: `${operatingSystem.sample.tradeCount}T / ${operatingSystem.sample.tradingDays}D`, tone: operatingSystem.sample.tradeCount >= 10 ? "green" : "grey" },
          { label: "Best Symbol", value: profile?.metrics.bestSymbol || "Need data", tone: profile?.metrics.bestSymbol && profile.metrics.bestSymbol !== "Need data" ? "green" : "grey" },
          { label: "Best Session", value: profile?.metrics.bestSession || "Need data", tone: profile?.metrics.bestSession && profile.metrics.bestSession !== "Need data" ? "purple" : "grey" },
          { label: "Confidence", value: aiOsConfidenceLabel(operatingSystem.confidence), tone: lowConfidence ? "purple" : "green" },
        ]}
      />
      {lowConfidence ? (
        <WarningCard
          title="Not enough journal history yet"
          body={dna.emptyState?.message || "Log at least 10 trades with symbols, sessions, setup tags, and notes before using Trading DNA as a decision guide."}
        />
      ) : profile ? (
        <View style={{ gap: 10, marginTop: 14 }}>
          <RuleImpactCard title="Risk Profile" rule={profile.metrics.drawdownBehavior} evidence={`Recovery: ${profile.metrics.recoveryAfterLosses} · Emotional behavior: ${profile.metrics.emotionalBehavior}`} />
          <AiOsTextBlock title="Ideal Conditions" items={profile.bestConditions} />
          <AiOsTextBlock title="Worst Conditions" items={profile.dangerZones} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AiOsTextBlock title="Strengths" items={profile.strengths} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AiOsTextBlock title="Weaknesses" items={profile.weaknesses} />
            </View>
          </View>
        </View>
      ) : null}
    </TerminalGlassCard>
  );
}

function AiOperatingSystemEvidenceSection({ operatingSystem }: { operatingSystem: AiOperatingSystem }) {
  const evidence = operatingSystem.evidence;
  const lowConfidence = aiOsStateIsLow(evidence.state);
  const metrics = aiOsUniqueList(
    evidence.metrics.filter((metric) => !["trade_count", "net_pnl", "win_rate"].includes(metric)),
    8,
  );
  const sections = [
    { title: "Session Impact", items: evidence.sessionImpact },
    { title: "Weekday Impact", items: evidence.weekdayImpact },
    { title: "Instrument Impact", items: evidence.instrumentImpact },
    { title: "Setup Impact", items: evidence.setupImpact },
    { title: "Behavior Patterns", items: evidence.behaviorPatterns },
  ].filter((section) => aiOsUniqueList(section.items, 3).length > 0);
  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSmallLabel}>EVIDENCE</Text>
      <Text style={styles.terminalSectionTitle}>Why does this say this?</Text>
      <Text style={styles.terminalSub}>
        {lowConfidence
          ? evidence.emptyState?.message || "Evidence is limited until more saved trades are available."
          : "Compact proof from saved journal trades, grouped by what actually moved your results."}
      </Text>
      {lowConfidence ? (
        <WarningCard
          title={evidence.emptyState?.title || "Evidence sample is weak"}
          body={evidence.emptyState?.message || "Add more saved trades across multiple sessions before relying on detailed evidence breakdowns."}
        />
      ) : (
        <View style={{ gap: 10, marginTop: 14 }}>
          {sections.map((section) => (
            <AiOsTextBlock key={section.title} title={section.title} items={section.items} />
          ))}
          {metrics.length ? (
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(150,255,0,0.20)", backgroundColor: "rgba(150,255,0,0.045)", padding: 13, gap: 8 }}>
              <Text style={styles.terminalSmallLabel}>Metrics Tied To Recommendations</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {metrics.map((metric) => (
                  <Text key={metric} style={styles.tradeMetaChip}>{metric.replace(/_/g, " ").toUpperCase()}</Text>
                ))}
              </View>
            </View>
          ) : null}
          {!sections.length && !metrics.length ? (
            <Text style={styles.terminalSub}>No compact evidence groups yet. Add more trades with symbols, sessions, setup tags, and notes.</Text>
          ) : null}
        </View>
      )}
    </TerminalGlassCard>
  );
}

type AiOsPropMode = keyof AiOperatingSystem["propFirm"]["recommendations"];

const aiOsPropModeLabels: Record<AiOsPropMode, string> = {
  evaluation: "Evaluation",
  funded: "Funded",
  live: "Live",
  consistency: "Consistency",
  payout_protection: "Payout Protection",
};

const aiOsPropModeQuestions: Record<AiOsPropMode, string> = {
  evaluation: "Pass phase objective, target progress, drawdown left, and today's max-loss plan.",
  funded: "Protect the account, lower rule-violation risk, and preserve payout safety.",
  live: "Compound safely with a defined risk budget and drawdown protection.",
  consistency: "Control trade count, size consistency, rule adherence, and outlier days.",
  payout_protection: "Reduce risk near payout, avoid trailing drawdown traps, and stop after rule breaks.",
};

const aiOsPropModeMetricLabels: Record<AiOsPropMode, string[]> = {
  evaluation: ["Pass objective", "Current progress", "Remaining target", "Daily drawdown left", "Max drawdown left", "Suggested risk", "Today's goal", "Maximum loss"],
  funded: ["Account protection", "Rule violation risk", "Daily risk cap", "Payout safety"],
  live: ["Compounding safely", "Risk budget", "Suggested risk %", "Monthly target", "Drawdown protection"],
  consistency: ["Trade count control", "Average size consistency", "Rule adherence", "Avoid outlier days"],
  payout_protection: ["Payout eligibility", "Reduced size", "Trailing drawdown traps", "Stop after rule breaks"],
};

function aiOsEvidenceValue(evidence: string[], pattern: RegExp) {
  return evidence.find((item) => pattern.test(item)) || null;
}


function AiOperatingSystemPropFirmSection({
  operatingSystem,
  snapshot,
  passProbability,
  stats,
  trades,
  revengeTrading,
}: {
  operatingSystem: AiOperatingSystem;
  snapshot: ReturnType<typeof computePropRiskSnapshot> | null;
  passProbability: PassProbabilityResult;
  stats: ReturnType<typeof calcStats>;
  trades: Trade[];
  revengeTrading: RevengeTradingResult;
}) {
  const propFirm = operatingSystem.propFirm;
  const [mode, setMode] = useState<AiOsPropMode>(propFirm.mode);
  const [activeTool, setActiveTool] = useState<AiOsPropTool>("limits");
  const [plannedContracts, setPlannedContracts] = useState("1");
  const [hypotheticalLoss, setHypotheticalLoss] = useState("");
  const [dailyTarget, setDailyTarget] = useState("");
  const [riskMathOpen, setRiskMathOpen] = useState(false);
  const recommendation = propFirm.recommendations[mode];
  const lowConfidence = propFirm.state === "empty" || propFirm.state === "low_confidence";
  const notConfigured = propFirm.state === "not_configured" || !snapshot;
  const evidence = aiOsUniqueList([...(recommendation?.evidence || []), ...propFirm.evidence], 6);
  const status = aiOsEvidenceValue(evidence, /^Status/i) || (notConfigured ? "No prop firm template selected" : "Status needs synced prop data");
  const dailyBuffer = aiOsEvidenceValue(evidence, /Daily buffer/i) || "Daily drawdown left needs prop data";
  const accountBuffer = aiOsEvidenceValue(evidence, /Account buffer|Drawdown/i) || "Max drawdown left needs prop data";
  const probability = aiOsEvidenceValue(evidence, /Pass probability/i) || "Probability needs more trade history";
  const contracts = Math.max(0, Math.round(Number(plannedContracts) || 0));
  const nextLoss = Math.max(0, Math.abs(Number(hypotheticalLoss) || Math.abs(stats.avgLoss || 0)));
  const target = Math.max(0, Number(dailyTarget) || 0);
  const projectedDaily = snapshot ? Math.max(0, snapshot.dailyRemaining - nextLoss) : 0;
  const projectedAccount = snapshot ? Math.max(0, snapshot.accountRemaining - nextLoss) : 0;
  const dailyRiskRatio = snapshot ? projectedDaily / Math.max(1, snapshot.template.dailyLossLimit) : 0;
  const accountRiskRatio = snapshot ? projectedAccount / Math.max(1, snapshot.template.maxLossLimit) : 0;
  const revengeRiskScore = revengeTrading.severity === "HIGH" ? 85 : revengeTrading.severity === "MEDIUM" ? 60 : 20;
  const riskStatus: "safe" | "caution" | "danger" =
    !snapshot || projectedDaily <= 0 || projectedAccount <= 0 || revengeRiskScore >= 85
      ? "danger"
      : dailyRiskRatio < 0.35 || accountRiskRatio < 0.35 || revengeRiskScore >= 60 || stats.exp <= 0
        ? "caution"
        : "safe";
  const violationRisk = riskStatus === "danger" ? "High" : riskStatus === "caution" ? "Medium" : "Low";
  const maxSafeLoss = snapshot ? Math.floor(Math.max(0, Math.min(snapshot.dailyRemaining, snapshot.accountRemaining) * 0.35)) : 0;
  const suggestedContracts = snapshot?.engine?.contractRecommendation.recommended ?? (riskStatus === "safe" ? Math.max(1, contracts) : 0);
  const safeDailyTarget = snapshot ? Math.max(0, Math.min(target || snapshot.remainingToPass, maxSafeLoss || snapshot.dailyRemaining)) : 0;
  const suggestedAction =
    riskStatus === "danger"
      ? "Stop trading and protect the account."
      : riskStatus === "caution"
        ? "Reduce size and only take checklist-perfect setups."
        : "Trade the plan, keep size stable, and protect green progress.";
  const toolLabels: { key: AiOsPropTool; label: string }[] = [
    { key: "limits", label: "Generate Today's Limits" },
    { key: "whatif", label: "What-if Simulator" },
    { key: "emergency", label: "Emergency Mode" },
    { key: "green", label: "Green Day Lock" },
    { key: "recovery", label: "Recovery Plan" },
  ];
  const modeMetrics = aiOsPropModeMetricLabels[mode].slice(0, 4).map((label, index) => {
    const values = [status, probability, dailyBuffer, accountBuffer];
    return { label, value: values[index] || "Needs prop data", tone: index === 0 ? "purple" as const : "grey" as const };
  });

  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSmallLabel}>PROP FIRM COACH</Text>
      <Text style={styles.terminalSectionTitle}>How do I pass/protect my account?</Text>
      <Text style={styles.terminalSub}>
        {notConfigured
          ? "Select a synced prop firm template to unlock mode-based prop coaching."
          : lowConfidence
            ? propFirm.emptyState?.message || "Prop coaching needs more journal history before making strong recommendations."
            : aiOsPropModeQuestions[mode]}
      </Text>
      <View style={styles.propModeRail}>
        {(Object.keys(aiOsPropModeLabels) as AiOsPropMode[]).map((item) => {
          const active = item === mode;
          return (
            <Pressable key={item} onPress={() => setMode(item)} style={[styles.propModeChip, active && styles.propModeChipActive]}>
              <Text style={[styles.propModeChipText, active && styles.propModeChipTextActive]}>{aiOsPropModeLabels[item]}</Text>
            </Pressable>
          );
        })}
      </View>
      {notConfigured || lowConfidence || !recommendation ? (
        <WarningCard
          title={notConfigured ? "Prop account setup needed" : propFirm.emptyState?.title || "Low-confidence prop sample"}
          body={notConfigured ? "Prop Firm Coach will stay in setup mode until a synced prop template and journal sample are available." : propFirm.emptyState?.message || "Add more saved trades before relying on mode-specific prop coaching."}
        />
      ) : (
        <View style={{ gap: 12, marginTop: 14 }}>
          <MetricPillRow items={modeMetrics} />
          <View style={styles.propCoachInteractivePanel}>
            <View style={styles.terminalHeaderRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.terminalSmallLabel}>ACCOUNT MENTOR</Text>
                <Text style={styles.propCoachHeadline}>{riskStatus === "danger" ? "Protect the account now" : riskStatus === "caution" ? "Trade in protection mode" : "Account is clear for controlled execution"}</Text>
              </View>
              <Text style={[styles.tradeMetaChip, riskStatus === "danger" ? { color: C.red, borderColor: "rgba(255,91,91,0.38)", backgroundColor: C.redSoft } : riskStatus === "caution" ? { color: C.yellow, borderColor: "rgba(255,204,0,0.38)", backgroundColor: C.yellowSoft } : null]}>
                {riskStatus.toUpperCase()}
              </Text>
            </View>
            <MetricPillRow
              items={[
                { label: "Daily Buffer", value: moneyCompact(snapshot.dailyRemaining), tone: snapshot.dailyRemaining > 0 ? "green" : "red" },
                { label: "Account Buffer", value: moneyCompact(snapshot.accountRemaining), tone: snapshot.accountRemaining > 0 ? "green" : "red" },
                { label: "Max Safe Loss", value: moneyCompact(maxSafeLoss), tone: maxSafeLoss > 0 ? "purple" : "red" },
                { label: "Suggested Contracts", value: `${suggestedContracts}`, tone: suggestedContracts > 0 ? "green" : "red" },
              ]}
            />
            <View style={styles.coachConsoleActionRow}>
              {toolLabels.map((tool) => {
                const active = activeTool === tool.key;
                return (
                  <Pressable key={tool.key} onPress={() => setActiveTool(tool.key)} style={[styles.coachConsoleActionChip, active && styles.coachConsoleActionChipActive]}>
                    <Text style={[styles.coachConsoleActionText, active && styles.coachConsoleActionTextActive]}>{tool.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {activeTool === "whatif" ? (
              <View style={styles.propSimulatorBox}>
                <View style={styles.propSimulatorInputRow}>
                  <View style={styles.propSimulatorInputWrap}>
                    <Text style={styles.terminalSmallLabel}>Contracts</Text>
                    <TextInput value={plannedContracts} onChangeText={setPlannedContracts} keyboardType="number-pad" placeholder="1" placeholderTextColor={C.sub} style={styles.propSimulatorInput} />
                  </View>
                  <View style={styles.propSimulatorInputWrap}>
                    <Text style={styles.terminalSmallLabel}>Next Loss</Text>
                    <TextInput value={hypotheticalLoss} onChangeText={setHypotheticalLoss} keyboardType="decimal-pad" placeholder={moneyCompact(Math.abs(stats.avgLoss || 0))} placeholderTextColor={C.sub} style={styles.propSimulatorInput} />
                  </View>
                </View>
                <View style={styles.propSimulatorInputWrap}>
                  <Text style={styles.terminalSmallLabel}>Optional Daily Target</Text>
                  <TextInput value={dailyTarget} onChangeText={setDailyTarget} keyboardType="decimal-pad" placeholder="Optional" placeholderTextColor={C.sub} style={styles.propSimulatorInput} />
                </View>
              </View>
            ) : null}
            <View style={styles.propSimulatorResult}>
              <Text style={styles.terminalSmallLabel}>
                {activeTool === "limits" ? "Today's Limits" : activeTool === "whatif" ? "What-if Result" : activeTool === "emergency" ? "Emergency Mode" : activeTool === "green" ? "Green Day Lock" : "Recovery Plan"}
              </Text>
              <MetricPillRow
                items={[
                  { label: "Projected Daily", value: moneyCompact(activeTool === "whatif" ? projectedDaily : snapshot.dailyRemaining), tone: projectedDaily > 0 ? "green" : "red" },
                  { label: "Projected Account", value: moneyCompact(activeTool === "whatif" ? projectedAccount : snapshot.accountRemaining), tone: projectedAccount > 0 ? "green" : "red" },
                  { label: "Violation Risk", value: violationRisk, tone: riskStatus === "danger" ? "red" : riskStatus === "caution" ? "purple" : "green" },
                  { label: "Safe Target", value: moneyCompact(safeDailyTarget), tone: safeDailyTarget > 0 ? "green" : "grey" },
                ]}
              />
              <Text style={styles.terminalSub}>
                {activeTool === "emergency"
                  ? (riskStatus === "danger" ? "Stop trading. Review the last sequence before taking another trade." : "Emergency mode is not required, but keep a hard stop ready.")
                  : activeTool === "green"
                    ? "If you are green, lock progress by reducing size and stopping after one rule break."
                    : activeTool === "recovery"
                      ? `Recovery plan: cap size at ${Math.max(0, Math.min(suggestedContracts, contracts || suggestedContracts))} contracts and rebuild with clean journal entries.`
                      : suggestedAction}
              </Text>
              <Pressable onPress={() => setRiskMathOpen((prev) => !prev)} style={styles.coachConsoleActionChip}>
                <Text style={styles.coachConsoleActionText}>{riskMathOpen ? "Hide risk math" : "Show risk math"}</Text>
              </Pressable>
              {riskMathOpen ? (
                <View style={styles.coachConsoleReveal}>
                  <Text style={styles.aiBulletText}>• Daily buffer after hypothetical loss: {moneyCompact(projectedDaily)}</Text>
                  <Text style={styles.aiBulletText}>• Account buffer after hypothetical loss: {moneyCompact(projectedAccount)}</Text>
                  <Text style={styles.aiBulletText}>• Risk status uses daily/account buffer, expectancy, and revenge-risk severity.</Text>
                  <Text style={styles.aiBulletText}>• Sample: {trades.length} trades · Win rate {stats.wr.toFixed(0)}% · Expectancy {moneyCompact(stats.exp)}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.propCoachAdviceCard}>
            <Text style={styles.terminalSmallLabel}>{aiOsPropModeLabels[mode].toUpperCase()} MODE</Text>
            <Text style={styles.propCoachHeadline}>{recommendation.title}</Text>
            <Text style={styles.terminalSub}>{recommendation.action}</Text>
          </View>
          <AiOsTextBlock title="Mode Evidence" items={evidence} />
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.035)", padding: 13, gap: 8 }}>
            <Text style={styles.terminalSmallLabel}>Mode Focus</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {aiOsPropModeMetricLabels[mode].map((item) => (
                <Text key={`${mode}-${item}`} style={styles.tradeMetaChip}>{item.toUpperCase()}</Text>
              ))}
            </View>
          </View>
        </View>
      )}
    </TerminalGlassCard>
  );
}

function AiOperatingSystemGrowthSection({ operatingSystem }: { operatingSystem: AiOperatingSystem }) {
  const growth = operatingSystem.growth;
  const lowConfidence = aiOsStateIsLow(growth.state) || !growth.timeline;
  const evidence = aiOsUniqueList(growth.evidence, 6);
  const evidenceValue = (pattern: RegExp) => {
    const match = aiOsEvidenceValue(evidence, pattern);
    return match ? match.replace(pattern, "").replace(/^[:\s-]+/, "").trim() || match : "Needs more history";
  };
  const growthMetrics = [
    { label: "Consistency", value: evidenceValue(/Consistency/i), tone: evidence.some((item) => /Consistency/i.test(item)) ? "green" as const : "grey" as const },
    { label: "Rule Following", value: evidenceValue(/Rule|discipline|adherence/i), tone: evidence.some((item) => /Rule|discipline|adherence/i.test(item)) ? "purple" as const : "grey" as const },
    { label: "Risk Control", value: evidenceValue(/Risk control/i), tone: evidence.some((item) => /Risk control/i.test(item)) ? "green" as const : "grey" as const },
    { label: "Emotional Stability", value: evidenceValue(/Emotional|revenge|tilt/i), tone: evidence.some((item) => /Emotional|revenge|tilt/i.test(item)) ? "purple" as const : "grey" as const },
    { label: "Execution Quality", value: growth.recommendation?.action || "Needs more history", tone: growth.recommendation ? "green" as const : "grey" as const },
  ];
  const timelineWindows = growth.timeline?.windows || [];

  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSmallLabel}>GROWTH</Text>
      <Text style={styles.terminalSectionTitle}>Am I becoming a better trader?</Text>
      <Text style={styles.terminalSub}>
        {lowConfidence
          ? growth.emptyState?.message || "Growth needs enough saved trades across time periods before comparing progress."
          : "Progress is based on journal evidence and period-to-period behavior, not vanity badges."}
      </Text>
      {lowConfidence ? (
        <WarningCard
          title={growth.emptyState?.title || "Not enough progress history"}
          body={growth.emptyState?.message || "Keep saving trades with notes, mood, mistakes, and setups to unlock growth comparisons."}
        />
      ) : (
        <View style={{ gap: 12, marginTop: 14 }}>
          <MetricPillRow items={growthMetrics} />
          {timelineWindows.length ? (
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(150,255,0,0.20)", backgroundColor: "rgba(150,255,0,0.045)", padding: 13, gap: 8 }}>
              <Text style={styles.terminalSmallLabel}>Comparison vs Previous Period</Text>
              {timelineWindows.slice(0, 4).map((window) => (
                <View key={window.label} style={styles.terminalHeaderRow}>
                  <Text style={[styles.terminalSub, { flex: 1 }]}>{window.label}</Text>
                  <Text style={[styles.metricPillValue, { color: window.improved ? C.green : C.red, fontSize: 16 }]}>
                    {window.improved ? "+" : ""}{Math.round(window.delta)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {growth.recommendation ? (
            <RuleImpactCard
              title={growth.recommendation.title}
              rule={growth.recommendation.action}
              evidence={aiOsUniqueList(growth.recommendation.evidence, 3).join(" · ")}
            />
          ) : null}
          <AiOsTextBlock title="Growth Evidence" items={evidence} />
        </View>
      )}
    </TerminalGlassCard>
  );
}

type AiOsMarketActionId = AiOperatingSystem["marketAssistant"]["actions"][number]["id"];

const aiOsMarketActionToCoachKey: Partial<Record<AiOsMarketActionId, keyof AIResultMap>> = {
  summarize_today: "journalSummary",
  risk_for_mes: "riskPredictor",
  pre_market_plan: "dailyPlan",
  prop_preparation: "dailyChallenge",
};

function AiOperatingSystemMarketAssistantSection({
  operatingSystem,
  aiBusy,
  onAction,
}: {
  operatingSystem: AiOperatingSystem;
  aiBusy: Record<keyof AIResultMap, boolean>;
  onAction: (id: AiOsMarketActionId) => void;
}) {
  const assistant = operatingSystem.marketAssistant;
  const lowConfidence = assistant.state === "empty" || assistant.state === "low_confidence";
  const evidence = aiOsUniqueList(assistant.evidence, 4);

  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSmallLabel}>MARKET PULSE</Text>
      <Text style={styles.terminalSectionTitle}>What market help do I need right now?</Text>
      <Text style={styles.terminalSub}>
        One action hub for market and journal-assisted workflows. Existing review actions keep their current payloads.
      </Text>
      {lowConfidence ? (
        <WarningCard
          title={assistant.state === "empty" ? "Journal evidence needed" : "Limited journal evidence"}
          body="Journal-based actions stay cautious until more saved trades are available. Market-only actions can still be reviewed below."
        />
      ) : null}
      <View style={{ gap: 10, marginTop: 14 }}>
        {assistant.actions.map((action) => {
          const coachKey = aiOsMarketActionToCoachKey[action.id];
          const wired = Boolean(coachKey);
          const disabled = !action.enabled || !wired || (coachKey ? aiBusy[coachKey] : false);
          const status = !action.enabled ? "Needs evidence" : wired ? (coachKey && aiBusy[coachKey] ? "Working" : "Ready") : "View below";
          return (
            <Pressable
              key={action.id}
              disabled={disabled}
              onPress={() => onAction(action.id)}
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: wired && action.enabled ? "rgba(150,255,0,0.24)" : "rgba(255,255,255,0.10)",
                backgroundColor: wired && action.enabled ? "rgba(150,255,0,0.045)" : "rgba(255,255,255,0.035)",
                padding: 13,
                opacity: disabled && wired ? 0.62 : 1,
              }}
            >
              <View style={styles.terminalHeaderRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.propCoachHeadline}>{action.label}</Text>
                  <Text style={styles.terminalSub}>
                    {action.source.replace(/_/g, " ").toUpperCase()} · {action.requiresJournalEvidence ? "Uses journal evidence" : "Market context"}
                  </Text>
                </View>
                <Text style={[styles.tradeMetaChip, !wired || !action.enabled ? { color: C.sub, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.04)" } : null]}>
                  {status.toUpperCase()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {evidence.length ? (
        <View style={{ marginTop: 14 }}>
          <AiOsTextBlock title="Assistant Evidence" items={evidence} />
        </View>
      ) : null}
    </TerminalGlassCard>
  );
}

function AchievementDetailModal({ achievement, onClose }: { achievement: AiTradingAchievement | null; onClose: () => void }) {
  if (!achievement) return null;
  const pctDone = Math.round((achievement.progress / Math.max(1, achievement.target)) * 100);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <View style={[styles.terminalCard, { width: "100%", maxWidth: 420, gap: 14 }]}>
          <Text style={styles.terminalSmallLabel}>{achievement.rarity.toUpperCase()} · {achievement.category.toUpperCase()}</Text>
          <Text style={styles.terminalSectionTitle}>{achievement.icon} {achievement.title}</Text>
          <RiskMeter label={achievement.unlocked ? t("microUnlockedLabel") : t("microProgress")} value={pctDone} />
          <Text style={styles.terminalSub}>{achievement.explanation}</Text>
          <WarningCard title={t("achWhyItMatters")} body={achievement.whyItMatters} />
          <EvidenceChart label={t("profileConnectedStats")} values={achievement.connectedStats.map((item, index) => ({ name: item, value: achievement.connectedStats.length - index, tone: achievement.unlocked ? "green" : "purple" }))} />
          <Pressable onPress={onClose} style={styles.primaryBig}>
            <Text style={styles.primaryText}>{t("microClose")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AchievementSystemCard({ achievements }: { achievements: AiTradingAchievement[] }) {
  const [selected, setSelected] = useState<AiTradingAchievement | null>(null);
  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSectionTitle}>{t("achievementSystem")}</Text>
      <Text style={styles.terminalSub}>{t("achievementSystemSub")}</Text>
      <View style={{ gap: 10, marginTop: 14 }}>
        {achievements.map((achievement) => {
          const pctDone = Math.round((achievement.progress / Math.max(1, achievement.target)) * 100);
          return (
            <Pressable key={achievement.id} onPress={() => setSelected(achievement)} style={{ borderRadius: 18, borderWidth: 1, borderColor: achievement.unlocked ? "rgba(150,255,0,0.30)" : "rgba(255,255,255,0.10)", backgroundColor: achievement.unlocked ? "rgba(150,255,0,0.055)" : "rgba(255,255,255,0.035)", padding: 13, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={[styles.propCoachHeadline, { color: achievement.unlocked ? C.green : C.sub }]}>{achievement.icon}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.monthlyTimelineValue}>{achievement.title}</Text>
                  <Text style={styles.terminalSmallLabel}>{achievement.rarity.toUpperCase()} · {achievement.unlocked ? t("badgeUnlocked") : t("badgeLocked")}</Text>
                </View>
                <Text style={[styles.terminalSmallLabel, { color: achievement.unlocked ? C.green : C.purple }]}>{pctDone}%</Text>
              </View>
              <RiskMeter label={`${achievement.progress.toFixed(0)} / ${achievement.target}`} value={pctDone} />
            </Pressable>
          );
        })}
      </View>
      <AchievementDetailModal achievement={selected} onClose={() => setSelected(null)} />
    </TerminalGlassCard>
  );
}

function TradingDNACard({ profile }: { profile: AiTradingDNAProfile }) {
  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSectionTitle}>{t("personalTradingDna")}</Text>
      <TypingText text={profile.summary} speedMs={9} enabled={profile.summary.length <= 200} textStyle={styles.terminalSub} />
      <View style={{ gap: 10, marginTop: 14 }}>
        <RuleImpactCard title={t("profileTraderType")} rule={profile.traderType} evidence={profile.enoughData ? t("profileBuiltFromJournal") : t("profileRequiresTenTrades")} />
        <MetricPillRow items={[
          { label: t("profileBestSymbol"), value: profile.metrics.bestSymbol, tone: "purple" },
          { label: t("profileBestSession"), value: profile.metrics.bestSession, tone: "purple" },
          { label: t("profileAvgRR"), value: profile.metrics.averageRR.toFixed(2), tone: profile.metrics.averageRR >= 1 ? "green" : "grey" },
          { label: t("profileHold"), value: profile.metrics.averageHoldingMinutes ? `${profile.metrics.averageHoldingMinutes}m` : t("microNA"), tone: "grey" },
        ]} />
        <EvidenceChart label={t("strengthsSection")} values={profile.strengths.slice(0, 3).map((item, index) => ({ name: item, value: 3 - index, tone: "green" }))} />
        <EvidenceChart label={t("profileWeaknesses")} values={profile.weaknesses.slice(0, 3).map((item, index) => ({ name: item, value: 3 - index, tone: "red" }))} />
        <RuleImpactCard title={t("profileBestConditions")} rule={profile.bestConditions.join(" · ")} evidence={profile.metrics.bestSetup} />
        <WarningCard title={t("profileDangerZones")} body={profile.dangerZones.join(" · ")} />
        <RuleImpactCard title={t("profilePersonalRules")} rule={profile.personalRules.join(" · ")} evidence={profile.growthPotential} />
      </View>
    </TerminalGlassCard>
  );
}

function BenchmarkCard({ benchmark }: { benchmark: AiBenchmarkProfile }) {
  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSectionTitle}>{t("compareYourself")}</Text>
      <Text style={styles.terminalSub}>{t("compareYourselfSub")}</Text>
      {!benchmark.available ? (
        <WarningCard title={t("profileBenchmarkLocked")} body={benchmark.message} />
      ) : (
        <EvidenceChart label={t("profilePercentiles")} values={Object.entries(benchmark.percentiles).map(([name, value]) => ({ name, value: value || 0, tone: "purple" }))} />
      )}
    </TerminalGlassCard>
  );
}

function ImprovementCard({ timeline }: { timeline: AiImprovementTimeline }) {
  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSectionTitle}>{t("youAreImproving")}</Text>
      <Text style={styles.terminalSub}>{t("youAreImprovingSub")}</Text>
      <View style={{ gap: 10, marginTop: 14 }}>
        {timeline.windows.map((window) => (
          <View key={window.label} style={{ borderRadius: 18, borderWidth: 1, borderColor: window.improved ? "rgba(150,255,0,0.22)" : "rgba(255,69,105,0.22)", backgroundColor: "rgba(255,255,255,0.035)", padding: 13, gap: 8 }}>
            <Text style={styles.monthlyTimelineValue}>{window.label}</Text>
            <MiniPerformanceChart values={[window.previous, window.current]} />
            <Text style={[styles.terminalSmallLabel, { color: window.improved ? C.green : C.red }]}>{window.improved ? "+" : ""}{window.delta}</Text>
            <Text style={styles.terminalSub}>{window.explanation}</Text>
          </View>
        ))}
        <RuleImpactCard title={t("profileNextImprovement")} rule={timeline.nextFocus} evidence={[...timeline.whatImproved, ...timeline.whatDeclined].slice(0, 3).join(" · ") || t("profileNeedMoreHistory")} />
      </View>
    </TerminalGlassCard>
  );
}

function SessionHeatmap({ stats }: { stats: ReturnType<typeof calcStats> }) {
  return <EvidenceChart label={t("profileSessionImpact")} values={stats.session.slice(0, 3).map((row) => ({ name: row.label, value: row.pnl, tone: row.pnl >= 0 ? "green" : "red" }))} />;
}

function CalendarImpact({ stats }: { stats: ReturnType<typeof calcStats> }) {
  return <EvidenceChart label={t("profileCalendarImpact")} values={stats.weekday.slice(0, 3).map((row) => ({ name: row.label, value: row.pnl, tone: row.pnl >= 0 ? "green" : "red" }))} />;
}

function PropFirmCoachSection({
  templates,
  value,
  mode,
  snapshot,
  stats,
  passProbability,
  revengeTrading,
  onTemplateChange,
  onModeChange,
}: {
  templates: RiskTemplate[];
  value: string;
  mode: FirmMode;
  snapshot: ReturnType<typeof computePropRiskSnapshot> | null;
  stats: ReturnType<typeof calcStats>;
  passProbability: PassProbabilityResult;
  revengeTrading: RevengeTradingResult;
  onTemplateChange: (key: string) => void;
  onModeChange: (mode: FirmMode) => void;
}) {
  const safeTemplates = templates;
  if (!snapshot) {
    return (
      <TerminalGlassCard>
        <Text style={styles.terminalSectionTitle}>{t("propFirmRiskAssistant")}</Text>
        <Text style={styles.terminalSub}>
          {safeTemplates.length
            ? t("propSelectEvalAccount")
            : t("propTemplatesLoadHint")}
        </Text>
        {safeTemplates.length ? (
          <>
            <View style={styles.propModeRail}>
              {(["evaluation", "funded"] as FirmMode[]).map((item) => {
                const active = item === mode;
                return (
                  <Pressable key={item} onPress={() => onModeChange(item)} style={[styles.propModeChip, active && styles.propModeChipActive]}>
                    <Text style={[styles.propModeChipText, active && styles.propModeChipTextActive]}>
                      {item === "evaluation" ? "Evaluation" : "Funded"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propTemplateRailCompact}>
              {safeTemplates.map((template) => {
                const active = template.key === value;
                return (
                  <Pressable key={template.key} onPress={() => onTemplateChange(template.key)} style={[styles.propTemplateChipCompact, active && styles.propTemplateChipActive]}>
                    <Text style={[styles.propTemplateChipText, active && styles.propTemplateChipTextActive]}>{template.accountSize / 1000}K</Text>
                    <Text style={styles.propTemplateChipSub}>{template.evaluationContracts} eval / {template.liveContracts} live</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}
      </TerminalGlassCard>
    );
  }
  const engine = snapshot.engine;
  const isFunded = mode === "funded";
  const maxContracts = isFunded ? snapshot.template.liveContracts : snapshot.template.evaluationContracts;
  const riskPct = isFunded ? snapshot.template.liveRiskPct : snapshot.template.evaluationRiskPct;
  const coach = buildPropCoachRecommendation({ snapshot, stats, passProbability, revengeTrading });
  const revengeRiskScore = revengeTrading.severity === "HIGH" ? 85 : revengeTrading.severity === "MEDIUM" ? 60 : 20;
  const safetyScore = engine?.accountHealthScore ?? Math.max(0, Math.min(100, Math.round((passProbability.probability * 0.45) + (snapshot.bufferPct * 0.35) + (stats.drawdownControl * 0.2) - (revengeRiskScore * 0.15))));
  const headline = engine?.coachMessage || coach.headline;
  const action = engine?.primaryAction || coach.action;
  return (
    <TerminalGlassCard>
      <View style={styles.terminalHeaderRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.terminalSectionTitle}>{t("propFirmRiskAssistant")}</Text>
          <Text style={styles.terminalSub}>{t("propFirmRiskAssistantSub")}</Text>
        </View>
        <AppleRing label={isFunded ? "HEALTH" : "PASS"} value={isFunded ? safetyScore : passProbability.probability} display={`${isFunded ? safetyScore : passProbability.probability}%`} size={112} color={snapshot.statusColor} />
      </View>
      <View style={styles.propModeRail}>
        {(["evaluation", "funded"] as FirmMode[]).map((item) => {
          const active = item === mode;
          return (
            <Pressable key={item} onPress={() => onModeChange(item)} style={[styles.propModeChip, active && styles.propModeChipActive]}>
              <Text style={[styles.propModeChipText, active && styles.propModeChipTextActive]}>
                {item === "evaluation" ? "Evaluation" : "Funded"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propTemplateRailCompact}>
        {safeTemplates.map((template) => {
          const active = template.key === value;
          return (
            <Pressable key={template.key} onPress={() => onTemplateChange(template.key)} style={[styles.propTemplateChipCompact, active && styles.propTemplateChipActive]}>
              <Text style={[styles.propTemplateChipText, active && styles.propTemplateChipTextActive]}>{template.accountSize / 1000}K</Text>
              <Text style={styles.propTemplateChipSub}>{template.evaluationContracts} eval / {template.liveContracts} live</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.propCoachStatusCard}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.terminalSmallLabel}>{t("statusLabel")}</Text>
          <Text style={[styles.propCoachStatus, { color: snapshot.statusColor }]}>{snapshot.status}</Text>
        </View>
        <Text style={[styles.propCoachAction, { color: snapshot.statusColor }]}>{action}</Text>
      </View>
      <MetricPillRow
        items={[
          { label: t("dailyBuffer"), value: moneyCompact(snapshot.dailyRemaining), tone: snapshot.dailyRemaining > 0 ? "green" : "red" },
          { label: t("microAccountBuffer"), value: moneyCompact(snapshot.accountRemaining), tone: snapshot.accountRemaining > 0 ? "green" : "red" },
          { label: isFunded ? "Health Score" : "To Pass", value: isFunded ? `${safetyScore}%` : moneyCompact(snapshot.remainingToPass), tone: isFunded ? "purple" : snapshot.remainingToPass <= 0 ? "green" : "purple" },
          { label: t("microContractsRec"), value: engine ? `${engine.contractRecommendation.recommended}/${engine.contractRecommendation.maxAllowed}` : `${maxContracts} max`, tone: "purple" },
          { label: t("microPayoutReady"), value: engine?.payoutReadiness.ready ? t("microYes") : `${engine?.payoutReadiness.pct ?? 0}%`, tone: engine?.payoutReadiness.ready ? "green" : "grey" },
          { label: t("microRevengeRisk"), value: `${revengeRiskScore}%`, tone: revengeRiskScore >= 60 ? "red" : "grey" },
        ]}
      />
      <View style={styles.propCoachAdviceCard}>
        <Text style={styles.propCoachHeadline}>{headline}</Text>
        <BulletList items={engine?.ruleWarnings.slice(0, 3).map((w) => w.title) || coach.rules} />
        <Text style={styles.terminalSub}>{coach.reason}</Text>
      </View>
      <Text style={styles.newsDisclaimer}>{t("educationalDisclaimer")}</Text>
    </TerminalGlassCard>
  );
}

function TerminalPropFirmMission({
  propSnapshot,
  passProbability,
}: {
  propSnapshot: ReturnType<typeof computePropRiskSnapshot> | null;
  passProbability: PassProbabilityResult;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!propSnapshot) {
    return (
      <TerminalGlassCard>
        <Text style={styles.terminalSectionTitle}>Eval</Text>
        <Text style={styles.terminalSub}>{t("selectPropTemplatePass")}</Text>
      </TerminalGlassCard>
    );
  }
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
          { label: t("microToPass"), value: moneyCompact(propSnapshot.remainingToPass), tone: propSnapshot.remainingToPass > 0 ? "purple" : "green" },
          { label: t("microDailyLimit"), value: moneyCompact(propSnapshot.template.dailyLossLimit), tone: "grey" },
          { label: t("microMaxLoss"), value: moneyCompact(propSnapshot.template.maxLossLimit), tone: "grey" },
          { label: t("microContracts"), value: `${maxContracts} max`, tone: "purple" },
        ]}
      />
      <Pressable onPress={() => setDetailsOpen(true)} style={styles.missionCta} accessibilityRole="button" accessibilityLabel={t("protectPassPath")}>
        <Text style={styles.missionCtaText} maxFontSizeMultiplier={1.25}>{t("protectPassPath")}</Text>
      </Pressable>
      <BottomSheetPanel visible={detailsOpen} title="Protect Pass Path" onClose={() => setDetailsOpen(false)}>
        <MetricPillRow
          items={[
            { label: t("microPass"), value: `${passProbability.probability}%`, tone: passProbability.probability >= 70 ? "green" : "purple" },
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
    { label: t("profileStrength"), value: tradeAnalysis?.strengths[0]?.title || patterns.strengths[0]?.title || t("profileBestSetupForming") },
    { label: t("profileMistake"), value: tradeAnalysis?.mistakes[0]?.title || patterns.risks[0]?.title || t("profileNoMajorMistake") },
    { label: t("profileBestSetup"), value: stats.bySetup[0]?.label || t("profileAddTags") },
    { label: t("profileWorstSetup"), value: [...stats.bySetup].sort((a, b) => a.pnl - b.pnl)[0]?.label || "—" },
    { label: t("profileBestDay"), value: bestDay ? fullWeekdayName(bestDay.label) : "—" },
    { label: t("profileWorstDay"), value: worstDay ? fullWeekdayName(worstDay.label) : "—" },
    { label: t("profileBestSession"), value: bestSession?.label || "—" },
    { label: t("profileWeakSession"), value: worstSession?.label || "—" },
  ];
  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSectionTitle}>{t("performanceIntelligence")}</Text>
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
  snapshot: ReturnType<typeof computePropRiskSnapshot> | null;
  mode: FirmMode;
  onModeChange: (mode: FirmMode) => void;
}) {
  const isFunded = mode === "funded";
  if (!snapshot) {
    return (
      <TerminalGlassCard>
        <Text style={styles.terminalSectionTitle}>{isFunded ? "Funded" : "Evaluation"}</Text>
        <Text style={styles.terminalSub}>{t("selectPropTemplateFunded")}</Text>
      </TerminalGlassCard>
    );
  }
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
          { label: t("dailyBuffer"), value: moneyCompact(snapshot.dailyRemaining), tone: snapshot.dailyRemaining > 0 ? "green" : "red" },
          { label: t("microAccountBuffer"), value: moneyCompact(snapshot.accountRemaining), tone: snapshot.accountRemaining > 0 ? "green" : "red" },
          { label: isFunded ? "Live Cap" : "To Pass", value: isFunded ? `${maxContracts} max` : moneyCompact(snapshot.remainingToPass), tone: isFunded ? "purple" : snapshot.remainingToPass <= 0 ? "green" : "purple" },
          { label: t("microContracts"), value: `${maxContracts} max`, tone: "purple" },
          { label: t("microRiskPerTrade"), value: `${Math.round(riskPct * 100)}%`, tone: "grey" },
          { label: t("statusLabel"), value: snapshot.status, tone: snapshot.status === "CLEAR" ? "green" : snapshot.status === "STOP" ? "red" : "purple" },
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


type AiAnalyticsToolId = "dna" | "evidence" | "growth" | "market" | "patterns" | "monthly";

function CoachFocusRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "risk" | "action";
}) {
  const valueColor = tone === "risk" ? C.red : tone === "action" ? C.green : C.text;
  return (
    <View style={styles.coachFocusRow}>
      <Text style={styles.coachFocusLabel}>{label}</Text>
      <Text style={[styles.coachFocusValue, { color: valueColor }]} numberOfLines={2}>
        {truncateCoachLine(value, 96)}
      </Text>
    </View>
  );
}

function AiAnalyticsToolTile({
  icon: Icon,
  title,
  summary,
  active,
  onPress,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  summary: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.analyticsToolTile, active && styles.analyticsToolTileActive]}>
      <View style={styles.analyticsToolTileIcon}>
        <Icon size={16} color={active ? C.green : C.purple} strokeWidth={2.3} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={styles.analyticsToolTileTitle}>{title}</Text>
        <Text style={styles.analyticsToolTileSummary} numberOfLines={1}>
          {truncateCoachLine(summary, 72)}
        </Text>
      </View>
      <ChevronRight size={16} color={active ? C.green : C.sub} strokeWidth={2.4} />
    </Pressable>
  );
}

function AiAnalyticsToolMenu({
  operatingSystem,
  patterns,
  stats,
  tradeAnalysis,
  activeTool,
  onSelect,
}: {
  operatingSystem: AiOperatingSystem;
  patterns: PatternDetectionResult;
  stats: ReturnType<typeof calcStats>;
  tradeAnalysis: TradeAnalysisResult | null;
  activeTool: AiAnalyticsToolId | null;
  onSelect: (tool: AiAnalyticsToolId) => void;
}) {
  const dnaSummary =
    operatingSystem.tradingDna.profile?.traderType ||
    operatingSystem.tradingDna.emptyState?.title ||
    "Classify your trading style";
  const evidenceSummary =
    operatingSystem.evidence.sessionImpact[0] ||
    operatingSystem.evidence.behaviorPatterns[0] ||
    "Journal-backed proof";
  const growthSummary =
    operatingSystem.growth.recommendation?.title ||
    operatingSystem.growth.emptyState?.title ||
    "Track period-over-period progress";
  const marketSummary =
    operatingSystem.marketAssistant.actions.find((action) => action.enabled)?.label ||
    "Market and journal actions";
  const patternSummary =
    patterns.risks[0]?.title ||
    tradeAnalysis?.mistakes[0]?.title ||
    "Scan hidden leaks and revenge risk";
  const monthlySummary =
    tradeAnalysis?.strengths[0]?.title ||
    stats.bySetup[0]?.label ||
    "Monthly performance review";

  const tiles: { id: AiAnalyticsToolId; icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; title: string; summary: string }[] = [
    { id: "dna", icon: Sparkles, title: "Trading DNA", summary: dnaSummary },
    { id: "evidence", icon: ShieldCheck, title: "Evidence", summary: evidenceSummary },
    { id: "growth", icon: TrendingUp, title: "Growth", summary: growthSummary },
    { id: "market", icon: Newspaper, title: "Market Brief", summary: marketSummary },
    { id: "patterns", icon: Target, title: "Pattern Leaks", summary: patternSummary },
    { id: "monthly", icon: CalendarDays, title: "Monthly Review", summary: monthlySummary },
  ];

  return (
    <TerminalGlassCard style={styles.analyticsToolMenuCard}>
      <Text style={styles.terminalSmallLabel}>ANALYTICS TOOLS</Text>
      <Text style={styles.coachCompactHeadline}>Open one report at a time</Text>
      <View style={styles.analyticsToolGrid}>
        {tiles.map((tile) => (
          <AiAnalyticsToolTile
            key={tile.id}
            icon={tile.icon}
            title={tile.title}
            summary={tile.summary}
            active={activeTool === tile.id}
            onPress={() => {
              lightHaptic();
              onSelect(tile.id);
            }}
          />
        ))}
      </View>
    </TerminalGlassCard>
  );
}


function TradeVisionEntryCard({
  expanded,
  onToggle,
  userId,
}: {
  expanded: boolean;
  onToggle: () => void;
  userId: string | null;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Pressable onPress={onToggle} style={styles.tradeVisionEntryCard}>
        <View style={styles.tradeVisionIconOrbSmall}>
          <ImagePlus size={17} color={C.purple} strokeWidth={2.3} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={styles.workflowNextLabel}>Screenshot coach</Text>
          <Text style={styles.coachCompactHeadline}>Trade Vision</Text>
          <Text style={styles.coachCompactSub}>Upload one chart and ask what happened — client-only preview.</Text>
        </View>
        <ChevronRight size={16} color={expanded ? C.green : C.sub} strokeWidth={2.4} style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }} />
      </Pressable>
      {expanded ? <TradeVisionCoachSection userId={userId} /> : null}
    </View>
  );
}

function AiAnalysisScreen({
  lang,
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
  onOpenJournal,
  onOpenNews,
}: {
  lang: Lang;
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
  onOpenJournal?: () => void;
  onOpenNews?: () => void;
}) {
  const { range, anchorDate } = useStatsTimeRange();
  const [selectedDate] = useState(anchorDate);
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
  const safeAnalysisTemplates = propTemplates;
  const [analysisTemplateKey, setAnalysisTemplateKey] = useState("");
  const [propMode, setPropMode] = useState<FirmMode>("evaluation");
  const screenActiveRef = useRef(true);

  useEffect(() => {
    screenActiveRef.current = true;
    return () => {
      screenActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      AsyncStorage.getItem("prop-risk-template-v1"),
      AsyncStorage.getItem("prop-risk-mode-v1"),
    ]).then(([savedTemplate, savedMode]) => {
      if (!mounted) return;
      const nextKey = resolvePropTemplateKey(savedTemplate || "", safeAnalysisTemplates);
      if (nextKey) setAnalysisTemplateKey(nextKey);
      if (savedMode === "evaluation" || savedMode === "funded") setPropMode(savedMode);
    });
    return () => {
      mounted = false;
    };
  }, [safeAnalysisTemplates]);
  const changeAnalysisTemplate = useCallback((key: string) => {
    setAnalysisTemplateKey(key);
    AsyncStorage.setItem("prop-risk-template-v1", key).catch(() => {});
  }, []);
  const changePropMode = useCallback((mode: FirmMode) => {
    setPropMode(mode);
    AsyncStorage.setItem("prop-risk-mode-v1", mode).catch(() => {});
  }, []);

  const periodTrades = useFilteredTrades(trades);
  const periodStats = useMemo(() => calcStats(periodTrades), [periodTrades]);
  const tradingScore = useMemo(() => tradingScoreForTrades(periodTrades), [periodTrades]);
  const patterns = useMemo(() => detectTradingPatterns(periodTrades), [periodTrades]);
  const activeTemplate =
    analysisTemplateKey
      ? safeAnalysisTemplates.find((template) => template.key === analysisTemplateKey) || null
      : null;
  const propSnapshot = useMemo(
    () =>
      activeTemplate
        ? tryComputePropRiskSnapshot({
            trades,
            selectedDate,
            templateKey: activeTemplate.key,
            mode: "evaluation",
            templates: safeAnalysisTemplates,
            phase: mapLegacyFirmMode("evaluation"),
          })
        : null,
    [trades, selectedDate, activeTemplate, safeAnalysisTemplates],
  );
  const fundedSnapshot = useMemo(
    () =>
      activeTemplate
        ? tryComputePropRiskSnapshot({
            trades,
            selectedDate,
            templateKey: activeTemplate.key,
            mode: "funded",
            templates: safeAnalysisTemplates,
            phase: "funded",
          })
        : null,
    [trades, selectedDate, activeTemplate, safeAnalysisTemplates],
  );
  const selectedPropSnapshot = propMode === "funded" ? fundedSnapshot : propSnapshot;
  const passProbability = useMemo(
    () =>
      activeTemplate
        ? calculatePassProbability({ trades, selectedDate, template: activeTemplate })
        : { probability: 0, status: "DANGER" as const, explanation: "Select a prop firm template synced from Supabase.", confidence: "low" as const },
    [trades, selectedDate, activeTemplate],
  );
  const aiPropContext = useMemo(
    () =>
      selectedPropSnapshot?.engine
        ? buildAiPropContextFromEngine(selectedPropSnapshot.engine, passProbability.probability)
        : selectedPropSnapshot
          ? {
              mode: propMode,
              status: selectedPropSnapshot.status,
              templateLabel: selectedPropSnapshot.template.label,
              dailyRemaining: selectedPropSnapshot.dailyRemaining,
              accountRemaining: selectedPropSnapshot.accountRemaining,
              remainingToPass: selectedPropSnapshot.remainingToPass,
              dailyLossLimit: selectedPropSnapshot.template.dailyLossLimit,
              maxLossLimit: selectedPropSnapshot.template.maxLossLimit,
              passProbability: passProbability.probability,
              bufferPct: selectedPropSnapshot.bufferPct,
            }
          : undefined,
    [passProbability.probability, propMode, selectedPropSnapshot],
  );
  const revengeTrading = useMemo(
    () => detectRevengeTrading({ trades, selectedDate, dangerMode: passProbability.status === "DANGER" }),
    [trades, selectedDate, passProbability.status],
  );
  const hiddenLeaks = useMemo(() => detectHiddenLeaks(trades), [trades]);
  const aiCoachPayload = useMemo(
    () => ({
      period: range,
      selectedDate,
      stats: periodStats,
      analyticsContext: buildAIAnalyticsContext(periodTrades),
      tradeAnalysisPayload: buildTradeAnalysisPayload(periodTrades, periodStats, range, { passProbability, propSnapshot }),
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
  const unifiedInsights = useMemo(
    () =>
      buildAiInsights({
        trades: periodTrades,
        stats: periodStats,
        prop: aiPropContext,
        patterns,
        revengeRisk: revengeTrading,
      }),
    [aiPropContext, patterns, periodStats, periodTrades, revengeTrading],
  );
  const aiAchievements = useMemo(
    () =>
      buildAiAchievements({
        trades: periodTrades,
        stats: periodStats,
        prop: aiPropContext,
        patterns,
        revengeRisk: revengeTrading,
      }),
    [aiPropContext, patterns, periodStats, periodTrades, revengeTrading],
  );
  const operatingSystem = useMemo(
    () =>
      buildAiOperatingSystem({
        trades: periodTrades,
        stats: periodStats,
        prop: aiPropContext,
        patterns,
        revengeRisk: revengeTrading,
        createdAt: `${selectedDate}T00:00:00.000Z`,
      }),
    [aiPropContext, patterns, periodStats, periodTrades, revengeTrading, selectedDate],
  );
  const tradeVisionJournalContext = useMemo(
    () => ({
      tradeCount: periodStats.count,
      winRate: periodStats.wr,
      profitFactor: periodStats.pf,
      expectancy: periodStats.exp,
      averageLoss: periodStats.avgLoss,
      maxDrawdown: periodStats.maxDd,
      bestSession: periodStats.session[0]?.label || null,
      revengeRisk: {
        severity: revengeTrading.severity,
        detected: revengeTrading.detected,
        reason: revengeTrading.reason,
        recommendation: revengeTrading.recommendation,
      },
      topRisks: patterns.risks.slice(0, 3).map((risk) => ({
        title: risk.title,
        detail: risk.detail,
      })),
      recentTrades: periodTrades.slice(0, 8).map((trade) => ({
        date: trade.date,
        symbol: trade.symbol,
        direction: trade.direction,
        pnl: trade.pnl,
        mood: trade.mood,
        tags: trade.tags?.slice(0, 4) || [],
      })),
    }),
    [patterns.risks, periodStats, periodTrades, revengeTrading],
  );

  const runCoachFeature = async (key: keyof AIResultMap) => {
    if (!isPremium || !getLimitsForUser(isPremium).paidAiAnalysis) {
      warningHaptic();
      Alert.alert(t("premiumAccess"), t("paidAiPaywall"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("unlockPro"), onPress: () => onPurchase(packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null, YOU_TRADER_MONTHLY_PRODUCT_ID) },
      ]);
      return;
    }
    lightHaptic();
    setAiBusy((prev) => ({ ...prev, [key]: true }));
    try {
      const cacheKey = localAiCacheKey(
        `assistant-${key}`,
        session?.user.id || null,
        hashLocalAiInput({ key, payload: aiCoachPayload }),
      );
      const cached = await readLocalAiResponse<NonNullable<AIResultMap[typeof key]>>(cacheKey);
      if (cached) {
        if (screenActiveRef.current) {
          setAiResults((prev) => ({ ...prev, [key]: cached }));
        }
        successHaptic();
        return;
      }
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
      if (!screenActiveRef.current) return;
      setAiResults((prev) => ({ ...prev, [key]: response }));
      if (!response.usedFallback) {
        await writeLocalAiResponse(cacheKey, response, AI_ASSISTANT_CACHE_TTL_MS);
      }
      successHaptic();
      trackEvent("ai_coach_feature_generated", {
        feature: key,
        provider_status: response.providerStatus,
        used_fallback: response.usedFallback,
      });
    } finally {
      if (screenActiveRef.current) {
        setAiBusy((prev) => ({ ...prev, [key]: false }));
      }
    }
  };

  const runTradeAnalysis = async () => {
    if (!isPremium) {
      Alert.alert(t("premiumAccess"), t("aiTradeAnalysisPro"), [
        { text: t("ok") },
        { text: t("unlockPro"), onPress: () => onPurchase(packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null, YOU_TRADER_MONTHLY_PRODUCT_ID) },
      ]);
      return;
    }
    if (!periodTrades.length) {
      Alert.alert(t("aiTradeAnalysis"), t("addTradesFirstAnalysis"));
      return;
    }
    try {
      setTradeAnalysisBusy(true);
      setTradeAnalysisError("");
      trackEvent("ai_trade_analysis_opened", { period: range, trade_count: periodTrades.length });
      trackEvent("ai_analysis_opened", { period: range, trade_count: periodTrades.length });
      const payload = buildTradeAnalysisPayload(periodTrades, periodStats, range, { passProbability, propSnapshot });
      const result = await analyzeTrades(payload);
      if (!screenActiveRef.current) return;
      setTradeAnalysis(result);
      successHaptic();
      trackEvent("ai_trade_analysis_generated", { period: range, source: "edge_function", trade_count: periodTrades.length });
      trackEvent("ai_pattern_detective_generated", {
        period: range,
        trade_count: periodTrades.length,
        detective_score: result.detectiveScore,
      });
      recordMetric("ai_trade_analysis_completed", 1, { source: "edge_function" });
    } catch (error) {
      trackEvent("ai_trade_analysis_failed", { period: range, trade_count: periodTrades.length });
      trackEvent("ai_pattern_detective_failed", { period: range, trade_count: periodTrades.length });
      logger.error(error, { feature: "ai_trade_analysis", action: "generate_failed", period: range });
      const fallback = buildLocalTradeAnalysisResult(periodStats, buildMistakePatterns(periodStats));
      if (screenActiveRef.current) {
        setTradeAnalysis(fallback);
        setTradeAnalysisError(t("aiUnavailableLocal"));
      }
    } finally {
      if (screenActiveRef.current) {
        setTradeAnalysisBusy(false);
      }
    }
  };

  if (!isPremium) {
    return (
      <AiAnalyticsProScreen
        packages={packages}
        storeProducts={storeProducts}
        purchaseBusy={purchaseBusy}
        paywallError={paywallError}
        showRestorePurchases={showRestorePurchases}
        monthlyProductId={YOU_TRADER_MONTHLY_PRODUCT_ID}
        fallbackPrice={PREMIUM_PRICE}
        packageTitle={packageTitle}
        packagePrice={packagePrice}
        onPurchase={onPurchase}
        onRestore={onRestore}
      />
    );
  }

  if (!periodTrades.length) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: 46 }]}>
        <EmptyStateCard
          tone="purple"
          title={t("aiEmptyTitle")}
          message={t("aiEmptyMessage")}
          icon={<BrainCircuit size={24} color={C.purple} strokeWidth={2.4} />}
          actionLabel={t("goToJournal")}
          onActionPress={onOpenJournal}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: 46 }]}>
      <View style={styles.terminalScreenStack}>
        <AiTradingAssistantBlock
          operatingSystem={operatingSystem}
          patterns={patterns}
          stats={periodStats}
          trades={periodTrades}
          tradeAnalysis={tradeAnalysis}
          tradeAnalysisBusy={tradeAnalysisBusy}
          tradeAnalysisError={tradeAnalysisError}
          aiResults={aiResults}
          aiBusy={aiBusy}
          onRunCoachFeature={runCoachFeature}
          onRunTradeAnalysis={runTradeAnalysis}
          onOpenNews={onOpenNews}
        />
        {tradeAnalysis ? <TradeAnalysisCard result={tradeAnalysis} /> : null}
        <View style={styles.aiHubSecondaryStack}>
          <PropCoachQuickCard
            snapshot={selectedPropSnapshot}
            templates={safeAnalysisTemplates}
            templateKey={analysisTemplateKey}
            propMode={propMode}
            operatingSystem={operatingSystem}
            passProbability={passProbability}
            stats={periodStats}
            trades={periodTrades}
            revengeTrading={revengeTrading}
            onTemplateChange={changeAnalysisTemplate}
            onModeChange={changePropMode}
          />
          <TradeVisionCoachSection
            userId={session?.user.id || null}
            journalContext={tradeVisionJournalContext}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function InstrumentButton({
  symbol,
  active,
  onPress,
  testIDPrefix,
}: {
  symbol: string;
  active: boolean;
  onPress: () => void;
  testIDPrefix?: string;
}) {
  const a11yId = testIDPrefix ? `${testIDPrefix}.${symbol}` : undefined;
  return (
    <AnimatedPressable
      press="listItem"
      haptic
      onPress={onPress}
      testID={a11yId}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={a11yId || symbol}
      style={[styles.instrumentBtn, active && styles.instrumentBtnActive]}
      contentStyle={{ minHeight: 0, minWidth: 0, justifyContent: "center" }}
    >
      <Text style={styles.instrumentSymbol} maxFontSizeMultiplier={1.25}>
        {symbol}
      </Text>
      <Text style={styles.instrumentName} maxFontSizeMultiplier={1.2}>
        {INSTRUMENTS[symbol]?.name || symbol}
      </Text>
    </AnimatedPressable>
  );
}

function buildFirstInsight(trades: Trade[], stats: ReturnType<typeof calcStats>) {
  if (trades.length < 5) return null;
  const bestSession = stats.session[0];
  const worstSession = [...stats.session].sort((a, b) => a.pnl - b.pnl)[0];
  const hourlyCells = buildSessionHeatmap(trades).filter((item) => item.tradeCount > 0);
  const bestHour = [...hourlyCells].sort((a, b) => b.pnl - a.pnl)[0];
  const worstHour = [...hourlyCells].sort((a, b) => a.pnl - b.pnl)[0];
  if (stats.avgLoss && stats.avgWin && Math.abs(stats.avgLoss) > stats.avgWin) {
    return {
      title: t("microFirstInsight"),
      text: `Your average loss (${moneyCompact(stats.avgLoss)}) is bigger than your average win (${moneyCompact(stats.avgWin)}). Protect risk before chasing more trades.`,
    };
  }
  if (worstHour && worstHour.pnl < 0) {
    return {
      title: t("microFirstInsight"),
      text: `Your worst trading hour is ${worstHour.label}. That window is costing ${moneyCompact(worstHour.pnl)} in this sample.`,
    };
  }
  if (bestSession) {
    return {
      title: t("microFirstInsight"),
      text: `Your best session is ${bestSession.label}. It has produced ${moneyCompact(bestSession.pnl)} across your logged trades.`,
    };
  }
  if (bestHour && worstHour && bestHour.label !== worstHour.label) {
    return {
      title: t("microFirstInsight"),
      text: `Your win rate and P&L are stronger around ${bestHour.label} than ${worstHour.label}.`,
    };
  }
  return {
    title: t("microFirstInsight"),
    text: `You have enough data for a first sample: ${trades.length} trades, ${stats.wr.toFixed(0)}% win rate, ${moneyCompact(stats.pnl)} net P&L.`,
  };
}

function JournalScreen({
  lang,
  trades,
  propTemplates,
  setTrades,
  isPremium,
  packages,
  storeProducts,
  purchaseBusy,
  paywallError,
  showRestorePurchases,
  onOpenPropRisk,
  onUpgrade,
  onPurchase,
  onRestore,
  onTradeDeleted,
  onContinueToReview,
  cloudSyncEnabled,
  cloudSyncStatus,
  qaApplyEditRequest,
  onQaApplyEditConsumed,
}: {
  lang: Lang;
  trades: Trade[];
  propTemplates: RiskTemplate[];
  setTrades: React.Dispatch<React.SetStateAction<Trade[]>>;
  isPremium: boolean;
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  onOpenPropRisk: (date: string) => void;
  onUpgrade: () => void;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
  onTradeDeleted: (tradeId: string) => void;
  onContinueToReview?: () => void;
  cloudSyncEnabled?: boolean;
  cloudSyncStatus?: "off" | "syncing" | "synced" | "error";
  qaApplyEditRequest?: { url: string; nonce: number } | null;
  onQaApplyEditConsumed?: () => void;
}) {
  const { width } = useWindowDimensions();
  const isTabletLayout = width >= 768;
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [audioReady, setAudioReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [tradePnlSign, setTradePnlSign] = useState<TradePnlSign>("plus");
  const [tradeContextExpanded, setTradeContextExpanded] = useState(false);
  const [executionDetailsExpanded, setExecutionDetailsExpanded] = useState(false);
  const [marketType, setMarketType] = useState<"emini" | "micro" | "custom">("emini");
  const [photoView, setPhotoView] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [symbolIsCustom, setSymbolIsCustom] = useState(false);
  const [savingTrade, setSavingTrade] = useState(false);
  const [valueModal, setValueModal] = useState<ProValueModalContent>({ visible: false, reason: "pro_feature", title: "YouTrader Pro", message: t("unlockSeriousTraderTools") });
  const [firstInsightDismissed, setFirstInsightDismissed] = useState(false);
  const [lockedInsightDismissed, setLockedInsightDismissed] = useState(false);
  const [deleteDayDate, setDeleteDayDate] = useState<string | null>(null);
  const [deleteDayBusy, setDeleteDayBusy] = useState(false);
  const [deleteTradeConfirmId, setDeleteTradeConfirmId] = useState<string | null>(null);
  const [deleteTradeBusy, setDeleteTradeBusy] = useState(false);
  const [tradeActionTarget, setTradeActionTarget] = useState<Trade | null>(null);
  const [deleteToastKey, setDeleteToastKey] = useState<string | null>(null);
  const [postSavePrompt, setPostSavePrompt] = useState(false);
  const deleteToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const journalMountedRef = useRef(true);
  const lastSaveAtRef = useRef(0);
  const firstInsightSeenRef = useRef(false);
  const lockedInsightSeenRef = useRef(false);
  const tradesRef = useRef(trades);
  tradesRef.current = trades;
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
  const dayCellHeight = Math.max(84, Math.min(isTabletLayout ? 118 : 104, Math.round(dayCellWidth * 1.55)));
  const years = useMemo(
    () => Array.from({ length: 9 }, (_, index) => viewMonth.getFullYear() - 4 + index),
    [viewMonth],
  );
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
  useEffect(() => {
    journalMountedRef.current = true;
    return () => {
      journalMountedRef.current = false;
      if (deleteToastTimerRef.current) clearTimeout(deleteToastTimerRef.current);
    };
  }, []);
  useEffect(() => {
    if (isPremium && valueModal.visible) {
      setValueModal((prev) => ({ ...prev, visible: false }));
    }
  }, [isPremium, valueModal.visible]);
  const showDeleteToast = useCallback((messageKey = "journalTradeDeletedToast") => {
    if (deleteToastTimerRef.current) clearTimeout(deleteToastTimerRef.current);
    if (!journalMountedRef.current) return;
    setDeleteToastKey(messageKey);
    deleteToastTimerRef.current = setTimeout(() => {
      if (journalMountedRef.current) setDeleteToastKey(null);
    }, 2200);
  }, []);
  const filtered = useMemo(
    () => trades.filter((x) => x.date === selectedDate),
    [trades, selectedDate],
  );
  const rangedTrades = useFilteredTrades(trades);
  const monthlyTradeCount = useMemo(() => monthlyLoggedTradeCount(trades), [trades]);
  const journalStats = useMemo(() => calcStats(rangedTrades), [rangedTrades]);
  const firstInsight = useMemo(() => buildFirstInsight(rangedTrades, journalStats), [rangedTrades, journalStats]);
  const lockedInsightKey = `locked-insight-dismissed:${usageMonthKey()}`;
  const firstInsightVisible = !firstInsightDismissed && !!firstInsight;
  const lockedInsightVisible = !isPremium && !lockedInsightDismissed && trades.length >= 7 && trades.length <= 10;
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem("first-insight-dismissed:5").then((value) => {
      if (mounted) setFirstInsightDismissed(value === "true");
    }).catch(() => {});
    AsyncStorage.getItem(lockedInsightKey).then((value) => {
      if (mounted) setLockedInsightDismissed(value === "true");
    }).catch(() => {});
    return () => {
      mounted = false;
    };
  }, [lockedInsightKey]);
  useEffect(() => {
    if (!firstInsightVisible || firstInsightSeenRef.current) return;
    firstInsightSeenRef.current = true;
    trackEvent("first_insight_seen", { trade_count: trades.length, is_pro: isPremium });
  }, [firstInsightVisible, isPremium, trades.length]);
  useEffect(() => {
    if (!lockedInsightVisible || lockedInsightSeenRef.current) return;
    lockedInsightSeenRef.current = true;
    trackEvent("locked_insight_seen", { trade_count: trades.length, is_pro: isPremium });
  }, [isPremium, lockedInsightVisible, trades.length]);
  const dismissFirstInsight = useCallback(() => {
    setFirstInsightDismissed(true);
    AsyncStorage.setItem("first-insight-dismissed:5", "true").catch(() => {});
  }, []);
  const dismissLockedInsight = useCallback(() => {
    setLockedInsightDismissed(true);
    AsyncStorage.setItem(lockedInsightKey, "true").catch(() => {});
  }, [lockedInsightKey]);
  const openTradeLimitModal = useCallback(() => {
    trackEvent("trade_limit_reached", { limit: FREE_MONTHLY_TRADE_LIMIT });
    setValueModal({
      visible: true,
      reason: "trade_limit",
      title: TRADE_LIMIT_PAYWALL.title,
      message: TRADE_LIMIT_PAYWALL.subtitle,
      bullets: ["Unlimited monthly trades", "Performance Analytics and Market Pulse", "Premium exports and analytics"],
      primaryTrial: true,
    });
  }, []);
  const openLockedInsightModal = useCallback(() => {
    setValueModal({
      visible: true,
      reason: "locked_insight",
      title: t("hiddenLeaksFoundTitle"),
      message: "Unlock Pro to see exactly which session, setup, and behavior is costing you money.",
      bullets: ["Hidden Leaks from your own trades", "Revenge Alerts after emotional sequences", "Pattern Detective and Prop Firm Coach"],
      primaryTrial: true,
    });
  }, []);
  const showProGate = useCallback(
    (feature: string) => {
      Alert.alert(t("premiumAccess"), t("featureIncludedInPro", { feature }), [
        { text: t("close"), style: "cancel" },
        { text: "Unlock Pro", onPress: onUpgrade },
      ]);
    },
    [onUpgrade, t],
  );
  const openDeleteDayConfirm = useCallback((date: string) => {
    const dayTrades = trades.filter((trade) => trade.date === date);
    if (!dayTrades.length) return;
    lightHaptic();
    setSelectedDate(date);
    setDeleteDayDate(date);
  }, [trades]);

  const monthDays = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) =>
      isoFromDate(new Date(y, m, i + 1)),
    );
  }, [viewMonth]);
  const monthTimeline = useMemo(() => {
    const prefix = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, "0")}`;
    const dayPnl = new Map<string, number>();
    for (const trade of trades) {
      if (!trade.date.startsWith(prefix)) continue;
      dayPnl.set(trade.date, (dayPnl.get(trade.date) || 0) + trade.pnl);
    }
    let monthPnlTotal = 0;
    let greenDays = 0;
    let redDays = 0;
    let maxAbs = 0;
    for (const pnl of dayPnl.values()) {
      monthPnlTotal += pnl;
      maxAbs = Math.max(maxAbs, Math.abs(pnl));
      if (pnl > 0) greenDays += 1;
      else if (pnl < 0) redDays += 1;
    }
    return { dayPnl, monthPnlTotal, greenDays, redDays, maxAbs, tradedDays: dayPnl.size };
  }, [trades, viewMonth]);
  const selectedDayPnl = monthTimeline.dayPnl.get(selectedDate);
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
    if (!isPremium && monthlyTradeCount >= FREE_MONTHLY_TRADE_LIMIT) {
      openTradeLimitModal();
      return;
    }
    setSelectedDate(date);
    setDayPanelOpen(false);
    setEditId(null);
    setSymbolIsCustom(false);
    setMarketType("micro");
    setTradeContextExpanded(false);
    setExecutionDetailsExpanded(false);
    setTradePnlSign("plus");
    setForm({ ...emptyForm, entryTime: formatClockFromDate() });
    setModal(true);
  };
  const openEdit = (tr: Trade) => {
    setEditId(tr.id);
    setDayPanelOpen(false);
    const isMini = (MINI_INSTRUMENTS as readonly string[]).includes(tr.symbol);
    const isMicro = (MICRO_INSTRUMENTS as readonly string[]).includes(tr.symbol);
    const preset = isMini || isMicro;
    setSymbolIsCustom(!preset);
    setMarketType(isMini ? "emini" : isMicro ? "micro" : "custom");
    setTradeContextExpanded(false);
    setExecutionDetailsExpanded(false);
    const signedPnl = Number(tr.pnl) || 0;
    setTradePnlSign(inferTradePnlSign(signedPnl));
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
      pnl: formatAbsolutePnlAmount(signedPnl),
      mood: tr.mood,
      notes: tr.notes || "",
      tags: tagsToInput(tr.tags),
      photoUri: tr.photoUri || "",
      voiceUri: tr.voiceUri || "",
      voiceName: tr.voiceName || "",
    });
    setModal(true);
  };
  // Staging QA: parent deep-link sets qaApplyEditRequest; form patches + real save() via Save button.
  useEffect(() => {
    if (!qaApplyEditRequest?.url) return;
    const requestUrl = qaApplyEditRequest.url;
    const requestNonce = qaApplyEditRequest.nonce;
    const tradesNow = tradesRef.current;
    let cancelled = false;
    (async () => {
      const {
        isStagingQaJournalSeedAllowed,
        parseStagingQaApplyTradeEditUrl,
        parseStagingQaTradeOverrides,
      } = await import("../qa/stagingQaJournalSeed");
      if (cancelled) return;
      if (!isStagingQaJournalSeedAllowed() || !parseStagingQaApplyTradeEditUrl(requestUrl)) {
        onQaApplyEditConsumed?.();
        return;
      }
      const overrides = parseStagingQaTradeOverrides(requestUrl);
      const marker = overrides.marker || "";
      const notesHint = overrides.notes || "";
      const target =
        tradesNow.find((tr) => marker && (tr.notes || "").includes(marker)) ||
        tradesNow.find((tr) => notesHint && (tr.notes || "").includes(notesHint.replace(/-EDITED$/, ""))) ||
        tradesNow.find((tr) => notesHint && (tr.notes || "") === notesHint) ||
        tradesNow.find((tr) => String(tr.id || "").startsWith("qa-seed-")) ||
        null;
      if (!target) {
        console.info("[YTQA] apply-trade-edit miss", {
          hasMarker: !!marker,
          tradeCount: tradesNow.length,
          nonce: requestNonce,
        });
        onQaApplyEditConsumed?.();
        return;
      }
      const nextPnl = overrides.pnl != null ? overrides.pnl : target.pnl;
      setEditId(target.id);
      const preset = (MINI_INSTRUMENTS as readonly string[]).includes(target.symbol)
        || (MICRO_INSTRUMENTS as readonly string[]).includes(target.symbol);
      setSymbolIsCustom(!preset);
      setForm({
        symbol: target.symbol,
        direction: target.direction,
        entryTime: target.entryTime || "",
        exitTime: target.exitTime || "",
        entry: String(overrides.entry ?? (target.entry != null ? target.entry : "")),
        exit: String(overrides.exit ?? (target.exit != null ? target.exit : "")),
        contracts: String(overrides.contracts ?? target.contracts ?? 1),
        stopLoss: target.stopLoss != null ? String(target.stopLoss) : "",
        takeProfit: target.takeProfit != null ? String(target.takeProfit) : "",
        pnl: String(nextPnl),
        mood: target.mood,
        notes: overrides.notes ?? target.notes ?? "",
        tags: tagsToInput(target.tags),
        photoUri: target.photoUri || "",
        voiceUri: target.voiceUri || "",
        voiceName: target.voiceName || "",
      });
      setModal(true);
      console.info("[YTQA] apply-trade-edit ok", {
        idPrefix: String(target.id).slice(0, 20),
        hasNotesOverride: overrides.notes != null,
        hasPnlOverride: overrides.pnl != null,
        hasExitOverride: overrides.exit != null,
        nonce: requestNonce,
      });
      onQaApplyEditConsumed?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [qaApplyEditRequest?.nonce, onQaApplyEditConsumed]);
  const executeTradeDelete = useCallback(
    async (tradeId: string, opts?: { suppressFeedback?: boolean }): Promise<boolean> => {
      const limit = await checkClientRateLimit("trade:delete", "journal-local");
      if (!limit.allowed) {
        Alert.alert("YouTrader", SECURITY_MESSAGES.rateLimited);
        return false;
      }
      try {
        onTradeDeleted(tradeId);
        setTrades((prev) => prev.filter((x) => x.id !== tradeId));
        publishPropPassJournalMutation({
          tradeClientId: tradeId,
          kind: "deleted",
          occurredAt: new Date().toISOString(),
        });
        trackEvent("trade_deleted", { source: "manual" });
        if (editId === tradeId) setModal(false);
        if (!opts?.suppressFeedback) {
          successHaptic();
          showDeleteToast();
        }
        return true;
      } catch {
        return false;
      }
    },
    [editId, onTradeDeleted, setTrades, showDeleteToast],
  );
  const confirmDeleteTrade = useCallback((tradeId: string) => {
    // App-owned YDL confirmation — native Alert.alert is not reliably automatable on iOS.
    // Dismiss the edit modal first so the confirmation Modal is not buried under it.
    setModal(false);
    setDeleteTradeConfirmId(tradeId);
  }, []);
  const cancelDeleteTradeConfirm = useCallback(() => {
    if (deleteTradeBusy) return;
    setDeleteTradeConfirmId(null);
  }, [deleteTradeBusy]);
  const performDeleteTradeConfirm = useCallback(async () => {
    if (!deleteTradeConfirmId || deleteTradeBusy) return;
    setDeleteTradeBusy(true);
    warningHaptic();
    try {
      const ok = await executeTradeDelete(deleteTradeConfirmId);
      if (ok) setDeleteTradeConfirmId(null);
    } finally {
      setDeleteTradeBusy(false);
    }
  }, [deleteTradeBusy, deleteTradeConfirmId, executeTradeDelete]);
  const confirmDeleteDay = useCallback(async () => {
    if (!deleteDayDate || deleteDayBusy) return;
    const dayTrades = trades.filter((trade) => trade.date === deleteDayDate);
    if (!dayTrades.length) {
      setDeleteDayDate(null);
      return;
    }
    warningHaptic();
    setDeleteDayBusy(true);
    const tradeIds = dayTrades.map((trade) => trade.id);
    try {
      await recordSecurityEvent("delete_trading_day_confirmed", "trade:delete", "journal-local");
      let deletedCount = 0;
      for (const tradeId of tradeIds) {
        const ok = await executeTradeDelete(tradeId, { suppressFeedback: true });
        if (!ok) break;
        deletedCount += 1;
      }
      if (deletedCount === tradeIds.length) {
        trackEvent("day_deleted", { trade_count: tradeIds.length });
        successHaptic();
        showDeleteToast("journalDayDeletedToast");
        setDeleteDayDate(null);
      } else {
        showDeleteToast("journalDayDeleteFailedToast");
        if (deletedCount > 0) setDeleteDayDate(null);
      }
    } catch {
      showDeleteToast("journalDayDeleteFailedToast");
    } finally {
      setDeleteDayBusy(false);
    }
  }, [deleteDayBusy, deleteDayDate, executeTradeDelete, showDeleteToast, trades]);
  const openTradeActions = useCallback((tr: Trade) => {
    lightHaptic();
    setTradeActionTarget(tr);
  }, []);
  const calcPnl = (): number | null => {
    const resolved = resolveSignedTradePnl(form.pnl, tradePnlSign);
    return resolved.ok ? resolved.pnl : null;
  };
  const calcExecutionPreview = (): number | null => {
    const i = INSTRUMENTS[normalizeSymbolInput(form.symbol)];
    if (!i || !form.entry || !form.exit) return null;
    const diff =
      form.direction === "LONG"
        ? toNum(form.exit) - toNum(form.entry)
        : toNum(form.entry) - toNum(form.exit);
    const preview = Number(
      ((diff / i.tickSize) * i.tickValue * Number(form.contracts || 1)).toFixed(2),
    );
    return Number.isFinite(preview) ? preview : null;
  };
  const save = async () => {
    if (savingTrade) return;
    setSavingTrade(true);
    try {
      const action = editId ? "trade:update" : "trade:create";
      if (!isPremium && !editId && monthlyTradeCount >= FREE_MONTHLY_TRADE_LIMIT) {
        openTradeLimitModal();
        return;
      }
      const limit = await peekClientRateLimit(action, "journal-local", "trade_save");
      if (!limit.allowed) {
        Alert.alert("YouTrader", SECURITY_MESSAGES.rateLimited);
        return;
      }
      const now = Date.now();
      // Double-tap guard only — failed validations must remain retryable (see lastSaveAt below).
      if (now - lastSaveAtRef.current < TRADE_SAVE_DEBOUNCE_MS) return;
      const validated = validateTradeForm(form, lang, {
        pnlSign: tradePnlSign,
      });
      if ("error" in validated) {
        Alert.alert(t("couldNotSaveTrade"), validated.error || t("checkTradeDetails"));
        return;
      }
      const safe = validated.value;
      if (!safe) {
        Alert.alert(t("couldNotSaveTrade"), t("checkTradeDetails"));
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
      // Only debounce successful validations so failed saves remain retryable.
      lastSaveAtRef.current = now;
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
      photoUri: safe.photoUri || null,
      voiceUri: isPremium ? safe.voiceUri || null : null,
      photoCloudUri: previousTrade?.photoUri === safe.photoUri ? previousTrade?.photoCloudUri || null : null,
      voiceCloudUri: isPremium && previousTrade?.voiceUri === safe.voiceUri ? previousTrade?.voiceCloudUri || null : null,
      voiceName: isPremium && safe.voiceUri ? safeText(form.voiceName || t("voiceNoteName"), 128) : null,
      createdAt: editId ? (previousTrade?.createdAt || now) : now,
      updatedAt: now,
    };
      const saved = await runIdempotentLocal(action, "journal-local", item, () => {
        setTrades((prev) =>
          editId ? prev.map((x) => (x.id === editId ? item : x)) : [item, ...prev],
        );
        return { tradeId: item.id, updatedAt: item.updatedAt };
      });
      if (!saved.duplicate) {
        await consumeClientRateLimit(action, "journal-local");
        publishPropPassJournalMutation({
          tradeClientId: item.id,
          kind: previousTrade ? "updated" : "created",
          occurredAt: new Date(item.updatedAt).toISOString(),
        });
      }
      successHaptic();
      if (!editId) {
        trackEvent("trade_added", {
          source: "manual",
          pnl_result: item.pnl > 0 ? "win" : item.pnl < 0 ? "loss" : "flat",
          has_screenshot: !!item.photoUri,
          has_voice: !!item.voiceUri,
          tag_count: item.tags?.length || 0,
        });
      }
      setModal(false);
      setPostSavePrompt(true);
    } finally {
      setSavingTrade(false);
    }
  };
  const remove = () => {
    if (!editId) return;
    confirmDeleteTrade(editId);
  };
  const pnlPreview = calcPnl();
  const executionPreview = calcExecutionPreview();
  const pickImage = async (camera: boolean) => {
    if (!isPremium) {
      if (form.photoUri) {
        Alert.alert("YouTrader", t("screenshotLimitTrade"));
        return;
      }
      const imageCheck = canAttachTradeImage(isPremium, trades, editId, form.photoUri);
      if (!imageCheck.allowed) {
        Alert.alert(t("screenshotLimitReached"), t("screenshotLimitMessage"), [
          { text: t("upgradeToProCta"), onPress: () => onUpgrade() },
          { text: t("stayFree"), style: "cancel" },
        ]);
        return;
      }
    }
    try {
      if (camera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) return Alert.alert(t("cameraPermissionNeeded"));
        const r = await ImagePicker.launchCameraAsync({
          quality: 0.75,
          allowsEditing: false,
        });
        if (!r.canceled) {
          const asset = r.assets[0];
          const originalName = asset.fileName || "camera.jpg";
          const mimeType = asset.mimeType || "image/jpeg";
          const uploadCheck = await validateSecureUploadInput({
            uri: asset.uri,
            category: "screenshot",
            originalName,
            mimeType,
          });
          if (!uploadCheck.ok) {
            await recordSecurityEvent("invalid_upload", "upload:screenshot", "journal-local");
            return Alert.alert("YouTrader", SECURITY_MESSAGES.invalidUpload);
          }
          const limit = await peekClientRateLimit("upload:screenshot", "journal-local", "pick_image_camera");
          if (!limit.allowed) {
            await recordSecurityEvent("invalid_upload", "upload:screenshot", "journal-local");
            return Alert.alert("YouTrader", SECURITY_MESSAGES.rateLimited);
          }
          const savedUri = await persistJournalMediaAsset({
            uri: asset.uri,
            kind: "photos",
            originalName,
            mimeType,
          });
          await consumeClientRateLimit("upload:screenshot", "journal-local");
          setForm((prev) => ({ ...prev, photoUri: savedUri }));
        }
      } else {
        const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!p.granted) return Alert.alert(t("photoPermissionNeeded"));
        const r = await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          allowsEditing: false,
        });
        if (!r.canceled) {
          const asset = r.assets[0];
          const originalName = asset.fileName || "screenshot.jpg";
          const mimeType = asset.mimeType || "image/jpeg";
          const uploadCheck = await validateSecureUploadInput({
            uri: asset.uri,
            category: "screenshot",
            originalName,
            mimeType,
          });
          if (!uploadCheck.ok) {
            await recordSecurityEvent("invalid_upload", "upload:screenshot", "journal-local");
            return Alert.alert("YouTrader", SECURITY_MESSAGES.invalidUpload);
          }
          const limit = await peekClientRateLimit("upload:screenshot", "journal-local", "pick_image_library");
          if (!limit.allowed) {
            await recordSecurityEvent("invalid_upload", "upload:screenshot", "journal-local");
            return Alert.alert("YouTrader", SECURITY_MESSAGES.rateLimited);
          }
          const savedUri = await persistJournalMediaAsset({
            uri: asset.uri,
            kind: "photos",
            originalName,
            mimeType,
          });
          await consumeClientRateLimit("upload:screenshot", "journal-local");
          setForm((prev) => ({ ...prev, photoUri: savedUri }));
        }
      }
    } catch {
      Alert.alert(t("photoUploadFailed"), t("mediaPreservedRetry"));
    }
  };
  const pickAudio = async () => {
    if (!isPremium) {
      showProGate(t("voiceNotes"));
      return;
    }
    try {
      if (recorderState.isRecording) {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        if (!uri) return Alert.alert(t("recordingFailed"));
        const uploadCheck = await validateSecureUploadInput({
          uri,
          category: "voice-note",
          originalName: "voice-note.m4a",
          mimeType: "audio/x-m4a",
        });
        if (!uploadCheck.ok) {
          await recordSecurityEvent("invalid_upload", "upload:voice", "journal-local");
          return Alert.alert("YouTrader", SECURITY_MESSAGES.invalidUpload);
        }
        const limit = await peekClientRateLimit("upload:voice", "journal-local", "voice_note_record");
        if (!limit.allowed) {
          await recordSecurityEvent("invalid_upload", "upload:voice", "journal-local");
          return Alert.alert("YouTrader", SECURITY_MESSAGES.rateLimited);
        }
        const safeName = `${Date.now()}-voice-note.m4a`;
        const savedUri = await persistJournalMediaAsset({
          uri,
          kind: "voice",
          originalName: safeName,
          mimeType: "audio/x-m4a",
        });
        await consumeClientRateLimit("upload:voice", "journal-local");
        setForm((prev) => ({ ...prev, voiceUri: savedUri, voiceName: safeName }));
        return;
      }
      if (!audioReady) {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) return Alert.alert(t("microphonePermissionNeeded"));
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        setAudioReady(true);
      }
      await audioRecorder.prepareToRecordAsync();
      await audioRecorder.record();
    } catch {
      Alert.alert(t("audioRecordingFailed"), t("mediaPreservedRetry"));
    }
  };
  return (
    <View style={styles.journalScreenRoot}>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        styles.journalContent,
        isTabletLayout && styles.journalTabletContent,
      ]}
    >
      <View style={[styles.calendarCard, { width: calendarWidth }]} testID="journal-calendar">
        <View style={styles.monthControlRow}>
          <Pressable
            accessibilityLabel={t("previousMonth")}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              runYdlMotionHaptic("Selection");
              setViewMonth(addMonths(viewMonth, -1));
            }}
            style={styles.monthNavBtn}
          >
            <ChevronLeft
              size={ydlIconRules.sizes.md}
              color={C.sub}
              strokeWidth={UI_ICON_STROKE}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={t("selectMonth")}
            accessibilityRole="button"
            accessibilityHint={monthTitle(viewMonth)}
            onPress={() => {
              runYdlMotionHaptic("Selection");
              setMonthPickerOpen(true);
            }}
            style={styles.monthTitlePill}
          >
            <CalendarDays
              size={ydlIconRules.sizes.md}
              color={C.sub}
              strokeWidth={UI_ICON_STROKE}
            />
            <Text
              style={styles.monthTitleText}
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1.3}
            >
              {monthTitle(viewMonth)}
            </Text>
            <ChevronDown
              size={ydlIconRules.sizes.sm}
              color={C.sub}
              strokeWidth={UI_ICON_STROKE}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={t("nextMonth")}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              runYdlMotionHaptic("Selection");
              setViewMonth(addMonths(viewMonth, 1));
            }}
            style={styles.monthNavBtn}
          >
            <ChevronRight
              size={ydlIconRules.sizes.md}
              color={C.sub}
              strokeWidth={UI_ICON_STROKE}
            />
          </Pressable>
        </View>
        <View style={[styles.weekdayHeader, { gap: calendarGap }]}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <SafeText key={d} style={[styles.weekdayHeaderText, { width: dayCellWidth }]} maxFontSizeMultiplier={1.2}>
              {d}
            </SafeText>
          ))}
        </View>
        <View
          style={styles.calendarMonthOverview}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`${t("monthPnl")} ${dayMoney(monthTimeline.monthPnlTotal)}. ${monthTimeline.greenDays} green days. ${monthTimeline.redDays} red days. ${monthTimeline.tradedDays} traded days.`}
        >
          <View style={styles.calendarMonthOverviewMain}>
            <Text style={styles.calendarMonthOverviewLabel} maxFontSizeMultiplier={1.2}>{t("monthPnl")}</Text>
            <Text
              style={[
                styles.calendarMonthOverviewValue,
                { color: monthTimeline.monthPnlTotal >= 0 ? C.green : C.red },
              ]}
              maxFontSizeMultiplier={1.35}
            >
              {dayMoney(monthTimeline.monthPnlTotal)}
            </Text>
          </View>
          <View style={styles.calendarMonthOverviewStats}>
            <Text style={[styles.calendarMonthOverviewStat, { color: C.green }]} maxFontSizeMultiplier={1.2}>
              {monthTimeline.greenDays}
            </Text>
            <Text style={styles.calendarMonthOverviewStatMuted} maxFontSizeMultiplier={1.2}>/</Text>
            <Text style={[styles.calendarMonthOverviewStat, { color: C.red }]} maxFontSizeMultiplier={1.2}>
              {monthTimeline.redDays}
            </Text>
            <Text style={styles.calendarMonthOverviewStatMuted} maxFontSizeMultiplier={1.2}>
              · {monthTimeline.tradedDays}
            </Text>
          </View>
        </View>
        <View style={[styles.calendarGrid, { gap: calendarGap }]}>
          {monthRows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={[styles.calendarRow, { gap: calendarGap }]}>
              {row.map((d, cellIndex) => {
                if (!d) {
                  return (
                    <View
                      key={`empty-${rowIndex}-${cellIndex}`}
                      style={[styles.daySpacer, styles.dayMuted, { width: dayCellWidth, height: dayCellHeight }]}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                  );
                }
                const pnl = monthTimeline.dayPnl.get(d) || 0;
                const hasTrades = monthTimeline.dayPnl.has(d);
                const active = d === selectedDate;
                const isToday = d === todayISO();
                const dayNumber = Number(d.slice(8, 10));
                const weight =
                  hasTrades && monthTimeline.maxAbs > 0
                    ? Math.min(1, Math.abs(pnl) / monthTimeline.maxAbs)
                    : 0;
                const dayA11yLabel = [
                  String(dayNumber),
                  hasTrades ? dayMoney(pnl) : null,
                  isToday ? t("today") : null,
                  active ? "selected" : null,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <JournalCalendarDayPressable
                    key={d}
                    hasTrades={hasTrades}
                    selected={active}
                    accessibilityLabel={dayA11yLabel}
                    accessibilityHint={hasTrades ? t("journalViewTradesForDate", { date: journalLongDateLabel(d) }) : t("journalAddTradeForDate", { date: journalLongDateLabel(d) })}
                    onDayPress={() => {
                      setSelectedDate(d);
                      setDayPanelOpen(true);
                    }}
                    onDayLongPress={() => openDeleteDayConfirm(d)}
                    style={[
                      styles.day,
                      { width: dayCellWidth, height: dayCellHeight },
                      !hasTrades && styles.dayInactive,
                      hasTrades && (pnl >= 0 ? styles.dayProfit : styles.dayLoss),
                      hasTrades && weight >= 0.72 && (pnl >= 0 ? styles.dayProfitStrong : styles.dayLossStrong),
                      isToday && styles.dayToday,
                      active && styles.daySelected,
                    ]}
                  >
                    <SafeText
                      style={[
                        styles.dayNum,
                        !hasTrades && styles.dayNumInactive,
                        isToday && styles.dayNumToday,
                        active && styles.dayNumSelected,
                      ]}
                      minScale={0.72}
                      maxFontSizeMultiplier={1.25}
                    >
                      {dayNumber}
                    </SafeText>
                    <SafeText
                      style={[
                        styles.dayPnlText,
                        {
                          color: active && !hasTrades
                            ? C.text
                            : hasTrades
                              ? (pnl >= 0 ? C.green : C.red)
                              : C.muted,
                          fontVariant: getYdlNumberMotionConfig("currency").fontVariant,
                          opacity: hasTrades ? 0.72 + weight * 0.28 : 1,
                        },
                      ]}
                      minScale={0.6}
                      maxFontSizeMultiplier={1.2}
                    >
                      {hasTrades ? dayMoney(pnl) : ""}
                    </SafeText>
                    {isToday || active ? <View style={styles.todayDot} accessibilityElementsHidden /> : null}
                  </JournalCalendarDayPressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
      {!isTabletLayout ? (
        <Pressable
          style={styles.journalScrollCue}
          onPress={() => setDayPanelOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("journalViewTradesForDate", { date: journalLongDateLabel(selectedDate) })}
          testID="journal-open-day-panel"
        >
          <Text style={styles.journalScrollCueLabel}>{t("journalViewDayTrades")}</Text>
          <View style={styles.journalScrollCueGlass}>
            <ChevronDown size={18} color={C.green} strokeWidth={UI_ICON_STROKE} />
          </View>
        </Pressable>
      ) : null}
      <Modal visible={monthPickerOpen} transparent animationType="fade">
        <Pressable style={styles.monthPickerBackdrop} onPress={() => setMonthPickerOpen(false)}>
          <Pressable style={styles.monthPickerCard}>
            <Text style={styles.monthPickerTitle} maxFontSizeMultiplier={1.35}>
              {t("selectMonth")}
            </Text>
            <View style={styles.monthPickerYears}>
              {years.map((year) => {
                const selected = year === viewMonth.getFullYear();
                return (
                  <Pressable
                    key={year}
                    accessibilityRole="button"
                    accessibilityLabel={String(year)}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      runYdlMotionHaptic("Selection");
                      setViewMonth(new Date(year, viewMonth.getMonth(), 1));
                    }}
                    style={[styles.monthPickerYear, selected && styles.monthPickerYearActive]}
                  >
                    <Text
                      style={[styles.monthPickerYearText, selected && styles.monthPickerYearTextActive]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {year}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.monthPickerMonths}>
              {Array.from({ length: 12 }, (_, index) => {
                const monthLabel = new Date(2026, index, 1).toLocaleDateString([], { month: "short" });
                const selected = index === viewMonth.getMonth();
                return (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={monthLabel}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      runYdlMotionHaptic("Selection");
                      setViewMonth(new Date(viewMonth.getFullYear(), index, 1));
                      setMonthPickerOpen(false);
                    }}
                    style={[styles.monthPickerMonth, selected && styles.monthPickerMonthActive]}
                  >
                    <Text
                      style={[styles.monthPickerMonthText, selected && styles.monthPickerMonthTextActive]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {monthLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <View
        style={styles.calendarDayDetailHeader}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${t("tradesToday")}. ${eventDateLabel(selectedDate)}${selectedDayPnl != null ? `. ${dayMoney(selectedDayPnl)}` : ""}`}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.workflowNextLabel} maxFontSizeMultiplier={1.2}>{t("tradesToday")}</Text>
          <Text style={styles.calendarDayDetailDate} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68} maxFontSizeMultiplier={1.3}>
            {eventDateLabel(selectedDate)}
          </Text>
        </View>
        {selectedDayPnl != null ? (
          <Text
            style={[
              styles.calendarDayDetailPnl,
              { color: selectedDayPnl >= 0 ? C.green : C.red },
            ]}
            maxFontSizeMultiplier={1.35}
          >
            {dayMoney(selectedDayPnl)}
          </Text>
        ) : (
          <Text style={styles.calendarDayDetailPnlMuted} maxFontSizeMultiplier={1.2}>—</Text>
        )}
      </View>
      {filtered.length === 0 ? (
        <View style={styles.journalDayEmpty} testID="journal-day-empty">
          <Text style={styles.journalDayEmptyText} maxFontSizeMultiplier={1.3}>
            {t("journalNoTradesForDay")}
          </Text>
          <Pressable
            testID="journal-add-trade"
            accessibilityRole="button"
            accessibilityLabel={t("journalAddTradeForDate", { date: journalLongDateLabel(selectedDate) })}
            onPress={() => {
              runYdlMotionHaptic("Selection");
              openNew(selectedDate);
            }}
            style={styles.journalDayAddTradeBtn}
          >
            <Plus size={ydlIconRules.sizes.sm} color={C.bg} strokeWidth={UI_ICON_STROKE} />
            <Text style={styles.journalDayAddTradeLabel} maxFontSizeMultiplier={1.2}>
              {t("journalDayAddTrade")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          testID="journal-add-trade"
          accessibilityRole="button"
          accessibilityLabel={t("journalAddTradeForDate", { date: journalLongDateLabel(selectedDate) })}
          onPress={() => {
            runYdlMotionHaptic("Selection");
            openNew(selectedDate);
          }}
          style={styles.journalDayAddTradeBtnSecondary}
        >
          <Plus size={ydlIconRules.sizes.sm} color={C.green} strokeWidth={UI_ICON_STROKE} />
          <Text style={styles.journalDayAddTradeLabelSecondary} maxFontSizeMultiplier={1.2}>
            {t("journalDayAddTrade")}
          </Text>
        </Pressable>
      )}
      {filtered.map((tr) => {
        const sessionLabel = [tr.entryTime, tr.exitTime].filter(Boolean).join(" → ");
        const executionBits = [
          tr.contracts != null ? `${t("contracts")} ${tr.contracts}` : null,
          tr.stopLoss != null ? `${t("stopLoss")} ${tr.stopLoss}` : null,
          tr.takeProfit != null ? `${t("takeProfit")} ${tr.takeProfit}` : null,
        ].filter(Boolean) as string[];
        const hasExecution =
          (tr.entry != null && tr.exit != null) ||
          executionBits.length > 0 ||
          (tr.tags || []).length > 0;
        const pnlLabel = moneyCompact(tr.pnl);
        const cardA11yLabel = [
          tr.symbol,
          tr.direction,
          pnlLabel,
          sessionLabel || null,
          `${t("mood")}: ${moodLabel(tr.mood, lang)}`,
          tr.notes ? `notes:${tr.notes}` : null,
        ]
          .filter(Boolean)
          .join(", ");

        return (
        <JournalTradeSwipeCard
          key={tr.id}
          testID={`journal.trade.card.${tr.id}`}
          accessibilityLabel={cardA11yLabel}
          accessibilityHint={t("tapToViewEdit")}
          onPress={() => openEdit(tr)}
          onLongPress={() => openTradeActions(tr)}
          onDeletePress={() => confirmDeleteTrade(tr.id)}
          onSwipeReveal={lightHaptic}
        >
          <Card animated={false} style={styles.journalSwipeCardInner}>
            <View style={styles.journalTradeResultRow}>
              <Text
                style={[
                  styles.journalTradeResultValue,
                  {
                    color: tr.pnl >= 0 ? C.green : C.red,
                    fontVariant: getYdlNumberMotionConfig("currency").fontVariant,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.4}
                accessibilityRole="text"
              >
                {pnlLabel}
              </Text>
            </View>

            <View>
              <View style={styles.journalTradeIdentityRow}>
                <Text
                  style={styles.journalTradeSymbol}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}
                >
                  {tr.symbol}
                </Text>
                <Pill
                  text={tr.direction}
                  tone={tr.direction === "LONG" ? "long" : "short"}
                />
              </View>
              {sessionLabel ? (
                <Text style={styles.journalTradeSession} maxFontSizeMultiplier={1.3}>
                  {sessionLabel}
                </Text>
              ) : null}
            </View>

            {hasExecution ? (
              <View style={styles.journalTradeExecution}>
                {tr.entry != null && tr.exit != null ? (
                  <Text style={styles.journalTradeExecutionLine} maxFontSizeMultiplier={1.3}>
                    {tr.entry} → {tr.exit}
                  </Text>
                ) : null}
                {executionBits.length > 0 ? (
                  <Text style={styles.journalTradeExecutionLine} maxFontSizeMultiplier={1.3}>
                    {executionBits.join(" · ")}
                  </Text>
                ) : null}
                {(tr.tags || []).length > 0 ? (
                  <View style={styles.journalTradeTagsWrap}>
                    {(tr.tags || []).slice(0, 4).map((tag) => (
                      <Text key={`${tr.id}-${tag}`} style={styles.journalTradeTag}>
                        #{tag}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.journalTradeReflection}>
              <Text style={styles.journalTradeMood} maxFontSizeMultiplier={1.3}>
                {t("mood")}: {moodLabel(tr.mood, lang)}
              </Text>
              {tr.notes ? (
                <Text
                  style={styles.journalTradeNotes}
                  numberOfLines={3}
                  maxFontSizeMultiplier={1.3}
                >
                  {tr.notes}
                </Text>
              ) : null}
              {tr.photoUri ? (
                <Pressable
                  onPress={() => setPhotoView(tr.photoUri || null)}
                  accessibilityRole="imagebutton"
                    accessibilityLabel={t("photo")}
                >
                  <Image
                    source={{ uri: tr.photoUri }}
                    style={styles.journalTradeThumb}
                    resizeMode="cover"
                  />
                </Pressable>
              ) : null}
              {tr.voiceUri ? (
                <Pressable
                  onPress={() => Linking.openURL(tr.voiceUri || "")}
                  accessibilityRole="button"
                  accessibilityLabel={t("openAudio")}
                  style={styles.journalTradeVoiceRow}
                >
                  <Mic size={ydlIconRules.sizes.sm} color={C.purple} strokeWidth={UI_ICON_STROKE} />
                  <Text style={styles.journalTradeVoiceText}>{t("openAudio")}</Text>
                </Pressable>
              ) : null}
              <Text style={styles.journalTradeTapHint} maxFontSizeMultiplier={1.2}>
                {t("tapToViewEdit")}
              </Text>
            </View>
          </Card>
        </JournalTradeSwipeCard>
        );
      })}
      {firstInsightVisible && firstInsight ? (
        <GlassCard style={styles.freeInsightCard} intensity={34}>
          <View style={styles.rowBetween}>
            <Text style={styles.freeInsightTitle} maxFontSizeMultiplier={1.3}>{firstInsight.title}</Text>
            <Pressable onPress={dismissFirstInsight} accessibilityRole="button" accessibilityLabel={t("dismiss")} style={styles.workflowGhostAction}>
              <Text style={styles.workflowGhostText}>{t("dismiss")}</Text>
            </Pressable>
          </View>
          <Text style={styles.freeInsightText} maxFontSizeMultiplier={1.25}>{firstInsight.text}</Text>
          <Text style={styles.freeInsightCta} maxFontSizeMultiplier={1.2}>{t("firstInsightProCta")}</Text>
        </GlassCard>
      ) : null}
      {lockedInsightVisible ? (
        <GlassCard style={styles.lockedInsightCard} intensity={36}>
          <Text style={styles.freeInsightTitle} maxFontSizeMultiplier={1.3}>{t("lockedInsightTitle")}</Text>
          <Text style={styles.freeInsightText} maxFontSizeMultiplier={1.25}>{t("lockedInsightBody")}</Text>
          <View style={styles.workflowActionStack}>
            <AnimatedPressable
              press="buttonPrimary"
              haptic
              onPress={openLockedInsightModal}
              style={styles.workflowPrimaryInStack}
              contentStyle={[styles.primaryBig, styles.workflowPrimaryInStack]}
              accessibilityRole="button"
              accessibilityLabel={t("startSevenDayPro")}
            >
              <Text style={styles.primaryText} maxFontSizeMultiplier={1.25}>{t("startSevenDayPro")}</Text>
            </AnimatedPressable>
            <Pressable
              onPress={dismissLockedInsight}
              style={styles.workflowGhostAction}
              accessibilityRole="button"
              accessibilityLabel={t("maybeLater")}
            >
              <Text style={styles.workflowGhostText} maxFontSizeMultiplier={1.25}>{t("maybeLater")}</Text>
            </Pressable>
          </View>
        </GlassCard>
      ) : null}
      <BottomSheetPanel
        visible={dayPanelOpen}
        title={eventDateLabel(selectedDate)}
        onClose={() => setDayPanelOpen(false)}
      >
        <View testID="journal-day-panel" style={{ gap: 12, paddingBottom: 24 }}>
          {selectedDayPnl != null ? (
            <Text
              style={[
                styles.calendarDayDetailPnl,
                { color: selectedDayPnl >= 0 ? C.green : C.red },
              ]}
              maxFontSizeMultiplier={1.35}
            >
              {dayMoney(selectedDayPnl)}
            </Text>
          ) : null}
          {filtered.length === 0 ? (
            <Text style={styles.journalDayEmptyText} maxFontSizeMultiplier={1.3}>
              {t("journalNoTradesForDay")}
            </Text>
          ) : (
            filtered.map((tr) => (
              <Pressable
                key={`panel-${tr.id}`}
                testID={`journal.day.panel.trade.${tr.id}`}
                onPress={() => openEdit(tr)}
                style={styles.tradeSheetAction}
                accessibilityRole="button"
                accessibilityLabel={`${tr.symbol} ${tr.direction} ${moneyCompact(tr.pnl)}`}
              >
                <Text style={styles.tradeSheetActionText} maxFontSizeMultiplier={1.25}>
                  {`${tr.symbol} ${tr.direction} · ${moneyCompact(tr.pnl)}`}
                </Text>
              </Pressable>
            ))
          )}
          <Pressable
            testID="journal-day-panel-add-trade"
            accessibilityRole="button"
            accessibilityLabel={t("journalAddTradeForDate", { date: journalLongDateLabel(selectedDate) })}
            onPress={() => {
              runYdlMotionHaptic("Selection");
              openNew(selectedDate);
            }}
            style={styles.journalDayAddTradeBtn}
          >
            <Plus size={ydlIconRules.sizes.sm} color={C.bg} strokeWidth={UI_ICON_STROKE} />
            <Text style={styles.journalDayAddTradeLabel} maxFontSizeMultiplier={1.2}>
              {t("journalDayAddTrade")}
            </Text>
          </Pressable>
        </View>
      </BottomSheetPanel>
      <BottomSheetPanel
        visible={!!tradeActionTarget}
        title={t("journalTradeActions")}
        onClose={() => setTradeActionTarget(null)}
      >
        <Pressable
          style={[styles.tradeSheetAction, styles.tradeSheetActionPrimary]}
          onPress={() => {
            const target = tradeActionTarget;
            setTradeActionTarget(null);
            if (target) openEdit(target);
          }}
          testID="journal.trade.actions.edit"
          accessibilityRole="button"
          accessibilityLabel={t("journalGestureEditTrade")}
        >
          <Text style={[styles.tradeSheetActionText, styles.tradeSheetActionPrimaryText]} maxFontSizeMultiplier={1.25}>
            {t("journalGestureEditTrade")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tradeSheetAction, styles.tradeSheetActionDestructive]}
          onPress={() => {
            const target = tradeActionTarget;
            setTradeActionTarget(null);
            if (target) confirmDeleteTrade(target.id);
          }}
          testID="journal.trade.actions.delete"
          accessibilityRole="button"
          accessibilityLabel={t("deleteTrade")}
        >
          <Text style={[styles.tradeSheetActionText, styles.tradeSheetActionDestructiveText]} maxFontSizeMultiplier={1.25}>
            {t("deleteTrade")}
          </Text>
        </Pressable>
        <Pressable
          style={styles.tradeSheetCancel}
          onPress={() => setTradeActionTarget(null)}
          accessibilityRole="button"
          accessibilityLabel={t("cancel")}
        >
          <Text style={styles.tradeSheetCancelText} maxFontSizeMultiplier={1.25}>{t("cancel")}</Text>
        </Pressable>
      </BottomSheetPanel>
      <Modal
        visible={!!deleteTradeConfirmId}
        transparent
        animationType="fade"
        onRequestClose={cancelDeleteTradeConfirm}
      >
        <View
          style={styles.deleteDayBackdrop}
          testID="journal.trade.delete.confirmation"
          accessibilityLabel={t("deleteQuestion")}
        >
          <View style={styles.deleteDayCard}>
            <Text style={styles.deleteDayEyebrow}>{t("journalSafety")}</Text>
            <Text style={styles.deleteDayTitle} maxFontSizeMultiplier={1.35}>
              {t("deleteQuestion")}
            </Text>
            <Text style={styles.deleteDayBody} maxFontSizeMultiplier={1.3}>
              {t("journalDeleteTradeBody")}
              {deleteTradeConfirmId
                ? `\n${trades.find((x) => x.id === deleteTradeConfirmId)?.symbol || ""} ${
                    trades.find((x) => x.id === deleteTradeConfirmId)?.direction || ""
                  }`.trim()
                : ""}
            </Text>
            <View style={styles.deleteDayActions}>
              <Pressable
                disabled={deleteTradeBusy}
                onPress={cancelDeleteTradeConfirm}
                style={styles.deleteDayCancel}
                testID="journal.trade.delete.cancel"
                accessibilityRole="button"
                accessibilityLabel={t("cancel")}
              >
                <Text style={styles.deleteDayCancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable
                disabled={deleteTradeBusy}
                onPress={() => {
                  void performDeleteTradeConfirm();
                }}
                style={[styles.deleteDayConfirm, deleteTradeBusy && styles.disabledBtn]}
                testID="journal.trade.delete.confirm"
                accessibilityRole="button"
                accessibilityLabel={t("deleteTrade")}
                accessibilityState={{ disabled: deleteTradeBusy }}
              >
                <Text style={styles.deleteDayConfirmText}>
                  {deleteTradeBusy ? t("deleting") : t("deleteTrade")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={!!deleteDayDate} transparent animationType="fade">
        <View style={styles.deleteDayBackdrop}>
          <View style={styles.deleteDayCard}>
            <Text style={styles.deleteDayEyebrow}>{t("journalSafety")}</Text>
            <Text style={styles.deleteDayTitle}>{t("deleteThisTradingDay")}</Text>
            <Text style={styles.deleteDayBody}>{t("deleteTradingDayBody")}</Text>
            <View style={styles.deleteDayActions}>
              <Pressable disabled={deleteDayBusy} onPress={() => setDeleteDayDate(null)} style={styles.deleteDayCancel}>
                <Text style={styles.deleteDayCancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable disabled={deleteDayBusy} onPress={confirmDeleteDay} style={[styles.deleteDayConfirm, deleteDayBusy && styles.disabledBtn]}>
                <Text style={styles.deleteDayConfirmText}>{deleteDayBusy ? t("deleting") : t("deleteDay")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <ProValueModal
        lang={lang}
        content={valueModal}
        packages={packages}
        storeProducts={storeProducts}
        purchaseBusy={purchaseBusy}
        paywallError={paywallError}
        showRestorePurchases={showRestorePurchases}
        onPurchase={onPurchase}
        onRestore={onRestore}
        onClose={() => setValueModal((prev) => ({ ...prev, visible: false }))}
      />
      <Modal visible={modal} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.modalHeader}>
                <Text
                  style={styles.journalDetailTitle}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}
                  accessibilityRole="header"
                >
                  {editId ? t("updateTrade") : t("addTrade")}
                </Text>
                <Pressable
                  onPress={() => {
                    runYdlMotionHaptic("Selection");
                    setModal(false);
                  }}
                  style={styles.closeCircle}
                  accessibilityRole="button"
                  accessibilityLabel={t("close")}
                >
                  <Text style={styles.closeX}>×</Text>
                </Pressable>
              </View>

              {/* A. Trade P&L — authoritative signed result */}
              <View style={styles.journalDetailSection} testID="journal.trade.section.result">
                <Text style={styles.journalDetailSectionTitle} maxFontSizeMultiplier={1.2}>
                  {t("journalFormTradePnl")}
                </Text>
                <View
                  testID="journal.trade.edit.signedPnl"
                  accessibilityRole="summary"
                  accessibilityLabel={`${
                    tradePnlSign === "minus" ? t("journalFormPnlLoss") : t("journalFormPnlProfit")
                  } ${form.pnl || t("journalFormPnlAmountPlaceholder")}`}
                  style={[
                    styles.journalSignedPnlRow,
                    pnlPreview != null && pnlPreview > 0 && styles.journalDetailResultBoxGreen,
                    pnlPreview != null && pnlPreview < 0 && styles.journalDetailResultBoxRed,
                    (pnlPreview == null || pnlPreview === 0) && styles.journalDetailResultBoxNeutral,
                  ]}
                >
                  <Pressable
                    testID="journal.trade.edit.pnl.sign"
                    onPress={() => {
                      runYdlMotionHaptic("Selection");
                      setTradePnlSign((prev) => (prev === "plus" ? "minus" : "plus"));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      tradePnlSign === "minus"
                        ? t("journalFormPnlSignMinusA11y")
                        : t("journalFormPnlSignPlusA11y")
                    }
                    style={[
                      styles.journalSignedPnlSign,
                      tradePnlSign === "minus" && styles.journalSignedPnlSignLoss,
                    ]}
                  >
                    <Text
                      style={[
                        styles.journalSignedPnlSignText,
                        {
                          color:
                            tradePnlSign === "minus"
                              ? C.red
                              : String(form.pnl || "").trim()
                                ? C.green
                                : C.text,
                        },
                      ]}
                      maxFontSizeMultiplier={1.2}
                    >
                      {tradePnlSign === "minus" ? "−" : "+"}
                    </Text>
                  </Pressable>
                  <Text style={styles.journalSignedPnlCurrency} maxFontSizeMultiplier={1.2}>
                    $
                  </Text>
                  <Input
                    testID="journal.trade.edit.pnl.manual"
                    accessibilityLabel={t("journalFormPnlAmount")}
                    label=""
                    keyboardType="decimal-pad"
                    value={form.pnl}
                    onChangeText={(v: string) =>
                      setForm({ ...form, pnl: v.replace(/[^0-9.,]/g, "") })
                    }
                    placeholder={t("journalFormPnlAmountPlaceholder")}
                    style={styles.journalSignedPnlInput}
                  />
                </View>
                {pnlPreview != null ? (
                  <Text
                    testID="journal.trade.edit.pnl"
                    style={[
                      styles.journalDetailResultDisplay,
                      {
                        color: pnlPreview > 0 ? C.green : pnlPreview < 0 ? C.red : C.text,
                        fontVariant: getYdlNumberMotionConfig("currency").fontVariant,
                      },
                    ]}
                    maxFontSizeMultiplier={1.35}
                  >
                    {money(pnlPreview)}
                  </Text>
                ) : (
                  <Text style={styles.journalPnlHint} maxFontSizeMultiplier={1.25}>
                    {t("journalFormPnlSignedHint")}
                  </Text>
                )}
              </View>

              {/* B. Execution Details — Optional */}
              <View style={styles.journalDetailSection} testID="journal.trade.section.setup">
                <Pressable
                  testID="journal.trade.execution.toggle"
                  onPress={() => {
                    if (Platform.OS === "ios" && UIManager.setLayoutAnimationEnabledExperimental) {
                      UIManager.setLayoutAnimationEnabledExperimental(true);
                    }
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    runYdlMotionHaptic("Selection");
                    setExecutionDetailsExpanded((v) => !v);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: executionDetailsExpanded }}
                  accessibilityLabel={t("journalFormExecutionDetails")}
                  style={styles.row}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.journalDetailSectionTitle} maxFontSizeMultiplier={1.2}>
                      {t("journalFormExecutionDetails")}
                    </Text>
                    {!executionDetailsExpanded ? (
                      <Text style={styles.journalPnlHint} maxFontSizeMultiplier={1.25}>
                        {t("journalFormExecutionDetailsSummary")}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.optionText}>{executionDetailsExpanded ? "−" : "+"}</Text>
                </Pressable>

                {executionDetailsExpanded ? (
                  <>
                    <Text style={styles.label}>{t("direction")}</Text>
                    <View style={styles.row}>
                      {(["LONG", "SHORT"] as Direction[]).map((d) => (
                        <Pressable
                          key={d}
                          testID={`journal.trade.edit.direction.${d.toLowerCase()}`}
                          onPress={() => {
                            runYdlMotionHaptic("Selection");
                            setForm({ ...form, direction: d });
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`journal.trade.edit.direction.${d.toLowerCase()}`}
                          accessibilityState={{ selected: form.direction === d }}
                          style={[
                            styles.option,
                            form.direction === d && (d === "SHORT" ? styles.optionShortActive : styles.optionActive),
                          ]}
                        >
                          <Text style={styles.optionText}>{d}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.label}>{t("journalFormMarketType")}</Text>
                    <View style={styles.row} testID="journal.trade.edit.marketType">
                      {([
                        { id: "emini" as const, label: t("journalFormMarketEmini") },
                        { id: "micro" as const, label: t("journalFormMarketMicro") },
                        { id: "custom" as const, label: t("journalFormMarketCustom") },
                      ]).map((opt) => (
                        <Pressable
                          key={opt.id}
                          testID={`journal.trade.edit.marketType.${opt.id}`}
                          onPress={() => {
                            runYdlMotionHaptic("Selection");
                            setMarketType(opt.id);
                            if (opt.id === "custom") {
                              setSymbolIsCustom(true);
                              setForm({
                                ...form,
                                symbol:
                                  (MINI_INSTRUMENTS as readonly string[]).includes(form.symbol) ||
                                  (MICRO_INSTRUMENTS as readonly string[]).includes(form.symbol)
                                    ? ""
                                    : form.symbol,
                              });
                            } else {
                              setSymbolIsCustom(false);
                              const list = opt.id === "emini" ? MINI_INSTRUMENTS : MICRO_INSTRUMENTS;
                              setForm({
                                ...form,
                                symbol: list.includes(form.symbol as never) ? form.symbol : list[0],
                              });
                            }
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: marketType === opt.id }}
                          style={[styles.option, marketType === opt.id && styles.optionActive]}
                        >
                          <Text style={styles.optionText}>{opt.label}</Text>
                        </Pressable>
                      ))}
                    </View>

                    {marketType !== "custom" ? (
                      <View
                        style={styles.instrumentGrid}
                        testID={marketType === "emini" ? "journal.trade.edit.instrument.mini" : "journal.trade.edit.instrument.micro"}
                      >
                        {(marketType === "emini" ? MINI_INSTRUMENTS : MICRO_INSTRUMENTS).map((s) => (
                          <InstrumentButton
                            key={s}
                            symbol={s}
                            active={!symbolIsCustom && form.symbol === s}
                            onPress={() => {
                              setSymbolIsCustom(false);
                              setForm({ ...form, symbol: s });
                            }}
                            testIDPrefix="journal.trade.edit.instrument"
                          />
                        ))}
                      </View>
                    ) : (
                      <Input
                        testID="journal.trade.edit.instrument"
                        accessibilityLabel="journal.trade.edit.instrument"
                        label={t("customSymbol")}
                        value={form.symbol}
                        onChangeText={(v: string) =>
                          setForm({ ...form, symbol: normalizeSymbolInput(v) })
                        }
                      />
                    )}

                    <Input
                      testID="journal.trade.edit.quantity"
                      accessibilityLabel="journal.trade.edit.quantity"
                      label={t("contracts")}
                      keyboardType="number-pad"
                      value={form.contracts}
                      onChangeText={(v: string) => setForm({ ...form, contracts: v })}
                    />
                    <Input
                      testID="journal.trade.edit.entry"
                      accessibilityLabel="journal.trade.edit.entry"
                      label={t("entry")}
                      keyboardType="decimal-pad"
                      value={form.entry}
                      onChangeText={(v: string) => setForm({ ...form, entry: v })}
                    />
                    <Input
                      testID="journal.trade.edit.exit"
                      accessibilityLabel="journal.trade.edit.exit"
                      label={t("exit")}
                      keyboardType="decimal-pad"
                      value={form.exit}
                      onChangeText={(v: string) => setForm({ ...form, exit: v })}
                    />
                    {executionPreview != null ? (
                      <Text style={styles.journalPnlHint} maxFontSizeMultiplier={1.25}>
                        {t("journalFormExecutionPreview", { value: money(executionPreview) })}
                      </Text>
                    ) : null}
                    <View style={styles.formTwoCol}>
                      <View style={styles.formTwoColItem}>
                        <Input
                          testID="journal.trade.edit.entryTime"
                          accessibilityLabel="journal.trade.edit.entryTime"
                          label={t("entryTime")}
                          value={form.entryTime}
                          onChangeText={(v: string) => setForm({ ...form, entryTime: v })}
                          placeholder="09:30"
                          style={styles.compactInput}
                        />
                      </View>
                      <View style={styles.formTwoColItem}>
                        <Input
                          testID="journal.trade.edit.exitTime"
                          accessibilityLabel="journal.trade.edit.exitTime"
                          label={t("exitTime")}
                          value={form.exitTime}
                          onChangeText={(v: string) => setForm({ ...form, exitTime: v })}
                          placeholder="10:15"
                          style={styles.compactInput}
                        />
                      </View>
                    </View>
                    <Text style={styles.journalDetailMetaDate} maxFontSizeMultiplier={1.3}>
                      {eventDateLabel(selectedDate)}
                    </Text>
                  </>
                ) : null}
              </View>

              {/* C. Trade Context — Optional (collapsed by default) */}
              <View style={styles.journalDetailSection} testID="journal.trade.section.context">
                <Pressable
                  testID="journal.trade.context.toggle"
                  onPress={() => {
                    if (Platform.OS === "ios" && UIManager.setLayoutAnimationEnabledExperimental) {
                      UIManager.setLayoutAnimationEnabledExperimental(true);
                    }
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    runYdlMotionHaptic("Selection");
                    setTradeContextExpanded((v) => !v);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: tradeContextExpanded }}
                  accessibilityLabel={t("journalFormTradeContext")}
                  style={styles.row}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.journalDetailSectionTitle} maxFontSizeMultiplier={1.2}>
                      {t("journalFormTradeContext")}
                    </Text>
                    {!tradeContextExpanded ? (
                      <Text style={styles.journalPnlHint} maxFontSizeMultiplier={1.25}>
                        {t("journalFormTradeContextSummary")}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.optionText}>{tradeContextExpanded ? "−" : "+"}</Text>
                </Pressable>

                {tradeContextExpanded ? (
                  <>
                    <Input
                      testID="journal.trade.edit.notes"
                      accessibilityLabel="journal.trade.edit.notes"
                      label={t("notes")}
                      value={form.notes}
                      onChangeText={(v: string) => setForm({ ...form, notes: v.slice(0, MAX_NOTES_LENGTH) })}
                      multiline
                    />
                    <Text style={styles.label}>{t("mood")}</Text>
                    <View style={styles.moodGrid}>
                      {MOODS.map((m) => (
                        <Pressable
                          key={m.key}
                          onPress={() => {
                            runYdlMotionHaptic("Selection");
                            setForm({ ...form, mood: m.key });
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: form.mood === m.key }}
                          style={[styles.moodBtn, form.mood === m.key && styles.optionActive]}
                        >
                          <Text style={styles.moodEmoji}>{m.emoji}</Text>
                          <Text style={styles.moodText}>{moodLabel(m.key, lang).replace(`${m.emoji} `, "")}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Input
                      testID="journal.trade.edit.stopLoss"
                      accessibilityLabel="journal.trade.edit.stopLoss"
                      label={t("stopLoss")}
                      keyboardType="decimal-pad"
                      value={form.stopLoss}
                      onChangeText={(v: string) => setForm({ ...form, stopLoss: v })}
                    />
                    <Input
                      testID="journal.trade.edit.takeProfit"
                      accessibilityLabel="journal.trade.edit.takeProfit"
                      label={t("takeProfit")}
                      keyboardType="decimal-pad"
                      value={form.takeProfit}
                      onChangeText={(v: string) => setForm({ ...form, takeProfit: v })}
                    />
                    <View style={styles.journalMediaSection}>
                      <Pressable
                        style={[styles.journalVoiceBtn, recorderState.isRecording && styles.journalVoiceRecording, form.voiceUri && !recorderState.isRecording && styles.journalVoiceDone]}
                        onPress={pickAudio}
                        accessibilityRole="button"
                        accessibilityLabel={
                          recorderState.isRecording
                            ? t("journalFormRecording")
                            : form.voiceUri
                              ? t("journalFormVoiceAdded")
                              : t("journalFormRecordVoiceNote")
                        }
                      >
                        <Mic
                          size={16}
                          color={recorderState.isRecording ? C.red : form.voiceUri ? C.green : C.text}
                          strokeWidth={2.2}
                        />
                        <Text
                          style={[
                            styles.journalVoiceBtnText,
                            recorderState.isRecording && { color: C.red },
                            form.voiceUri && !recorderState.isRecording && { color: C.green },
                          ]}
                        >
                          {recorderState.isRecording
                            ? t("journalFormRecording")
                            : form.voiceUri
                              ? t("journalFormVoiceAdded")
                              : t("journalFormRecordVoiceNote")}
                        </Text>
                      </Pressable>
                      {form.photoUri ? (
                        <Image source={{ uri: form.photoUri }} style={styles.tradePhoto} />
                      ) : null}
                      <View style={styles.journalActionPair}>
                        <Pressable
                          style={styles.journalActionCard}
                          onPress={() => pickImage(true)}
                          accessibilityRole="button"
                          accessibilityLabel={t("journalFormTakeScreenshot")}
                        >
                          <Camera size={18} color={C.green} strokeWidth={2.2} />
                          <Text style={styles.journalActionCardTitle}>{t("journalFormTakeScreenshot")}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.journalActionCard}
                          onPress={() => pickImage(false)}
                          accessibilityRole="button"
                          accessibilityLabel={t("journalFormUploadChart")}
                        >
                          <ImagePlus size={18} color={C.green} strokeWidth={2.2} />
                          <Text style={styles.journalActionCardTitle}>{t("journalFormUploadChart")}</Text>
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.label}>{t("tags")}</Text>
                    <View style={styles.tagChipGrid}>
                      {COMMON_TRADE_TAGS.map((tag) => {
                        const currentTags = parseTagsInput(form.tags);
                        const active = currentTags.includes(tag.toUpperCase());
                        return (
                          <Pressable
                            key={tag}
                            onPress={() => {
                              runYdlMotionHaptic("Selection");
                              const next = active
                                ? currentTags.filter((item) => item !== tag.toUpperCase())
                                : [...currentTags, tag.toUpperCase()].slice(0, 8);
                              setForm({ ...form, tags: tagsToInput(next) });
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            style={[styles.tradeTagButton, active && styles.tradeTagButtonActive]}
                          >
                            <Text style={[styles.tradeTagButtonText, active && styles.tradeTagButtonTextActive]}>#{tag}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Input
                      label={t("customTags")}
                      value={form.tags}
                      onChangeText={(v: string) => setForm({ ...form, tags: v })}
                      placeholder="#ORB #APlus #NYOpen"
                    />
                  </>
                ) : null}
              </View>

              <View style={styles.journalDetailActions}>
                <Text style={styles.workflowNextLabel} maxFontSizeMultiplier={1.2}>
                  {editId ? t("updateTrade") : t("saveTrade")}
                </Text>
                <AnimatedPressable
                  press="buttonPrimary"
                  haptic
                  style={styles.workflowPrimaryInStack}
                  contentStyle={[styles.primaryBig, styles.workflowPrimaryInStack]}
                  onPress={() => {
                    void save();
                  }}
                  testID="journal.trade.save"
                  accessibilityRole="button"
                  accessibilityLabel={editId ? t("updateTrade") : t("saveTrade")}
                >
                  <Text style={styles.primaryText} maxFontSizeMultiplier={1.25}>
                    {editId ? t("updateTrade") : t("saveTrade")}
                  </Text>
                  <Text style={styles.journalSaveHint} maxFontSizeMultiplier={1.2}>{t("journalFormSaveHint")}</Text>
                </AnimatedPressable>
                {editId && (
                  <AnimatedPressable
                    press="buttonSecondary"
                    style={styles.workflowSecondaryInStack}
                    contentStyle={styles.deleteBig}
                    onPress={remove}
                    testID="journal.trade.delete"
                    accessibilityRole="button"
                    accessibilityLabel={t("deleteTrade")}
                  >
                    <Text style={styles.deleteText} maxFontSizeMultiplier={1.25}>{t("deleteTrade")}</Text>
                  </AnimatedPressable>
                )}
              </View>
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
    {deleteToastKey ? (
      <View style={styles.journalDeleteToastWrap} pointerEvents="none">
        <View style={styles.journalDeleteToast}>
          <Text style={styles.journalDeleteToastText}>{t(deleteToastKey)}</Text>
        </View>
      </View>
    ) : null}
    {postSavePrompt ? (
      <View style={styles.journalLoopPromptWrap} pointerEvents="box-none">
        <View
          style={styles.journalLoopPrompt}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`${t("tradeSavedTitle")}. ${isPremium ? t("reviewThisTrade") : t("viewPerformance")}`}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={styles.workflowNextLabel} maxFontSizeMultiplier={1.2}>{t("tradeSavedTitle")}</Text>
            <Text style={styles.journalLoopPromptTitle} maxFontSizeMultiplier={1.3}>
              {isPremium ? t("reviewThisTrade") : t("viewPerformance")}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setPostSavePrompt(false);
              lightHaptic();
              onContinueToReview?.();
            }}
            style={styles.journalLoopPromptCta}
            accessibilityRole="button"
            accessibilityLabel={isPremium ? t("reviewThisTrade") : t("viewPerformance")}
          >
            <Text style={styles.journalLoopPromptCtaText} maxFontSizeMultiplier={1.25}>
              {isPremium ? t("reviewThisTrade") : t("viewPerformance")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPostSavePrompt(false)}
            style={styles.journalLoopPromptDismiss}
            accessibilityRole="button"
            accessibilityLabel={t("maybeLater")}
            hitSlop={8}
          >
            <Text style={styles.journalLoopPromptDismissText} maxFontSizeMultiplier={1.2}>×</Text>
          </Pressable>
        </View>
      </View>
    ) : null}
    </View>
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
  return (
    <EmptyStateCard
      tone="purple"
      title={t("marketIntelEmptyTitle")}
      message={text}
      icon={<Newspaper size={24} color={C.purple} strokeWidth={2.4} />}
    />
  );
}

function MarketIntelligencePanel({ lang }: { lang: Lang }) {
  const [intel, setIntel] = useState<MarketIntelData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (alive) setLoading(true);
      try {
        const data = await loadMarketIntelligence();
        if (alive) setIntel(data);
      } finally {
        if (alive) setLoading(false);
      }
    };
    trackEvent("market_intel_viewed", { source: "cached" });
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const data = intel || { brief: null, watchlist: [], summary: null, events: [], propUpdates: [], headlines: [] };
  return (
    <View style={styles.terminalScreenStack}>
      <MarketSection title={t("dailyBrief")}>
        {loading && !intel ? <AiAnalysisLoading /> : data.brief ? (
          <GlassCard style={styles.marketHeroCard} intensity={30}>
            <View style={styles.rowBetween}>
              <Pill text={data.brief.marketRegime} tone="med" />
              <Text style={styles.sub}>{data.brief.generatedAt ? new Date(data.brief.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : t("cached")}</Text>
            </View>
            <Text style={styles.newsTitle}>{data.brief.title}</Text>
            <Text style={styles.newsSummary}>{data.brief.summary}</Text>
            {!!data.brief.whatNotToDo && <Text style={styles.marketCaution}>{t("doNot")} {data.brief.whatNotToDo}</Text>}
          </GlassCard>
        ) : <MarketEmpty text={t("dailyBriefEmpty")} />}
      </MarketSection>

      <MarketSection title={t("marketSummary")}>
        {data.summary ? (
          <GlassCard style={styles.marketCard} intensity={24}>
            <View style={styles.marketSummaryRow}>
              <SmallMetric l={t("macro")} v={data.summary.macroTone} />
              <SmallMetric l={t("risk")} v={data.summary.riskMode} />
            </View>
            {data.summary.strongestHeadlines.slice(0, 3).map((item) => <Text key={item} style={styles.marketListText}>• {item}</Text>)}
          </GlassCard>
        ) : <MarketEmpty text={t("marketSummaryEmpty")} />}
      </MarketSection>
    </View>
  );
}

function NewsListItem({ item }: { item: MarketNews }) {
  const highImpact = item.impact === "HIGH";
  const impactTone = highImpact ? "high" : item.impact === "MED" ? "med" : "low";
  const accessibilityAssets = ASSETS.map((asset) => {
    const bias = item.bias[asset] || "NEUTRAL";
    return `${asset} ${bias}`;
  }).join(", ");

  return (
    <AnimatedPressable
      testID="news.article"
      accessibilityLabel={`news.article.${item.title}. Impact ${item.impact}. ${accessibilityAssets}. ${item.source}, ${item.time}`}
      accessibilityRole="link"
      onPress={() => {
        trackEvent("news_opened", { source: item.source, impact: item.impact, has_url: !!item.url });
        return item.url ? Linking.openURL(item.url) : undefined;
      }}
    >
      <GlassCard
        style={[styles.newsCard, highImpact && styles.newsCardHigh]}
        intensity={highImpact ? 26 : 16}
        compact
      >
        <Text style={styles.newsHeadline} maxFontSizeMultiplier={1.35}>
          {item.title}
        </Text>
        {!!item.summary ? (
          <Text style={styles.newsCardSummary} numberOfLines={2} maxFontSizeMultiplier={1.25}>
            {item.summary}
          </Text>
        ) : null}
        <View style={styles.newsImpactRow}>
          <Pill text={item.impact} tone={impactTone} />
        </View>
        <View style={styles.newsAssetRow}>
          {ASSETS.map((asset) => {
            const bias = item.bias[asset] || "NEUTRAL";
            const active = bias !== "NEUTRAL";
            const tone = bias === "LONG" ? C.green : bias === "SHORT" ? C.red : C.muted;
            return (
              <View
                key={asset}
                style={[styles.newsAssetChip, active && styles.newsAssetChipActive]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Text style={[styles.newsAssetSymbol, active && { color: C.sub }]} maxFontSizeMultiplier={1.2}>
                  {asset}
                </Text>
                <Text style={[styles.newsAssetBias, { color: tone }]} maxFontSizeMultiplier={1.2}>
                  {bias === "LONG" ? "↑" : bias === "SHORT" ? "↓" : "·"}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.newsTimestamp} maxFontSizeMultiplier={1.2}>
          {item.source} · {item.time}
        </Text>
      </GlassCard>
    </AnimatedPressable>
  );
}

const MemoNewsListItem = React.memo(NewsListItem);

function NewsScreen({
  lang,
  isPremium,
  userId,
  onUpgrade,
}: {
  lang: Lang;
  isPremium: boolean;
  userId: string | null;
  onUpgrade: () => void;
}) {
  const [items, setItems] = useState<MarketNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [faultMode, setFaultMode] = useState<import("../qa/stagingQaNewsFault").StagingNewsFaultMode>("none");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { isStagingNewsFaultAllowed, STAGING_NEWS_FAULT_STORAGE_KEY } = await import(
        "../qa/stagingQaNewsFault"
      );
      if (!isStagingNewsFaultAllowed()) return;
      const raw = await AsyncStorage.getItem(STAGING_NEWS_FAULT_STORAGE_KEY);
      if (!cancelled && raw) {
        setFaultMode(raw as import("../qa/stagingQaNewsFault").StagingNewsFaultMode);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const news = await loadNews({ fault: faultMode });
      setItems(news.items);
      setErrorCode(news.errorCode);
    } finally {
      setLoading(false);
    }
  }, [faultMode]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (alive) setLoading(true);
      try {
        const news = await loadNews({ fault: faultMode });
        if (alive) {
          setItems(news.items);
          setErrorCode(news.errorCode);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [faultMode]);

  const renderNewsItem = useCallback(({ item }: { item: MarketNews }) => (
    <MemoNewsListItem item={item} />
  ), []);
  const newsKeyExtractor = useCallback((item: MarketNews) => item.id, []);
  const newsListHeader = useMemo(
    () => (
      <View>
        <AiNewsSentimentCard
          isPremium={isPremium}
          onUpgrade={onUpgrade}
          userId={userId}
          headlines={items.slice(0, 8).map((item) => ({
            title: item.title,
            summary: item.summary,
            source: item.source,
            time: item.time,
            impact: item.impact,
            symbols: ASSETS.filter((asset) => item.bias[asset] && item.bias[asset] !== "NEUTRAL"),
          }))}
        />
        {errorCode ? (
          <View
            testID="news.error"
            accessibilityLabel={`news.error.${errorCode}`}
            style={{ marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#f59e0b55" }}
          >
            <Text style={{ color: "#f59e0b", marginBottom: 8 }} maxFontSizeMultiplier={1.25}>
              {errorCode === "offline"
                ? t("newsEmptyMessage")
                : errorCode === "timeout"
                  ? t("newsEmptyMessage")
                  : t("newsEmptyMessage")}
            </Text>
            <Pressable
              testID="news.retry"
              accessibilityLabel="news.retry"
              onPress={() => {
                void refresh();
              }}
              style={{ alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#7c3aed55" }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }} maxFontSizeMultiplier={1.2}>
                Retry
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [errorCode, isPremium, items, onUpgrade, refresh, userId],
  );
  const newsListEmpty = useMemo(
    () => (
      <View testID="news.empty" accessibilityLabel="news.empty">
        <EmptyStateCard
          tone="purple"
          title={t("newsEmptyTitle")}
          message={t("newsEmptyMessage")}
          icon={<Newspaper size={24} color={C.purple} strokeWidth={2.4} />}
        />
      </View>
    ),
    [],
  );

  if (loading && !items.length) {
    return (
      <View style={styles.screen} testID="news.screen" accessibilityLabel="news.screen">
        <View style={styles.newsList} testID="news.loading" accessibilityLabel="news.loading">
          <SkeletonStack count={4} tone="lime" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} testID="news.screen" accessibilityLabel="news.screen">
      <FlatList
        testID="news.list"
        accessibilityLabel="news.list"
        style={styles.screen}
        contentContainerStyle={[styles.newsList, styles.newsListNoTitle]}
        data={items}
        keyExtractor={newsKeyExtractor}
        renderItem={renderNewsItem}
        ItemSeparatorComponent={() => <View style={styles.newsItemGap} />}
        refreshing={loading}
        onRefresh={refresh}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
        ListHeaderComponent={newsListHeader}
        ListEmptyComponent={newsListEmpty}
        ListHeaderComponentStyle={{ width: "100%" }}
      />
      <Pressable
        testID="news.refresh"
        accessibilityLabel="news.refresh"
        onPress={() => {
          void refresh();
        }}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0.01 }}
      />
    </View>
  );
}

function SmallMetric({ l, v, value, formatValue }: any) {
  return (
    <AnimatedEntrance style={styles.smallMetric} distance={6}>
      <Text style={styles.label}>{l}</Text>
      {typeof value === "number" ? (
        <CountUpText value={value} durationMs={420} formatValue={formatValue} textStyle={styles.metric} />
      ) : (
        <Text style={styles.metric}>{v}</Text>
      )}
    </AnimatedEntrance>
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
  const { width } = useWindowDimensions();
  const isTabletLayout = width >= 768;
  const [events, setEvents] = useState<EconEvent[]>([]);
  const [selected, setSelected] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (alive) setLoading(true);
      try {
        const d = await loadCalendarEvents();
        if (alive) setEvents(d);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
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
        <SkeletonStack count={4} tone="purple" style={styles.calendarSkeletonStack} />
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
                <Text style={[styles.calendarEventDate, isTabletLayout && styles.calendarEventDateTablet]} numberOfLines={1}>{t("easternTime")}</Text>
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
          <EmptyStateCard
            tone="purple"
            title={t("calendarEmptyTitle")}
            message={t("calendarEmptyMessage")}
            icon={<CalendarDays size={24} color={C.purple} strokeWidth={2.4} />}
          />
        )
      )}
    </ScrollView>
  );
}
function CalcScreen({ lang }: { lang: Lang }) {
  const [symbol, setSymbol] = useState("MES");
  const [mode, setMode] = useState<"ticks" | "points">("ticks");
  const [amount, setAmount] = useState("20");
  const [contracts, setContracts] = useState("1");
  const [sl, setSl] = useState("20");
  const [tp, setTp] = useState("40");
  const [balance, setBalance] = useState("50000");
  const [riskPct, setRiskPct] = useState("1");
  const i = INSTRUMENTS[symbol] || INSTRUMENTS.MES;
  const calc = computeCalculatorResults({
    mode,
    amount,
    contracts,
    stopLoss: sl,
    takeProfit: tp,
    balance,
    riskPct,
    instrument: { tickSize: i.tickSize, tickValue: i.tickValue, name: i.name },
  });
  const unitValue = calc.unitValue;
  const result = calc.resultUsd;
  const risk = calc.riskUsd;
  const reward = calc.rewardUsd;
  const rr = calc.riskReward;
  const maxRiskDollars = calc.maxRiskUsd;
  const formatUsd = formatCalcUsd;
  const resultA11y = `${t("resultInUsd")}. ${formatUsd(result)}. ${amount} ${mode} × $${Number.isFinite(unitValue) ? unitValue.toFixed(2) : "—"} × ${contracts} · ${i.name}`;
  const resetCalc = () => {
    setSymbol("MES");
    setMode("ticks");
    setAmount("20");
    setContracts("1");
    setSl("20");
    setTp("40");
    setBalance("50000");
    setRiskPct("1");
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="calc.screen"
      accessibilityLabel="calc.screen"
    >
      {/* 1. Instrument */}
      <Card delay={0}>
        <View style={styles.calcInstrumentBlock} accessible={false}>
          <Text style={styles.calcSectionLabel} maxFontSizeMultiplier={1.2}>{t("miniContracts")}</Text>
          <View style={styles.instrumentGrid}>
            {MINI_INSTRUMENTS.map((s) => (
              <InstrumentButton key={s} symbol={s} active={symbol === s} onPress={() => setSymbol(s)} testIDPrefix="calc.instrument" />
            ))}
          </View>
        </View>
        <View style={styles.calcInstrumentBlock} accessible={false}>
          <Text style={styles.calcSectionLabel} maxFontSizeMultiplier={1.2}>{t("microContracts")}</Text>
          <View style={styles.instrumentGrid}>
            {MICRO_INSTRUMENTS.map((s) => (
              <InstrumentButton key={s} symbol={s} active={symbol === s} onPress={() => setSymbol(s)} testIDPrefix="calc.instrument" />
            ))}
          </View>
        </View>
        <Input
          testID="calc.instrument.custom"
          accessibilityLabel="calc.instrument.custom"
          label={t("customInstrument")}
          value={symbol}
          onChangeText={(v: string) => setSymbol(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </Card>

      {/* 2. Account / Risk */}
      <Card delay={40}>
        <Text style={styles.calcSectionTitle} maxFontSizeMultiplier={1.25} accessibilityRole="header">
          {t("percentRiskCalculator")}
        </Text>
        <View style={styles.calcFieldRow}>
          <View style={styles.calcFieldCol}>
            <Input
              testID="calc.balance"
              accessibilityLabel="calc.balance"
              label={t("accountBalance")}
              keyboardType="decimal-pad"
              value={balance}
              onChangeText={setBalance}
            />
          </View>
          <View style={styles.calcFieldCol}>
            <Input
              testID="calc.riskPct"
              accessibilityLabel="calc.riskPct"
              label={t("riskPercent")}
              keyboardType="decimal-pad"
              value={riskPct}
              onChangeText={setRiskPct}
            />
          </View>
        </View>
        <View
          style={styles.calcSupportResult}
          accessible
          accessibilityRole="summary"
          testID="calc.maxRisk"
          accessibilityLabel={`${t("maxRisk")}. ${formatUsd(maxRiskDollars)}`}
        >
          <Text style={styles.calcSectionLabel} maxFontSizeMultiplier={1.2} importantForAccessibility="no">{t("maxRisk")}</Text>
          <CountUpText
            value={Number.isFinite(maxRiskDollars) ? maxRiskDollars : 0}
            durationMs={460}
            formatValue={formatUsd}
            numberOfLines={1}
            adjustsFontSizeToFit
            textStyle={styles.calcSupportValue}
          />
          <Text style={styles.calcSupportSub} maxFontSizeMultiplier={1.25} importantForAccessibility="no">
            ${Number(balance || 0).toLocaleString()} × {riskPct || 0}%
          </Text>
        </View>
      </Card>

      {/* 3. Entry & Stop */}
      <Card delay={80}>
        <Text style={styles.calcSectionLabel} maxFontSizeMultiplier={1.2}>{t("mode")}</Text>
        <View style={styles.calcModeRow} accessibilityRole="tablist">
          {(["ticks", "points"] as const).map((m) => {
            const active = mode === m;
            const label = m === "ticks" ? t("ticks") : t("points");
            return (
              <AnimatedPressable
                key={m}
                testID={`calc.mode.${m}`}
                press="listItem"
                haptic
                onPress={() => setMode(m)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`calc.mode.${m}`}
                style={[styles.option, active && { backgroundColor: C.purpleSoft, borderColor: C.purple }]}
                contentStyle={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={[styles.optionText, active && { color: C.text }]} maxFontSizeMultiplier={1.25}>
                  {label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
        <View style={styles.calcFieldRow}>
          <View style={styles.calcFieldCol}>
            <Input
              testID="calc.amount"
              accessibilityLabel="calc.amount"
              label={mode === "ticks" ? t("ticks") : t("points")}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
          <View style={styles.calcFieldCol}>
            <Input
              testID="calc.contracts"
              accessibilityLabel="calc.contracts"
              label={t("contracts")}
              keyboardType="number-pad"
              value={contracts}
              onChangeText={setContracts}
            />
          </View>
        </View>
        <Text style={styles.calcSectionLabel} maxFontSizeMultiplier={1.2}>{t("riskReward")}</Text>
        <View style={styles.calcFieldRow}>
          <View style={styles.calcFieldCol}>
            <Input
              testID="calc.stopLoss"
              accessibilityLabel="calc.stopLoss"
              label={t("slAmount")}
              keyboardType="decimal-pad"
              value={sl}
              onChangeText={setSl}
            />
          </View>
          <View style={styles.calcFieldCol}>
            <Input
              testID="calc.takeProfit"
              accessibilityLabel="calc.takeProfit"
              label={t("tpAmount")}
              keyboardType="decimal-pad"
              value={tp}
              onChangeText={setTp}
            />
          </View>
        </View>
        <AnimatedPressable
          testID="calc.reset"
          accessibilityLabel="calc.reset"
          press="buttonSecondary"
          onPress={resetCalc}
          style={{ marginTop: 8 }}
          contentStyle={[styles.option, { minHeight: 44, justifyContent: "center" }]}
        >
          <Text style={styles.optionText} maxFontSizeMultiplier={1.25}>Reset</Text>
        </AnimatedPressable>
        {calc.errors.length ? (
          <Text testID="calc.validation" accessibilityLabel="calc.validation" style={styles.sub}>
            {calc.errors.join(", ")}
          </Text>
        ) : null}
      </Card>

      {/* 4. Position Size Result — visual anchor */}
      <Card delay={120}>
        <View
          style={styles.resultBox}
          accessible
          accessibilityRole="summary"
          testID="calc.result"
          accessibilityLabel={resultA11y}
        >
          <Text style={styles.calcHeroLabel} maxFontSizeMultiplier={1.2} importantForAccessibility="no">{t("resultInUsd")}</Text>
          <CountUpText
            value={Number.isFinite(result) ? result : 0}
            durationMs={460}
            formatValue={formatUsd}
            numberOfLines={1}
            adjustsFontSizeToFit
            textStyle={styles.result}
          />
          <Text style={styles.calcHeroSub} maxFontSizeMultiplier={1.3} importantForAccessibility="no">
            {amount} {mode} × ${Number.isFinite(unitValue) ? unitValue.toFixed(2) : "—"} × {contracts} · {i.name}
          </Text>
        </View>
      </Card>

      {/* 5. Additional Details */}
      <Card delay={160}>
        <Text style={styles.calcSectionTitle} maxFontSizeMultiplier={1.25} accessibilityRole="header">
          {t("rrCalculator")}
        </Text>
        <View style={styles.calcMetricRow}>
          <SmallMetric l={t("riskLabel")} value={risk} formatValue={(value: number) => `$${value.toFixed(2)}`} />
          <SmallMetric l={t("rewardHeading")} value={reward} formatValue={(value: number) => `$${value.toFixed(2)}`} />
          <SmallMetric l="RR" value={rr || undefined} v={rr ? `1:${rr.toFixed(2)}` : "—"} formatValue={(value: number) => `1:${value.toFixed(2)}`} />
        </View>
      </Card>
    </ScrollView>
  );
}
type ProBenefitTone = "purple" | "lime";

const PRO_BENEFIT_SECTIONS: Array<{
  titleKey: string;
  bodyKey: string;
  tone: ProBenefitTone;
  Icon: typeof BrainCircuit;
}> = [
  { titleKey: "paywallBenefitCoachTitle", bodyKey: "paywallBenefitCoachBody", tone: "purple", Icon: BrainCircuit },
  { titleKey: "paywallBenefitLeaksTitle", bodyKey: "paywallBenefitLeaksBody", tone: "lime", Icon: Target },
  { titleKey: "paywallBenefitPropTitle", bodyKey: "paywallBenefitPropBody", tone: "purple", Icon: ShieldCheck },
  { titleKey: "paywallBenefitJournalTitle", bodyKey: "paywallBenefitJournalBody", tone: "lime", Icon: FileText },
  { titleKey: "paywallBenefitAnalyticsTitle", bodyKey: "paywallBenefitAnalyticsBody", tone: "purple", Icon: ChartColumnIncreasing },
  { titleKey: "paywallBenefitPatternsTitle", bodyKey: "paywallBenefitPatternsBody", tone: "lime", Icon: Sparkles },
  { titleKey: "paywallBenefitMarketTitle", bodyKey: "paywallBenefitMarketBody", tone: "purple", Icon: Newspaper },
  { titleKey: "paywallBenefitExportTitle", bodyKey: "paywallBenefitExportBody", tone: "lime", Icon: Share2 },
  { titleKey: "paywallBenefitProgressTitle", bodyKey: "paywallBenefitProgressBody", tone: "purple", Icon: Trophy },
];

function ProBenefitSectionList({ compact = false }: { compact?: boolean }) {
  return (
    <View style={compact ? styles.proBenefitStack : styles.paywallFeatureGrid}>
      {PRO_BENEFIT_SECTIONS.map((item) => (
        <PremiumCard
          key={item.titleKey}
          tone={item.tone}
          compact
          style={[styles.paywallFeatureCard, compact && styles.proBenefitStackCard]}
          contentStyle={[styles.paywallFeatureContent, compact && styles.proBenefitStackContent]}
        >
          <View style={[styles.paywallFeatureIcon, item.tone === "lime" ? styles.paywallFeatureIconLime : styles.paywallFeatureIconPurple]}>
            <item.Icon size={18} color={item.tone === "lime" ? C.green : C.purple} strokeWidth={UI_ICON_STROKE} />
          </View>
          <Text style={styles.paywallFeatureTitle} numberOfLines={2}>
            {t(item.titleKey)}
          </Text>
          <Text style={styles.paywallFeatureBody} numberOfLines={compact ? 2 : 3}>
            {t(item.bodyKey)}
          </Text>
        </PremiumCard>
      ))}
    </View>
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
  const monthly = packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null;
  const yearly = packages.find((pkg) => packageTitle(pkg) === "YEARLY") || null;
  const monthlyProduct =
    storeProducts.find((product) => product.identifier === YOU_TRADER_MONTHLY_PRODUCT_ID) || null;
  const yearlyProduct =
    storeProducts.find((product) => product.identifier === YOU_TRADER_YEARLY_PRODUCT_ID) || null;
  const yearlyPriceLabel = yearly
    ? packagePrice(yearly)
    : yearlyProduct?.priceString || PREMIUM_PRICE_YEARLY;
  const entrance = useRef(new Animated.Value(0)).current;
  const primaryPrice = packagePrice(monthly);

  useEffect(() => {
    trackEvent("paywall_viewed", { screen: "premium_screen" });
    Animated.timing(entrance, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const entranceStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
      },
    ],
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.modalHeader}>
        <Text style={styles.h1NoMargin}>{t("premiumLocked")}</Text>
        <Pressable
          onPress={onClose}
          style={styles.closeCircle}
          testID="acquisition-paywall-close"
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <Text style={styles.closeX}>×</Text>
        </Pressable>
      </View>
      <Animated.View style={entranceStyle}>
        <GlowBorderCard tone="purple" radius={28} contentStyle={styles.premiumPaywallCard}>
          <View style={styles.premiumPaywallGlowLime} pointerEvents="none" />
          <View style={styles.premiumPaywallGlowPurple} pointerEvents="none" />
          <View style={styles.paywallHeroTop}>
            <View style={styles.paywallHeroCopy}>
              <Text style={styles.paywallKicker}>{t("premiumAccess")}</Text>
              <Text style={styles.paywallHeroTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78}>
                {t("paywallHeroTitle")}
              </Text>
              <Text style={styles.paywallHeroSub}>{t("premiumLockedText")}</Text>
            </View>
            <View style={styles.paywallTerminalBadge}>
              <Text style={styles.paywallTerminalBadgeText}>PRO</Text>
              <View style={styles.paywallTerminalDots}>
                <View style={[styles.paywallTerminalDot, { backgroundColor: C.green }]} />
                <View style={[styles.paywallTerminalDot, { backgroundColor: C.purple }]} />
              </View>
            </View>
          </View>

          {purchaseBusy ? (
            <PremiumCard tone="purple" compact style={styles.paywallBusyCard} contentStyle={styles.paywallBusyContent}>
              <View style={styles.paywallBusyHeader}>
                <StatusSpinner size="sm" accessibilityLabel={t("paywallProcessingTitle")} style={{ marginVertical: 0 }} />
                <Text style={styles.paywallBusyTitle}>{t("paywallProcessingTitle")}</Text>
              </View>
              <PremiumLoadingBar progress={0.68} tone="lime" height={4} />
              <Text style={styles.paywallBusyText}>{t("paywallProcessingBody")}</Text>
            </PremiumCard>
          ) : null}

          <ProBenefitSectionList compact />

          <NeonDivider tone="purple" style={styles.paywallDivider} />

          {!monthly && !yearly && !monthlyProduct && !yearlyProduct ? (
            <PremiumCard tone="purple" compact style={styles.paywallBusyCard} contentStyle={styles.paywallBusyContent}>
              <Text style={styles.paywallBusyTitle}>{t("subscription.unavailableTitle")}</Text>
              <Text style={styles.paywallBusyText}>{t("subscription.unavailableBody")}</Text>
              {(showRestorePurchases || !!paywallError) ? (
                <AnimatedPressable
                  disabled={purchaseBusy}
                  onPress={onRestore}
                  style={styles.paywallRestorePressable}
                  contentStyle={[styles.secondaryBig, styles.restorePurchaseBtn, styles.paywallRestoreBtn, purchaseBusy && styles.disabledBtn]}
                >
                  <Text style={styles.secondaryText}>{purchaseBusy ? t("checking") : t("restorePurchases")}</Text>
                </AnimatedPressable>
              ) : null}
              {paywallError ? (
                <StatusInlineMessage kind="error" title={t("purchaseIssue")} message={paywallError} />
              ) : null}
            </PremiumCard>
          ) : (
            <>
          <View style={styles.planRow}>
            <AnimatedPressable
              disabled={purchaseBusy}
              haptic
              onPress={() => onPurchase(monthly, YOU_TRADER_MONTHLY_PRODUCT_ID)}
              style={styles.planPressable}
              contentStyle={styles.monthlyPlan}
            >
              <Text style={styles.planName}>{t("monthlyPlan")}</Text>
              <Text style={styles.planPrice}>{primaryPrice}</Text>
              <Text style={styles.planCaption}>{t("paywallPlanMonthlyCaption")}</Text>
            </AnimatedPressable>
            <AnimatedPressable
              disabled={purchaseBusy}
              haptic
              onPress={() => onPurchase(yearly, YOU_TRADER_YEARLY_PRODUCT_ID)}
              style={styles.planPressable}
              contentStyle={styles.yearlyPlan}
            >
              <View style={styles.bestValueBadge}>
                <Text style={styles.bestValueText}>{t("bestValue")}</Text>
              </View>
              <Text style={styles.planName}>{t("yearlyPlan")}</Text>
              <Text style={styles.planPrice}>{yearlyPriceLabel}</Text>
              <Text style={styles.planCaption}>{t("paywallPlanYearlyCaption")}</Text>
            </AnimatedPressable>
          </View>

          <AnimatedPressable
            disabled={purchaseBusy}
            haptic
            onPress={() => onPurchase(monthly, YOU_TRADER_MONTHLY_PRODUCT_ID)}
            style={styles.paywallCtaPressable}
            contentStyle={[styles.primaryBig, styles.paywallPrimaryCta, purchaseBusy && styles.disabledBtn]}
          >
            <Text style={styles.primaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
              {purchaseBusy ? t("connecting") : t("startSevenDayPro")}
            </Text>
            {!purchaseBusy ? <Text style={styles.paywallCtaSub}>{t("paywallCtaSub")}</Text> : null}
          </AnimatedPressable>

          <AnimatedPressable
            disabled={purchaseBusy}
            onPress={onRestore}
            style={styles.paywallRestorePressable}
            contentStyle={[styles.secondaryBig, styles.restorePurchaseBtn, styles.paywallRestoreBtn, purchaseBusy && styles.disabledBtn]}
          >
            <Text style={styles.secondaryText}>{purchaseBusy ? t("checking") : t("restorePurchases")}</Text>
            <Text style={styles.paywallRestoreHint}>{t("paywallRestoreHint")}</Text>
          </AnimatedPressable>

          {paywallError ? (
            <StatusInlineMessage
              kind="error"
              title={t("purchaseIssue")}
              message={paywallError}
            />
          ) : (
            <View style={styles.paywallFeedbackNeutral}>
              <Text style={styles.paywallFeedbackTitle}>{t("paywallSecureTitle")}</Text>
              <Text style={styles.paywallFeedbackText}>{t("paywallSecureBody")}</Text>
            </View>
          )}
            </>
          )}

          <SubscriptionLegalDisclosure
            monthlyPackage={monthly}
            monthlyProduct={monthlyProduct}
            yearlyPackage={yearly}
            yearlyProduct={yearlyProduct}
          />
        </GlowBorderCard>
      </Animated.View>
    </ScrollView>
  );
}

function SettingsBenefitLine({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.settingsBenefit}>
      <Check size={16} color={C.green} strokeWidth={UI_ICON_STROKE} />
      <Text style={styles.settingsBenefitText}>{children}</Text>
    </View>
  );
}

function SettingsScreen({
  lang,
  setLang,
  session,
  authBusy,
  authConfigured,
  isPremium,
  entitlementResolving = false,
  customerInfo,
  packages,
  storeProducts,
  purchaseBusy,
  revenueCatConfigured,
  paywallError,
  showRestorePurchases,
  onPurchase,
  onRestore,
  onSignIn,
  onSignOut,
  onChangePassword,
  onChangeEmail,
  calendarEvents,
  onUpgrade,
  onViewPlans,
  onRefreshCustomerInfo,
  refreshDailyPropBuffer,
  trades,
}: {
  lang: Lang;
  setLang: (x: Lang) => void;
  session: Session | null;
  authBusy: boolean;
  authConfigured: boolean;
  isPremium: boolean;
  entitlementResolving?: boolean;
  customerInfo: CustomerInfo | null;
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  revenueCatConfigured: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
  onSignIn: (provider: AuthProvider) => void;
  onSignOut: (options?: { force?: boolean }) => void;
  onChangePassword: (password: string) => Promise<void>;
  onChangeEmail: (email: string) => Promise<void>;
  calendarEvents: EconEvent[];
  onUpgrade: () => void;
  onViewPlans: () => void;
  onRefreshCustomerInfo: () => void;
  refreshDailyPropBuffer: () => Promise<void>;
  trades: Trade[];
}) {
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [accountPane, setAccountPane] = useState<"root" | "account">("root");
  const insets = useSafeAreaInsets();
  const choose = (l: Lang) => {
    void changeAppLanguage(l).then(() => setLang(l));
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

  const subscriptionPresentation =
    isPremium && !entitlementResolving
      ? buildSettingsSubscriptionPresentation(customerInfo, REVENUECAT_ENTITLEMENT_ID, {
          storeProducts,
        })
      : null;
  const subscriptionCardActive = isPremium && !entitlementResolving;

  useEffect(() => {
    if (!subscriptionPresentation?.expirationLooksStale) return;
    onRefreshCustomerInfo();
  }, [subscriptionPresentation?.expirationIso, subscriptionPresentation?.expirationLooksStale]);
  // onRefreshCustomerInfo is intentionally omitted — parent passes a fresh inline closure.

  if (accountPane === "account") {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          styles.settingsStack,
          { flexGrow: 1, paddingBottom: Math.max(48, insets.bottom + 88) },
        ]}
        testID="settings-account-pane"
      >
        <SettingsAccountSection
          mode="details"
          session={session}
          authBusy={authBusy}
          authConfigured={authConfigured}
          onBack={() => setAccountPane("root")}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          onChangeEmail={() => setChangeEmailOpen(true)}
          onChangePassword={() => setChangePasswordOpen(true)}
        />
        <ChangePasswordModal
          visible={changePasswordOpen}
          onClose={() => setChangePasswordOpen(false)}
          onSubmit={onChangePassword}
        />
        <ChangeEmailModal
          visible={changeEmailOpen}
          onClose={() => setChangeEmailOpen(false)}
          onSubmit={onChangeEmail}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        styles.settingsStack,
        { flexGrow: 1, justifyContent: "space-between", paddingBottom: Math.max(48, insets.bottom + 88) },
      ]}
      testID="settings-root"
    >
      <View style={styles.settingsStack}>
        <SettingsAccountSection
          mode="row"
          session={session}
          authBusy={authBusy}
          authConfigured={authConfigured}
          onOpenDetails={() => setAccountPane("account")}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          onChangeEmail={() => setChangeEmailOpen(true)}
          onChangePassword={() => setChangePasswordOpen(true)}
        />

        <ChangePasswordModal
          visible={changePasswordOpen}
          onClose={() => setChangePasswordOpen(false)}
          onSubmit={onChangePassword}
        />
        <ChangeEmailModal
          visible={changeEmailOpen}
          onClose={() => setChangeEmailOpen(false)}
          onSubmit={onChangeEmail}
        />

        <GlassCard style={[styles.proSubscriptionCard, styles.settingsQuietCard]} intensity={36} testID="settings-subscription-section">
          <Text style={[styles.settingsSectionTitle, styles.proSubscriptionTitle]} maxFontSizeMultiplier={1.25}>
            {t("more.subscription")}
          </Text>
          <View
            style={[styles.proStatusBox, subscriptionCardActive ? styles.proStatusActive : styles.proStatusLocked]}
            testID="settings-subscription-card"
          >
            <View style={[styles.proStatusIcon, subscriptionCardActive ? styles.proStatusIconActive : styles.proStatusIconLocked]}>
              {subscriptionCardActive ? <Unlock size={22} color={C.green} strokeWidth={2.4} /> : <Lock size={22} color={C.purple} strokeWidth={2.4} />}
            </View>
            <View style={styles.proStatusCopy}>
              {entitlementResolving ? (
                <>
                  <Text style={[styles.proStatusTitle, styles.proStatusTitleActive]} maxFontSizeMultiplier={1.25}>
                    {t("subscription.proActive")}
                  </Text>
                  <Text style={styles.proStatusText} maxFontSizeMultiplier={1.25} testID="settings-subscription-resolving">
                    {t("checking")}
                  </Text>
                </>
              ) : subscriptionPresentation ? (
                <>
                  <Text style={[styles.proStatusTitle, styles.proStatusTitleActive]} maxFontSizeMultiplier={1.25}>
                    {`${t("subscription.currentPlan")}\n${subscriptionPresentation.planLabel}`}
                  </Text>
                  {subscriptionPresentation.priceLabel ? (
                    <Text style={styles.proStatusText} maxFontSizeMultiplier={1.25}>
                      {subscriptionPresentation.priceLabel}
                    </Text>
                  ) : null}
                  {subscriptionPresentation.renewalLine ? (
                    <Text
                      style={styles.proStatusText}
                      maxFontSizeMultiplier={1.25}
                      testID="settings-subscription-renewal"
                    >
                      {subscriptionPresentation.renewalLine}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text
                    style={[styles.proStatusTitle, styles.proStatusTitleLocked]}
                    maxFontSizeMultiplier={1.25}
                  >
                    {t("subscription.proActive")}
                  </Text>
                  <Text style={styles.proStatusText} maxFontSizeMultiplier={1.25}>
                    {t("subscription.noActiveSubscription")}
                  </Text>
                </>
              )}
            </View>
          </View>
          {entitlementResolving ? null : subscriptionCardActive ? (
            <Pressable
              onPress={() =>
                openSubscriptionManagement(subscriptionPresentation?.managementURL)
              }
              style={[styles.secondaryBig, styles.restorePurchaseBtn]}
              accessibilityRole="button"
              accessibilityLabel={t("manageSubscription")}
              testID="settings-manage-subscription"
            >
              <Text style={styles.secondaryText}>{t("manageSubscription")}</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={onViewPlans}
                style={styles.secondaryBig}
                accessibilityRole="button"
                accessibilityLabel={t("viewPlans")}
                testID="settings-view-plans"
              >
                <Text style={styles.secondaryText}>{t("viewPlans")}</Text>
              </Pressable>
              {(showRestorePurchases || !!paywallError) ? (
                <Pressable
                  disabled={purchaseBusy}
                  onPress={onRestore}
                  style={[styles.secondaryBig, styles.restorePurchaseBtn, purchaseBusy && styles.disabledBtn]}
                  accessibilityRole="button"
                  accessibilityLabel={purchaseBusy ? t("checking") : t("restorePurchases")}
                  testID="settings-restore-purchases"
                >
                  <Text style={styles.secondaryText}>{purchaseBusy ? t("checking") : t("restorePurchases")}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          {!!paywallError && <StatusInlineMessage kind="error" message={paywallError} style={{ marginTop: 8 }} />}
        </GlassCard>

        <Card style={[styles.notificationsCard, styles.settingsQuietCard]}>
          <Text style={[styles.settingsSectionTitle, styles.notificationsTitle]} maxFontSizeMultiplier={1.25}>{t("notifications")}</Text>
          <SmartNotificationsSection
            isPro={isPremium}
            calendarEvents={calendarEvents.map((e) => ({
              id: e.id,
              date: e.date,
              time: e.time,
              name: e.name,
            }))}
            onUpgrade={onUpgrade}
            refreshDailyPropBuffer={refreshDailyPropBuffer}
          />
        </Card>

        <Card style={styles.settingsQuietCard}>
          <Text style={styles.settingsSectionTitle} maxFontSizeMultiplier={1.25}>{t("language")}</Text>
          <View style={styles.settingsLangRow} accessibilityRole="tablist">
            {(["en", "ru", "es", "fr", "it", "uk", "de"] as Lang[]).map((l) => {
              const active = lang === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => choose(l)}
                  style={[styles.settingsLangChip, active && styles.settingsLangChipActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={l.toUpperCase()}
                >
                  <Text style={styles.settingsLangChipText} maxFontSizeMultiplier={1.2}>{l.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {isStagingBuildFingerprintVisible() ? (
          <Card style={styles.settingsQuietCard} testID="settings-developer-diagnostics">
            <Text
              style={styles.settingsSectionTitle}
              maxFontSizeMultiplier={1.25}
              accessibilityLabel="Developer Diagnostics"
            >
              Developer Diagnostics
            </Text>
            <Text style={styles.settingsSectionSub} maxFontSizeMultiplier={1.25}>
              Staging-only build fingerprint for QA. Not shown in production.
            </Text>
            {buildFingerprintDiagnosticLines().map((line) => (
              <Text
                key={line}
                style={[styles.settingsSectionSub, { marginTop: 4 }]}
                maxFontSizeMultiplier={1.2}
                selectable
                testID="settings-build-fingerprint-line"
              >
                {line}
              </Text>
            ))}
          </Card>
        ) : null}

        <Card style={styles.settingsQuietCard}>
          <Text style={styles.settingsSectionTitle} maxFontSizeMultiplier={1.25}>Legal</Text>
          <Pressable onPress={() => Alert.alert(t("termsRiskPrivacy"), legalInfo)} style={styles.legalRow} accessibilityRole="button" accessibilityLabel={t("termsRiskPrivacy")}>
            <Text style={styles.legalText} maxFontSizeMultiplier={1.25}>{t("termsRiskPrivacy")}</Text>
            <Text style={styles.legalArrow}>›</Text>
          </Pressable>
          <Pressable onPress={() => openLegalUrl(TERMS_OF_USE_EULA_URL, "Terms of Use (EULA)")} style={[styles.legalRow, { borderBottomWidth: 0 }]} accessibilityRole="button" accessibilityLabel="Terms of Use (EULA)">
            <Text style={styles.legalText} maxFontSizeMultiplier={1.25}>Terms of Use (EULA)</Text>
            <Text style={styles.legalArrow}>›</Text>
          </Pressable>
        </Card>

        <Card style={styles.settingsQuietCard}>
          <Text style={styles.settingsSectionTitle} maxFontSizeMultiplier={1.25}>Support</Text>
          <Text style={styles.settingsSectionSub} maxFontSizeMultiplier={1.25}>
            Contact us or report bugs and app issues.
          </Text>
          <Pressable
            onPress={() => Linking.openURL("mailto:support@borovikgroup.com?subject=YouTrader Support")}
            style={[styles.workflowGhostAction, { marginTop: 8, alignItems: "flex-start" }]}
            accessibilityRole="link"
            accessibilityLabel="support@borovikgroup.com"
          >
            <Text style={[styles.settingsSectionSub, { color: C.sub, textDecorationLine: "underline" }]}>support@borovikgroup.com</Text>
          </Pressable>
        </Card>
      </View>

      <View>
        <Text style={styles.versionText}>{appVersionDisplayLabel()}</Text>
        <Text style={styles.madeByText}>{t("madeByTraders")}</Text>
      </View>
    </ScrollView>
  );
}

function TabGlyph({ id, active }: { id: Tab; active: boolean }) {
  const theme = useYdlTheme("dark");
  // All tab glyphs stay lime; inactive uses reduced opacity (still visibly lime).
  const color = theme.colors.action.primary;
  const iconProps = {
    size: UI_ICON_SIZE + 5,
    color,
    strokeWidth: UI_ICON_STROKE,
    opacity: active ? 1 : 0.58,
  };
  if (id === "journal") return <BookOpen {...iconProps} />;
  if (id === "stats") return <ChartColumnIncreasing {...iconProps} />;
  if (id === "propPass") return <ShieldCheck {...iconProps} />;
  if (id === "calc") return <CalculatorIcon {...iconProps} />;
  if (id === "news") return <Newspaper {...iconProps} />;
  if (id === "calendar") return <CalendarDays {...iconProps} />;
  if (id === "settings") return <SettingsIcon {...iconProps} />;
  if (id === "more") return <Ellipsis {...iconProps} />;
  return null;
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
    logStartupError("root_error_boundary", error);
    captureAppError(error, { componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.app}>
          <View style={styles.errorBoundaryScreen}>
            <StartupFailureFallback
              reasonCode="root_render_error"
              onRetry={() => this.setState({ error: null })}
            />
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

function App({ onVisibleShell }: { onVisibleShell?: () => void } = {}) {
  const firstRenderLogged = useRef(false);
  const authReadyLogged = useRef(false);
  const shellTheme = useYdlTheme("dark");
  const [tab, setTab] = useState<Tab>("journal");
  const [qaResetPhase, setQaResetPhase] = useState<
    import("../qa/stagingQaResetState").StagingQaResetPhase
  >("idle");
  const [qaResetMode, setQaResetMode] = useState<string | null>(null);
  const [qaResetError, setQaResetError] = useState<string | null>(null);
  const showStagingQaResetMarkers =
    sanitizedRuntimeConfigReport().appEnvironment === "staging" ||
    sanitizedRuntimeConfigReport().appEnvironment === "development" ||
    (typeof __DEV__ !== "undefined" && __DEV__);
  const stagingQaResetOverlay =
    showStagingQaResetMarkers && qaResetPhase !== "idle" ? (
      <StagingQaResetMarkers phase={qaResetPhase} mode={qaResetMode} error={qaResetError} />
    ) : null;
  const [qaApplyEditRequest, setQaApplyEditRequest] = useState<{ url: string; nonce: number } | null>(
    null,
  );
  const [qaNewsFaultEpoch, setQaNewsFaultEpoch] = useState(0);
  const [qaPropPassEpoch, setQaPropPassEpoch] = useState(0);
  const [moreDestination, setMoreDestination] = useState<MoreDestination | "hub">("hub");
  const [qaPropPassPayload, setQaPropPassPayload] = useState<
    import("../qa/stagingQaPropPassState").StagingPropPassQaPayload | null
  >(null);
  const onQaApplyEditConsumed = useCallback(() => {
    setQaApplyEditRequest(null);
  }, []);
  const clearQaApplyEditRequest = useCallback(() => {
    setQaApplyEditRequest(null);
  }, []);
  const [lang, setLang] = useState<Lang>("en");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesHydrated, setTradesHydrated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const [authHydrated, setAuthHydrated] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [revenueCatReady, setRevenueCatReady] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [proAccess, setProAccess] = useState<ProAccessState>(() => emptyProAccessState());
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [storeProducts, setStoreProducts] = useState<PurchasesStoreProduct[]>([]);
  const [paywallError, setPaywallError] = useState("");
  const [showRestorePurchases, setShowRestorePurchases] = useState(false);
  const [acquisitionHydrated, setAcquisitionHydrated] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [paywallCompleted, setPaywallCompleted] = useState(false);
  /** In-flight explicit logout — suppresses acquisition paywall flash. */
  const [loggingOut, setLoggingOut] = useState(false);
  /** Sticky AUTH_REQUIRED after Settings → Log Out (persisted across restart). */
  const [explicitAuthRequired, setExplicitAuthRequired] = useState(false);
  const signingOutRef = useRef(false);
  /** Tracks prior session id so sticky clears only on login, never mid-logout. */
  const prevSessionUserIdRef = useRef<string | null>(null);
  const loggingOutRef = useRef(false);
  const explicitAuthRequiredRef = useRef(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"off" | "syncing" | "synced" | "error">("off");
  const [cloudSyncMessage, setCloudSyncMessage] = useState("Sign in and upgrade to Pro to sync your journal.");
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [propRiskOpen, setPropRiskOpen] = useState(false);
  const [propRiskDate, setPropRiskDate] = useState(todayISO());
  const [propTemplates, setPropTemplates] = useState<RiskTemplate[]>([]);
  const [propRulesMeta, setPropRulesMeta] = useState<{ source: "remote" | "cache" | "fallback"; updatedAt?: string }>({
    source: "fallback",
  });
  const [pushCalendarEvents, setPushCalendarEvents] = useState<EconEvent[]>([]);
  const [shareExportHostReady, setShareExportHostReady] = useState(false);
  const purchasesConfigured = useRef(false);
  const [anonymousEntitlementStatus, setAnonymousEntitlementStatus] = useState<"loading" | "active" | "inactive" | "unknown">("unknown");
  const anonymousCustomerInfoRef = useRef<CustomerInfo | null>(null);
  const anonymousEntitlementHydratedRef = useRef(false);
  const cloudSyncInFlight = useRef(false);
  const activeSessionUserIdRef = useRef<string | null>(null);
  const customerInfoRef = useRef<CustomerInfo | null>(null);
  const serverEntitlementActiveRef = useRef(false);
  const identitySyncGenerationRef = useRef(0);
  const [identitySyncFailed, setIdentitySyncFailed] = useState(false);
  const [identitySyncPending, setIdentitySyncPending] = useState(false);
  const revenueCatIdentityRef = useRef(
    new RevenueCatIdentitySynchronizer<CustomerInfo>(
      {
        getAppUserID: () => Purchases.getAppUserID(),
        getCustomerInfo: () => Purchases.getCustomerInfo(),
        logIn: (appUserID) => Purchases.logIn(appUserID),
      },
      { isConfigured: () => purchasesConfigured.current },
    ),
  );

  const authConfigured = isSupabaseConfigured;
  const authRequired = isSupabaseConfigured;
  const revenueCatConfigured = isRevenueCatConfigured;
  const isPremium = proAccess.isPro;
  // Prop Pass follows active CustomerInfo entitlement directly. Do not use a
  // local premium flag, a subscription-card label, a server mirror, or a
  // staging allowlist to decide this product's state.
  const entitlementUiPhase = decideEntitlementUiPhase({
    identitySyncPending: !!session?.user?.id && identitySyncPending,
    identitySyncFailed,
    isPro: isPremium,
  });
  const propPassEntitled =
    !!session?.user?.id &&
    entitlementUiPhase === "entitled" &&
    hasActivePropPassEntitlement(
      customerInfo,
      REVENUECAT_ENTITLEMENT_ID,
      YOU_TRADER_PRO_PRODUCT_IDS,
    );
  const cloudSyncEnabled = authConfigured && !!session?.user.id;
  const currentTradeSignature = useMemo(() => tradesSignature(trades), [trades]);
  /** Legacy key — still honored so existing installs are not re-paywalled. */
  const POST_AUTH_PAYWALL_SEEN_KEY = "yt-post-auth-paywall-seen-v1";

  useEffect(() => {
    if (!authHydrated) return;
    let cancelled = false;
    void (async () => {
      try {
        const [onboarding, devicePaywall, legacyPaywall, authRequiredFlag] = await Promise.all([
          AsyncStorage.getItem(ACQUISITION_ONBOARDING_KEY),
          AsyncStorage.getItem(ACQUISITION_PAYWALL_DEVICE_KEY),
          AsyncStorage.getItem(POST_AUTH_PAYWALL_SEEN_KEY),
          AsyncStorage.getItem(ACQUISITION_AUTH_REQUIRED_KEY),
        ]);
        // Clear legacy guest flag — free/guest access is removed.
        void AsyncStorage.removeItem(ACQUISITION_GUEST_KEY);
        let paywallDone = devicePaywall === "1" || legacyPaywall === "1" || isPremium;
        let onboardingDone = onboarding === "1";
        let authRequiredSticky = authRequiredFlag === "1";
        const userId = session?.user?.id;
        if (userId) {
          const userPaywall = await AsyncStorage.getItem(acquisitionPaywallUserKey(userId));
          if (userPaywall === "1") paywallDone = true;
          // Existing authenticated users skip marketing onboarding once.
          if (!onboardingDone) {
            onboardingDone = true;
            void AsyncStorage.setItem(ACQUISITION_ONBOARDING_KEY, "1");
          }
          // Successful session clears sticky AUTH_REQUIRED from a prior logout.
          if (authRequiredSticky) {
            authRequiredSticky = false;
            void AsyncStorage.removeItem(ACQUISITION_AUTH_REQUIRED_KEY);
          }
        }
        if (cancelled) return;
        setOnboardingCompleted(onboardingDone);
        setPaywallCompleted(paywallDone);
        setExplicitAuthRequired((prev) =>
          mergeExplicitAuthRequiredFlag({
            hasSession: !!userId,
            storageSticky: authRequiredSticky,
            previous: prev || explicitAuthRequiredRef.current,
          }),
        );
        if (userId) {
          explicitAuthRequiredRef.current = false;
        } else if (authRequiredSticky || explicitAuthRequiredRef.current) {
          explicitAuthRequiredRef.current = true;
        }
        setAcquisitionHydrated(true);
      } catch {
        if (!cancelled) {
          setOnboardingCompleted(false);
          setPaywallCompleted(isPremium);
          setAcquisitionHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHydrated, isPremium, session?.user?.id]);

  useEffect(() => {
    const nextUserId = session?.user?.id ?? null;
    const previousUserId = prevSessionUserIdRef.current;
    prevSessionUserIdRef.current = nextUserId;
    if (
      !shouldClearExplicitAuthRequiredOnSessionChange({
        explicitAuthRequired,
        loggingOut: loggingOut || loggingOutRef.current,
        previousUserId,
        nextUserId,
      })
    ) {
      return;
    }
    explicitAuthRequiredRef.current = false;
    setExplicitAuthRequired(false);
    void AsyncStorage.removeItem(ACQUISITION_AUTH_REQUIRED_KEY);
  }, [explicitAuthRequired, loggingOut, session?.user?.id]);

  useEffect(() => {
    if (isPremium) setPaywallCompleted(true);
  }, [isPremium]);

  useEffect(() => {
    // Tab always stays in the dock; only QA force-hide may remove it.
    // Entitled content is Active Pro → InternalScreen (allowlist gates engine inside).
    const tabPresent = !(qaPropPassPayload?.forceHidePropPassTab);
    if (tab === "propPass" && !tabPresent) setTab("journal");
  }, [qaPropPassPayload?.forceHidePropPassTab, tab]);

  const completeProductOnboarding = useCallback(() => {
    setOnboardingCompleted(true);
    void AsyncStorage.setItem(ACQUISITION_ONBOARDING_KEY, "1");
  }, []);

  const markPaywallAcknowledged = useCallback(() => {
    setPaywallCompleted(true);
    void AsyncStorage.setItem(ACQUISITION_PAYWALL_DEVICE_KEY, "1");
    void AsyncStorage.setItem(POST_AUTH_PAYWALL_SEEN_KEY, "1");
    const userId = session?.user?.id;
    if (userId) {
      void AsyncStorage.setItem(acquisitionPaywallUserKey(userId), "1");
    }
  }, [session?.user?.id]);


  const appReady = tradesHydrated && authHydrated;
  const anonymousEntitlementActive = anonymousEntitlementStatus === "active";
  const acquisitionPhase = resolveAcquisitionPhase({
    hydrated: appReady && acquisitionHydrated,
    onboardingCompleted,
    paywallCompleted,
    authRequired,
    hasSession: !!session?.user,
    isPremium,
    revenueCatReady: !revenueCatConfigured || revenueCatReady,
    identitySyncPending: !!session?.user?.id && identitySyncPending,
    identitySyncFailed: !!session?.user?.id && identitySyncFailed,
    loggingOut: loggingOut || loggingOutRef.current,
    explicitAuthRequired: explicitAuthRequired || explicitAuthRequiredRef.current,
    anonymousEntitlementActive,
  });

  useEffect(() => {
    if (!showStagingQaResetMarkers) return;
    if (
      acquisitionPhase !== "auth" &&
      acquisitionPhase !== "onboarding" &&
      acquisitionPhase !== "paywall" &&
      acquisitionPhase !== "main" &&
      acquisitionPhase !== "loading"
    ) {
      return;
    }
    let cancelled = false;
    void AsyncStorage.getItem("yt-qa-reset-complete-v1").then((mode) => {
      if (cancelled || !mode) return;
      setQaResetPhase("reset_complete");
      setQaResetMode(mode);
    });
    return () => {
      cancelled = true;
    };
  }, [acquisitionPhase, showStagingQaResetMarkers]);

  const propPassTabVisible = !(qaPropPassPayload?.forceHidePropPassTab);
  // Active Pro → InternalScreen; none → Locked Preview. Staging allowlist does not
  // gate this swap (Release bundles often omit dynamic EXPO_PUBLIC_* peek env).
  const qaTabIds = [
    "journal",
    ...(propPassTabVisible ? (["propPass"] as const) : []),
    "stats",
    "more",
    "settings",
  ];
  useDeviceQaCaptureWalk({
    phase: acquisitionPhase,
    tab,
    tabIds: qaTabIds,
    setTab: (id) => setTab(id as Tab),
    ready:
      isDeviceQaCaptureEnabled() &&
      appReady &&
      acquisitionHydrated &&
      acquisitionPhase !== "loading",
    onAdvanceFromOnboarding: completeProductOnboarding,
    onAdvanceFromPaywall: markPaywallAcknowledged,
  });

  useLayoutEffect(() => {
    // Mark shell as visible as soon as App commits — do not wait for a later
    // useEffect tick (Metro/CI cold start raced the 15–45s watchdog while paywall/auth
    // were already on screen).
    onVisibleShell?.();
  }, [onVisibleShell]);

  useEffect(() => {
    if (firstRenderLogged.current) return;
    firstRenderLogged.current = true;
    logStartupPerf("first_render");
    logStartupCheckpoint("S09");
    // Staging-only controlled failure for fallback QA — never leave an indefinite black screen.
    if ((process.env.EXPO_PUBLIC_FORCE_STARTUP_FAILURE || "").trim() === "true") {
      logStartupError("forced_startup_failure");
      return;
    }
  }, []);

  useEffect(() => {
    logStartupCheckpoint("S10");
  }, []);

  useEffect(() => {
    if (!authHydrated || authReadyLogged.current) return;
    authReadyLogged.current = true;
    logStartupPerf("auth_ready");
  }, [authHydrated]);

  useEffect(() => {
    trackScreen(tab);
    logCrashlyticsBreadcrumb("screen_view", { tab });
  }, [tab]);

  useEffect(() => {
    if (tradesHydrated) recordMetric("journal_trade_count", trades.length);
  }, [trades.length, tradesHydrated]);

  useEffect(() => {
    if (!appReady) return;
    let cancelled = false;
    logStartupPerf("non_critical_init_started");
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          scheduleMonitoringInit();
          getPosthogClient();
          trackEvent("app_opened");

          const events = await loadCalendarEvents().catch(() => [] as EconEvent[]);
          if (!cancelled) setPushCalendarEvents(events);

          try {
            const cached = await AsyncStorage.getItem(PROP_RULES_CACHE_KEY);
            if (cached) {
              const parsed = JSON.parse(cached) as { templates?: unknown[]; updatedAt?: string };
              const normalized = Array.isArray(parsed.templates)
                ? parsed.templates
                    .map((row) => normalizeRemoteTemplate(row))
                    .filter((x): x is RiskTemplate => Boolean(x))
                : [];
              if (normalized.length && !cancelled) {
                setPropTemplates(normalized);
                setPropRulesMeta({ source: "cache", updatedAt: parsed.updatedAt });
              }
            }
          } catch {
            // ignore cache parsing issues
          }

          if (supabase && !cancelled) {
            try {
              const { data, error } = await supabase
                .from("prop_firms")
                .select(PROP_FIRM_SELECT_COLUMNS)
                .eq("is_active", true)
                .order("account_size", { ascending: true });
              if (error) throw error;
              const normalized = (data || [])
                .map((row) => normalizeRemoteTemplate(row))
                .filter((x): x is RiskTemplate => Boolean(x));
              if (normalized.length && !cancelled) {
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
            }
          }

          if (!cancelled) setShareExportHostReady(true);
        } catch (error) {
          logStartupError("non_critical_init", error);
          captureAppError(error, { feature: "startup", action: "non_critical_init" });
        } finally {
          if (!cancelled) logStartupPerf("non_critical_init_done");
        }
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [appReady]);

  useEffect(() => {
    if (!authHydrated || !tradesHydrated) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          const { syncSmartPushSchedules, evaluateSmartPushConditions } = await import("../notifications/smartAlerts");
          const [templateKeyRaw, modeRaw] = await Promise.all([
            AsyncStorage.getItem("prop-risk-template-v1"),
            AsyncStorage.getItem("prop-risk-mode-v1"),
          ]);
          const templateKey = resolvePropTemplateKey(templateKeyRaw || "", propTemplates);
          const mode: FirmMode = modeRaw === "funded" ? "funded" : "evaluation";
          const snapshot = tryComputePropRiskSnapshot({
            trades,
            selectedDate: todayISO(),
            templateKey,
            mode,
            templates: propTemplates,
          });
          const propSnapshot = snapshot
            ? {
                enabled: Boolean(templateKey),
                dailyRemaining: snapshot.dailyRemaining,
                dailyLossLimit: snapshot.template.dailyLossLimit,
                dayPnl: snapshot.dayPnl,
                status: snapshot.status,
              }
            : null;
          const calendarMapped = pushCalendarEvents.map((e) => ({
            id: e.id,
            date: e.date,
            time: e.time,
            name: e.name,
          }));
          if (cancelled) return;
          await syncSmartPushSchedules({ isPro: isPremium, calendarEvents: calendarMapped });
          await evaluateSmartPushConditions({
            trades,
            isPro: isPremium,
            calendarEvents: calendarMapped,
            propSnapshot,
          });
        } catch (error) {
          logStartupError("smart_push_startup_sync", error);
          captureAppError(error, { feature: "smart_push", action: "startup_sync" });
        }
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [authHydrated, trades, tradesHydrated, isPremium, propTemplates, pushCalendarEvents]);

  useEffect(() => {
    let cancelled = false;
    void withTimeout(initAppI18n(), 3500)
      .then((initial) => {
        if (!cancelled) {
          setLang(initial);
          logStartupPerf("i18n_ready");
        }
      })
      .catch((error) => {
        logStartupError("i18n_init", error);
        captureAppError(error, { feature: "i18n", action: "init" });
        if (!cancelled) logStartupPerf("i18n_ready");
      });
    const onLanguageChanged = (lng: string) => {
      if (["en", "ru", "es", "fr", "it", "uk", "de"].includes(lng)) setLang(lng as Lang);
    };
    i18n.on("languageChanged", onLanguageChanged);
    return () => {
      cancelled = true;
      i18n.off("languageChanged", onLanguageChanged);
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user.id) return;
    void pullUserPreferences(supabase, session.user.id).then((prefs) => {
      if (prefs?.lang && ["en", "ru", "es", "fr", "it", "uk", "de"].includes(prefs.lang)) {
        void changeAppLanguage(prefs.lang as Lang).then(() => setLang(prefs.lang as Lang));
      }
    }).catch(() => {});
  }, [session?.user.id]);

  useEffect(() => {
    if (!supabase || !session?.user.id) return;
    void pushUserPreferences(supabase, session.user.id, { lang }).catch(() => {});
  }, [lang, session?.user.id]);

  const activeTradesStorageKey = session?.user.id ? userTradesStorageKey(session.user.id) : TRADES_STORAGE_KEY;

  useEffect(() => {
    let cancelled = false;
    const loadTrades = async () => {
      if (authRequired && !session?.user.id) {
        if (!cancelled) {
          setTrades([]);
          setTradesHydrated(true);
        }
        return;
      }
      const key = session?.user.id ? userTradesStorageKey(session.user.id) : TRADES_STORAGE_KEY;
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const loaded = parseStoredTrades(value);
          if (loaded.length) {
            setTrades(loaded);
          } else if (value.trim()) {
            await AsyncStorage.removeItem(key);
          }
        } else if (session?.user.id) {
          const guest = await AsyncStorage.getItem(TRADES_STORAGE_KEY);
          if (guest) {
            const loaded = parseStoredTrades(guest);
            if (loaded.length) setTrades(loaded);
          }
        }
      } catch {
        await AsyncStorage.removeItem(key);
      } finally {
        if (!cancelled) setTradesHydrated(true);
      }
    };
    if (!authHydrated) return;
    setTradesHydrated(false);
    void loadTrades();
    const safety = setTimeout(() => {
      if (!cancelled) setTradesHydrated(true);
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, [authHydrated, authRequired, session?.user.id]);

  useEffect(() => {
    if (!tradesHydrated || !session?.user.id) return;
    AsyncStorage.setItem(activeTradesStorageKey, JSON.stringify(normalizeTrades(trades)));
  }, [activeTradesStorageKey, session?.user.id, trades, tradesHydrated]);

  const applyCustomerInfo = useCallback((info: CustomerInfo, reason: string) => {
    // Ignore CustomerInfo updates while signed out — never expose previous-user Pro.
    if (!sessionRef.current?.user?.id) {
      billingDebugLog("customer info ignored (unauthenticated)", { reason });
      return false;
    }
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
      if (!isExpoGo) {
        logger.error(error, { feature: "revenuecat", action: "refresh_catalog" });
      }
      const message = userFacingBillingError(error?.message || "RevenueCat connection failed.");
      setPaywallError(message);
      return { packages: [] as PurchasesPackage[], storeProducts: [] as PurchasesStoreProduct[] };
    }
  }, [applyCustomerInfo]);

  useEffect(() => {
    // Configure RevenueCat. When an authenticated Supabase UUID exists, use it
    // as the appUserID. Without a session, configure anonymously to allow
    // pre-auth purchases that are later linked via Purchases.logIn.
    if (!revenueCatConfigured) return;
    const userId = session?.user?.id;
    const hasSession = !!userId;

    let listener: ((info: CustomerInfo) => void) | null = null;
    let cancelled = false;

    const attach = () => {
      if (cancelled) return;
      try {
        if (!purchasesConfigured.current) {
          Purchases.setLogLevel(LOG_LEVEL.ERROR);
          if (hasSession) {
            Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userId });
          } else {
            Purchases.configure({ apiKey: REVENUECAT_API_KEY });
          }
          purchasesConfigured.current = true;
          setRevenueCatReady(true);
        }
        listener = (info: CustomerInfo) => {
          // Track anonymous CustomerInfo for post-purchase entitlement detection.
          if (!sessionRef.current?.user?.id) {
            anonymousCustomerInfoRef.current = info;
            const hasActivePro = customerHasPro(info);
            setAnonymousEntitlementStatus(hasActivePro ? "active" : "inactive");
            if (!hasActivePro) {
              // Clear stale linking marker if entitlement is no longer active.
              void AsyncStorage.removeItem(POST_PURCHASE_LINKING_MARKER_KEY);
            }
            return;
          }
          applyCustomerInfo(info, "customerInfoUpdateListener");
        };
        Purchases.addCustomerInfoUpdateListener(listener);
        void refreshRevenueCat();
      } catch (error: any) {
        if (!isExpoGo) {
          logger.error(error, { feature: "revenuecat", action: "configure" });
        }
        setPaywallError(userFacingBillingError(error?.message || "RevenueCat setup failed."));
        setIdentitySyncFailed(true);
      }
    };

    const task = purchasesConfigured.current
      ? null
      : InteractionManager.runAfterInteractions(attach);
    if (purchasesConfigured.current) attach();

    return () => {
      cancelled = true;
      task?.cancel();
      if (listener) Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo, refreshRevenueCat, revenueCatConfigured, session?.user?.id]);

  useEffect(() => {
    if (!purchasesConfigured.current || !session?.user.id || !revenueCatReady) return;
    let cancelled = false;
    const userId = session.user.id;
    const generation = ++identitySyncGenerationRef.current;
    setIdentitySyncPending(true);
    setIdentitySyncFailed(false);

    void (async () => {
      const result = await revenueCatIdentityRef.current.synchronize(userId);
      if (cancelled || generation !== identitySyncGenerationRef.current) return;

      if (result.status === "failed" || result.status === "skipped_not_configured" || result.status === "skipped_no_user") {
        setIdentitySyncFailed(true);
        setIdentitySyncPending(false);
        setShowRestorePurchases(true);
        setPaywallError(t("restoreFailedTryAgain"));
        if (result.status === "failed") {
          logger.error(new Error("revenuecat_identity_sync_failed"), {
            feature: "revenuecat",
            action: "log_in",
          });
        }
        return;
      }

      // Verify App User ID matches Supabase UUID before granting access.
      try {
        const currentAppUserId = await Purchases.getAppUserID();
        if (cancelled || generation !== identitySyncGenerationRef.current) return;
        if (currentAppUserId !== userId) {
          setIdentitySyncFailed(true);
          setIdentitySyncPending(false);
          logger.error(new Error("revenuecat_app_user_id_mismatch"), {
            feature: "revenuecat",
            action: "identity_verify",
          });
          return;
        }
      } catch (error) {
        if (!cancelled && generation === identitySyncGenerationRef.current) {
          setIdentitySyncFailed(true);
          setIdentitySyncPending(false);
          logger.error(error, { feature: "revenuecat", action: "identity_verify" });
        }
        return;
      }

      const info = result.customerInfo;
      if (info) applyCustomerInfo(info, `identity:${result.status}`);

      let postLoginEntitled = isActiveEntitlement(info ?? customerInfoRef.current, REVENUECAT_ENTITLEMENT_ID);

      // Explicit refresh when logIn/already_synced snapshot is not entitled yet.
      if (!postLoginEntitled && purchasesConfigured.current) {
        try {
          const refreshed = await Purchases.getCustomerInfo();
          if (cancelled || generation !== identitySyncGenerationRef.current) return;
          applyCustomerInfo(refreshed, "identity:post_login_refresh");
          postLoginEntitled = isActiveEntitlement(refreshed, REVENUECAT_ENTITLEMENT_ID);
        } catch (error) {
          if (!cancelled && generation === identitySyncGenerationRef.current) {
            // Network failure with no usable CustomerInfo → retry, not false paywall.
            if (!info) {
              setIdentitySyncFailed(true);
              setIdentitySyncPending(false);
              setShowRestorePurchases(true);
              logger.error(error, { feature: "revenuecat", action: "post_login_refresh" });
              return;
            }
          }
        }
      }

      const decision = decidePostLoginEntitlementReconcile({
        postLoginEntitled,
      });

      // Never auto-restore. Manual Restore is a Paywall/Settings action only.
      if (decision.action === "confirmed_not_entitled") {
        setShowRestorePurchases(true);
      }

      setIdentitySyncFailed(false);
      setIdentitySyncPending(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [applyCustomerInfo, revenueCatReady, session?.user.id]);

  const refreshLockScreenBufferReminder = useCallback(async () => {
    const [enabledRaw, templateKeyRaw, modeRaw] = await Promise.all([
      AsyncStorage.getItem(LOCK_SCREEN_BUFFER_KEY),
      AsyncStorage.getItem("prop-risk-template-v1"),
      AsyncStorage.getItem("prop-risk-mode-v1"),
    ]);
  const enabled = enabledRaw === "on";
  if (!enabled) {
      await scheduleDailyPropRiskNotification({ enabled: false, title: "", body: "" });
      return;
    }
    const templateKey = resolvePropTemplateKey(templateKeyRaw || "", propTemplates);
    const mode: FirmMode = modeRaw === "funded" ? "funded" : "evaluation";
    const snapshot = tryComputePropRiskSnapshot({
      trades,
      selectedDate: todayISO(),
      templateKey,
      mode,
      templates: propTemplates,
    });
    if (!snapshot) {
      await scheduleDailyPropRiskNotification({ enabled: false, title: "", body: "" });
      return;
    }
    await scheduleDailyPropRiskNotification({
      enabled: true,
      title: `YouTrader • ${snapshot.template.label}`,
      body: `Daily buffer ${moneyCompact(snapshot.dailyRemaining)} • ${snapshot.status} • Day P&L ${moneyCompact(snapshot.dayPnl)}`,
    });
  }, [trades, propTemplates]);

  useEffect(() => {
    if (!tradesHydrated) return;
    refreshLockScreenBufferReminder().catch(() => {});
  }, [tradesHydrated, refreshLockScreenBufferReminder]);

  const importTradesFromCsv = useCallback(async () => {
    try {
      const limit = await checkClientRateLimit("csv:import", session?.user.id || "local");
      if (!limit.allowed) {
        Alert.alert(t("importTrades"), SECURITY_MESSAGES.rateLimited);
        return;
      }
      trackEvent("csv_import_started", { source: "settings" });
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
        Alert.alert(t("importTrades"), SECURITY_MESSAGES.invalidUpload);
        return;
      }
      const text = await readCsvFileAsText(asset.uri);
      const byteLength = new TextEncoder().encode(text).length;
      const sourceRows = text.split(/\r?\n/).filter(Boolean).length;
      const importCheck = validateImportedRows(sourceRows, byteLength);
      if (!importCheck.ok) {
        await recordSecurityEvent("invalid_csv_import", "csv:import", session?.user.id || "local");
        Alert.alert(
          t("importTrades"),
          importCheck.reason === "too_large" ? SECURITY_MESSAGES.csvTooLarge : SECURITY_MESSAGES.csvTooManyRows,
        );
        return;
      }
      const rows = parseTradesCsvText(text);
      if (!rows.length) {
        Alert.alert(
          t("importTrades"),
          t("noTradesFoundCsv"),
        );
        return;
      }
      const imported: Trade[] = rows.flatMap((row) => {
        const validated = validateTradeInput({
          ...row,
          stopLoss: null,
          takeProfit: null,
          notes: row.notes || t("importedFromCsv"),
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
          notes: validated.value.notes || t("importedFromCsv"),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }];
      });
      if (!imported.length) {
        await recordSecurityEvent("invalid_csv_rows", "csv:import", session?.user.id || "local");
        Alert.alert(t("importTrades"), SECURITY_MESSAGES.invalidTrade);
        return;
      }
      const claimed = await claimRemoteIdempotency("csv:import", session?.user.id, {
        sourceHash: stableSecurityHash(text),
        rowCount: imported.length,
      });
      if (!claimed) {
        Alert.alert(t("importTrades"), SECURITY_MESSAGES.duplicateRequest);
        return;
      }
      setTrades((prev) => [...imported, ...prev]);
      trackEvent("csv_import_completed", { row_count: imported.length });
      Alert.alert(t("importComplete"), t("tradesAddedJournal", { count: imported.length }));
    } catch (error) {
      alertExportError(t("csvImportFailed"), error);
    }
  }, [lang, session?.user.id]);

  useEffect(() => {
    if (!supabase) {
      setAuthHydrated(true);
      return;
    }
    let cancelled = false;
    const safety = setTimeout(() => {
      if (!cancelled) {
        logStartupError("auth_hydration_timeout");
        setAuthHydrated(true);
      }
    }, 6000);

    const hydrateAuth = async () => {
      try {
        // Staging-only: clear persisted session/onboarding before first getSession.
        const { runStagingQaReset } = await import("../qa/stagingQaReset");
        const initialUrl = await Linking.getInitialURL();
        const reset = await runStagingQaReset({ deepLinkUrl: initialUrl });
        if (reset.attempted && reset.allowed && reset.reason === "reset_ok" && __DEV__) {
          console.info("[YTQA] startup reset applied", {
            clearedAsyncKeys: reset.clearedAsyncKeys,
            signedOutSupabase: reset.signedOutSupabase,
          });
        }
      } catch (error) {
        logger.error(error, { feature: "qa", action: "staging_qa_reset" });
      }
      if (cancelled) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        let cachedSession = data.session;
        if (cachedSession) {
          // A cached session can outlive its account: validate before trusting it.
          const { error: userError } = await supabase.auth.getUser();
          if (cancelled) return;
          const verdict = classifyBootstrapSession(userError as { status?: number } | null);
          if (shouldPurgeCachedSession(verdict)) {
            const staleUserId = cachedSession.user.id;
            try {
              await supabase.auth.signOut({ scope: "local" });
            } catch {
              // Local purge is best-effort; state below still routes to Auth.
            }
            await clearLocalUserCache(staleUserId);
            cachedSession = null;
          }
        }
        clearTimeout(safety);
        setSession(cachedSession);
        setAuthHydrated(true);
      } catch (error) {
        if (cancelled) return;
        clearTimeout(safety);
        logger.error(error, { feature: "supabase", action: "get_session" });
        logStartupError("auth_get_session", error);
        captureAppError(error, { feature: "auth", action: "get_session" });
        setAuthHydrated(true);
      }
    };

    void hydrateAuth();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      clearTimeout(safety);
      setSession(nextSession);
      setAuthHydrated(true);
    });
    return () => {
      cancelled = true;
      clearTimeout(safety);
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    activeSessionUserIdRef.current = session?.user.id ?? null;
  }, [session?.user.id]);

  useEffect(() => {
    if (session?.user?.id) {
      identifyAnalyticsUser(session.user.id, { provider: session.user.app_metadata?.provider || "unknown" });
      setMonitoringUser(session.user.id);
    } else {
      setMonitoringUser(null);
    }
  }, [session?.user?.id]);

  const refreshServerEntitlement = useCallback(async () => {
    if (!supabase || !session?.user.id) {
      applyServerEntitlement(false, "no-session");
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
      applyServerEntitlement(serverSubscriptionHasPro(data as ServerSubscriptionRow | null), "supabase");
    } catch (error) {
      logger.error(error, { feature: "supabase", action: "refresh_server_entitlement", table: "user_subscriptions" });
      // Preserve last known server entitlement during offline/transient Supabase errors.
    }
  }, [applyServerEntitlement, session?.user.id]);

  useEffect(() => {
    void refreshServerEntitlement();
  }, [refreshServerEntitlement]);

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
    const handleUrl = async (url: string) => {
      if (!url) return;
      try {
        if (
          url.toLowerCase().startsWith("youtrader://qa/reset-")
        ) {
          const { runStagingQaReset } = await import("../qa/stagingQaReset");
          const { parseStagingQaResetMode, stagingQaResetModeUi } = await import(
            "../qa/stagingQaResetModes"
          );
          const mode = parseStagingQaResetMode(url) || "auth";
          // Drop stale complete marker before wipe so Maestro cannot false-pass.
          await AsyncStorage.removeItem("yt-qa-reset-complete-v1");
          setQaResetPhase("reset_requested");
          setQaResetMode(mode);
          setQaResetError(null);
          const reset = await runStagingQaReset({
            deepLinkUrl: url,
            mode,
            onProgress: (snap) => {
              setQaResetPhase(snap.phase);
              setQaResetMode(snap.mode);
              setQaResetError(snap.error);
            },
          });
          if (reset.allowed && reset.reason === "reset_ok") {
            const ui = stagingQaResetModeUi(mode);
            setAuthBusy(false);
            // Force local sign-out again so onAuthStateChange cannot revive Main.
            try {
              if (supabase) await supabase.auth.signOut({ scope: "local" });
            } catch {
              // ignore
            }
            setSession(null);
            setOnboardingCompleted(ui.onboardingCompleted);
            setPaywallCompleted(ui.paywallCompleted);
            setAcquisitionHydrated(ui.acquisitionHydrated);
            setTrades([]);
            setTradesHydrated(true);
            setQaResetPhase("reset_complete");
            setQaResetMode(mode);
            setQaResetError(null);
            void AsyncStorage.setItem("yt-qa-reset-complete-v1", mode);

            console.info("[YTQA] reset mode applied", {
              mode,
              expectedPhase: ui.expectedPhase,
              oauthStateCleared: reset.oauthStateCleared,
              signedOutSupabase: reset.signedOutSupabase,
              sessionForcedNull: true,
              phase: reset.phase,
            });
            if (mode === "returning-allow" || mode === "returning-deny") {
              const role = mode === "returning-allow" ? "allow" : "deny";
              // Chain deterministic email bootstrap into Main (no Google).
              await handleUrl(`youtrader://qa/email-login?role=${role}`);
              return;
            }
            // No blocking Alert — Maestro cannot reliably dismiss native alerts as Auth CTAs.
          } else if (!reset.allowed) {
            setQaResetPhase("reset_failed");
            setQaResetError(reset.reason);
            Alert.alert("QA reset blocked", reset.reason);
          } else if (reset.phase === "reset_failed") {
            setQaResetPhase("reset_failed");
            setQaResetError(reset.reason);
          }
          return;
        }
        if (url.toLowerCase().startsWith("youtrader://qa/email-login")) {
          const {
            isStagingQaEmailLoginAllowed,
            parseStagingQaEmailLoginUrl,
            readStagingQaEmailFixture,
          } = await import("../qa/stagingQaEmailLogin");
          if (!isStagingQaEmailLoginAllowed()) {
            Alert.alert("QA email login blocked", "staging_only");
            return;
          }
          const role = parseStagingQaEmailLoginUrl(url);
          if (!role) {
            Alert.alert("QA email login", "Invalid role. Use role=allow|deny.");
            return;
          }
          const fixture = await readStagingQaEmailFixture(role);
          if (!fixture) {
            Alert.alert(
              "QA email login",
              "Fixture missing. Run scripts/staging-qa-seed-email-fixture.sh after install.",
            );
            return;
          }
          if (!supabase) {
            Alert.alert("QA email login", "Supabase client unavailable.");
            return;
          }
          setAuthBusy(true);
          const { data, error } = await supabase.auth.signInWithPassword({
            email: fixture.email,
            password: fixture.password,
          });
          if (error || !data.session) {
            setAuthBusy(false);
            console.info("[YTQA] email login failed", { role, code: error?.code || "no_session" });
            Alert.alert("QA email login failed", error?.message || "no_session");
            return;
          }
          // Returning-user QA path: skip marketing onboarding/paywall so Journal is reachable.
          // Await storage before setSession so the acquisition hydrate effect cannot race-clear flags.
          await AsyncStorage.multiSet([
            [ACQUISITION_ONBOARDING_KEY, "1"],
            [ACQUISITION_PAYWALL_DEVICE_KEY, "1"],
            [POST_AUTH_PAYWALL_SEEN_KEY, "1"],
            [acquisitionPaywallUserKey(data.session.user.id), "1"],
          ]);
          setOnboardingCompleted(true);
          setPaywallCompleted(true);
          setAcquisitionHydrated(true);
          setSession(data.session);
          setAuthHydrated(true);
          setAuthBusy(false);
          setTab("journal");
          console.info("[YTQA] email login ok", {
            role,
            userPrefix: (data.session.user.id || "").slice(0, 8),
            forcedTab: "journal",
          });
          return;
        }
        if (url.toLowerCase().startsWith("youtrader://qa/seed-trade")) {
          const {
            buildStagingQaSeedTrade,
            isStagingQaJournalSeedAllowed,
            parseStagingQaJournalSeedUrl,
            parseStagingQaTradeOverrides,
          } = await import("../qa/stagingQaJournalSeed");
          if (!isStagingQaJournalSeedAllowed() || !parseStagingQaJournalSeedUrl(url)) {
            Alert.alert("QA seed trade blocked", "staging_only");
            return;
          }
          if (!sessionRef.current?.user?.id) {
            Alert.alert("QA seed trade", "Sign in first (email-login allow).");
            return;
          }
          const overrides = parseStagingQaTradeOverrides(url);
          const item = buildStagingQaSeedTrade(Date.now(), overrides);
          setTrades((prev) => [item as Trade, ...prev.filter((t) => t.id !== item.id)]);
          setTab("journal");
          console.info("[YTQA] seed trade ok", {
            idPrefix: item.id.slice(0, 20),
            pnl: item.pnl,
            notesLen: (item.notes || "").length,
          });
          return;
        }
        if (url.toLowerCase().startsWith("youtrader://qa/apply-trade-edit")) {
          const { createStagingQaApplyEditRequest } = await import("../qa/stagingQaApplyEditRequest");
          const request = createStagingQaApplyEditRequest(url);
          if (!request) {
            Alert.alert("QA apply-trade-edit blocked", "staging_only");
            return;
          }
          if (!sessionRef.current?.user?.id) {
            Alert.alert("QA apply-trade-edit", "Sign in first (email-login allow).");
            return;
          }
          setTab("journal");
          setQaApplyEditRequest(request);
          console.info("[YTQA] apply-trade-edit queued", { hasQuery: url.includes("?"), nonce: request.nonce });
          return;
        }
        if (url.toLowerCase().startsWith("youtrader://qa/tab")) {
          const { isStagingQaEmailLoginAllowed } = await import("../qa/stagingQaEmailLogin");
          if (!isStagingQaEmailLoginAllowed()) {
            Alert.alert("QA tab blocked", "staging_only");
            return;
          }
          let tabId = "journal";
          try {
            tabId = new URL(url).searchParams.get("id") || "journal";
          } catch {
            const match = url.match(/[?&]id=([a-zA-Z]+)/);
            if (match) tabId = match[1];
          }
          const allowed = new Set([
            "journal",
            "stats",
            "calc",
            "propPass",
            "news",
            "calendar",
            "settings",
            "more",
          ]);
          if (!allowed.has(tabId)) {
            Alert.alert("QA tab", `Unsupported tab id: ${tabId}`);
            return;
          }
          setTab(tabId as Tab);
          console.info("[YTQA] tab forced", { tabId });
          return;
        }
        if (url.toLowerCase().startsWith("youtrader://qa/prop-pass-state")) {
          const {
            isStagingPropPassQaAllowed,
            parseStagingPropPassQaUrl,
            resolveStagingPropPassQa,
            STAGING_PROP_PASS_QA_STORAGE_KEY,
          } = await import("../qa/stagingQaPropPassState");
          if (!isStagingPropPassQaAllowed()) {
            Alert.alert("QA prop-pass-state blocked", "staging_only");
            return;
          }
          const mode = parseStagingPropPassQaUrl(url);
          if (!mode) {
            Alert.alert(
              "QA prop-pass-state",
              "Use mode=healthy|caution|at_risk|passed|violated|insufficient_data|no_account|stale|offline_cached|backend_unavailable|loading|empty_plan|populated_plan|insights_*|non_allowlisted|none",
            );
            return;
          }
          const payload = resolveStagingPropPassQa(mode);
          await AsyncStorage.setItem(STAGING_PROP_PASS_QA_STORAGE_KEY, mode);
          setQaPropPassPayload(payload);
          setQaPropPassEpoch((n) => n + 1);
          if (payload.forceHidePropPassTab) {
            setTab("journal");
          } else if (mode !== "none") {
            setTab("propPass");
          }
          console.info("[YTQA] prop-pass state set", { mode });
          return;
        }
        if (url.toLowerCase().startsWith("youtrader://qa/news-fault")) {
          const {
            isStagingNewsFaultAllowed,
            parseStagingNewsFaultUrl,
            STAGING_NEWS_FAULT_STORAGE_KEY,
          } = await import("../qa/stagingQaNewsFault");
          if (!isStagingNewsFaultAllowed()) {
            Alert.alert("QA news-fault blocked", "staging_only");
            return;
          }
          const mode = parseStagingNewsFaultUrl(url);
          if (!mode) {
            Alert.alert("QA news-fault", "Use mode=none|offline|timeout|empty|malformed|unavailable");
            return;
          }
          await AsyncStorage.setItem(STAGING_NEWS_FAULT_STORAGE_KEY, mode);
          setQaNewsFaultEpoch((n) => n + 1);
          setTab("news");
          console.info("[YTQA] news fault set", { mode });
          return;
        }
        const result = await processAuthDeepLink(url);
        if (result.kind === "email_confirmed") {
          Alert.alert(
            "Email confirmed",
            "Your email is verified. You can now sign in with your email and password.",
          );
          return;
        }
        if (result.kind === "password_recovery") {
          setSession(result.session);
          setAuthHydrated(true);
          setAuthBusy(false);
          setResetPasswordOpen(true);
        }
      } catch (error) {
        if (isAuthCancellation(error)) return;
        logger.error(error, { feature: "supabase", action: "auth_deep_link" });
        logAuthDev("email", error, { source: "auth_deep_link" });
        Alert.alert(
          "Account link",
          error instanceof Error ? error.message : "Could not complete account link.",
        );
      }
    };
    void Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    });
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });
    return () => subscription.remove();
  }, []);

  const syncTradesWithCloud = useCallback(async () => {
    if (!supabase || !session?.user.id || !tradesHydrated) {
      setCloudSyncStatus("off");
      setCloudSyncMessage(
        !session?.user.id
          ? t("authSecureNote")
          : t("loadingJournal"),
      );
      return;
    }
    const syncUserId = session.user.id;
    const syncStillActive = () => activeSessionUserIdRef.current === syncUserId;
    if (cloudSyncInFlight.current) return;
    cloudSyncInFlight.current = true;
    setCloudSyncStatus("syncing");
    setCloudSyncMessage(t("cloudSyncing"));
    try {
      const { data, error } = await withTimeout(supabase
        .from("trade_journal")
        .select("*")
        .eq("user_id", syncUserId)
        .order("updated_at", { ascending: false }));
      if (error) throw error;
      if (!syncStillActive()) return;

      const cloudRows = (data || []) as TradeJournalRow[];
      const activeCloudTrades = cloudRows.filter((row) => !row.deleted_at).map(cloudRowToTrade);
      const activeCloudSignature = tradesSignature(activeCloudTrades);
      const merged = await mergeLocalAndCloudTrades(trades, cloudRows);
      if (!syncStillActive()) return;
      if (!merged.length && activeCloudTrades.length) {
        const cloudOnly = sortTrades(activeCloudTrades);
        setTrades(cloudOnly);
        setCloudSyncStatus("synced");
        setCloudSyncMessage(t("cloudSynced"));
        setLastCloudSyncAt(new Date().toISOString());
        await clearOfflineJobsForUser(syncUserId);
        return;
      }
      const mergedSignature = tradesSignature(merged);
      if (mergedSignature !== currentTradeSignature) {
        setTrades(merged);
      }

      let finalSyncedTrades = merged;
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
          await recordSecurityEvent("invalid_trade_blocked_cloud_sync", "trade:update", syncUserId);
        }
        if (!syncStillActive()) return;
        const uploadedTrades: Trade[] = [];
        for (const trade of safeTrades) {
          const result = await uploadTradeAttachmentsForCloud(trade);
          uploadedTrades.push(result.trade);
        }
        if (!syncStillActive()) return;
        const uploadedSignature = tradesSignature(uploadedTrades);
        if (uploadedSignature !== mergedSignature) {
          setTrades(uploadedTrades);
        }
        finalSyncedTrades = uploadedTrades;
        const rows = uploadedTrades.map((trade) => tradeToCloudRow(trade, syncUserId));
        if (rows.length) {
          const claimed = await claimRemoteIdempotency("trade:cloud-upsert", syncUserId, rows);
          if (claimed) {
            const { error: upsertError } = await withTimeout(supabase
              .from("trade_journal")
              .upsert(rows, { onConflict: "user_id,client_id" }));
            if (upsertError) throw upsertError;
          }
        }
      }

      if (!syncStillActive()) return;
      const syncedAt = new Date().toISOString();
      setLastCloudSyncAt(syncedAt);
      const attachmentRetryNeeded = finalSyncedTrades.some((trade) =>
        (isLocalMediaUri(trade.photoUri) && !trade.photoCloudUri) ||
        (isLocalMediaUri(trade.voiceUri) && !trade.voiceCloudUri),
      );
      setCloudSyncStatus(attachmentRetryNeeded ? "error" : "synced");
      setCloudSyncMessage(
        attachmentRetryNeeded
          ? t("cloudSyncError")
          : t("cloudSynced"),
      );
      await clearOfflineJobsForUser(syncUserId);
      try {
        await pullUserPreferences(supabase, syncUserId);
      } catch (prefsError) {
        logger.warn("Failed to pull user preferences", { feature: "supabase", action: "pull_preferences", userId: syncUserId, error: prefsError });
      }
    } catch (error: any) {
      if (!syncStillActive()) return;
      logger.error(error, { feature: "supabase", action: "sync_trades", table: "trade_journal", userId: syncUserId });
      setCloudSyncStatus("error");
      setCloudSyncMessage(t("cloudSyncError"));
      for (const trade of trades) {
        await enqueueOfflineJob({ type: "trade_upsert", userId: syncUserId, tradeId: trade.id, queuedAt: Date.now() });
      }
    } finally {
      cloudSyncInFlight.current = false;
      if (!syncStillActive()) {
        setCloudSyncStatus((status) => (status === "syncing" ? "off" : status));
      }
    }
  }, [currentTradeSignature, lang, session?.user.id, trades, tradesHydrated]);

  const markCloudTradeDeleted = useCallback(async (tradeId: string) => {
    if (!supabase || !session?.user.id) return;
    const userId = session.user.id;
    try {
      const now = new Date().toISOString();
      const claimed = await claimRemoteIdempotency("trade:cloud-delete", userId, { tradeId, now });
      if (!claimed) return;
      await withTimeout(supabase
        .from("trade_journal")
        .update({ deleted_at: now, updated_at: now })
        .eq("user_id", userId)
        .eq("client_id", tradeId));
    } catch (error) {
      logger.error(error, { feature: "supabase", action: "mark_trade_deleted", table: "trade_journal", userId });
      await enqueueOfflineJob({ type: "trade_delete", userId, tradeId, queuedAt: Date.now() });
    }
  }, [session?.user.id]);

  useEffect(() => {
    if (!cloudSyncEnabled || !tradesHydrated) {
      setCloudSyncStatus("off");
      setCloudSyncMessage(
        !session?.user.id
          ? t("authSecureNote")
          : t("loadingJournal"),
      );
      return;
    }
    const timeout = setTimeout(syncTradesWithCloud, 900);
    return () => clearTimeout(timeout);
  }, [cloudSyncEnabled, currentTradeSignature, lang, session?.user.id, syncTradesWithCloud, tradesHydrated]);

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
        t("signInUnavailable"),
        t("signInUnavailableBody"),
      );
      return;
    }

    setAuthBusy(true);
    try {
      const limit = await checkClientRateLimit("auth", provider);
      if (!limit.allowed) {
        Alert.alert(t("signInFailed"), SECURITY_MESSAGES.rateLimited);
        return;
      }
      trackEvent("signup_started", { provider });
      if (provider === "apple") {
        if (!enableNativeAppleSignIn) {
          Alert.alert(t("signInFailed"), userFacingAuthError(provider));
          return;
        }
        const credential = await signInWithAppleNative(supabase);
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
        // Authorization code is exchanged server-side only; never persist locally.
        beginAppleLifecycleAttempt();
        void storeAppleAuthTokenAfterSignIn(credential.authorizationCode);
        trackEvent("signup_completed", { provider });
        return;
      }

      if (provider !== "google") {
        throw new Error(`Unsupported sign-in provider: ${provider}`);
      }

      await signInWithGoogle(supabase);
      trackEvent("signup_completed", { provider });
    } catch (error: any) {
      if (isAuthCancellation(error)) return;
      logger.error(error, { feature: "supabase", action: "sign_in", provider });
      logAuthDev(provider, error);
      Alert.alert(t("signInFailed"), userFacingAuthError(provider, error));
    } finally {
      setAuthBusy(false);
    }
  }, [authConfigured]);

  // Post-purchase auth: async wrappers that return { userId } | null after
  // the supabase auth listener confirms the new session.

  /** Wait up to 15s for a new Supabase session after Apple/Google sign-in. */
  const waitForNextSession = useCallback((client: typeof supabase): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      // If session already exists (sync sign-in), resolve immediately.
      client.auth.getSession().then(({ data }) => {
        if (data.session?.user?.id) { resolve(data.session.user.id); return; }
      });
      const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (nextSession?.user?.id) {
          data.subscription.unsubscribe();
          resolve(nextSession.user.id);
        }
      });
      setTimeout(() => {
        data.subscription.unsubscribe();
        resolve(null);
      }, 15000);
    });
  }, []);

  const handlePostPurchaseAuthenticate = useCallback(async (provider: AuthProvider): Promise<{ userId: string } | null> => {
    if (!supabase || !authConfigured) throw new Error("Sign-in is not available.");
    setAuthBusy(true);
    try {
      if (provider === "apple") {
        if (!enableNativeAppleSignIn) throw new Error("Apple Sign-In is not available.");
        const credential = await signInWithAppleNative(supabase);
        if (credential.fullName?.givenName || credential.fullName?.familyName) {
          const fullName = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ");
          await supabase.auth.updateUser({ data: { full_name: fullName, given_name: credential.fullName.givenName, family_name: credential.fullName.familyName } });
        }
        beginAppleLifecycleAttempt();
        void storeAppleAuthTokenAfterSignIn(credential.authorizationCode);
      } else if (provider === "google") {
        await signInWithGoogle(supabase);
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
      // Wait for the session to appear via onAuthStateChange.
      const userId = await waitForNextSession(supabase);
      if (!userId) throw new Error("Sign-in did not complete. Please try again.");
      return { userId };
    } finally {
      setAuthBusy(false);
    }
  }, [authConfigured]);

  const handlePostPurchaseEmail = useCallback(async (email: string, password: string): Promise<{ userId: string } | null> => {
    if (!supabase || !authConfigured) throw new Error("Email sign-in is not configured.");
    const limit = await checkClientRateLimit("auth", "email");
    if (!limit.allowed) throw new Error(SECURITY_MESSAGES.rateLimited);
    setAuthBusy(true);
    try {
      const { data } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (!data.user?.id) throw new Error("Sign-in failed. Please check your credentials.");
      setSession(data.session);
      setAuthHydrated(true);
      trackEvent("login_completed", { provider: "email" });
      return { userId: data.user.id };
    } finally {
      setAuthBusy(false);
    }
  }, [authConfigured]);

  const completeEmailAuthSession = useCallback(async (nextSession: Session) => {
    setSession(nextSession);
    setAuthHydrated(true);
    setAuthBusy(false);
    trackEvent("login_completed", { provider: "email" });
  }, []);

  const signInWithEmailPasswordHandler = useCallback(async (email: string, password: string) => {
    if (!supabase || !authConfigured) {
      throw new Error("Cloud sign-in is not configured in this build.");
    }
    const limit = await checkClientRateLimit("auth", "email");
    if (!limit.allowed) {
      throw new Error(SECURITY_MESSAGES.rateLimited);
    }
    setAuthBusy(true);
    try {
      const nextSession = await signInWithEmailPassword(email, password);
      await completeEmailAuthSession(nextSession);
    } catch (error) {
      setAuthBusy(false);
      throw error;
    }
  }, [authConfigured, completeEmailAuthSession]);

  const signUpWithEmailPasswordHandler = useCallback(async (email: string, password: string) => {
    if (!supabase || !authConfigured) {
      throw new Error("Cloud sign-in is not configured in this build.");
    }
    const limit = await checkClientRateLimit("auth", "email");
    if (!limit.allowed) {
      throw new Error(SECURITY_MESSAGES.rateLimited);
    }
    trackEvent("sign_up_started", { provider: "email" });
    const result = await signUpWithEmailPassword(email, password);
    if (result === "confirmation_sent") return "confirmation_sent" as const;
    await completeEmailAuthSession(result);
    trackEvent("sign_up_completed", { provider: "email" });
    return "signed_in" as const;
  }, [authConfigured, completeEmailAuthSession]);

  const requestPasswordResetHandler = useCallback(async (email: string) => {
    if (!supabase || !authConfigured) {
      throw new Error("Cloud sign-in is not configured in this build.");
    }
    await requestPasswordResetEmail(email);
  }, [authConfigured]);

  const changeAccountPassword = useCallback(async (newPassword: string) => {
    if (!supabase || !session?.user) {
      throw new Error("Sign in to change your password.");
    }
    await updateUserPassword(newPassword);
    const { data } = await supabase.auth.getSession();
    if (data.session) setSession(data.session);
    Alert.alert(t("account"), EMAIL_PASSWORD_MESSAGES.passwordUpdated);
  }, [session?.user]);

  const changeAccountEmail = useCallback(async (newEmail: string) => {
    if (!supabase || !session?.user) {
      throw new Error("Sign in to change your email.");
    }
    await updateUserEmail(newEmail);
    Alert.alert(t("account"), EMAIL_PASSWORD_MESSAGES.emailChangeSent);
  }, [session?.user]);

  const completePasswordReset = useCallback(async (newPassword: string) => {
    if (!supabase || !session?.user) {
      throw new Error("Open the password reset link again.");
    }
    await updateUserPassword(newPassword);
    const { data } = await supabase.auth.getSession();
    if (data.session) setSession(data.session);
    setResetPasswordOpen(false);
    Alert.alert(t("account"), EMAIL_PASSWORD_MESSAGES.passwordUpdated);
  }, [session?.user]);

  const signOut = useCallback(async (options?: { force?: boolean }) => {
    if (!supabase) return;
    if (!beginExplicitLogoutGuard(signingOutRef)) return;
    // Deleted accounts cannot sign out remotely (403 user_not_found) — local
    // teardown must still complete so the deleted user never stays inside.
    const forceLocalTeardown = options?.force === true;
    const userId = session?.user.id || null;
    // Enter LOGGING_OUT before clearing session so acquisition cannot flash paywall.
    // Persist AUTH_REQUIRED before session→null so the acquisition hydrate effect
    // cannot race AsyncStorage and route anonymous users to the paywall.
    // Refs are set synchronously — a "clear sticky on session" effect must not
    // wipe AUTH_REQUIRED while logout still has an active session.
    loggingOutRef.current = true;
    explicitAuthRequiredRef.current = true;
    setLoggingOut(true);
    setExplicitAuthRequired(true);
    let logoutCompleted = false;
    try {
      await AsyncStorage.setItem(ACQUISITION_AUTH_REQUIRED_KEY, "1");
    } catch {
      // Keep in-memory sticky even if persistence fails this frame.
    }
    try {
      try {
        const { clearPendingOAuthClientState } = await import("../auth/clearPendingOAuth");
        // App-owned pending OAuth only — production-safe, no full QA wipe.
        await clearPendingOAuthClientState();
      } catch {
        // non-fatal
      }
      await signOutGoogleNative();
      let error: unknown = null;
      try {
        ({ error } = await supabase.auth.signOut());
      } catch (thrown) {
        // A thrown transport failure must never skip local teardown.
        error = thrown;
      }
      if (error) {
        logger.error(error, { feature: "supabase", action: "sign_out" });
        if (!forceLocalTeardown) {
          Alert.alert(t("signOutFailed"), t("signOutFailedBody"));
          // Recoverable Supabase error — stay signed in; do not leave AUTH_REQUIRED sticky.
          explicitAuthRequiredRef.current = false;
          setExplicitAuthRequired(false);
          void AsyncStorage.removeItem(ACQUISITION_AUTH_REQUIRED_KEY);
          return;
        }
        // Drop the persisted session locally so relaunch cannot rehydrate it.
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // Local scope is best-effort; teardown below still clears app state.
        }
      }
      // Force navigation root off authenticated shell immediately.
      setSession(null);
      await clearLocalUserCache(userId);
      resetAnalyticsUser();
      setMonitoringUser(null);
      serverEntitlementActiveRef.current = false;
      setIdentitySyncFailed(false);
      setIdentitySyncPending(false);
      identitySyncGenerationRef.current += 1;
      revenueCatIdentityRef.current.reset();
      // Account-first: clear local CustomerInfo only. Do NOT call Purchases.logOut.
      // Next login uses Purchases.logIn(newSupabaseUUID) when App User ID differs.
      customerInfoRef.current = null;
      setCustomerInfo(null);
      setProAccess(emptyProAccessState());
      setPackages([]);
      setStoreProducts([]);
      setPaywallError("");
      setShowRestorePurchases(true);
      setTrades([]);
      setTradesHydrated(true);
      setCloudSyncStatus("off");
      setCloudSyncMessage("Sign in and upgrade to Pro to sync your journal.");
      setLastCloudSyncAt(null);
      setQaPropPassPayload(null);
      setTab("journal");
      logoutCompleted = true;
    } finally {
      if (logoutCompleted) {
        // Keep AUTH_REQUIRED sticky/ref asserted after LOGGING_OUT ends.
        explicitAuthRequiredRef.current = true;
        setExplicitAuthRequired(true);
      }
      loggingOutRef.current = false;
      setLoggingOut(false);
      endExplicitLogoutGuard(signingOutRef);
    }
  }, [session?.user.id]);

  const refreshCurrentEntitlements = useCallback(async (reason: string, retryDelays = ENTITLEMENT_RETRY_DELAYS_MS) => {
    if (!purchasesConfigured.current) return null;
    if (!sessionRef.current?.user?.id) return null;
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

    // Prefer entitlement unlock over StoreKit transaction success alone.
    if (applyCustomerInfo(result.customerInfo, `${reason}:purchase-result`)) {
      logger.info("RevenueCat purchase unlocked Pro", { feature: "revenuecat", action: "purchase_success", reason });
      trackEvent("purchase_success", { reason });
      trackEvent("pro_purchased", { reason });
      successHaptic();
      return;
    }

    // Anonymous purchase: no session yet, but CustomerInfo confirms Pro entitlement.
    // Persist a lightweight marker for relaunch recovery.
    if (!session?.user?.id && customerHasPro(result.customerInfo)) {
      anonymousCustomerInfoRef.current = result.customerInfo;
      void AsyncStorage.setItem(POST_PURCHASE_LINKING_MARKER_KEY, "1");
      setAnonymousEntitlementStatus("active");
      logger.info("post_purchase_auth pending", { feature: "revenuecat", action: "anonymous_purchase" });
      trackEvent("pro_purchased", { reason });
      successHaptic();
      return;
    }

    if (resultProductId && !YOU_TRADER_PRO_PRODUCT_IDS.includes(resultProductId)) {
      billingDebugLog("purchase product id not in known Pro list", {
        resultProductId,
        knownProductIds: YOU_TRADER_PRO_PRODUCT_IDS,
      });
    }

    const refreshedInfo = await refreshCurrentEntitlements(reason);
    if (customerHasPro(refreshedInfo)) {
      logger.info("RevenueCat entitlement refresh unlocked Pro", { feature: "revenuecat", action: "purchase_success_after_refresh", reason });
      trackEvent("purchase_success", { reason });
      trackEvent("pro_purchased", { reason });
      successHaptic();
      return;
    }

    if (resultProductId && !YOU_TRADER_PRO_PRODUCT_IDS.includes(resultProductId)) {
      const message = t("purchaseDifferentProduct");
      setPaywallError(message);
      setShowRestorePurchases(true);
      trackEvent("purchase_failed", { reason: "wrong_product" });
      Alert.alert(t("purchaseIssue"), message);
      return;
    }

    setShowRestorePurchases(true);
    setPaywallError(t("purchaseUnreadable"));
    logger.warn("RevenueCat purchase completed without readable entitlement", { feature: "revenuecat", action: "entitlement_unreadable" });
    trackEvent("purchase_failed", { reason: "entitlement_unreadable" });
    Alert.alert(
      t("purchaseComplete"),
      t("purchaseUnreadable"),
    );
  }, [applyCustomerInfo, lang, refreshCurrentEntitlements, session?.user.id]);

  const ensureAuthenticatedRevenueCatIdentity = useCallback(async (): Promise<boolean> => {
    const userId = sessionRef.current?.user?.id;
    if (!userId || !purchasesConfigured.current) return false;
    try {
      const currentAppUserId = await Purchases.getAppUserID();
      if (currentAppUserId !== userId) {
        const sync = await revenueCatIdentityRef.current.synchronize(userId);
        if (sync.status === "failed") return false;
        if (sync.customerInfo) applyCustomerInfo(sync.customerInfo, "purchase:identity");
      }
      const verified = await Purchases.getAppUserID();
      return verified === userId;
    } catch {
      return false;
    }
  }, [applyCustomerInfo]);

  const purchasePackage = useCallback(async (pkg?: PurchasesPackage | null, productId = YOU_TRADER_MONTHLY_PRODUCT_ID) => {
    if (!revenueCatConfigured || !purchasesConfigured.current) {
      Alert.alert(t("premiumAccess"), t("restoreUnavailable"));
      return;
    }
    if (!session?.user?.id) {
      Alert.alert(t("premiumAccess"), t("authSecureNote"));
      return;
    }
    // Accept any known Pro product id (weekly/monthly/yearly). Both unlock the same entitlement.
    if (!YOU_TRADER_PRO_PRODUCT_IDS.includes(productId)) {
      const message = t("subsTemporarilyUnavailable");
      setPaywallError(message);
      trackEvent("purchase_failed", { reason: "product_config_mismatch" });
      billingDebugLog("product id mismatch", {
        expectedProductIds: YOU_TRADER_PRO_PRODUCT_IDS,
        requestedProductId: productId,
      });
      Alert.alert(t("premiumAccess"), message);
      return;
    }
    const identityOk = await ensureAuthenticatedRevenueCatIdentity();
    if (!identityOk) {
      setIdentitySyncFailed(true);
      Alert.alert(t("premiumAccess"), t("restoreFailedTryAgain"));
      return;
    }
    const isYearly =
      productId === YOU_TRADER_YEARLY_PRODUCT_ID ||
      productId === "youtrader_pro_yearly" ||
      productId === "youtrader_pro_yearly__";

    setPurchaseBusy(true);
    setShowRestorePurchases(true);
    try {
      const limit = await checkClientRateLimit("purchase", session?.user.id || "local");
      if (!limit.allowed) {
        Alert.alert(t("premiumAccess"), SECURITY_MESSAGES.rateLimited);
        return;
      }
      logger.info("RevenueCat purchase started", { feature: "revenuecat", action: "purchase_started" });
      trackEvent("subscribe_pressed", { plan: isYearly ? "yearly" : "monthly" });
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
        const trialEligible = !!(selectedPackage.product as any)?.introPrice;
        const result = await withTimeout(Purchases.purchasePackage(selectedPackage));
        if (trialEligible) {
          logger.info("[YouTrader:trial] started", { plan: isYearly ? "yearly" : "monthly" });
          trackEvent("trial_started", { plan: isYearly ? "yearly" : "monthly" });
        }
        logger.info("[YouTrader:subscription] purchase_package_success", { productId });
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
        Alert.alert(t("premiumAccess"), message);
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
        Alert.alert(t("purchaseFailed"), message);
      }
      await refreshRevenueCat();
    } finally {
      setPurchaseBusy(false);
    }
  }, [ensureAuthenticatedRevenueCatIdentity, finishPurchaseFlow, packages, refreshRevenueCat, revenueCatConfigured, session?.user.id, storeProducts]);

  const restorePurchases = useCallback(async () => {
    if (!revenueCatConfigured || !purchasesConfigured.current) {
      Alert.alert(
        t("restorePurchases"),
        t("restoreUnavailable"),
      );
      return;
    }
    if (!session?.user?.id) {
      Alert.alert(t("restorePurchases"), t("authSecureNote"));
      return;
    }

    setPurchaseBusy(true);
    try {
      const limit = await checkClientRateLimit("restore", session.user.id);
      if (!limit.allowed) {
        Alert.alert(t("restorePurchases"), SECURITY_MESSAGES.rateLimited);
        return;
      }

      const identityOk = await ensureAuthenticatedRevenueCatIdentity();
      if (!identityOk) {
        setIdentitySyncFailed(true);
        Alert.alert(t("restorePurchases"), t("restoreFailedTryAgain"));
        return;
      }

      billingDebugLog("restore started", { productId: YOU_TRADER_MONTHLY_PRODUCT_ID });
      const info = await withTimeout(Purchases.restorePurchases());
      await claimRemoteIdempotency("subscription:restore", session.user.id, {
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
        trackEvent("pro_restored", { source: "restore_purchases" });
        Alert.alert(t("premiumAccess"), t("proUnlocked"));
      } else {
        logger.warn("RevenueCat restore found no active subscription", { feature: "revenuecat", action: "restore_no_active_subscription" });
        setShowRestorePurchases(true);
        Alert.alert(t("restorePurchases"), t("noActiveSubscription"));
      }
    } catch (error: any) {
      logger.error(error, { feature: "revenuecat", action: "restore" });
      billingDebugLog("restore failed", { message: error?.message });
      const message = t("restoreFailedTryAgain");
      setPaywallError(message);
      Alert.alert(t("restorePurchases"), t("restoreFailedTryAgain"));
    } finally {
      setPurchaseBusy(false);
    }
  }, [applyCustomerInfo, ensureAuthenticatedRevenueCatIdentity, refreshCurrentEntitlements, revenueCatConfigured, session?.user.id]);

  const confirmDeleteAccountFromPaywall = useCallback(() => {
    Alert.alert(t("deleteAccountConfirmTitle"), t("deleteAccountConfirmBody"), [
      { text: t("cancel") || "Cancel", style: "cancel" },
      {
        text: t("deleteAccountManageSubscription"),
        onPress: () => openSubscriptionManagement(customerInfoRef.current?.managementURL),
      },
      {
        text: t("deleteAccountContinue"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            const result = await requestAccountDeletion();
            if (!result.ok) {
              Alert.alert(t("deleteAccount"), t("deleteAccountFailed"));
              return;
            }
            if (result.manualAppleRevocationRequired) {
              Alert.alert(t("deleteAccount"), t("deleteAccountAppleManualRevokeBody"), [
                { text: t("deleteAccountAppleManualRevokeAction"), onPress: () => openAppleAppsUsingAppleIdSettings() },
                { text: t("ok") || "OK", style: "cancel" },
              ]);
            } else {
              Alert.alert(t("deleteAccount"), t("deleteAccountSuccess"));
            }
            await signOut({ force: true });
          })();
        },
      },
    ]);
  }, [signOut]);

  useEffect(() => {
    if (!revenueCatConfigured) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !purchasesConfigured.current) return;
      if (!sessionRef.current?.user?.id) return;
      void refreshCurrentEntitlements("app-foreground", [0]);
      void refreshServerEntitlement();
    });
    return () => subscription.remove();
  }, [refreshCurrentEntitlements, refreshServerEntitlement, revenueCatConfigured]);

  useEffect(() => {
    if (
      (tab !== "propPass" && tab !== "settings") ||
      !purchasesConfigured.current
    ) {
      return;
    }
    void refreshCurrentEntitlements(`${tab}-focus`, [0]);
  }, [refreshCurrentEntitlements, tab]);

  useNetworkReconnect(() => {
    if (cloudSyncEnabled) syncTradesWithCloud();
    if (purchasesConfigured.current && sessionRef.current?.user?.id) {
      void refreshCurrentEntitlements("network-reconnect", [0]);
    }
    if (sessionRef.current?.user?.id) {
      void refreshServerEntitlement();
    }
  });

  const authScreenCopy: AuthScreenCopy = {
    headline: t("authHeadline"),
    subtitle: t("authSubtitle"),
    apple: t("authApple"),
    google: t("authGoogle"),
    email: t("authEmail"),
    secureNote: t("authSecureNote"),
    entitlementActiveNote: t("authEntitlementActiveNote"),
    termsPrefix: t("authTermsPrefix"),
    termsLabel: t("authTermsLabel"),
    termsAnd: t("authTermsAnd"),
    privacyLabel: t("authPrivacyLabel"),
    termsSuffix: t("authTermsSuffix"),
    cancel: t("cancel"),
  };
  const emailModalCopy: EmailAuthModalCopy = {
    signInTitle: t("authEmailSignInTitle"),
    signUpTitle: t("authEmailSignUpTitle"),
    forgotTitle: t("authEmailForgotTitle"),
    checkEmailTitle: t("authEmailCheckTitle"),
    checkEmailBody: t("authEmailCheckBody"),
    emailPlaceholder: t("authEmailPlaceholder"),
    passwordPlaceholder: t("authEmailPasswordPlaceholder"),
    confirmPasswordPlaceholder: t("authEmailConfirmPasswordPlaceholder"),
    signIn: t("authEmailSignIn"),
    createAccount: t("authEmailCreateAccount"),
    createAccountLink: t("authEmailCreateAccountLink"),
    forgotPassword: t("authEmailForgotPassword"),
    sendReset: t("authEmailSendReset"),
    backToSignIn: t("authEmailBackToSignIn"),
    cancel: t("cancel"),
  };

  if (!appReady) {
    return (
      <SafeAreaView style={styles.app}>
        <StatusBar style="light" backgroundColor="#000000" />
        <View style={styles.lockScreen}>
          <AppStartupSkeleton />
          <Text style={[styles.sub, styles.startupSkeletonCaption]}>{t("loadingJournal")}</Text>
        </View>
        {stagingQaResetOverlay}
      </SafeAreaView>
    );
  }

  if (acquisitionPhase === "loading") {
    return (
      <SafeAreaView style={styles.app}>
        <StatusBar style="light" backgroundColor="#000000" />
        <View style={styles.lockScreen}>
          <AppStartupSkeleton />
          <Text style={[styles.sub, styles.startupSkeletonCaption]}>
            {identitySyncFailed ? t("tryAgain") : t("loadingJournal")}
          </Text>
          {identitySyncFailed ? (
            <Pressable
              onPress={() => {
                setIdentitySyncFailed(false);
                setIdentitySyncPending(true);
                identitySyncGenerationRef.current += 1;
                const userId = session?.user?.id;
                if (userId) {
                  void revenueCatIdentityRef.current.synchronize(userId).then((result) => {
                    if (result.status === "failed") {
                      setIdentitySyncFailed(true);
                      setIdentitySyncPending(false);
                      return;
                    }
                    if (result.customerInfo) applyCustomerInfo(result.customerInfo, "identity:retry");
                    setIdentitySyncPending(false);
                  });
                } else {
                  setIdentitySyncPending(false);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={t("tryAgain")}
              testID="entitlement-retry"
              style={{ marginTop: 16, minHeight: 44, justifyContent: "center", paddingHorizontal: 20 }}
            >
              <Text style={styles.sub}>{t("tryAgain")}</Text>
            </Pressable>
          ) : null}
        </View>
        {stagingQaResetOverlay}
      </SafeAreaView>
    );
  }

  if (acquisitionPhase === "onboarding") {
    return (
      <SafeAreaView style={[styles.app, { backgroundColor: shellTheme.colors.background.primary }]}>
        <StatusBar style="light" backgroundColor={shellTheme.colors.background.primary} />
        {stagingQaResetOverlay}
        <ValueOnboarding onComplete={() => completeProductOnboarding()} />
      </SafeAreaView>
    );
  }

  if (acquisitionPhase === "paywall") {
    return (
      <SafeAreaView style={[styles.app, { backgroundColor: shellTheme.colors.background.primary }]}>
        <StatusBar style="light" backgroundColor={shellTheme.colors.background.primary} />
        {stagingQaResetOverlay}
        <AcquisitionPaywall
          packages={packages}
          storeProducts={storeProducts}
          purchaseBusy={purchaseBusy}
          paywallError={paywallError}
          showRestorePurchases
          authenticatedAccountActions
          onPurchase={purchasePackage}
          onRestore={restorePurchases}
          onSignOut={() => void signOut()}
          onDeleteAccount={confirmDeleteAccountFromPaywall}
          onRetryOfferings={() => {
            void refreshRevenueCat();
          }}
          packageTitle={packageTitle}
          packagePrice={packagePrice}
        />
      </SafeAreaView>
    );
  }

  if (acquisitionPhase === "post_purchase_auth") {
    return (
      <PostPurchaseAuthContainer
        anonymousCustomerInfo={anonymousCustomerInfoRef.current}
        onAuthenticate={handlePostPurchaseAuthenticate}
        onAuthenticateEmail={handlePostPurchaseEmail}
        onLinkingComplete={(result) => {
          void AsyncStorage.removeItem(POST_PURCHASE_LINKING_MARKER_KEY);
          applyCustomerInfo(result.customerInfo, "post-purchase-linking");
          setAnonymousEntitlementStatus("inactive");
          anonymousCustomerInfoRef.current = null;
          // Coordinator handled migration; acquisition now routes to main (session + Pro).
        }}
      />
    );
  }

  if (acquisitionPhase === "auth") {
    return (
      <View style={styles.app}>
        <StatusBar style="light" backgroundColor="#000000" />
        {stagingQaResetOverlay}
        {qaResetPhase === "reset_complete" ? (
          <View
            testID="qa.reset.complete"
            accessibilityLabel="qa.reset.complete"
            accessible
            importantForAccessibility="yes"
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
        ) : null}
        {qaResetPhase === "reset_failed" ? (
          <View
            testID="qa.reset.failed"
            accessibilityLabel="qa.reset.failed"
            accessible
            importantForAccessibility="yes"
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
        ) : null}
        <AuthScreen
          busy={authBusy}
          copy={authScreenCopy}
          emailModalCopy={emailModalCopy}
          showApple={enableNativeAppleSignIn}
          showGoogle
          hideQaConfigBanners
          appleConfigWarning={null}
          googleConfigWarning={null}
          onSignIn={signInWithProvider}
          onSignInWithEmailPassword={signInWithEmailPasswordHandler}
          onSignUpWithEmailPassword={signUpWithEmailPasswordHandler}
          onRequestPasswordReset={requestPasswordResetHandler}
        />
      </View>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "journal", label: t("journal") },
    ...(propPassTabVisible ? [{ id: "propPass" as const, label: t("propPass.tab") }] : []),
    { id: "stats", label: t("stats") },
    { id: "more", label: t("more.title") },
    { id: "settings", label: t("settings") },
  ];
  const premiumTabs: Tab[] = [];
  const locked = !isPremium && premiumTabs.includes(tab);
  return (
    <SafeAreaView style={[styles.app, { backgroundColor: shellTheme.colors.background.primary }]}>
        <StatusBar style="light" backgroundColor={shellTheme.colors.background.primary} />
        {stagingQaResetOverlay}
        <View style={styles.body}>
          <YdlFade key={tab} style={{ flex: 1 }} enter>
          {locked ? (
            <PremiumScreen
              lang={lang}
              onClose={() => setTab("more")}
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
              packages={packages}
              storeProducts={storeProducts}
              purchaseBusy={purchaseBusy}
              paywallError={paywallError}
              showRestorePurchases={showRestorePurchases}
              onOpenPropRisk={(date) => {
                setPropRiskDate(date);
                setPropRiskOpen(true);
              }}
              onUpgrade={() => purchasePackage(packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null, YOU_TRADER_MONTHLY_PRODUCT_ID)}
              onPurchase={purchasePackage}
              onRestore={restorePurchases}
              onTradeDeleted={markCloudTradeDeleted}
              onContinueToReview={() => setTab("stats")}
              cloudSyncEnabled={cloudSyncEnabled}
              cloudSyncStatus={cloudSyncStatus}
              qaApplyEditRequest={qaApplyEditRequest}
              onQaApplyEditConsumed={onQaApplyEditConsumed}
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
              onLogTrade={() => setTab("journal")}
              onOpenReports={() => {
                /* Performance reports remain on Stats scroll; keep tab */
              }}
            />
          ) : tab === "propPass" ? (
            entitlementUiPhase === "loading" ? (
              <View style={styles.lockScreen} testID="prop-pass-entitlement-loading">
                <AppStartupSkeleton />
                <Text style={[styles.sub, styles.startupSkeletonCaption]}>{t("checking")}</Text>
              </View>
            ) : propPassEntitled ? (
            <React.Suspense fallback={null}>
              <LazyPropPassInternalScreen
                key={`prop-pass-${qaPropPassEpoch}`}
                userId={session?.user?.id ?? null}
                trades={trades}
                presentation="tab"
                uiStateOverride={qaPropPassPayload?.uiStateOverride ?? undefined}
                todaysPlan={qaPropPassPayload?.plan ?? null}
                insightsPresentation={qaPropPassPayload?.insightsMode ?? "from_model"}
                developerMode={false}
              />
            </React.Suspense>
            ) : (
              <PropPassLockedPreview
                onViewPlans={() => {
                  setTab("more");
                  setMoreDestination("subscription");
                }}
                onRestore={restorePurchases}
                restoreBusy={purchaseBusy}
              />
            )
          ) : tab === "news" ? (
            <NewsScreen
              key={`news-${qaNewsFaultEpoch}`}
              lang={lang}
              isPremium={isPremium}
              userId={session?.user.id || null}
              onUpgrade={() => purchasePackage(packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null, YOU_TRADER_MONTHLY_PRODUCT_ID)}
            />
          ) : tab === "calendar" ? (
            <CalendarScreen lang={lang} trades={trades} isPremium={isPremium} onUpgrade={() => purchasePackage(packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null, YOU_TRADER_MONTHLY_PRODUCT_ID)} />
          ) : tab === "calc" ? (
            <CalcScreen lang={lang} />
          ) : tab === "more" && moreDestination === "subscription" ? (
            <SubscriptionScreen
              isPremium={isPremium}
              packages={packages}
              storeProducts={storeProducts}
              purchaseBusy={purchaseBusy}
              paywallError={paywallError}
              showRestorePurchases={showRestorePurchases}
              offeringsUnavailable={!packages.length && !storeProducts.length}
              monthlyLabel={t("monthlyPlan")}
              yearlyLabel={t("yearlyPlan")}
              monthlyPrice={(() => {
                const monthly = packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null;
                if (monthly) return packagePrice(monthly);
                return (
                  storeProducts.find((product) => product.identifier === YOU_TRADER_MONTHLY_PRODUCT_ID)?.priceString ||
                  PREMIUM_PRICE
                );
              })()}
              yearlyPrice={(() => {
                const yearly = packages.find((pkg) => packageTitle(pkg) === "YEARLY") || null;
                if (yearly) return packagePrice(yearly);
                return (
                  storeProducts.find((product) => product.identifier === YOU_TRADER_YEARLY_PRODUCT_ID)?.priceString ||
                  PREMIUM_PRICE_YEARLY
                );
              })()}
              onPurchaseMonthly={() =>
                purchasePackage(
                  packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null,
                  YOU_TRADER_MONTHLY_PRODUCT_ID,
                )
              }
              onPurchaseYearly={() =>
                purchasePackage(
                  packages.find((pkg) => packageTitle(pkg) === "YEARLY") || null,
                  YOU_TRADER_YEARLY_PRODUCT_ID,
                )
              }
              onRestore={restorePurchases}
              onRetryOfferings={() => {
                void refreshRevenueCat();
              }}
              onBack={() => setMoreDestination("hub")}
            />
          ) : tab === "more" ? (
            <MoreScreen
              showRestore={showRestorePurchases}
              isPremium={isPremium}
              onOpen={(dest) => {
                if (dest === "subscription") {
                  setMoreDestination("subscription");
                  return;
                }
                if (dest === "restore") {
                  restorePurchases();
                  return;
                }
                if (dest === "importTrades") {
                  if (!isPremium) {
                    Alert.alert(t("premiumAccess"), t("csvImportPro"));
                    return;
                  }
                  void importTradesFromCsv();
                  return;
                }
                if (dest === "reports") {
                  setMoreDestination("hub");
                  setTab("stats");
                  return;
                }
                if (dest === "account") {
                  setMoreDestination("hub");
                  setTab("settings");
                  return;
                }
                setMoreDestination("hub");
                setTab(dest as Tab);
              }}
            />
          ) : (
            <SettingsScreen
              lang={lang}
              setLang={setLang}
              session={session}
              authBusy={authBusy}
              authConfigured={authConfigured}
              isPremium={isPremium}
              entitlementResolving={entitlementUiPhase === "loading"}
              customerInfo={customerInfo}
              packages={packages}
              storeProducts={storeProducts}
              purchaseBusy={purchaseBusy}
              revenueCatConfigured={revenueCatConfigured}
              paywallError={paywallError}
              showRestorePurchases={showRestorePurchases}
              onPurchase={purchasePackage}
              onRestore={restorePurchases}
              refreshDailyPropBuffer={refreshLockScreenBufferReminder}
              onSignIn={signInWithProvider}
              onSignOut={signOut}
              onChangePassword={changeAccountPassword}
              onChangeEmail={changeAccountEmail}
              calendarEvents={pushCalendarEvents}
              trades={trades}
              onViewPlans={() => {
                setTab("more");
                setMoreDestination("subscription");
              }}
              onRefreshCustomerInfo={() => {
                void refreshRevenueCat();
              }}
              onUpgrade={() =>
                purchasePackage(
                  packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null,
                  YOU_TRADER_MONTHLY_PRODUCT_ID,
                )
              }
            />
          )}
          </YdlFade>
        </View>
        <ChangePasswordModal
          visible={resetPasswordOpen}
          title={t("authResetPassword")}
          submitLabel={t("authUpdatePassword")}
          onClose={() => setResetPasswordOpen(false)}
          onSubmit={completePasswordReset}
        />
        <Modal visible={propRiskOpen} animationType="slide">
          <SafeAreaView style={styles.modal}>
            <View style={styles.propModalTopBar}>
              <Pressable onPress={() => setPropRiskOpen(false)} style={styles.closeCircleProp}>
                <Text style={styles.closeX}>×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={[styles.content, styles.propModalScroll]}>
              <PropFirmRiskCoach
                trades={trades}
                selectedDate={propRiskDate}
                templates={propTemplates}
                isPremium={isPremium}
                onUpgrade={() =>
                  purchasePackage(
                    packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null,
                    YOU_TRADER_MONTHLY_PRODUCT_ID,
                  )
                }
              />
            </ScrollView>
          </SafeAreaView>
        </Modal>
        <YdlTabBar<Tab>
          tabs={tabs.map((x) => ({
            id: x.id,
            label: x.label,
            glyph: (
              <TabGlyph
                id={x.id}
                active={
                  (
                    tab === "calc" ||
                    tab === "news" ||
                    tab === "calendar" ||
                    moreDestination === "subscription"
                      ? "more"
                      : tab
                  ) === x.id
                }
              />
            ),
          }))}
          activeId={
            tab === "calc" ||
            tab === "news" ||
            tab === "calendar" ||
            moreDestination === "subscription"
              ? "more"
              : tab
          }
          onSelect={(id) => {
            if (
              id === "more" &&
              (tab === "calc" ||
                tab === "news" ||
                tab === "calendar" ||
                tab === "more" ||
                moreDestination === "subscription")
            ) {
              setMoreDestination("hub");
              setTab("more");
              return;
            }
            setMoreDestination("hub");
            setTab(id);
          }}
        />
        {shareExportHostReady ? (
          <React.Suspense fallback={null}>
            <LazyStatCardExportHost />
          </React.Suspense>
        ) : null}
      </SafeAreaView>
  );
}

function AppRoot() {
  const [posthogReady, setPosthogReady] = useState(false);
  const [shellMounted, setShellMounted] = useState(false);
  const [startupTimedOut, setStartupTimedOut] = useState(false);
  const [startupEpoch, setStartupEpoch] = useState(0);
  const posthogClient = posthogReady ? getPosthogClient() : undefined;

  useEffect(() => {
    logStartupCheckpoint("S05");
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setPosthogReady(true);
    });
    return () => task.cancel();
  }, []);

  const shellMountedRef = useRef(false);
  useEffect(() => {
    shellMountedRef.current = shellMounted;
  }, [shellMounted]);

  useEffect(() => {
    setShellMounted(false);
    setStartupTimedOut(false);
    // Debug/staging Metro cold bundles can exceed 15s on this host (no Watchman / CI mode).
    const env = (process.env.EXPO_PUBLIC_APP_ENV || process.env.APP_ENV || "").trim().toLowerCase();
    const stagingLike = env === "staging" || env === "development" || env === "local" || env === "dev" || __DEV__;
    const watchdogMs = stagingLike ? 45000 : 15000;
    const watchdog = setTimeout(() => {
      if (shellMountedRef.current) return;
      logStartupError("startup_watchdog_timeout");
      setStartupTimedOut(true);
    }, watchdogMs);
    return () => clearTimeout(watchdog);
  }, [startupEpoch]);

  useEffect(() => {
    if (!shellMounted) return;
    setStartupTimedOut(false);
    logStartupCheckpoint("S12");
    logStartupCheckpoint("S13");
    logStartupCheckpoint("S14");
  }, [shellMounted]);

  const appTree = (
    <AppErrorBoundary key={startupEpoch}>
      <StatsTimeRangeProvider>
        <App key={startupEpoch} onVisibleShell={() => setShellMounted(true)} />
      </StatsTimeRangeProvider>
    </AppErrorBoundary>
  );

  const wrapped = posthogClient ? (
    <PostHogProvider client={posthogClient} autocapture={false}>
      {appTree}
    </PostHogProvider>
  ) : (
    appTree
  );

  return (
    <YouTraderSafeAreaProvider>
      {startupTimedOut && !shellMounted ? (
        <SafeAreaView style={styles.app}>
          <StartupFailureFallback
            reasonCode="startup_shell_timeout"
            onRetry={() => setStartupEpoch((value) => value + 1)}
          />
        </SafeAreaView>
      ) : (
        wrapped
      )}
    </YouTraderSafeAreaProvider>
  );
}

export default wrapAppWithSentry(AppRoot);
