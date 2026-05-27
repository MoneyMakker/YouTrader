import "react-native-url-polyfill/auto";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as AppleAuthentication from "expo-apple-authentication";
import { makeRedirectUri } from "expo-auth-session";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import * as WebBrowser from "expo-web-browser";
import { createClient, processLock, type Session } from "@supabase/supabase-js";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

WebBrowser.maybeCompleteAuthSession();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type Tab = "journal" | "stats" | "calendar" | "news" | "calc" | "settings";
type Direction = "LONG" | "SHORT";
type Asset = "ES" | "NQ" | "GOLD" | "OIL" | "BTC" | "ETH";
type Bias = "LONG" | "SHORT" | "NEUTRAL";
type Impact = "HIGH" | "MED" | "LOW";
type Lang = "en" | "ru" | "es" | "fr" | "it" | "uk" | "de";
type AuthProvider = "google" | "apple";
type FirmMode = "evaluation" | "live";
type ContractFamily = "micro" | "emini";

type Trade = {
  id: string;
  date: string;
  symbol: string;
  direction: Direction;
  entry?: number | null;
  exit?: number | null;
  contracts: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  pnl: number;
  mood: string;
  notes: string;
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

const FINNHUB =
  process.env.EXPO_PUBLIC_FINNHUB_API_KEY ||
  "d86f9tpr01qgiu456f40d86f9tpr01qgiu456f4g";
const CALENDAR_API_URL = process.env.EXPO_PUBLIC_CALENDAR_API_URL || "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const AUTH_REDIRECT_TO = makeRedirectUri({ scheme: "com.youtrader.pro", path: "auth" });
const ENABLE_NATIVE_APPLE_SIGN_IN =
  process.env.EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGN_IN === "true";
const OWNER_FULL_ACCESS = process.env.EXPO_PUBLIC_OWNER_FULL_ACCESS === "true";
const PREMIUM_PRICE = "$9.99/mo";
const TRADES_STORAGE_KEY = "trades-v6";
const FREE_JOURNAL_DAYS = 10;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "";
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || "";
const REVENUECAT_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "pro";
const REVENUECAT_API_KEY =
  Platform.OS === "ios"
    ? REVENUECAT_IOS_API_KEY
    : Platform.OS === "android"
      ? REVENUECAT_ANDROID_API_KEY
      : "";
const supabase = SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : null;

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
    autoRefresh: "Finnhub live feed • auto-refresh every 60 seconds",
    refresh: "Refresh",
    economicCalendar: "Economic Calendar",
    calendarSub: "Market-moving events • Eastern Time",
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
    premiumAccess: "Premium Access",
    subscribe: "Start Pro • $9.99/mo",
    restore: "Restore Purchase",
    premiumLocked: "Premium Feature",
    premiumLockedText:
      "Keep the core tools free. Upgrade when you want unlimited journal, cloud sync and the full edge profile.",
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
    premiumBenefit1: "Unlimited trade journal after the free 10 trading days",
    premiumBenefit2: "Full analytics: expectancy, Sharpe, consistency and streaks",
    premiumBenefit3: "Full edge profile, full radar and recovery analytics",
    premiumBenefit4: "Session, day and symbol performance breakdowns",
    premiumBenefit5: "Advanced news sentiment for ES/NQ/GOLD/OIL/BTC",
    premiumBenefit6: "Cloud Sync + multi-device journal backup",
    premiumBenefit7: "AI edge insights, export and replay tools planned next",
    premiumBenefit8: "Keep calculator, economic calendar and basic news free",
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
    cloudSync: "Cloud Sync",
    cloudSyncText: "Premium Cloud Sync keeps your journal available across devices after you sign in.",
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
    calc: "Калькулятор",
    settings: "Настройки",
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
    premiumAccess: "Premium доступ",
    subscribe: "Оформить Premium • $4.99/мес",
    restore: "Восстановить покупку",
    premiumLocked: "Premium функция",
    premiumLockedText:
      "Базовые инструменты остаются бесплатными. Premium нужен для unlimited journal, cloud sync и полного edge profile.",
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
    premiumBenefit1: "Unlimited journal после 10 бесплатных торговых дней",
    premiumBenefit2: "Полная аналитика: expectancy, Sharpe, consistency и серии",
    premiumBenefit3: "Full edge profile, full radar и recovery analytics",
    premiumBenefit4: "Разбор по session/day/symbol",
    premiumBenefit5: "Advanced news sentiment для ES/NQ/GOLD/OIL/BTC",
    premiumBenefit6: "Cloud Sync + multi-device backup журнала",
    premiumBenefit7: "AI edge insights, export и replay добавим следующими",
    premiumBenefit8: "Calculator, economic calendar и basic news остаются free",
    percentRiskCalculator: "% Risk Calculator",
    accountBalance: "Account Balance",
    riskPercent: "Risk %",
    maxRisk: "Max SL Risk",
    dataProtection: "Защита данных",
    backupNow: "Экспорт backup",
    restoreBackup: "Импорт backup",
    backupText: "Сохраняй полный backup сделок и скриншотов в iCloud Drive. Если приложение удалится, импортируй этот файл и восстанови журнал.",
    cloudSync: "Cloud Sync",
    cloudSyncText: "Premium Cloud Sync синхронизирует журнал между устройствами после входа в аккаунт.",
    backupReady: "Backup готов",
    backupFailed: "Backup не удался",
    restoreDone: "Backup восстановлен. Перезапусти приложение, чтобы журнал обновился.",
    restoreFailed: "Восстановление не удалось",
  },
  es: {
    myJournal: "Mi diario",
    journal: "Diario",
    calendar: "Calendario",
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
    premiumAccess: "Acceso Premium",
    subscribe: "Premium • $4.99/mes",
    restore: "Restaurar compra",
    premiumLocked: "Función Premium",
    premiumLockedText:
      "Desbloquea noticias live, calendario, analytics, AI summaries y cloud sync.",
    plusPnl: "Profit +",
    minusPnl: "Loss −",
    photo: "Screenshot",
    takePhoto: "Tomar foto",
    uploadPhoto: "Subir foto",
    premiumBenefit1: "Noticias live con bias",
    premiumBenefit2: "Calendario semanal",
    premiumBenefit3: "Analytics avanzadas",
    premiumBenefit4: "Replay Mode: screenshots, notes и voice notes для разбора каждой сделки",
    premiumBenefit5: "Unlimited journal database",
    premiumBenefit6: "Cloud Sync + Multi Device backup всей базы сделок",
    premiumBenefit7: "Tick, Point, Risk/Reward и % Risk calculators",
    premiumBenefit8: "My Stats: лучшие/худшие дни, время торговли, setup performance, drawdown и equity curve",
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
    premiumAccess: "Accès Premium",
    subscribe: "Premium • $4.99/mois",
    restore: "Restaurer achat",
    premiumLocked: "Fonction Premium",
    premiumLockedText:
      "Débloquez news live, calendrier, analytics, AI summaries et cloud sync.",
    plusPnl: "Profit +",
    minusPnl: "Loss −",
    photo: "Screenshot",
    takePhoto: "Photo",
    uploadPhoto: "Importer",
    premiumBenefit1: "News live avec bias",
    premiumBenefit2: "Calendrier semaine",
    premiumBenefit3: "Analytics avancées",
    premiumBenefit4: "Replay Mode: screenshots, notes и voice notes для разбора каждой сделки",
    premiumBenefit5: "Unlimited journal database",
    premiumBenefit6: "Cloud Sync + Multi Device backup всей базы сделок",
    premiumBenefit7: "Tick, Point, Risk/Reward и % Risk calculators",
    premiumBenefit8: "My Stats: лучшие/худшие дни, время торговли, setup performance, drawdown и equity curve",
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
    calc: "Calcolatore",
    settings: "Impostazioni",
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
    premiumAccess: "Accesso Premium",
    subscribe: "Premium • $4.99/mese",
    restore: "Ripristina",
    premiumLocked: "Funzione Premium",
    premiumLockedText:
      "Sblocca news live, calendario, analytics, AI summaries e cloud sync.",
    plusPnl: "Profit +",
    minusPnl: "Loss −",
    photo: "Screenshot",
    takePhoto: "Foto",
    uploadPhoto: "Carica",
    premiumBenefit1: "News live con bias",
    premiumBenefit2: "Calendario settimana",
    premiumBenefit3: "Analytics avanzate",
    premiumBenefit4: "Replay Mode: screenshots, notes и voice notes для разбора каждой сделки",
    premiumBenefit5: "Unlimited journal database",
    premiumBenefit6: "Cloud Sync + Multi Device backup всей базы сделок",
    premiumBenefit7: "Tick, Point, Risk/Reward и % Risk calculators",
    premiumBenefit8: "My Stats: лучшие/худшие дни, время торговли, setup performance, drawdown и equity curve",
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
    calc: "Калькулятор",
    settings: "Налаштування",
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
    premiumAccess: "Premium доступ",
    subscribe: "Premium • $4.99/міс",
    restore: "Відновити",
    premiumLocked: "Premium функція",
    premiumLockedText:
      "Відкрий live новини, календар, аналітику, AI summaries і cloud sync.",
    plusPnl: "Профіт +",
    minusPnl: "Лосс −",
    photo: "Скрин",
    takePhoto: "Фото",
    uploadPhoto: "Завантажити",
    premiumBenefit1: "Live новини з bias",
    premiumBenefit2: "Календар на тиждень",
    premiumBenefit3: "Аналітика журналу",
    premiumBenefit4: "Replay Mode: screenshots, notes и voice notes для разбора каждой сделки",
    premiumBenefit5: "Unlimited journal database",
    premiumBenefit6: "Cloud Sync + Multi Device backup всей базы сделок",
    premiumBenefit7: "Tick, Point, Risk/Reward и % Risk calculators",
    premiumBenefit8: "My Stats: лучшие/худшие дни, время торговли, setup performance, drawdown и equity curve",
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
    calc: "Rechner",
    settings: "Einstellungen",
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
    premiumAccess: "Premium Zugriff",
    subscribe: "Premium • $4.99/Monat",
    restore: "Kauf wiederherstellen",
    premiumLocked: "Premium Funktion",
    premiumLockedText:
      "Live News, Kalender, Analytics, AI summaries und cloud sync freischalten.",
    plusPnl: "Profit +",
    minusPnl: "Loss −",
    photo: "Screenshot",
    takePhoto: "Foto",
    uploadPhoto: "Hochladen",
    premiumBenefit1: "Live News mit Bias",
    premiumBenefit2: "Wochenkalender",
    premiumBenefit3: "Advanced Analytics",
    premiumBenefit4: "Replay Mode: screenshots, notes и voice notes для разбора каждой сделки",
    premiumBenefit5: "Unlimited journal database",
    premiumBenefit6: "Cloud Sync + Multi Device backup всей базы сделок",
    premiumBenefit7: "Tick, Point, Risk/Reward и % Risk calculators",
    premiumBenefit8: "My Stats: лучшие/худшие дни, время торговли, setup performance, drawdown и equity curve",
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
const ASSETS: Asset[] = ["ES", "NQ", "GOLD", "OIL", "BTC", "ETH"];
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
  const a = Math.abs(n);
  if (a >= 1000) return `${n >= 0 ? "+" : "-"}$${Math.round(a / 1000)}K`;
  return `${n >= 0 ? "+" : "-"}$${Math.round(a)}`;
}
function moodLabel(key: string) {
  const m = MOODS.find((x) => x.key === key);
  return m ? `${m.emoji} ${m.key}` : key;
}

function customerHasPro(customerInfo?: CustomerInfo | null) {
  return !!customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID];
}

function packagePrice(pkg?: PurchasesPackage | null) {
  return pkg?.product?.priceString || PREMIUM_PRICE;
}

function packageTitle(pkg: PurchasesPackage) {
  const id = `${pkg.identifier} ${pkg.product.identifier}`.toLowerCase();
  if (id.includes("annual") || id.includes("year")) return "YEARLY";
  if (id.includes("month")) return "MONTHLY";
  return pkg.packageType || "PRO";
}

function normalizeTrade(trade: Trade): Trade {
  const fallbackTime = typeof (trade as any).createdAt === "number" ? (trade as any).createdAt : Date.now();
  return {
    ...trade,
    id: String(trade.id || uid()),
    createdAt: typeof trade.createdAt === "number" ? trade.createdAt : fallbackTime,
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
  trades.forEach((trade) => {
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
    screenshot_url: normalized.photoUri || null,
    voice_url: normalized.voiceUri || null,
    tags: [],
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
    entry: row.entry,
    exit: row.exit,
    contracts: Number(row.contracts || 1),
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    pnl: Number(row.pnl || 0),
    mood: row.mood || "Focused",
    notes: row.notes || "",
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
    source: "Demo",
    time: "Cached",
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
    source: "Demo",
    time: "Cached",
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
function makeDemoEvents(): EconEvent[] {
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
  if (!FINNHUB) return cached?.items || demoNews;
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
    if (items.length)
      await AsyncStorage.setItem(
        "news-cache-v6",
        JSON.stringify({ at: Date.now(), items }),
      );
    return items.length ? items : cached?.items || demoNews;
  } catch {
    clearTimeout(timer);
    return cached?.items || demoNews;
  }
}
function normalizeEvent(e: any, index: number): EconEvent {
  const text = `${e.name || e.event || e.title || ""} ${e.currency || e.country || ""}`;
  return {
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
  };
}
async function loadCalendarEvents(): Promise<EconEvent[]> {
  const cacheRaw = await AsyncStorage.getItem("calendar-cache-v6");
  const cached = cacheRaw ? JSON.parse(cacheRaw) : null;
  if (!CALENDAR_API_URL) return cached?.items || makeDemoEvents();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const start = todayISO();
    const end = isoFromDate(addDays(new Date(), 7));
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
    const items = raw.map(normalizeEvent).slice(0, 80);
    if (items.length)
      await AsyncStorage.setItem(
        "calendar-cache-v6",
        JSON.stringify({ at: Date.now(), items }),
      );
    return items.length ? items : cached?.items || makeDemoEvents();
  } catch {
    clearTimeout(timer);
    return cached?.items || makeDemoEvents();
  }
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
  return <View style={[styles.card, style]}>{children}</View>;
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
  const ordered = [...trades].sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
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
  dailyLossLimit: number;
  maxLossLimit: number;
  evaluationContracts: number;
  liveContracts: number;
  evaluationRiskPct: number;
  liveRiskPct: number;
  trailingDrawdown: boolean;
};

const PROP_RISK_TEMPLATES: RiskTemplate[] = [
  {
    key: "topstep50k",
    label: "Topstep 50K",
    firm: "Topstep",
    accountName: "50K Combine",
    accountSize: 50000,
    dailyLossLimit: 1000,
    maxLossLimit: 2000,
    evaluationContracts: 5,
    liveContracts: 3,
    evaluationRiskPct: 0.14,
    liveRiskPct: 0.1,
    trailingDrawdown: false,
  },
  {
    key: "apex50k",
    label: "Apex 50K",
    firm: "Apex",
    accountName: "50K Evaluation",
    accountSize: 50000,
    dailyLossLimit: 1250,
    maxLossLimit: 2500,
    evaluationContracts: 10,
    liveContracts: 5,
    evaluationRiskPct: 0.12,
    liveRiskPct: 0.08,
    trailingDrawdown: true,
  },
  {
    key: "tpt50k",
    label: "Take Profit 50K",
    firm: "Take Profit Trader",
    accountName: "50K Pro",
    accountSize: 50000,
    dailyLossLimit: 1100,
    maxLossLimit: 2200,
    evaluationContracts: 5,
    liveContracts: 3,
    evaluationRiskPct: 0.13,
    liveRiskPct: 0.09,
    trailingDrawdown: false,
  },
  {
    key: "lucid100k",
    label: "Lucid 100K",
    firm: "Lucid",
    accountName: "100K Evaluation",
    accountSize: 100000,
    dailyLossLimit: 2000,
    maxLossLimit: 3000,
    evaluationContracts: 10,
    liveContracts: 6,
    evaluationRiskPct: 0.11,
    liveRiskPct: 0.08,
    trailingDrawdown: true,
  },
];

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
  const pnl = trades.reduce((a, t) => a + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLossRaw = losses.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(grossLossRaw);
  const wr = trades.length ? (wins.length / trades.length) * 100 : 0;
  const exp = trades.length ? pnl / trades.length : 0;
  const pf = grossLoss ? grossWin / grossLoss : grossWin ? 99 : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const avgWinLoss = avgLoss ? avgWin / avgLoss : avgWin ? 99 : 0;
  const rrs = trades.map(rrForTrade).filter((x): x is number => x != null && Number.isFinite(x));
  const avgRR = rrs.length ? rrs.reduce((a, x) => a + x, 0) / rrs.length : 0;
  const ordered = [...trades].sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
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
  const dd = maxDrawdownFromTrades(trades);
  const weekday = groupPerformance(trades, (t) => safeDateFromISO(t.date).toLocaleDateString([], { weekday: "short", timeZone: "UTC" }));
  const session = groupPerformance(trades, (t) => {
    const h = getTradeTime(t).getHours();
    if (h < 11) return "Morning";
    if (h < 14) return "Midday";
    return "Afternoon";
  });
  const bySetup = groupPerformance(trades, (t) => (t as any).setup || t.symbol || "Manual");
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
    weekday,
    session,
    bySetup,
  };
}

function PerformanceBreakdown({
  title,
  data,
  maxItems,
  labelFormatter = (label: string) => label,
}: {
  title: string;
  data: PerformanceGroup[];
  maxItems: number;
  labelFormatter?: (label: string) => string;
}) {
  const items = data.slice(0, maxItems);
  const max = Math.max(1, ...items.map((x) => Math.abs(x.pnl)));

  return (
    <View style={styles.breakdownSection}>
      <View style={styles.breakdownHeader}>
        <Text style={styles.breakdownTitle}>{title}</Text>
        <Text style={styles.breakdownHint}>Ranked by net P&L</Text>
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

function PropFirmRiskCoach({
  trades,
  selectedDate,
}: {
  trades: Trade[];
  selectedDate: string;
}) {
  const [templateKey, setTemplateKey] = useState(PROP_RISK_TEMPLATES[0].key);
  const [mode, setMode] = useState<FirmMode>("evaluation");
  const [alertsEnabled, setAlertsEnabled] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("prop-risk-template-v1"),
      AsyncStorage.getItem("prop-risk-mode-v1"),
      AsyncStorage.getItem("prop-risk-alerts-v1"),
    ]).then(([savedTemplate, savedMode, savedAlerts]) => {
      if (savedTemplate && PROP_RISK_TEMPLATES.some((template) => template.key === savedTemplate)) {
        setTemplateKey(savedTemplate);
      }
      if (savedMode === "evaluation" || savedMode === "live") setMode(savedMode);
      setAlertsEnabled(savedAlerts === "on");
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("prop-risk-template-v1", templateKey);
  }, [templateKey]);

  useEffect(() => {
    AsyncStorage.setItem("prop-risk-mode-v1", mode);
  }, [mode]);

  const template =
    PROP_RISK_TEMPLATES.find((item) => item.key === templateKey) || PROP_RISK_TEMPLATES[0];
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
  const dailyRemaining = Math.max(0, template.dailyLossLimit + Math.min(dayPnl, 0));
  const accountRemaining = Math.max(0, template.maxLossLimit + Math.min(totalPnl, 0));
  const recentTrades = [...trades].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)).slice(0, 8);
  let lossStreak = 0;
  for (const trade of recentTrades) {
    if (trade.pnl < 0) lossStreak += 1;
    else break;
  }
  const consistency = consistencyScoreFromTrades(trades);
  const expectancy = stats.exp;
  const sharpe = stats.sharpeRatio;
  const avgLoss = Math.max(35, stats.avgLoss || Math.max(50, Math.abs(expectancy || 0) * 1.7));
  const baseRiskPct = mode === "live" ? template.liveRiskPct : template.evaluationRiskPct;
  const qualityMultiplier =
    expectancy <= 0 || sharpe < 0
      ? 0.42
      : consistency >= 72 && sharpe >= 0.8
        ? 1
        : consistency >= 55
          ? 0.72
          : 0.55;
  const streakPenalty = lossStreak >= 3 ? 0.28 : lossStreak === 2 ? 0.48 : lossStreak === 1 ? 0.72 : 1;
  const modeMultiplier = mode === "live" ? 0.72 : 1;
  const riskBudget = Math.floor(
    Math.max(0, Math.min(dailyRemaining, accountRemaining) * baseRiskPct * qualityMultiplier * streakPenalty * modeMultiplier),
  );
  const maxFirmContracts = mode === "live" ? template.liveContracts : template.evaluationContracts;
  const microRiskUnit = Math.max(18, avgLoss * 0.32);
  const eminiRiskUnit = microRiskUnit * 10;
  const microContracts = Math.max(0, Math.min(maxFirmContracts * 10, Math.floor(riskBudget / microRiskUnit)));
  const eminiContracts = Math.max(0, Math.min(maxFirmContracts, Math.floor(riskBudget / eminiRiskUnit)));
  const family: ContractFamily =
    mode === "live" || dailyRemaining < template.dailyLossLimit * 0.55 || accountRemaining < template.maxLossLimit * 0.5 || lossStreak >= 2 || expectancy <= 0
      ? "micro"
      : eminiContracts >= 1
        ? "emini"
        : "micro";
  const suggestedContracts = family === "emini" ? Math.max(1, eminiContracts) : Math.max(1, microContracts || Math.min(2, maxFirmContracts));
  const hardStop = dailyRemaining <= 0 || accountRemaining <= 0;
  const caution =
    !hardStop &&
    (dailyRemaining <= template.dailyLossLimit * 0.35 ||
      accountRemaining <= template.maxLossLimit * 0.35 ||
      lossStreak >= 2 ||
      expectancy <= 0 ||
      dayPnl < 0);
  const status = hardStop ? "STOP" : caution ? "CAUTION" : "CLEAR";
  const statusColor = hardStop ? C.red : caution ? C.yellow : C.green;
  const coachLine = hardStop
    ? "Stop trading today. Protect the account and reset tomorrow."
    : lossStreak >= 3
      ? "3 losses in a row. Pause now or switch to review mode only."
      : expectancy <= 0
        ? `Trade only micros. Recommended ${suggestedContracts} Micro until expectancy turns positive.`
        : caution
          ? `Reduce size. Recommended ${suggestedContracts} ${family === "emini" ? "E-mini" : "Micro"} and wait for A+ setups.`
          : `You can trade. Recommended ${suggestedContracts} ${family === "emini" ? "E-mini" : "Micro"} with strict stop discipline.`;
  const reviewReady = selected.getUTCDay() === 0;
  const reviewLine = reviewReady
    ? `Weekly Review ready: week ${moneyCompact(weekPnl)}, month ${moneyCompact(monthPnl)}, expectancy ${moneyCompact(expectancy)}, Sharpe ${sharpe ? sharpe.toFixed(2) : "0.00"}.`
    : `Next weekly review on Sunday. Current week: ${moneyCompact(weekPnl)}.`;

  const enableAlerts = async () => {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Notifications", "Allow notifications to receive risk alerts.");
      return;
    }
    await AsyncStorage.setItem("prop-risk-alerts-v1", "on");
    setAlertsEnabled(true);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "YouTrader Risk Coach",
        body: reviewReady ? "Weekly Review is ready." : `Daily loss buffer: ${moneyCompact(dailyRemaining)}.`,
      },
      trigger: null,
    });
  };

  return (
    <Card style={styles.riskCoachCard}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.riskCoachTitle}>Prop Firm Risk Coach</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {template.firm} • {template.accountName} • {mode === "live" ? "Live" : "Evaluation"}
          </Text>
        </View>
        <View style={[styles.riskStatusPill, { borderColor: statusColor, backgroundColor: hardStop ? C.redSoft : caution ? C.yellowSoft : C.greenSoft }]}>
          <Text style={[styles.riskStatusText, { color: statusColor }]}>{status}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.riskTemplateRail}>
        {PROP_RISK_TEMPLATES.map((item) => {
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
        {(["evaluation", "live"] as FirmMode[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => setMode(item)}
            style={[styles.riskModeBtn, mode === item && styles.riskModeActive]}
          >
            <Text style={[styles.riskModeText, mode === item && { color: C.bg }]}>
              {item === "live" ? "LIVE MODE" : "EVALUATION"}
            </Text>
          </Pressable>
        ))}
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
          <Text style={styles.riskMetricValue}>{moneyCompact(riskBudget)}</Text>
        </View>
        <View style={styles.riskMetricBox}>
          <Text style={styles.edgeMiniLabel}>Smart size</Text>
          <Text style={[styles.riskMetricValue, { color: C.green }]}>
            {suggestedContracts} {family === "emini" ? "E-mini" : "Micro"}
          </Text>
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
      </View>

      <View style={styles.weeklyReviewBox}>
        <Text style={styles.edgeMiniLabel}>Weekly / Monthly Review</Text>
        <Text style={styles.weeklyReviewText}>{reviewLine}</Text>
      </View>

      <Pressable
        onPress={alertsEnabled ? undefined : enableAlerts}
        style={[styles.secondaryBig, styles.riskAlertsBtn, alertsEnabled && { opacity: 0.65 }]}
      >
        <Text style={styles.secondaryText}>
          {alertsEnabled ? "Risk alerts enabled" : "Enable risk push alerts"}
        </Text>
      </Pressable>

      <Text style={[styles.sub, { marginTop: 10 }]}>
        Confirm your firm's exact rules before trading. This coach uses conservative local calculations.
      </Text>
    </Card>
  );
}
function MetricGauge({ label, value, helper, tone = "green" }: { label: string; value: string; helper?: string; tone?: "green" | "purple" | "red" | "white" }) {
  const color = tone === "purple" ? C.purple : tone === "red" ? C.red : tone === "white" ? C.text : C.green;
  return (
    <View style={styles.dashboardMetric}>
      <View style={styles.rowBetween}>
        <Text style={styles.dashboardMetricLabel}>{label}</Text>
        <View style={[styles.metricDot, { backgroundColor: color }]} />
      </View>
      <Text style={[styles.dashboardMetricValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {!!helper && <Text style={styles.dashboardMetricHelper} numberOfLines={1}>{helper}</Text>}
    </View>
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
    <View style={[styles.dashboardMetric, locked && { opacity: 0.52 }]}>
      <Text style={[styles.dashboardMetricLabel, { color: C.sub, fontSize: 14 }]}>{label}</Text>
      <View style={{ marginTop: 10, minHeight: 30, justifyContent: "center" }}>
        {typeof value === "string" ? (
          <Text style={[styles.dashboardMetricValue, { color: value.includes("-") ? C.red : (value.includes("$") || value.includes("+") ? C.green : C.text), fontSize: 25 }]} numberOfLines={1} adjustsFontSizeToFit>
            {locked ? "••••" : value}
          </Text>
        ) : locked ? (
          <Text style={[styles.dashboardMetricValue, { color: C.purple, fontSize: 25 }]} numberOfLines={1}>
            ••••
          </Text>
        ) : (
          value
        )}
      </View>
      {locked && (
        <View style={styles.lockOverlay}>
          <Text style={styles.lockText}>PRO</Text>
        </View>
      )}
    </View>
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
    return <Text style={[styles.dashboardMetricValue, { color: C.purple, fontSize: 25 }]}>••••</Text>;
  }
  return (
    <Text style={[styles.dashboardMetricValue, { fontSize: 22 }]} numberOfLines={1} adjustsFontSizeToFit>
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
    return <Text style={[styles.dashboardMetricValue, { color: C.purple, fontSize: 25 }]}>••••</Text>;
  }
  return (
    <Text style={[styles.dashboardMetricValue, { fontSize: 25 }]} numberOfLines={1}>
      <Text style={{ color: C.green }}>{wins}</Text>
      <Text style={{ color: C.sub }}> / </Text>
      <Text style={{ color: C.red }}>{losses}</Text>
    </Text>
  );
}

function PaywallPreview({
  packages,
  purchaseBusy,
  revenueCatConfigured,
  paywallError,
  onPurchase,
  onRestore,
}: {
  packages: PurchasesPackage[];
  purchaseBusy: boolean;
  revenueCatConfigured: boolean;
  paywallError: string;
  onPurchase: (pkg?: PurchasesPackage | null) => void;
  onRestore: () => void;
}) {
  const monthly = packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null;
  const yearly = packages.find((pkg) => packageTitle(pkg) === "YEARLY") || packages[1] || null;
  return (
    <View style={styles.paywallPreview}>
      <Text style={styles.paywallTitle}>Unlock Full Edge Analysis</Text>
      <Text style={styles.paywallSub}>
        Unlimited journal, full radar profile, recovery factor, consistency, session/symbol breakdowns and advanced performance metrics.
      </Text>
      <View style={styles.planRow}>
        <Pressable
          disabled={purchaseBusy || !revenueCatConfigured}
          onPress={() => onPurchase(monthly)}
          style={[styles.monthlyPlan, (!revenueCatConfigured || purchaseBusy) && styles.disabledBtn]}
        >
          <Text style={styles.planName}>MONTHLY</Text>
          <Text style={styles.planPrice}>{packagePrice(monthly)}</Text>
        </Pressable>
        <Pressable
          disabled={purchaseBusy || !revenueCatConfigured}
          onPress={() => onPurchase(yearly || monthly)}
          style={[styles.yearlyPlan, (!revenueCatConfigured || purchaseBusy) && styles.disabledBtn]}
        >
          <View style={styles.bestValueBadge}>
            <Text style={styles.bestValueText}>BEST VALUE</Text>
          </View>
          <Text style={styles.planName}>YEARLY</Text>
          <Text style={styles.planPrice}>{yearly ? packagePrice(yearly) : "$79.99/year"}</Text>
        </Pressable>
      </View>
      <Pressable
        disabled={purchaseBusy || !revenueCatConfigured}
        onPress={onRestore}
        style={[styles.secondaryBig, styles.restorePurchaseBtn, (!revenueCatConfigured || purchaseBusy) && styles.disabledBtn]}
      >
        <Text style={styles.secondaryText}>{purchaseBusy ? "Connecting..." : "Restore Purchases"}</Text>
      </Pressable>
      {!revenueCatConfigured ? (
        <Text style={[styles.sub, { marginTop: 10 }]}>
          RevenueCat key is missing. Add EXPO_PUBLIC_REVENUECAT_IOS_API_KEY before TestFlight.
        </Text>
      ) : paywallError ? (
        <Text style={[styles.sub, { color: C.red, marginTop: 10 }]}>{paywallError}</Text>
      ) : null}
    </View>
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



function consistencyScoreFromTrades(trades: Trade[]) {
  const daily = buildDailySeries(trades);
  if (!trades.length) return 0;
  if (daily.length <= 1) return 62;
  const winners = daily.filter((d) => d.value > 0).length;
  const greenRate = (winners / daily.length) * 100;
  const avgAbs = daily.reduce((a, d) => a + Math.abs(d.value), 0) / daily.length || 1;
  const avg = daily.reduce((a, d) => a + d.value, 0) / daily.length;
  const stdev = Math.sqrt(daily.reduce((a, d) => a + Math.pow(d.value - avg, 2), 0) / daily.length);
  const stability = Math.max(0, 100 - (stdev / avgAbs) * 42);
  return Math.max(0, Math.min(100, greenRate * 0.55 + stability * 0.45));
}

function Stats({
  trades,
  lang,
  isPremium,
  packages,
  purchaseBusy,
  revenueCatConfigured,
  paywallError,
  onPurchase,
  onRestore,
}: {
  trades: Trade[];
  lang: Lang;
  isPremium: boolean;
  packages: PurchasesPackage[];
  purchaseBusy: boolean;
  revenueCatConfigured: boolean;
  paywallError: string;
  onPurchase: (pkg?: PurchasesPackage | null) => void;
  onRestore: () => void;
}) {
  const freeDays = 10;
  const sortedUniqueDays = [...new Set(trades.map((t) => t.date))].sort();
  const allowedDays = sortedUniqueDays.slice(0, freeDays);
  const visibleTrades = isPremium ? trades : trades.filter((t) => allowedDays.includes(t.date));
  const lockedByFreeLimit = !isPremium && sortedUniqueDays.length > freeDays;
  const s = useMemo(() => calcStats(visibleTrades), [visibleTrades]);

  const daily = buildDailySeries(visibleTrades);
  let running = 0;
  const cumulative = daily.map((x) => ({ label: x.label, value: (running += x.value) }));

  const wins = visibleTrades.filter((t) => t.pnl > 0).length;
  const losses = visibleTrades.filter((t) => t.pnl < 0).length;
  const biggestWin = Math.max(0, ...visibleTrades.map((t) => t.pnl));
  const biggestLoss = Math.min(0, ...visibleTrades.map((t) => t.pnl));
  const consistency = consistencyScoreFromTrades(visibleTrades);
  const absDrawdown = Math.abs(s.maxDd);
  const recoveryFactor = absDrawdown > 0 ? Math.max(0, s.pnl / absDrawdown) : s.pnl > 0 ? 99 : 0;
  const drawdownControl = s.pnl > 0
    ? Math.max(15, Math.min(100, 100 - (absDrawdown / Math.max(1, Math.abs(s.pnl) + absDrawdown)) * 100))
    : Math.max(10, 100 - absDrawdown / 10);

  const quality = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        s.wr * 0.26 +
          (Math.min(s.pf || 0, 3) / 3) * 20 +
          (Math.min(s.avgWinLoss || 0, 3) / 3) * 16 +
          Math.min(recoveryFactor, 4) / 4 * 14 +
          drawdownControl * 0.12 +
          consistency * 0.12
      )
    )
  );

  const bestDay = s.weekday[0];
  const worstDay = [...s.weekday].sort((a, b) => a.pnl - b.pnl)[0];
  const bestSession = s.session[0];

  const fullLocked = !isPremium;
  const advancedLocked = !isPremium;

  return (
    <Card style={styles.myStatsDashboard}>
      <View style={styles.dashboardHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h2, { fontSize: 42, letterSpacing: -1.4 }]}>My Stats</Text>
          <Text style={[styles.sub, { fontSize: 15, color: C.sub }]} numberOfLines={1}>
            Track your performance.
          </Text>
          <Text style={[styles.sub, { fontSize: 15, color: C.sub, marginTop: 2 }]} numberOfLines={1}>
            Find your edge.
          </Text>
        </View>
        <View style={styles.tradingScoreCard}>
          <Text style={[styles.scoreLabel, { color: C.purple }]}>Trading Score</Text>
          <Text style={styles.scoreBig}>{quality}</Text>
        </View>
      </View>

      {!isPremium && (
        <View style={styles.freeNotice}>
          <Text style={styles.freeNoticeTitle}>Free plan: 10 trading days</Text>
          <Text style={styles.freeNoticeText}>
            You can keep journaling, but full analytics unlock with Pro.
          </Text>
        </View>
      )}

      <View style={styles.dashboardMetricGrid}>
        <ScoreChip label="PROFIT FACTOR" value={s.pf ? s.pf.toFixed(2) : "—"} tone="purple" locked={advancedLocked} />
        <ScoreChip label="WIN RATE" value={`${s.wr.toFixed(0)}%`} tone="green" />
        <ScoreChip label="EXPECTANCY" value={moneyCompact(s.exp)} tone={s.exp >= 0 ? "green" : "red"} locked={advancedLocked} />
        <ScoreChip label="AVG WIN/LOSS" value={<SplitMoney win={s.avgWin} loss={s.avgLoss} />} tone="purple" />
        <ScoreChip label="TRADES" value={`${s.count}`} tone="purple" />
        <ScoreChip label="WIN / LOSS" value={<SplitCount wins={wins} losses={losses} />} tone="purple" />
        <ScoreChip label="CONSISTENCY" value={`${consistency.toFixed(0)}%`} tone="purple" locked={advancedLocked} />
        <ScoreChip label="SHARPE RATIO" value={s.sharpeRatio ? s.sharpeRatio.toFixed(2) : "—"} tone="purple" locked={advancedLocked} />
        <ScoreChip label="MAX LOSING DAY STREAK" value={`${s.maxLossDayStreak}`} tone="red" locked={advancedLocked} />
        <ScoreChip label="MAX WINNING DAY STREAK" value={`${s.maxWinDayStreak}`} tone="green" locked={advancedLocked} />
        <ScoreChip label="BIGGEST WIN" value={moneyCompact(biggestWin)} tone="green" locked={advancedLocked} />
        <ScoreChip label="BIGGEST LOSS" value={moneyCompact(biggestLoss)} tone="red" locked={advancedLocked} />
      </View>

      <View style={styles.chartCard}>
        <View style={styles.rowBetween}>
          <Text style={[styles.myStatsTitle, { fontSize: 22 }]}>Equity Curve</Text>
          <Text style={[styles.insightValue, { color: s.pnl >= 0 ? C.green : C.red, fontSize: 20 }]}>{moneyCompact(s.pnl)}</Text>
        </View>
        <EquityCurve data={cumulative} />
      </View>

      <View style={styles.performanceCard}>
        <Text style={[styles.profileTitle, { fontSize: 24 }]}>Performance Profile</Text>
        <Text style={styles.sub}>Live profile from your journal: win rate, profit factor, recovery, risk control and consistency.</Text>
        <RadarProfile
          winRate={s.wr}
          profitFactor={s.pf}
          avgWinLoss={s.avgWinLoss}
          recoveryFactor={recoveryFactor}
          drawdownControl={drawdownControl}
          consistency={consistency}
          locked={fullLocked}
        />
      </View>

      <View style={styles.insightGrid}>
        <View style={styles.insightCard}>
          <Text style={[styles.edgeMiniLabel, { color: C.sub }]}>Best day</Text>
          <Text style={styles.insightBig}>{bestDay ? fullWeekdayName(bestDay.label) : "—"}</Text>
        </View>
        <View style={styles.insightCard}>
          <Text style={[styles.edgeMiniLabel, { color: C.sub }]}>Worst day</Text>
          <Text style={[styles.insightBig, { color: C.red }]}>{worstDay ? fullWeekdayName(worstDay.label) : "—"}</Text>
        </View>
        <View style={styles.insightCard}>
          <Text style={[styles.edgeMiniLabel, { color: C.sub }]}>Best session</Text>
          <Text style={styles.insightBig}>{bestSession ? bestSession.label : "—"}</Text>
        </View>
      </View>

      {advancedLocked ? (
        <View style={styles.blurPreview}><Text style={styles.blurPreviewText}>Unlock Full Edge Analysis</Text></View>
      ) : (
        <PerformanceBreakdown
          title="Performance by day of week"
          data={s.weekday}
          maxItems={7}
          labelFormatter={fullWeekdayName}
        />
      )}

      {advancedLocked ? (
        <View style={styles.blurPreview}><Text style={styles.blurPreviewText}>Session edge is available in Pro</Text></View>
      ) : (
        <PerformanceBreakdown title="Performance by session" data={s.session} maxItems={3} />
      )}

      {advancedLocked ? (
        <View style={styles.blurPreview}><Text style={styles.blurPreviewText}>Symbol performance unlocks with Pro</Text></View>
      ) : (
        <PerformanceBreakdown title="Performance by symbol" data={s.bySetup} maxItems={5} />
      )}

      {!isPremium && (
        <PaywallPreview
          packages={packages}
          purchaseBusy={purchaseBusy}
          revenueCatConfigured={revenueCatConfigured}
          paywallError={paywallError}
          onPurchase={onPurchase}
          onRestore={onRestore}
        />
      )}
    </Card>
  );
}

function StatsScreen({
  trades,
  lang,
  isPremium,
  packages,
  purchaseBusy,
  revenueCatConfigured,
  paywallError,
  onPurchase,
  onRestore,
}: {
  trades: Trade[];
  lang: Lang;
  isPremium: boolean;
  packages: PurchasesPackage[];
  purchaseBusy: boolean;
  revenueCatConfigured: boolean;
  paywallError: string;
  onPurchase: (pkg?: PurchasesPackage | null) => void;
  onRestore: () => void;
}) {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [selectedDate] = useState(todayISO());
  const periodTrades = trades.filter((trade) => periodFilter(trade, selectedDate, period));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: 46 }]}>
      <View style={styles.journalHeader}>
        <Text style={styles.h1NoMargin}>Stats</Text>
      </View>
      <View style={styles.segment}>
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
      <Stats
        trades={periodTrades}
        lang={lang}
        isPremium={isPremium}
        packages={packages}
        purchaseBusy={purchaseBusy}
        revenueCatConfigured={revenueCatConfigured}
        paywallError={paywallError}
        onPurchase={onPurchase}
        onRestore={onRestore}
      />
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
  setTrades,
  isPremium,
  onUpgrade,
  onTradeDeleted,
}: {
  lang: Lang;
  trades: Trade[];
  setTrades: React.Dispatch<React.SetStateAction<Trade[]>>;
  isPremium: boolean;
  onUpgrade: () => void;
  onTradeDeleted: (tradeId: string) => void;
}) {
  const t = (k: string) => tText(lang, k);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [audioReady, setAudioReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [viewMonth, setViewMonth] = useState(new Date());
  const [modal, setModal] = useState(false);
  const [photoView, setPhotoView] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [pnlSide, setPnlSide] = useState<"plus" | "minus">("plus");
  const emptyForm = {
    symbol: "MES",
    direction: "LONG" as Direction,
    entry: "",
    exit: "",
    contracts: "1",
    stopLoss: "",
    takeProfit: "",
    pnl: "",
    mood: "Focused",
    notes: "",
    photoUri: "",
    voiceUri: "",
    voiceName: "",
  };
  const [form, setForm] = useState(emptyForm);
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
  const uniqueTradingDays = useMemo(() => [...new Set(trades.map((trade) => trade.date))], [trades]);
  const canAddTradeOnDate = useCallback((date: string) => {
    return isPremium || uniqueTradingDays.includes(date) || uniqueTradingDays.length < FREE_JOURNAL_DAYS;
  }, [isPremium, uniqueTradingDays]);
  const showJournalLimit = useCallback(() => {
    Alert.alert(
      "YouTrader Pro",
      `Free plan includes ${FREE_JOURNAL_DAYS} trading days. Upgrade to unlock unlimited journal, cloud sync and full analytics.`,
      [
        { text: t("close"), style: "cancel" },
        { text: "Upgrade", onPress: onUpgrade },
      ],
    );
  }, [onUpgrade, t]);
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
    if (!canAddTradeOnDate(date)) {
      showJournalLimit();
      return;
    }
    setSelectedDate(date);
    setEditId(null);
    setPnlSide("plus");
    setForm(emptyForm);
    setModal(true);
  };
  const openEdit = (tr: Trade) => {
    setEditId(tr.id);
    setPnlSide(tr.pnl < 0 ? "minus" : "plus");
    setForm({
      symbol: tr.symbol,
      direction: tr.direction,
      entry: tr.entry != null ? String(tr.entry) : "",
      exit: tr.exit != null ? String(tr.exit) : "",
      contracts: String(tr.contracts || 1),
      stopLoss: tr.stopLoss != null ? String(tr.stopLoss) : "",
      takeProfit: tr.takeProfit != null ? String(tr.takeProfit) : "",
      pnl: String(Math.abs(tr.pnl)),
      mood: tr.mood,
      notes: tr.notes || "",
      photoUri: tr.photoUri || "",
      voiceUri: tr.voiceUri || "",
      voiceName: tr.voiceName || "",
    });
    setModal(true);
  };
  const calcPnl = () => {
    if (form.pnl.trim()) {
      const amount = Math.abs(toNum(form.pnl));
      return Number((pnlSide === "minus" ? -amount : amount).toFixed(2));
    }
    const i = INSTRUMENTS[form.symbol];
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
  const save = () => {
    if (!editId && !canAddTradeOnDate(selectedDate)) {
      showJournalLimit();
      return;
    }
    const pnl = calcPnl();
    if (!form.pnl.trim() && (!form.entry || !form.exit))
      return Alert.alert(t("addPnl"));
    const now = Date.now();
    const previousTrade = editId ? trades.find((x) => x.id === editId) : null;
    const item: Trade = {
      id: editId || uid(),
      date: selectedDate,
      symbol: form.symbol.trim().toUpperCase() || "MES",
      direction: form.direction,
      entry: form.entry ? toNum(form.entry) : null,
      exit: form.exit ? toNum(form.exit) : null,
      contracts: Math.max(1, Number(form.contracts || 1)),
      stopLoss: form.stopLoss ? toNum(form.stopLoss) : null,
      takeProfit: form.takeProfit ? toNum(form.takeProfit) : null,
      pnl,
      mood: form.mood,
      notes: form.notes,
      photoUri: form.photoUri || null,
      voiceUri: form.voiceUri || null,
      voiceName: form.voiceName || null,
      createdAt: editId ? (previousTrade?.createdAt || now) : now,
      updatedAt: now,
    };
    setTrades((prev) =>
      editId ? prev.map((x) => (x.id === editId ? item : x)) : [item, ...prev],
    );
    setModal(false);
  };
  const remove = () => {
    if (!editId) return;
    Alert.alert(t("deleteQuestion"), t("cannotUndo"), [
      { text: t("close"), style: "cancel" },
      {
        text: t("deleteTrade"),
        style: "destructive",
        onPress: () => {
          onTradeDeleted(editId);
          setTrades((prev) => prev.filter((x) => x.id !== editId));
          setModal(false);
        },
      },
    ]);
  };
  const pnlPreview = calcPnl();
  const pickImage = async (camera: boolean) => {
    try {
      if (camera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) return Alert.alert("Camera permission needed");
        const r = await ImagePicker.launchCameraAsync({
          quality: 0.75,
          allowsEditing: false,
        });
        if (!r.canceled) setForm({ ...form, photoUri: r.assets[0].uri });
      } else {
        const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!p.granted) return Alert.alert("Photo permission needed");
        const r = await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          allowsEditing: false,
        });
        if (!r.canceled) setForm({ ...form, photoUri: r.assets[0].uri });
      }
    } catch {
      Alert.alert("Photo upload failed");
    }
  };
  const pickAudio = async () => {
    try {
      if (recorderState.isRecording) {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        if (!uri) return Alert.alert("Recording failed");
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
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { flexGrow: 1, justifyContent: "flex-end", paddingBottom: 46 }]}>
      <View style={styles.journalHeader}>
        <Text style={styles.h1NoMargin}>{t("myJournal")}</Text>
      </View>
      <Pressable
        onPress={() => openNew(selectedDate)}
        style={[styles.primaryBig, { marginTop: 0, marginBottom: 14 }]}
      >
        <Text style={styles.primaryText}>{t("addTrade")}</Text>
      </Pressable>
      {!isPremium && (
        <View style={[styles.freeNotice, { marginBottom: 12 }]}>
          <Text style={styles.freeNoticeTitle}>
            Free journal: {Math.min(uniqueTradingDays.length, FREE_JOURNAL_DAYS)}/{FREE_JOURNAL_DAYS} trading days
          </Text>
          <Text style={styles.freeNoticeText}>
            Calculator, calendar and basic news are free. Pro unlocks unlimited journal, cloud sync and full analytics.
          </Text>
        </View>
      )}
      <Card style={styles.calendarCard}>
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <Text style={styles.h2}>
            {safeDateFromISO(selectedDate).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </Text>
          <Text style={styles.sub}>
            Tap day to add trade
          </Text>
        </View>
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
          <Text style={styles.monthTitleText} numberOfLines={1} adjustsFontSizeToFit>
            {monthTitle(viewMonth)}
          </Text>
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
        <View style={styles.weekdayHeader}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <Text key={d} style={styles.weekdayHeaderText}>{d}</Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {monthRows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.calendarRow}>
              {row.map((d, cellIndex) => {
                if (!d) return <View key={`empty-${rowIndex}-${cellIndex}`} style={styles.daySpacer} />;
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
                    style={[styles.day, dayTrades.length > 0 && (pnl >= 0 ? styles.dayProfit : styles.dayLoss), active && styles.dayActive]}
                  >
                    <Text style={[styles.dayNum, active && { color: C.white }]}>
                      {Number(d.slice(8, 10))}
                    </Text>
                    {dayTrades.length > 0 && (
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "900",
                          color: active ? C.white : pnl >= 0 ? C.green : C.red,
                        }}
                      >
                        {dayMoney(pnl)}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </Card>
      <PropFirmRiskCoach trades={trades} selectedDate={selectedDate} />
      <Text style={[styles.tradesTodayTitle]}>
        TRADES TODAY • {eventDateLabel(selectedDate)}
      </Text>
      {filtered.map((tr) => (
        <Pressable key={tr.id} onPress={() => openEdit(tr)}>
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.newsTitle}>{tr.symbol}</Text>
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
                  setForm({ ...form, symbol: v.toUpperCase() })
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
              <View style={{ height: 12 }} />
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
                onChangeText={(v: string) => setForm({ ...form, notes: v })}
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

function NewsScreen({ lang, isPremium }: { lang: Lang; isPremium: boolean }) {
  const t = (k: string) => tText(lang, k);
  const [items, setItems] = useState<MarketNews[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    const n = await loadNews();
    setItems(n);
    setLoading(false);
  };
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.h1}>{t("liveNews")}</Text>
            <Text style={styles.sub}>{t("autoRefresh")}</Text>
          </View>
          <Pressable onPress={refresh} style={styles.refresh}>
            <Text style={styles.refreshText}>{t("refresh")}</Text>
          </Pressable>
        </View>
      </View>
      {loading && !items.length ? (
        <ActivityIndicator
          color={C.green}
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => (item.url ? Linking.openURL(item.url) : undefined)}
            >
              <Card style={styles.purpleNewsCard}>
                <View style={styles.rowBetween}>
                  <Pill
                    text={item.impact}
                    tone={
                      item.impact === "HIGH"
                        ? "high"
                        : item.impact === "MED"
                          ? "med"
                          : "low"
                    }
                  />
                  <Text style={styles.sub}>
                    {item.source} • {item.time}
                  </Text>
                </View>
                <Text style={styles.newsTitle}>{item.title}</Text>
                {!!item.summary && (
                  <Text style={styles.newsSummary}>
                    {item.summary.slice(0, 240)}
                  </Text>
                )}
                {isPremium ? (
                  <View style={styles.assetGrid}>
                    {ASSETS.map((a) => (
                      <View key={a} style={styles.assetCell}>
                        <Text style={styles.asset}>{a}</Text>
                        <Text
                          style={{
                            color:
                              item.bias[a] === "LONG"
                                ? C.green
                                : item.bias[a] === "SHORT"
                                  ? C.red
                                  : C.sub,
                            fontWeight: "900",
                            fontSize: 11,
                          }}
                        >
                          {item.bias[a] === "LONG" ? "LONG ↑" : item.bias[a] === "SHORT" ? "SHORT ↓" : "NEUTRAL -"}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.lockedNewsIntel}>
                    <Text style={styles.lockedNewsTitle}>Advanced sentiment is Pro</Text>
                    <Text style={styles.lockedNewsText}>Basic headlines stay free. Upgrade for ES/NQ/GOLD/OIL/BTC directional bias.</Text>
                  </View>
                )}
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
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
function CalendarScreen({ lang }: { lang: Lang }) {
  const t = (k: string) => tText(lang, k);
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
  const week = Array.from({ length: 7 }, (_, i) =>
    isoFromDate(addDays(new Date(), i)),
  );
  const shown = events.filter((e) => e.date === selected);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.h1}>{t("economicCalendar")}</Text>
          <Text style={styles.sub}>{t("calendarSub")}</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 12 }}
      >
        {week.map((d) => (
          <Pressable
            key={d}
            onPress={() => setSelected(d)}
            style={[styles.weekChip, selected === d && styles.weekChipActive]}
          >
            <Text
              style={[styles.weekChipDay, selected === d && { color: C.bg }]}
            >
              {safeDateFromISO(d).toLocaleDateString([], {
                weekday: "short",
              })}
            </Text>
            <Text
              style={[styles.weekChipDate, selected === d && { color: C.bg }]}
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
          style={{ marginTop: 50 }}
        />
      ) : (
        (shown.length
          ? shown
          : events.filter((e) => e.date === todayISO())
        ).map((e) => (
          <Card key={e.id} style={styles.purpleNewsCard}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bigTime}>{e.time}</Text>
                <Text style={styles.dateText}>
                  {eventDateLabel(e.date)} • ET
                </Text>
                <Text style={styles.newsTitle}>{e.name}</Text>
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
            <View style={styles.row}>
              <SmallMetric l={t("act")} v={e.actual} />
              <SmallMetric l={t("fcst")} v={e.forecast} />
              <SmallMetric l={t("prev")} v={e.previous} />
            </View>
            <View style={styles.assetGrid}>
              {ASSETS.map((a) => (
                <View key={a} style={styles.assetCell}>
                  <Text style={styles.asset}>{a}</Text>
                  <Text
                    style={{
                      color:
                        e.bias[a] === "LONG"
                          ? C.green
                          : e.bias[a] === "SHORT"
                            ? C.red
                            : C.sub,
                      fontWeight: "900",
                      fontSize: 11,
                    }}
                  >
                    {e.bias[a] === "LONG" ? "LONG ↑" : e.bias[a] === "SHORT" ? "SHORT ↓" : "NEUTRAL -"}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ))
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
      <Text style={styles.h1}>{t("calc")}</Text>
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
        <Text style={styles.h2}>{t("rrCalculator")}</Text>
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
        <Text style={styles.h2}>{t("percentRiskCalculator")}</Text>
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
  purchaseBusy,
  revenueCatConfigured,
  paywallError,
  onPurchase,
  onRestore,
}: {
  lang: Lang;
  onClose: () => void;
  packages: PurchasesPackage[];
  purchaseBusy: boolean;
  revenueCatConfigured: boolean;
  paywallError: string;
  onPurchase: (pkg?: PurchasesPackage | null) => void;
  onRestore: () => void;
}) {
  const t = (k: string) => tText(lang, k);
  const monthly = packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null;
  const yearly = packages.find((pkg) => packageTitle(pkg) === "YEARLY") || packages[1] || null;
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
            disabled={purchaseBusy || !revenueCatConfigured}
            onPress={() => onPurchase(monthly)}
            style={[styles.monthlyPlan, (!revenueCatConfigured || purchaseBusy) && styles.disabledBtn]}
          >
            <Text style={styles.planName}>MONTHLY</Text>
            <Text style={styles.planPrice}>{packagePrice(monthly)}</Text>
          </Pressable>
          <Pressable
            disabled={purchaseBusy || !revenueCatConfigured}
            onPress={() => onPurchase(yearly || monthly)}
            style={[styles.yearlyPlan, (!revenueCatConfigured || purchaseBusy) && styles.disabledBtn]}
          >
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <Text style={styles.planName}>YEARLY</Text>
            <Text style={styles.planPrice}>{yearly ? packagePrice(yearly) : "$79.99/year"}</Text>
          </Pressable>
        </View>
        <Pressable
          disabled={purchaseBusy || !revenueCatConfigured}
          onPress={() => onPurchase(monthly)}
          style={[styles.primaryBig, (!revenueCatConfigured || purchaseBusy) && styles.disabledBtn]}
        >
          <Text style={styles.primaryText}>
            {purchaseBusy ? "Connecting..." : `Start Pro • ${packagePrice(monthly)}`}
          </Text>
        </Pressable>
        <Pressable
          disabled={purchaseBusy || !revenueCatConfigured}
          onPress={onRestore}
          style={[styles.secondaryBig, (!revenueCatConfigured || purchaseBusy) && styles.disabledBtn]}
        >
          <Text style={styles.secondaryText}>{t("restore")}</Text>
        </Pressable>
        {!revenueCatConfigured ? (
          <Text style={[styles.sub, { marginTop: 10 }]}>
            Add EXPO_PUBLIC_REVENUECAT_IOS_API_KEY and configure the pro entitlement in RevenueCat.
          </Text>
        ) : paywallError ? (
          <Text style={[styles.sub, { color: C.red, marginTop: 10 }]}>{paywallError}</Text>
        ) : null}
      </Card>
    </ScrollView>
  );
}



function AccountPanel({
  session,
  authBusy,
  authConfigured,
  faceLockEnabled,
  onOAuth,
  onSignOut,
  onEnableFaceId,
  onDisableFaceId,
}: {
  session: Session | null;
  authBusy: boolean;
  authConfigured: boolean;
  faceLockEnabled: boolean;
  onOAuth: (provider: AuthProvider) => void;
  onSignOut: () => void;
  onEnableFaceId: () => void;
  onDisableFaceId: () => void;
}) {
  const userLabel = session?.user.email || session?.user.user_metadata?.email || session?.user.id;

  return (
    <Card>
      <Text style={styles.h2}>Account</Text>
      <Text style={styles.sub}>{userLabel ? `Signed in as ${userLabel}` : "Sign in quickly and keep your journal connected."}</Text>
      {userLabel ? (
        <Pressable onPress={onSignOut} style={[styles.secondaryBig, { marginTop: 14 }]}>
          <Text style={styles.secondaryText}>Sign out</Text>
        </Pressable>
      ) : (
        <View style={styles.authButtonStack}>
          <Pressable
            disabled={authBusy}
            onPress={() => onOAuth("google")}
            style={[styles.authProviderBtn, authBusy && styles.disabledBtn]}
          >
            <Text style={styles.authProviderIcon}>G</Text>
            <Text style={styles.authProviderText}>{authBusy ? "Connecting..." : "Continue with Google"}</Text>
          </Pressable>
          <Pressable
            disabled={authBusy}
            onPress={() => onOAuth("apple")}
            style={[styles.authProviderBtn, styles.authAppleBtn, authBusy && styles.disabledBtn]}
          >
            <Text style={[styles.authProviderIcon, { color: C.white }]}></Text>
            <Text style={[styles.authProviderText, { color: C.white }]}>Continue with Apple</Text>
          </Pressable>
          {!authConfigured && (
            <Text style={[styles.sub, { marginTop: 2 }]}>Account sign-in needs Supabase URL and publishable key in the release build.</Text>
          )}
        </View>
      )}
      <Pressable
        onPress={faceLockEnabled ? onDisableFaceId : onEnableFaceId}
        style={[styles.secondaryBig, styles.faceIdButton]}
      >
        <Text style={styles.secondaryText}>{faceLockEnabled ? "Face ID quick unlock: On" : "Enable Face ID quick unlock"}</Text>
      </Pressable>
    </Card>
  );
}

function BiometricLockScreen({ onUnlock }: { onUnlock: () => void }) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.app}>
        <StatusBar style="light" backgroundColor="#000000" />
        <View style={styles.lockScreen}>
          <Card style={styles.lockCard}>
            <Text style={styles.h1}>YouTrader</Text>
            <Text style={styles.sub}>Unlock your journal.</Text>
            <Pressable onPress={onUnlock} style={styles.primaryBig}>
              <Text style={styles.primaryText}>Unlock with Face ID</Text>
            </Pressable>
          </Card>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
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
  purchaseBusy,
  revenueCatConfigured,
  paywallError,
  cloudSyncEnabled,
  cloudSyncStatus,
  cloudSyncMessage,
  lastCloudSyncAt,
  faceLockEnabled,
  onOAuth,
  onSignOut,
  onPurchase,
  onRestore,
  onSyncNow,
  onEnableFaceId,
  onDisableFaceId,
}: {
  lang: Lang;
  setLang: (x: Lang) => void;
  session: Session | null;
  authBusy: boolean;
  authConfigured: boolean;
  isPremium: boolean;
  packages: PurchasesPackage[];
  purchaseBusy: boolean;
  revenueCatConfigured: boolean;
  paywallError: string;
  cloudSyncEnabled: boolean;
  cloudSyncStatus: "off" | "syncing" | "synced" | "error";
  cloudSyncMessage: string;
  lastCloudSyncAt: string | null;
  faceLockEnabled: boolean;
  onOAuth: (provider: AuthProvider) => void;
  onSignOut: () => void;
  onPurchase: (pkg?: PurchasesPackage | null) => void;
  onRestore: () => void;
  onSyncNow: () => void;
  onEnableFaceId: () => void;
  onDisableFaceId: () => void;
}) {
  const t = (k: string) => tText(lang, k);
  const choose = (l: Lang) => {
    setLang(l);
    AsyncStorage.setItem("lang-v1", l);
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

Account Data: When you register or authenticate via third-party providers, including Google Authentication, we collect your name, email address, and profile picture.

User-Generated Data: We securely store the trading logs, dates, times, contract types, execution prices, screenshots, and custom tags that you manually input or import via file uploads (CSV/Excel).

Usage & Device Data: We may automatically collect anonymized technical data, including device model, operating system, app version, and crash logs to monitor and optimize application performance.

Note: YouTrader does not collect, request, or store your live brokerage passwords, API secret keys, or live execution credentials.

2. Data Use, Security, and Protection
Your trading data is encrypted and used strictly to generate your personal statistics, charts, and performance analytics. We value your privacy: we do not sell, rent, trade, or share your personal identity or specific trading data with third-party advertisers, hedge funds, or institutional entities.

3. Data Ownership and Deletion Rights (GDPR & CCPA Compliance)
You retain full ownership of your data. In compliance with data privacy regulations, including GDPR and CCPA, you have the right to access, export, or permanently delete your account and all associated trading logs at any time. This action can be executed directly via the Application Settings. Once initiated, all account records are physically and permanently purged from our active databases.

4. Children's Privacy (COPPA)
YouTrader does not knowingly collect data from or market to individuals under the age of 18. If you are under 18, you are not authorized to use this application.`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { flexGrow: 1, justifyContent: "space-between", paddingBottom: 36 }]}>
      <View>
        <Text style={styles.h1}>{t("settings")}</Text>

        <AccountPanel
          session={session}
          authBusy={authBusy}
          authConfigured={authConfigured}
          faceLockEnabled={faceLockEnabled}
          onOAuth={onOAuth}
          onSignOut={onSignOut}
          onEnableFaceId={onEnableFaceId}
          onDisableFaceId={onDisableFaceId}
        />

        <Card>
          <Text style={styles.h2}>Subscription</Text>
          <Text style={styles.sub}>
            {isPremium
              ? "YouTrader Pro is active."
              : revenueCatConfigured
                ? "Unlock full analytics, market context and Pro tools."
                : "RevenueCat is ready in code. Add the public API key before TestFlight."}
          </Text>
          <View style={styles.row}>
            <Pressable
              disabled={isPremium || purchaseBusy || !revenueCatConfigured}
              onPress={() => onPurchase(packages[0] || null)}
              style={[styles.secondaryPhoto, styles.purpleAction, (isPremium || purchaseBusy || !revenueCatConfigured) && styles.disabledBtn]}
            >
              <Text style={styles.secondaryText}>{isPremium ? "Pro Active" : "Upgrade"}</Text>
            </Pressable>
            <Pressable
              disabled={purchaseBusy || !revenueCatConfigured}
              onPress={onRestore}
              style={[styles.secondaryPhoto, styles.purpleAction, (purchaseBusy || !revenueCatConfigured) && styles.disabledBtn]}
            >
              <Text style={styles.secondaryText}>Restore</Text>
            </Pressable>
          </View>
          {!!paywallError && <Text style={[styles.sub, { color: C.red, marginTop: 8 }]}>{paywallError}</Text>}
        </Card>

        <Card>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.h2}>Cloud Sync</Text>
              <Text style={styles.sub}>{cloudSyncMessage}</Text>
              {lastCloudSyncAt ? (
                <Text style={[styles.sub, { marginTop: 4 }]}>
                  Last sync: {new Date(lastCloudSyncAt).toLocaleString()}
                </Text>
              ) : null}
            </View>
            <View
              style={[
                styles.syncStatusDot,
                cloudSyncStatus === "synced" && { backgroundColor: C.green },
                cloudSyncStatus === "syncing" && { backgroundColor: C.yellow },
                cloudSyncStatus === "error" && { backgroundColor: C.red },
              ]}
            />
          </View>
          <Pressable
            disabled={!cloudSyncEnabled || cloudSyncStatus === "syncing"}
            onPress={onSyncNow}
            style={[styles.secondaryBig, styles.restorePurchaseBtn, (!cloudSyncEnabled || cloudSyncStatus === "syncing") && styles.disabledBtn]}
          >
            <Text style={styles.secondaryText}>
              {cloudSyncStatus === "syncing" ? "Syncing..." : "Sync Now"}
            </Text>
          </Pressable>
        </Card>

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
          <Text style={styles.h2}>Support</Text>
          <Text style={styles.sub}>
            Contact us or report bugs and app issues.
          </Text>
          <Pressable
            onPress={() => Linking.openURL("mailto:youtrader.support@gmail.com?subject=YouTrader Support")}
            style={[styles.secondaryBig, { marginTop: 14 }]}
          >
            <Text style={styles.secondaryText}>youtrader.support@gmail.com</Text>
          </Pressable>
        </Card>

        <Card>
          <Text style={styles.h2}>Legal</Text>
          <Pressable onPress={() => Alert.alert("Terms, Risk Disclosure & Privacy", legalInfo)} style={styles.legalRow}>
            <Text style={styles.legalText}>Terms, Risk Disclosure & Privacy</Text>
            <Text style={styles.legalArrow}>›</Text>
          </Pressable>
        </Card>
      </View>

      <View>
        <Text style={styles.versionText}>v1.3.1</Text>
        <Text style={styles.madeByText}>Made by a trader, for traders</Text>
      </View>
    </ScrollView>
  );
}

function TabGlyph({ id, active }: { id: Tab; active: boolean }) {
  const color = C.green;
  const border = active ? color : `${color}99`;
  const bg = active ? C.greenSoft : "transparent";
  if (id === "journal")
    return (
      <View style={[styles.iconTile, { borderColor: border, backgroundColor: bg }]}> 
        <View style={[styles.noteTop, { borderColor: color }]} />
        <View style={[styles.noteLine, { backgroundColor: color, width: 17 }]} />
        <View style={[styles.noteLine, { backgroundColor: color, width: 13 }]} />
        <View style={[styles.notePen, { backgroundColor: color }]} />
      </View>
    );
  if (id === "stats")
    return (
      <View style={[styles.iconTile, { borderColor: border, backgroundColor: bg }]}>
        <View style={styles.statsGlyphBars}>
          <View style={[styles.statsGlyphBar, { height: 10, backgroundColor: color }]} />
          <View style={[styles.statsGlyphBar, { height: 18, backgroundColor: color }]} />
          <View style={[styles.statsGlyphBar, { height: 24, backgroundColor: color }]} />
        </View>
      </View>
    );
  if (id === "calc")
    return (
      <View style={[styles.iconTile, { borderColor: border, backgroundColor: bg }]}> 
        <Text style={[styles.calcGlyphText, { color }]}>+−</Text>
        <Text style={[styles.calcGlyphText, { color }]}>×÷</Text>
      </View>
    );
  if (id === "calendar")
    return (
      <View style={[styles.iconTile, { borderColor: border, backgroundColor: bg }]}> 
        <View style={[styles.calendarTopBar, { backgroundColor: color }]} />
        <View style={styles.calendarMiniGrid}>
          {[0,1,2,3,4,5].map((n) => <View key={n} style={[styles.calendarDotMini, { backgroundColor: color }]} />)}
        </View>
      </View>
    );
  if (id === "news")
    return (
      <View style={[styles.iconTile, { borderColor: border, backgroundColor: bg }]}>
        <Text style={[styles.newsBolt, { color }]}>ϟ</Text>
      </View>
    );
  return (
    <View style={[styles.iconTile, { borderColor: border, backgroundColor: bg }]}> 
      {[0,45,90,135,180,225,270,315].map((r) => (
        <View key={r} style={[styles.gearTooth, { backgroundColor: color, transform: [{ rotate: `${r}deg` }, { translateX: 11 }] }]} />
      ))}
      <View style={[styles.gearRing, { borderColor: color }]} />
      <View style={[styles.gearCenter, { borderColor: color }]} />
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("journal");
  const [lang, setLang] = useState<Lang>("en");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesHydrated, setTradesHydrated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [revenueCatReady, setRevenueCatReady] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [paywallError, setPaywallError] = useState("");
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"off" | "syncing" | "synced" | "error">("off");
  const [cloudSyncMessage, setCloudSyncMessage] = useState("Sign in and upgrade to Pro to sync your journal.");
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [faceLockEnabled, setFaceLockEnabled] = useState(false);
  const [biometricUnlocked, setBiometricUnlocked] = useState(true);
  const [biometricChecking, setBiometricChecking] = useState(true);
  const purchasesConfigured = useRef(false);
  const cloudSyncInFlight = useRef(false);

  const authConfigured = !!supabase;
  const revenueCatConfigured = !!REVENUECAT_API_KEY && Platform.OS !== "web";
  const isPremium = OWNER_FULL_ACCESS || customerHasPro(customerInfo);
  const cloudSyncEnabled = !!supabase && !!session?.user.id && isPremium;
  const currentTradeSignature = useMemo(() => tradesSignature(trades), [trades]);
  const promptBiometricUnlock = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        Alert.alert("Face ID", "Face ID is not set up on this device.");
        setBiometricUnlocked(true);
        return false;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock YouTrader",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      setBiometricUnlocked(result.success);
      return result.success;
    } catch {
      setBiometricUnlocked(true);
      return false;
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("lang-v1").then((v) => {
      if (v && ["en", "ru", "es", "fr", "it", "uk", "de"].includes(v))
        setLang(v as Lang);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(TRADES_STORAGE_KEY)
      .then((value) => {
        if (value) setTrades(normalizeTrades(JSON.parse(value)));
      })
      .finally(() => setTradesHydrated(true));
  }, []);

  useEffect(() => {
    if (!tradesHydrated) return;
    AsyncStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(normalizeTrades(trades)));
  }, [trades, tradesHydrated]);

  const refreshRevenueCat = useCallback(async () => {
    if (!purchasesConfigured.current) return;
    try {
      const [nextCustomerInfo, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      setCustomerInfo(nextCustomerInfo);
      setPackages(offerings.current?.availablePackages || []);
      setPaywallError("");
    } catch (error: any) {
      setPaywallError(error?.message || "RevenueCat connection failed.");
    }
  }, []);

  useEffect(() => {
    if (!revenueCatConfigured || purchasesConfigured.current) return;
    try {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.WARN);
      Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      purchasesConfigured.current = true;
      setRevenueCatReady(true);
      refreshRevenueCat();
      const listener = (info: CustomerInfo) => setCustomerInfo(info);
      Purchases.addCustomerInfoUpdateListener(listener);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(listener);
      };
    } catch (error: any) {
      setPaywallError(error?.message || "RevenueCat setup failed.");
    }
  }, [refreshRevenueCat, revenueCatConfigured]);

  useEffect(() => {
    if (!purchasesConfigured.current || !session?.user.id) return;
    Purchases.logIn(session.user.id)
      .then(({ customerInfo: nextCustomerInfo }) => setCustomerInfo(nextCustomerInfo))
      .then(refreshRevenueCat)
      .catch(() => {});
  }, [refreshRevenueCat, session?.user.id]);

  useEffect(() => {
    AsyncStorage.getItem("face-lock-v1").then(async (value) => {
      const enabled = value === "on";
      setFaceLockEnabled(enabled);
      if (enabled) {
        setBiometricUnlocked(false);
        setBiometricChecking(false);
        await promptBiometricUnlock();
      } else {
        setBiometricUnlocked(true);
        setBiometricChecking(false);
      }
    });
  }, [promptBiometricUnlock]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

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
      createSessionFromAuthUrl(url).catch((error) =>
        Alert.alert("Sign in failed", error?.message || "Please try again."),
      );
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
            ? "Cloud Sync is included in YouTrader Pro."
            : "Cloud Sync is waiting for the journal to load.",
      );
      return;
    }
    if (cloudSyncInFlight.current) return;
    cloudSyncInFlight.current = true;
    setCloudSyncStatus("syncing");
    setCloudSyncMessage("Syncing journal with cloud...");
    try {
      const { data, error } = await supabase
        .from("trade_journal")
        .select("*")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false });
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
        const rows = merged.map((trade) => tradeToCloudRow(trade, session.user.id));
        const { error: upsertError } = await supabase
          .from("trade_journal")
          .upsert(rows, { onConflict: "user_id,client_id" });
        if (upsertError) throw upsertError;
      }

      const syncedAt = new Date().toISOString();
      setLastCloudSyncAt(syncedAt);
      setCloudSyncStatus("synced");
      setCloudSyncMessage(`Synced ${merged.length} trades across devices.`);
    } catch (error: any) {
      setCloudSyncStatus("error");
      setCloudSyncMessage(error?.message || "Cloud Sync failed. Check Supabase setup.");
    } finally {
      cloudSyncInFlight.current = false;
    }
  }, [currentTradeSignature, isPremium, session?.user.id, trades, tradesHydrated]);

  const markCloudTradeDeleted = useCallback(async (tradeId: string) => {
    if (!supabase || !session?.user.id || !isPremium) return;
    try {
      const now = new Date().toISOString();
      await supabase
        .from("trade_journal")
        .update({ deleted_at: now, updated_at: now })
        .eq("user_id", session.user.id)
        .eq("client_id", tradeId);
    } catch {}
  }, [isPremium, session?.user.id]);

  useEffect(() => {
    if (!cloudSyncEnabled || !tradesHydrated) {
      setCloudSyncStatus("off");
      setCloudSyncMessage(
        !session?.user.id
          ? "Sign in to sync your journal across devices."
          : !isPremium
            ? "Cloud Sync is included in YouTrader Pro."
            : "Cloud Sync is waiting for the journal to load.",
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

  const signInWithProvider = useCallback(async (provider: AuthProvider) => {
    if (!supabase) {
      Alert.alert(
        "Account sign-in",
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY before the App Store build.",
      );
      return;
    }

    setAuthBusy(true);
    try {
      if (
        ENABLE_NATIVE_APPLE_SIGN_IN &&
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
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });
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
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: AUTH_REDIRECT_TO,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      const result = await WebBrowser.openAuthSessionAsync(data.url || "", AUTH_REDIRECT_TO);
      if (result.type === "success") await createSessionFromAuthUrl(result.url);
    } catch (error: any) {
      if (error?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Sign in failed", error?.message || "Please try again.");
      }
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Sign out failed", error.message);
  }, []);

  const purchasePackage = useCallback(async (pkg?: PurchasesPackage | null) => {
    if (!revenueCatConfigured || !purchasesConfigured.current) {
      Alert.alert(
        "YouTrader Pro",
        "RevenueCat is ready in code. Add the public RevenueCat API key before testing subscriptions.",
      );
      return;
    }

    const selectedPackage = pkg || packages[0] || null;
    if (!selectedPackage) {
      Alert.alert(
        "YouTrader Pro",
        "No subscription packages found. Create an offering in RevenueCat and attach monthly/yearly products to the pro entitlement.",
      );
      return;
    }

    setPurchaseBusy(true);
    try {
      const result = await Purchases.purchasePackage(selectedPackage);
      setCustomerInfo(result.customerInfo);
      setPaywallError("");
      if (customerHasPro(result.customerInfo)) {
        Alert.alert("YouTrader Pro", "Pro access unlocked.");
      } else {
        Alert.alert(
          "Purchase complete",
          "The purchase finished, but the pro entitlement is not active yet. Check the RevenueCat entitlement setup.",
        );
      }
    } catch (error: any) {
      if (!error?.userCancelled) {
        const message = error?.message || "Purchase failed. Please try again.";
        setPaywallError(message);
        Alert.alert("Purchase failed", message);
      }
    } finally {
      setPurchaseBusy(false);
    }
  }, [packages, revenueCatConfigured]);

  const restorePurchases = useCallback(async () => {
    if (!revenueCatConfigured || !purchasesConfigured.current) {
      Alert.alert(
        "Restore Purchases",
        "RevenueCat is ready in code. Add the public RevenueCat API key before testing restore.",
      );
      return;
    }

    setPurchaseBusy(true);
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      setPaywallError("");
      if (customerHasPro(info)) {
        Alert.alert("Restored", "YouTrader Pro is active.");
      } else {
        Alert.alert("No active subscription", "No active YouTrader Pro subscription was found for this store account.");
      }
    } catch (error: any) {
      const message = error?.message || "Restore failed. Please try again.";
      setPaywallError(message);
      Alert.alert("Restore failed", message);
    } finally {
      setPurchaseBusy(false);
    }
  }, [revenueCatConfigured]);

  const enableFaceId = useCallback(async () => {
    const ok = await promptBiometricUnlock();
    if (!ok) return;
    await AsyncStorage.setItem("face-lock-v1", "on");
    setFaceLockEnabled(true);
    setBiometricUnlocked(true);
  }, [promptBiometricUnlock]);

  const disableFaceId = useCallback(async () => {
    await AsyncStorage.removeItem("face-lock-v1");
    setFaceLockEnabled(false);
    setBiometricUnlocked(true);
  }, []);

  if (biometricChecking) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.app}>
          <StatusBar style="light" backgroundColor="#000000" />
          <View style={styles.lockScreen}>
            <ActivityIndicator color={C.green} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (faceLockEnabled && !biometricUnlocked) {
    return <BiometricLockScreen onUnlock={promptBiometricUnlock} />;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "journal", label: tText(lang, "journal") },
    { id: "stats", label: tText(lang, "stats") },
    { id: "calc", label: tText(lang, "calc") },
    { id: "calendar", label: tText(lang, "calendar") },
    { id: "news", label: tText(lang, "news") },
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
              purchaseBusy={purchaseBusy}
              revenueCatConfigured={revenueCatConfigured}
              paywallError={paywallError}
              onPurchase={purchasePackage}
              onRestore={restorePurchases}
            />
          ) : tab === "journal" ? (
            <JournalScreen
              lang={lang}
              trades={trades}
              setTrades={setTrades}
              isPremium={isPremium}
              onUpgrade={() => setTab("stats")}
              onTradeDeleted={markCloudTradeDeleted}
            />
          ) : tab === "stats" ? (
            <StatsScreen
              lang={lang}
              trades={trades}
              isPremium={isPremium}
              packages={packages}
              purchaseBusy={purchaseBusy}
              revenueCatConfigured={revenueCatConfigured}
              paywallError={paywallError}
              onPurchase={purchasePackage}
              onRestore={restorePurchases}
            />
          ) : tab === "news" ? (
            <NewsScreen lang={lang} isPremium={isPremium} />
          ) : tab === "calendar" ? (
            <CalendarScreen lang={lang} />
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
              purchaseBusy={purchaseBusy}
              revenueCatConfigured={revenueCatConfigured}
              paywallError={paywallError}
              cloudSyncEnabled={cloudSyncEnabled}
              cloudSyncStatus={cloudSyncStatus}
              cloudSyncMessage={cloudSyncMessage}
              lastCloudSyncAt={lastCloudSyncAt}
              faceLockEnabled={faceLockEnabled}
              onOAuth={signInWithProvider}
              onSignOut={signOut}
              onPurchase={purchasePackage}
              onRestore={restorePurchases}
              onSyncNow={syncTradesWithCloud}
              onEnableFaceId={enableFaceId}
              onDisableFaceId={disableFaceId}
            />
          )}
        </View>
        <View style={styles.tabbar}>
          {tabs.map((x) => (
            <Pressable
              key={x.id}
              onPress={() => setTab(x.id)}
              style={[styles.tab, tab === x.id && styles.tabActive]}
            >
              <TabGlyph id={x.id} active={tab === x.id} />
              <Text
                style={[styles.tabText, tab === x.id && styles.tabTextActive]}
              >
                {x.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1, backgroundColor: C.bg },
  screen: { flex: 1, backgroundColor: C.bg, width: "100%" },
  content: { padding: 16, paddingBottom: 24, width: "100%", maxWidth: 980, alignSelf: "center" },
  list: { padding: 16, paddingBottom: 24, width: "100%", maxWidth: 980, alignSelf: "center" },
  h1: {
    color: C.text,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -1,
    marginBottom: 16,
  },
  h1NoMargin: {
    color: C.text,
    fontSize: 29,
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
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pillText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  sub: { color: C.sub, fontSize: 12, lineHeight: 18 },
  notes: { color: C.text, fontSize: 14, lineHeight: 21, marginTop: 8 },
  tapHint: { color: C.green, fontSize: 11, fontWeight: "800", marginTop: 10 },
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
  journalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
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
  calendarCard: { paddingHorizontal: 14 },
  calendarGrid: {
    gap: 4,
  },
  calendarRow: {
    flexDirection: "row",
    gap: 4,
    justifyContent: "flex-start",
  },
  daySpacer: {
    width: "13.6%",
    height: 70,
    marginBottom: 4,
  },
  day: {
    width: "13.6%",
    height: 70,
    borderRadius: 16,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 4,
  },
  dayProfit: { backgroundColor: "rgba(163,255,18,0.10)", borderColor: "rgba(163,255,18,0.55)" },
  dayLoss: { backgroundColor: "rgba(255,59,95,0.10)", borderColor: "rgba(255,59,95,0.55)" },
  dayActive: { backgroundColor: C.purple, borderColor: C.purple },
  dayMuted: { opacity: 0.48 },
  dayNum: { color: C.text, fontWeight: "900", fontSize: 20 },
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    paddingTop: 34,
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
  newsTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 23,
    marginTop: 10,
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
    borderRadius: 14,
    padding: 10,
  },
  asset: { color: C.sub, fontSize: 10, fontWeight: "900", marginBottom: 4 },
  bigTime: {
    color: C.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
  },
  dateText: { color: C.sub, fontSize: 12, fontWeight: "800", marginTop: 2 },
  intelCard: { backgroundColor: C.purpleSoft },
  smallMetric: {
    flex: 1,
    backgroundColor: C.card2,
    borderRadius: 14,
    padding: 10,
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
  weekChipActive: { backgroundColor: C.green, borderColor: C.green },
  weekChipDay: { color: C.text, fontWeight: "900", fontSize: 12 },
  weekChipDate: { color: C.sub, fontWeight: "800", fontSize: 11, marginTop: 3 },
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
    width: 32,
    height: 32,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
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
    height: 24,
    flexDirection: "row",
    alignItems: "flex-end",
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
  newsGlyph: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
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
  gearRing: { width: 18, height: 18, borderWidth: 2.4, borderRadius: 9, position: "absolute" },
  gearCenter: { width: 7, height: 7, borderWidth: 2.2, borderRadius: 4, position: "absolute" },
  gearTooth: { width: 8, height: 3.5, borderRadius: 2, position: "absolute" },
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
    justifyContent: "space-between",
    gap: 6,
    marginTop: 10,
  },
  purpleAction: {
    borderColor: C.purple,
    backgroundColor: C.purpleSoft,
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
  dashboardMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  dashboardMetric: { width: "48%", minWidth: 145, flexGrow: 1, borderRadius: 18, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, padding: 12 },
  dashboardMetricLabel: { color: C.sub, fontSize: 14, fontWeight: "900", textTransform: "uppercase" },
  dashboardMetricValue: { fontSize: 25, fontWeight: "900", marginTop: 8, letterSpacing: -0.8 },
  dashboardMetricHelper: { color: C.sub, fontSize: 11, marginTop: 4, fontWeight: "700" },
  metricDot: { width: 8, height: 8, borderRadius: 4 },
  chartGrid: { gap: 10 },
  chartCard: { borderWidth: 1, borderColor: "rgba(176,38,255,0.22)", backgroundColor: "rgba(255,255,255,0.035)", borderRadius: 20, padding: 12, marginTop: 8 },
  performanceCard: { borderWidth: 1, borderColor: "rgba(176,38,255,0.22)", backgroundColor: "rgba(176,38,255,0.045)", borderRadius: 20, padding: 12, marginTop: 8 },
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
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: C.bg,
    borderTopColor: C.border,
    borderTopWidth: 1,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 18 },
  tabActive: { backgroundColor: C.greenSoft },
  tabIcon: {
    fontSize: 22,
    lineHeight: 24,
    marginBottom: 2,
    color: C.green,
    fontWeight: "900",
  },
  tabIconActive: { color: C.green },
  tabText: { color: C.sub, fontSize: 10, fontWeight: "800" },
  tabTextActive: { color: C.green },

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
    color: C.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 10,
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
    gap: 10,
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  monthNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.greenSoft,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavText: {
    color: C.green,
    fontSize: 31,
    fontWeight: "800",
    lineHeight: 33,
  },
  monthTitleText: {
    flex: 1,
    color: C.green,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  weekdayHeader: {
    flexDirection: "row",
    gap: 4,
    justifyContent: "flex-start",
    marginBottom: 6,
  },
  weekdayHeaderText: {
    width: "13.6%",
    color: C.sub,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  instrumentBtnActive: {
    backgroundColor: C.purpleSoft,
    borderColor: C.purple,
  },
  purpleNewsCard: {
    backgroundColor: C.purpleSoft,
    borderColor: "rgba(176,38,255,0.42)",
  },

});
