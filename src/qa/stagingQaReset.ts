/**
 * Staging-only QA auth/state reset.
 * Impossible to enable in production builds (compile + runtime gates).
 *
 * Deep links:
 * - youtrader://qa/reset-fresh
 * - youtrader://qa/reset-paywall
 * - youtrader://qa/reset-auth
 * - youtrader://qa/reset-returning-allow
 * - youtrader://qa/reset-returning-deny
 * Launch argument: -YTQAResetAuth (defaults to auth mode)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { NativeModules, Platform } from "react-native";
import Purchases from "react-native-purchases";

import {
  ACQUISITION_ONBOARDING_KEY,
  ACQUISITION_PAYWALL_DEVICE_KEY,
} from "../app/startup/acquisitionState";
import { clearPendingOAuthClientState } from "../auth/clearPendingOAuth";
import { getPkceCodeVerifierStorageKey, getSupabaseAuthStorageKey } from "../auth/authStorageKeys";
import { signOutGoogleNative } from "../auth/googleSignIn";
import { supabase } from "../config/appConfig";
import {
  isStagingQaResetAllowed,
  resolveAppEnvironment,
  shouldRunStagingQaReset as shouldRunStagingQaResetPure,
} from "./stagingQaResetGates";
import {
  parseStagingQaResetMode,
  stagingQaResetModeUi,
  type StagingQaResetMode,
} from "./stagingQaResetModes";
import {
  STAGING_QA_RESET_STATUS_KEY,
  createResetStatus,
  serializeResetStatus,
  type StagingQaResetPhase,
  type StagingQaResetStatusSnapshot,
} from "./stagingQaResetState";

export {
  isStagingQaResetAllowed,
  resolveAppEnvironment,
  shouldRunStagingQaResetPure as shouldRunStagingQaResetGate,
};
export type { StagingQaResetMode };
export { clearPendingOAuthClientState };

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

const SIGN_OUT_TIMEOUT_MS = 8000;

export type StagingQaResetReport = {
  attempted: boolean;
  allowed: boolean;
  reason: string;
  mode: StagingQaResetMode | null;
  clearedAsyncKeys: number;
  clearedSecureKeys: string[];
  signedOutSupabase: boolean;
  revenueCatLoggedOut: boolean;
  oauthStateCleared: boolean;
  expectedPhase: string | null;
  phase: StagingQaResetPhase;
};

export type StagingQaResetProgressListener = (snap: StagingQaResetStatusSnapshot) => void;

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
    getPkceCodeVerifierStorageKey(),
    getSupabaseAuthStorageKey(),
    STAGING_QA_RESET_STATUS_KEY,
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

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<{ ok: true; value: T } | { ok: false }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then((v) => ({ ok: true as const, value: v })),
      new Promise<{ ok: false }>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false }), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function persistStatus(snap: StagingQaResetStatusSnapshot): Promise<void> {
  await AsyncStorage.setItem(STAGING_QA_RESET_STATUS_KEY, serializeResetStatus(snap));
}

/**
 * Clears YouTrader staging session + acquisition/paywall/cache state.
 * Emits deterministic phases for Maestro (qa.reset.* markers).
 * Does not wipe unrelated Keychain items.
 */
export async function runStagingQaReset(options?: {
  deepLinkUrl?: string | null;
  mode?: StagingQaResetMode;
  onProgress?: StagingQaResetProgressListener;
}): Promise<StagingQaResetReport> {
  const env = processEnv();
  const emit = async (
    phase: StagingQaResetPhase,
    mode: StagingQaResetMode | null,
    error: string | null = null,
  ) => {
    const snap = createResetStatus(phase, mode, error);
    options?.onProgress?.(snap);
    try {
      await persistStatus(snap);
    } catch {
      // ignore persist errors during mid-wipe
    }
  };

  const empty = async (
    reason: string,
    allowed: boolean,
    attempted: boolean,
  ): Promise<StagingQaResetReport> => {
    if (attempted && !allowed) {
      await emit("reset_failed", null, reason);
    }
    return {
      attempted,
      allowed,
      reason,
      mode: null,
      clearedAsyncKeys: 0,
      clearedSecureKeys: [],
      signedOutSupabase: false,
      revenueCatLoggedOut: false,
      oauthStateCleared: false,
      expectedPhase: null,
      phase: attempted && !allowed ? "reset_failed" : "idle",
    };
  };

  if (!isStagingQaResetAllowed(env, { devFallback: typeof __DEV__ !== "undefined" ? __DEV__ : false })) {
    return empty(
      `blocked_env:${resolveAppEnvironment(env, typeof __DEV__ !== "undefined" ? __DEV__ : false)}`,
      false,
      true,
    );
  }

  if (!shouldRunStagingQaReset(options) && !options?.mode) {
    return empty("not_requested", true, false);
  }

  const mode =
    options?.mode ||
    (options?.deepLinkUrl ? parseStagingQaResetMode(options.deepLinkUrl) : null) ||
    "auth";
  const ui = stagingQaResetModeUi(mode);

  try {
    await emit("reset_requested", mode);

    await emit("clearing_oauth_state", mode);
    const oauthStateCleared = await clearPendingOAuthClientState();

    await emit("clearing_app_storage", mode);
    const clearedAsyncKeys = await clearOwnedAsyncStorage();
    const clearedSecureKeys = await clearOwnedSecureStore();

    await emit("clearing_auth_session", mode);
    let signedOutSupabase = false;
    if (supabase) {
      const signOutResult = await withTimeout(
        supabase.auth.signOut({ scope: "local" }).then(() => true),
        SIGN_OUT_TIMEOUT_MS,
      );
      signedOutSupabase = signOutResult.ok;
    } else {
      signedOutSupabase = true;
    }

    try {
      await signOutGoogleNative();
    } catch {
      // non-fatal
    }

    await emit("clearing_user_cache", mode);
    let revenueCatLoggedOut = false;
    if (Platform.OS !== "web") {
      try {
        // Skip logOut when already anonymous — otherwise RC logs ERROR → LogBox covers QA UI.
        const anonymous = await Purchases.isAnonymous();
        if (anonymous) {
          revenueCatLoggedOut = true;
        } else {
          const rc = await withTimeout(Purchases.logOut().then(() => true), SIGN_OUT_TIMEOUT_MS);
          revenueCatLoggedOut = rc.ok;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/logOut was called|already|anonymous/i.test(message)) {
          revenueCatLoggedOut = true;
        } else {
          revenueCatLoggedOut = false;
        }
      }
    } else {
      revenueCatLoggedOut = true;
    }

    await emit("applying_target_mode", mode);
    const persistPairs: [string, string][] = [];
    if (ui.persistOnboarding) persistPairs.push([ACQUISITION_ONBOARDING_KEY, "1"]);
    if (ui.persistPaywallDevice) persistPairs.push([ACQUISITION_PAYWALL_DEVICE_KEY, "1"]);
    if (persistPairs.length) await AsyncStorage.multiSet(persistPairs);

    await emit("persisted", mode);
    await emit("reset_complete", mode);

    if (__DEV__) {
      console.info("[YTQA] staging auth reset complete", {
        mode,
        expectedPhase: ui.expectedPhase,
        clearedAsyncKeys,
        clearedSecureKeyCount: clearedSecureKeys.length,
        signedOutSupabase,
        revenueCatLoggedOut,
        oauthStateCleared,
      });
    }

    return {
      attempted: true,
      allowed: true,
      reason: "reset_ok",
      mode,
      clearedAsyncKeys,
      clearedSecureKeys,
      signedOutSupabase,
      revenueCatLoggedOut,
      oauthStateCleared,
      expectedPhase: ui.expectedPhase,
      phase: "reset_complete",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await emit("reset_failed", mode, message.slice(0, 120));
    return {
      attempted: true,
      allowed: true,
      reason: `reset_failed:${message.slice(0, 80)}`,
      mode,
      clearedAsyncKeys: 0,
      clearedSecureKeys: [],
      signedOutSupabase: false,
      revenueCatLoggedOut: false,
      oauthStateCleared: false,
      expectedPhase: ui.expectedPhase,
      phase: "reset_failed",
    };
  }
}
