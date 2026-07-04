import type { Session } from "@supabase/supabase-js";
import { supabase } from "../config/appConfig";
import { isPasswordResetCallbackUrl } from "./authConfig";
import { parseAuthCallbackParams } from "./authUrlParse";

function mergedParam(url: string, key: string): string | null {
  return parseAuthCallbackParams(url).merged[key] || null;
}

/** Establishes a recovery session from youtrader://auth/reset-password (no PKCE). */
export async function completePasswordRecoveryFromUrl(url: string): Promise<Session | null> {
  if (!supabase || !isPasswordResetCallbackUrl(url)) return null;

  await supabase.auth.getSession();

  const errorDescription = mergedParam(url, "error_description") || mergedParam(url, "error");
  if (errorDescription) {
    throw new Error("Password reset link is invalid or expired. Request a new reset email.");
  }

  const tokenHash = mergedParam(url, "token_hash");
  const type = mergedParam(url, "type");
  if (tokenHash && type === "recovery") {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (error) throw error;
    return data.session;
  }

  const access_token = mergedParam(url, "access_token");
  const refresh_token = mergedParam(url, "refresh_token");
  if (access_token && refresh_token) {
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return data.session;
  }

  return null;
}
