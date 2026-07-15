import { supabase } from "../config/appConfig";
import { logger } from "../lib/logger";
import { isEmailConfirmCallbackUrl } from "./authConfig";
import { exchangePkceCodeForSession } from "./exchangePkceCode";
import { parseAuthCallbackParams } from "./authUrlParse";

const LOG_TAG = "[YouTrader:email-password-auth]";

function mergedParam(url: string, key: string): string | null {
  return parseAuthCallbackParams(url).merged[key] || null;
}

async function clearSessionAfterConfirmation() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Confirms email from youtrader://auth — does not keep user signed in. */
export async function completeEmailConfirmationFromUrl(url: string): Promise<boolean> {
  if (!supabase || !isEmailConfirmCallbackUrl(url)) return false;

  logger.info(`${LOG_TAG} email_confirmation_received`);

  const errorDescription = mergedParam(url, "error_description") || mergedParam(url, "error");
  if (errorDescription) {
    throw new Error("Email confirmation link is invalid or expired.");
  }

  const tokenHash = mergedParam(url, "token_hash");
  const type = mergedParam(url, "type");
  if (tokenHash && (type === "signup" || type === "email" || type === "email_change")) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "email" | "email_change",
    });
    if (error) throw error;
    await clearSessionAfterConfirmation();
    return true;
  }

  const code = mergedParam(url, "code");
  if (code && (!type || type === "signup" || type === "email" || type === "email_change")) {
    await exchangePkceCodeForSession(code, "emailConfirmation.ts:exchangeCodeForSession");
    await clearSessionAfterConfirmation();
    return true;
  }

  const access_token = mergedParam(url, "access_token");
  const refresh_token = mergedParam(url, "refresh_token");
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    await clearSessionAfterConfirmation();
    return true;
  }

  return url.includes("confirm") || /[?#&]type=(signup|email_change)/i.test(url);
}
