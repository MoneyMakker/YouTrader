import { Linking } from "react-native";
import { supabase } from "../config/appConfig";

export type DeleteAccountResult =
  | { ok: true; manualAppleRevocationRequired?: boolean; appleRevoked?: boolean }
  | { ok: false; reason: "not_configured" | "unauthorized" | "failed" };

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

  if (error || !data?.ok) {
    return { ok: false, reason: "failed" };
  }
  return {
    ok: true,
    manualAppleRevocationRequired: !!data.manualAppleRevocationRequired,
    appleRevoked: !!data.appleRevoked,
  };
}

/**
 * Best-effort: exchange Apple authorizationCode server-side and store refresh token.
 * Never persists the code locally. Safe to call fire-and-forget after Apple sign-in.
 */
export async function storeAppleAuthTokenAfterSignIn(
  authorizationCode: string | null | undefined,
): Promise<void> {
  const code = (authorizationCode || "").trim();
  if (!code || !supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) return;
  try {
    await supabase.functions.invoke("store-apple-auth-token", {
      method: "POST",
      body: { authorizationCode: code },
    });
  } catch {
    // Non-blocking for sign-in; deletion falls back to manual Apple revocation.
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
