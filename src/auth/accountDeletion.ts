import { Linking } from "react-native";
import { supabase } from "../config/appConfig";
import {
  evaluateDeleteAccountResponse,
  evaluateStoreAppleTokenResponse,
  type StoreAppleTokenEvidence,
} from "./accountDeletionFlow";

export type DeleteAccountResult =
  | {
      ok: true;
      manualAppleRevocationRequired: boolean;
      appleRevoked: boolean;
      revokePass: boolean;
    }
  | { ok: false; reason: "not_configured" | "unauthorized" | "failed" };

/** Sanitized lifecycle evidence — booleans only, never codes, tokens, ids, or emails. */
function logAppleLifecycle(event: string, details: Record<string, boolean>) {
  console.warn(`[YouTrader:apple-lifecycle] ${event}`, details);
}

/**
 * Requests secure server-side account deletion for the current session user.
 * Does not cancel App Store subscriptions — callers must inform the user.
 */
export async function requestAccountDeletion(): Promise<DeleteAccountResult> {
  if (!supabase) return { ok: false, reason: "not_configured" };
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) return { ok: false, reason: "unauthorized" };

  const { data, error } = await supabase.functions.invoke("delete-account", {
    method: "POST",
    body: {},
  });

  const evidence = evaluateDeleteAccountResponse(data);
  logAppleLifecycle("delete-account response", {
    transportError: !!error,
    ok: evidence.ok,
    appleRevoked: evidence.appleRevoked,
    manualAppleRevocationRequired: evidence.manualAppleRevocationRequired,
    revokePass: evidence.pass,
  });

  if (error || !evidence.ok) {
    return { ok: false, reason: "failed" };
  }
  return {
    ok: true,
    manualAppleRevocationRequired: evidence.manualAppleRevocationRequired,
    appleRevoked: evidence.appleRevoked,
    revokePass: evidence.pass,
  };
}

/**
 * Best-effort: exchange Apple authorizationCode server-side and store refresh token.
 * Never persists the code locally. Safe to call fire-and-forget after Apple sign-in.
 */
export async function storeAppleAuthTokenAfterSignIn(
  authorizationCode: string | null | undefined,
): Promise<StoreAppleTokenEvidence> {
  const code = (authorizationCode || "").trim();
  const authorizationCodePresent = code.length > 0;
  if (!authorizationCodePresent || !supabase) {
    const evidence = evaluateStoreAppleTokenResponse(authorizationCodePresent, null);
    logAppleLifecycle("store-apple-auth-token skipped", {
      authorizationCodePresent,
      ok: evidence.ok,
      stored: evidence.stored,
      pass: evidence.pass,
    });
    return evidence;
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    return evaluateStoreAppleTokenResponse(authorizationCodePresent, null);
  }
  try {
    const { data } = await supabase.functions.invoke("store-apple-auth-token", {
      method: "POST",
      body: { authorizationCode: code },
    });
    const evidence = evaluateStoreAppleTokenResponse(authorizationCodePresent, data);
    logAppleLifecycle("store-apple-auth-token response", {
      authorizationCodePresent,
      ok: evidence.ok,
      stored: evidence.stored,
      pass: evidence.pass,
    });
    return evidence;
  } catch {
    // Non-blocking for sign-in; deletion falls back to manual Apple revocation.
    return evaluateStoreAppleTokenResponse(authorizationCodePresent, null);
  }
}

export function openAppleAppsUsingAppleIdSettings(): void {
  // iOS Settings deep link for Apps Using Apple ID management.
  void Linking.openURL("App-prefs:APPLE_ACCOUNT&path=PASSWORD_AND_SECURITY/APP_USING_YOUR_ID").catch(
    () => {
      void Linking.openURL("https://appleid.apple.com/account/manage");
    },
  );
}

const APPLE_SUBSCRIPTIONS_FALLBACK = "https://apps.apple.com/account/subscriptions";

/** Prefer RevenueCat CustomerInfo.managementURL; fall back to Apple subscriptions page. */
export function openSubscriptionManagement(managementURL?: string | null): void {
  const url = (managementURL || "").trim() || APPLE_SUBSCRIPTIONS_FALLBACK;
  void Linking.openURL(url);
}

/** @deprecated Prefer openSubscriptionManagement(managementURL). */
export function openAppleSubscriptionManagement(): void {
  openSubscriptionManagement(null);
}
