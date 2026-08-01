import { Linking } from "react-native";
import { supabase } from "../config/appConfig";

export type DeleteAccountResult =
  | { ok: true }
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
  return { ok: true };
}

export function openAppleSubscriptionManagement(): void {
  void Linking.openURL("https://apps.apple.com/account/subscriptions");
}
