import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { t } from "../i18n";

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
        flowType: "pkce",
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

export const IOS_BUNDLE_IDENTIFIER =
  Constants.expoConfig?.ios?.bundleIdentifier || "com.youtrader.pro";

/** iOS always uses native Apple sign-in (signInWithIdToken), never browser OAuth. */
export const enableNativeAppleSignIn =
  Platform.OS === "ios" && isSupabaseConfigured;

function resolveGoogleClientId(envKey: string): string {
  const value = (process.env[envKey] || "").trim();
  if (looksLikePlaceholder(value)) return "";
  if (!value.endsWith(".apps.googleusercontent.com")) return "";
  return value;
}

/** Web OAuth client ID — required for native Google idToken on iOS. */
export const GOOGLE_WEB_CLIENT_ID = resolveGoogleClientId(
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
);

/** iOS OAuth client ID — bundle-linked native Google Sign-In. */
export const GOOGLE_IOS_CLIENT_ID = resolveGoogleClientId(
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
);

export const isGoogleNativeSignInConfigured =
  !!GOOGLE_WEB_CLIENT_ID && !!GOOGLE_IOS_CLIENT_ID;

/** Native Google on iOS dev/TestFlight/App Store builds (not Expo Go). */
export const enableNativeGoogleSignIn =
  Platform.OS === "ios" && !isExpoGo && isGoogleNativeSignInConfigured;

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
    return t("subsTemporarilyUnavailable");
  }
  if (message.length > 140) {
    return t("subsUnableToLoad");
  }
  return message;
}

export function appVersionDisplayLabel() {
  const version = Constants.expoConfig?.version || "1.5.9";
  const build = Constants.expoConfig?.ios?.buildNumber || "94";
  return `Version ${version} (${build})`;
}

export function releaseConfigSummary() {
  return {
    supabase: isSupabaseConfigured,
    revenueCat: isRevenueCatConfigured,
    expoGo: isExpoGo,
    finnhub: !!(process.env.EXPO_PUBLIC_FINNHUB_API_KEY || "").trim() && !looksLikePlaceholder(process.env.EXPO_PUBLIC_FINNHUB_API_KEY || ""),
    cloudSignIn: enableCloudSignIn,
    nativeApple: enableNativeAppleSignIn,
    nativeGoogle: enableNativeGoogleSignIn,
  };
}
