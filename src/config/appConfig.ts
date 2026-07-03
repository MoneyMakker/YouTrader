import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const PLACEHOLDER_SNIPPETS = [
  "your_project",
  "your-public",
  "your_public",
  "your-supabase",
  "your_supabase",
  "your_publishable",
  "your-public-revenuecat",
  "your_public_revenuecat",
  "example.com",
  "replace_me",
  "changeme",
];

function looksLikePlaceholder(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("your_") || normalized.includes("your-")) return true;
  return PLACEHOLDER_SNIPPETS.some((snippet) => normalized.includes(snippet));
}

function resolveSupabaseUrl() {
  const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
  if (looksLikePlaceholder(url)) return "";
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".supabase.co")) return "";
    if (parsed.hostname.startsWith("your")) return "";
  } catch {
    return "";
  }
  return url;
}

function resolveSupabaseKey() {
  const key = (
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (looksLikePlaceholder(key)) return "";
  if (key.length < 40) return "";
  return key;
}

const supabaseUrl = resolveSupabaseUrl();
const supabaseKey = resolveSupabaseKey();

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

function resolveRevenueCatApiKey() {
  const key = (
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : Platform.OS === "android"
        ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
        : ""
  )?.trim() || "";
  if (looksLikePlaceholder(key)) return "";
  if (Platform.OS === "ios" && !key.startsWith("appl_")) return "";
  if (Platform.OS === "android" && !key.startsWith("goog_")) return "";
  return key;
}

export const REVENUECAT_API_KEY = resolveRevenueCatApiKey();
export const REVENUECAT_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "pro";
export const REVENUECAT_IOS_PRODUCT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_PRODUCT_ID || "youtrader_pro_monthly";
export const REVENUECAT_IOS_YEARLY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID || "youtrader_pro_yearly";
export const isExpoGo =
  Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient";

export const isRevenueCatConfigured =
  !!REVENUECAT_API_KEY && Platform.OS !== "web" && !isExpoGo;

export const enableCloudSignIn =
  process.env.EXPO_PUBLIC_ENABLE_CLOUD_SIGN_IN === "true";

/** Prefer native Apple on iOS when Supabase is live — avoids browser OAuth during review. */
export const enableNativeAppleSignIn =
  process.env.EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGN_IN === "true" ||
  (Platform.OS === "ios" && isSupabaseConfigured && enableCloudSignIn);

export function userFacingBillingError(message?: string) {
  if (!message) return "";
  const lower = message.toLowerCase();
  if (
    lower.includes("invalid api key") ||
    lower.includes("credentials issue") ||
    lower.includes("api key") ||
    lower.includes("configuration") ||
    lower.includes("couldn't find product") ||
    lower.includes("product not found") ||
    lower.includes("no subscription packages found")
  ) {
    return "Subscriptions are temporarily unavailable. Please try again in a moment.";
  }
  if (message.length > 140) {
    return "Unable to load subscriptions right now. Try again in a moment.";
  }
  return message;
}

export function releaseConfigSummary() {
  return {
    supabase: isSupabaseConfigured,
    revenueCat: isRevenueCatConfigured,
    expoGo: isExpoGo,
    finnhub: !!(process.env.EXPO_PUBLIC_FINNHUB_API_KEY || "").trim() && !looksLikePlaceholder(process.env.EXPO_PUBLIC_FINNHUB_API_KEY || ""),
    cloudSignIn: enableCloudSignIn,
    nativeApple: enableNativeAppleSignIn,
  };
}
