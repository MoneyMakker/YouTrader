/**
 * Staging-only QA auth/state reset.
 * Impossible to enable in production builds (compile + runtime gates).
 *
 * Invocation (any one):
 * - Launch argument: -YTQAResetAuth
 * - Deep link: youtrader://qa/reset-auth (staging schemes only)
 * - Env: EXPO_PUBLIC_QA_RESET_AUTH=1 (staging Debug/Release-Staging only)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { NativeModules, Platform } from "react-native";
import Purchases from "react-native-purchases";

import {
  ACQUISITION_ONBOARDING_KEY,
  ACQUISITION_PAYWALL_DEVICE_KEY,
} from "../app/startup/acquisitionState";
import { getPkceCodeVerifierStorageKey, getSupabaseAuthStorageKey } from "../auth/authStorageKeys";
import { signOutGoogleNative } from "../auth/googleSignIn";
import { supabase } from "../config/appConfig";
import {
  isStagingQaResetAllowed,
  resolveAppEnvironment,
  shouldRunStagingQaReset as shouldRunStagingQaResetPure,
} from "./stagingQaResetGates";

export {
  isStagingQaResetAllowed,
  resolveAppEnvironment,
  shouldRunStagingQaResetPure as shouldRunStagingQaResetGate,
};

/** Prefixes owned by YouTrader app storage — never wipe unrelated Keychain. */
const YT_ASYNC_PREFIXES = [
  "yt-",
  "yt_",
  "prop-",
  "prop_",
  "news-cache-",
  "calendar-cache-",
  "first-insight-",
  "sb-",
] as const;

export type StagingQaResetReport = {
  attempted: boolean;
  allowed: boolean;
  reason: string;
  clearedAsyncKeys: number;
  clearedSecureKeys: string[];
  signedOutSupabase: boolean;
  revenueCatLoggedOut: boolean;
};

function processEnv(): Record<string, string | undefined> {
  return typeof process !== "undefined" ? process.env : {};
}

function readProcessArguments(): string[] {
  try {
    const argv = (NativeModules as { PlatformConstants?: { processArgs?: string[] } })
      .PlatformConstants?.processArgs;
    if (Array.isArray(argv)) return argv.map(String);
  } catch {
    // ignore
  }
  try {
    const settings = NativeModules.SettingsManager?.settings;
    const args = settings?.argv || settings?.arguments;
    if (Array.isArray(args)) return args.map(String);
  } catch {
    // ignore
  }
  return [];
}

export function shouldRunStagingQaReset(options?: {
  deepLinkUrl?: string | null;
  env?: Record<string, string | undefined>;
}): boolean {
  const env = options?.env ?? processEnv();
  return shouldRunStagingQaResetPure({
    env,
    deepLinkUrl: options?.deepLinkUrl,
    processArgs: readProcessArguments(),
    devFallback: typeof __DEV__ !== "undefined" ? __DEV__ : false,
  });
}

async function clearOwnedAsyncStorage(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  const owned = keys.filter((key) =>
    YT_ASYNC_PREFIXES.some((prefix) => key.startsWith(prefix)),
  );
  const required = [
    ACQUISITION_ONBOARDING_KEY,
    ACQUISITION_PAYWALL_DEVICE_KEY,
    "yt-post-auth-paywall-seen-v1",
  ];
  const toRemove = Array.from(new Set([...owned, ...required]));
  if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  return toRemove.length;
}

async function clearOwnedSecureStore(): Promise<string[]> {
  const keys = [
    getSupabaseAuthStorageKey(),
    getPkceCodeVerifierStorageKey(),
  ].filter(Boolean);
  const cleared: string[] = [];
  for (const key of keys) {
    try {
      await SecureStore.deleteItemAsync(key);
      cleared.push(key);
    } catch {
      // Key may not exist — ignore.
    }
  }
  return cleared;
}

/**
 * Clears YouTrader staging session + acquisition/paywall/cache state.
 * Does not wipe unrelated Keychain items.
 */
export async function runStagingQaReset(options?: {
  deepLinkUrl?: string | null;
}): Promise<StagingQaResetReport> {
  const env = processEnv();
  if (!isStagingQaResetAllowed(env, { devFallback: typeof __DEV__ !== "undefined" ? __DEV__ : false })) {
    return {
      attempted: true,
      allowed: false,
      reason: `blocked_env:${resolveAppEnvironment(env, typeof __DEV__ !== "undefined" ? __DEV__ : false)}`,
      clearedAsyncKeys: 0,
      clearedSecureKeys: [],
      signedOutSupabase: false,
      revenueCatLoggedOut: false,
    };
  }

  if (!shouldRunStagingQaReset(options)) {
    return {
      attempted: false,
      allowed: true,
      reason: "not_requested",
      clearedAsyncKeys: 0,
      clearedSecureKeys: [],
      signedOutSupabase: false,
      revenueCatLoggedOut: false,
    };
  }

  let signedOutSupabase = false;
  if (supabase) {
    try {
      await supabase.auth.signOut({ scope: "local" });
      signedOutSupabase = true;
    } catch {
      signedOutSupabase = false;
    }
  }

  try {
    await signOutGoogleNative();
  } catch {
    // non-fatal
  }

  let revenueCatLoggedOut = false;
  if (Platform.OS !== "web") {
    try {
      // Anonymous / already-logged-out SDK throws; treat as cleared for QA.
      await Purchases.logOut();
      revenueCatLoggedOut = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/logOut was called|already|anonymous/i.test(message)) {
        revenueCatLoggedOut = true;
      } else {
        revenueCatLoggedOut = false;
      }
    }
  }

  const clearedAsyncKeys = await clearOwnedAsyncStorage();
  const clearedSecureKeys = await clearOwnedSecureStore();

  if (__DEV__) {
    console.info("[YTQA] staging auth reset complete", {
      clearedAsyncKeys,
      clearedSecureKeyCount: clearedSecureKeys.length,
      signedOutSupabase,
      revenueCatLoggedOut,
    });
  }

  return {
    attempted: true,
    allowed: true,
    reason: "reset_ok",
    clearedAsyncKeys,
    clearedSecureKeys,
    signedOutSupabase,
    revenueCatLoggedOut,
  };
}
