import type { Session } from "@supabase/supabase-js";
import { supabase } from "../config/appConfig";
import { getAuthRedirectUri, isLocalhostAuthUrl, logAuthRedirectBug } from "./authConfig";
import { waitForPkceCodeVerifier } from "./authPkceStorage";
import { isAccountLinkingConflict } from "./authErrors";
import { exchangePkceCodeForSession } from "./exchangePkceCode";
import {
  logAuthFlowSelected,
  logEmailAuth,
  type ParsedAuthUrl,
} from "./emailAuthDebug";
import { parseAuthCallbackParams, parseAuthCallbackUrl } from "./authUrlParse";

function mergedParams(url: string): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parseAuthCallbackParams(url).merged)) {
    params.set(key, value);
  }
  return params;
}

/** Google OAuth browser callback (Expo Go / staging browser fallback — not TestFlight native Google). */
export async function completeOAuthSessionFromUrl(url: string): Promise<Session> {
  const parsed = parseAuthCallbackUrl(url);
  const params = mergedParams(url);

  if (!supabase) {
    throw new Error("Account sign-in is not configured in this build.");
  }

  if (isLocalhostAuthUrl(url)) {
    logAuthRedirectBug("BUG: Supabase returned localhost. Check Site URL / redirectTo.", { url });
    throw new Error("Sign-in could not return to the app. Check Supabase Redirect URLs.");
  }

  const errorDescription = params.get("error_description") || params.get("error");
  if (errorDescription) {
    logEmailAuth("oauth_callback_error", {
      hasError: true,
      errorCode: params.get("error") || null,
      // description may contain PII — log length only
      errorDescriptionLen: String(errorDescription).length,
    });
    throw new Error(errorDescription);
  }

  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (access_token && refresh_token) {
    logAuthFlowSelected("setSession", parsed, url);
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    logEmailAuth("oauth_session_result", {
      flow: "setSession",
      sessionEstablished: !error && !!data.session,
      supabaseErrorCode: error?.code || null,
    });
    if (error) throw error;
    if (!data.session) throw new Error("OAuth sign-in did not return a session.");
    return data.session;
  }

  const code = params.get("code");
  if (!code) {
    logEmailAuth("oauth_callback_missing_code", {
      hasCode: false,
      hasAccessToken: parsed.hasAccessToken,
      hasRefreshToken: parsed.hasRefreshToken,
    });
    throw new Error("OAuth callback URL has no code or session tokens.");
  }

  const hasVerifier = await waitForPkceCodeVerifier();
  logEmailAuth("oauth_pkce_gate", {
    hasVerifier,
    hasCode: true,
    hasState: !!(params.get("state") || parsed.merged.state),
    redirectUri: getAuthRedirectUri(),
  });
  if (!hasVerifier) {
    throw new Error("OAuth PKCE verifier missing. Start sign-in again on this device.");
  }

  logAuthFlowSelected("exchangeCodeForSession", parsed, url);
  try {
    const session = await exchangePkceCodeForSession(code, "oauthAuthCallback.ts:exchangeCodeForSession");
    logEmailAuth("oauth_session_result", {
      flow: "exchangeCodeForSession",
      sessionEstablished: !!session,
      userPrefix: (session.user.id || "").slice(0, 8),
    });
    return session;
  } catch (error) {
    logEmailAuth("oauth_session_result", {
      flow: "exchangeCodeForSession",
      sessionEstablished: false,
      supabaseErrorCode:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code || "")
          : null,
    });
    if (isAccountLinkingConflict(error)) throw error;
    throw error;
  }
}
