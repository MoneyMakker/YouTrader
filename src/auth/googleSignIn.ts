import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  enableNativeGoogleSignIn,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  isExpoGo,
} from "../config/appConfig";
import {
  assertAuthUrlRedirectTo,
  assertNotLocalhostAuthUrl,
  getAuthRedirectUri,
  isLocalhostAuthUrl,
  logAuthRedirectBug,
  supabaseSiteUrlHint,
  withExplicitRedirectTo,
} from "./authConfig";
import { completeOAuthSessionFromUrl } from "./oauthAuthCallback";

let googleConfigured = false;

function logGoogleDev(event: string, value?: unknown) {
  if (!__DEV__) return;
  if (value !== undefined) {
    console.log(`[YouTrader:google-auth] ${event}`, value);
  } else {
    console.log(`[YouTrader:google-auth] ${event}`);
  }
}

/** Non-sensitive callback diagnostics — never log codes, tokens, email, or secrets. */
function logGoogleCallbackSafe(url: string) {
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    const hashParams = new URLSearchParams((parsed.hash || "").replace(/^#/, ""));
    const hasCode = !!(params.get("code") || hashParams.get("code"));
    const hasState = !!(params.get("state") || hashParams.get("state"));
    const hasError = !!(params.get("error") || hashParams.get("error") || params.get("error_description"));
    logGoogleDev("callback_meta", {
      scheme: parsed.protocol.replace(":", ""),
      host: parsed.host || parsed.hostname || "",
      path: parsed.pathname || "",
      hasCode,
      hasState,
      hasError,
      errorCode: params.get("error") || hashParams.get("error") || null,
    });
  } catch {
    logGoogleDev("callback_meta", { parseFailed: true });
  }
}

async function loadGoogleSignInModule() {
  return import("@react-native-google-signin/google-signin");
}

function ensureGoogleConfigured(GoogleSignin: { configure: (options: object) => void }) {
  if (googleConfigured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
  });
  googleConfigured = true;
}

async function signInWithGoogleNative(supabaseClient: SupabaseClient): Promise<Session> {
  const { GoogleSignin, isCancelledResponse, isSuccessResponse } = await loadGoogleSignInModule();
  ensureGoogleConfigured(GoogleSignin);
  logGoogleDev("native_sign_in_start");

  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices();
  }

  const response = await GoogleSignin.signIn();
  if (isCancelledResponse(response)) {
    const cancelled = new Error("User cancelled Google sign-in.") as Error & { code?: string };
    cancelled.code = "ERR_REQUEST_CANCELED";
    throw cancelled;
  }
  if (!isSuccessResponse(response)) {
    throw new Error("Google sign-in was not completed.");
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error("Google did not return an identity token.");
  }

  const { data, error } = await supabaseClient.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });

  if (error) throw error;
  if (!data.session) {
    throw new Error("Google sign-in did not return a session.");
  }

  if (response.data.user.name || response.data.user.photo) {
    await supabaseClient.auth.updateUser({
      data: {
        full_name: response.data.user.name ?? undefined,
        avatar_url: response.data.user.photo ?? undefined,
      },
    });
  }

  logGoogleDev("session_created", { userId: data.session.user.id, flow: "native" });
  return data.session;
}

async function signInWithGoogleOAuthBrowser(supabaseClient: SupabaseClient): Promise<Session> {
  const redirectTo = getAuthRedirectUri();
  assertNotLocalhostAuthUrl(redirectTo, "redirectTo");
  logGoogleDev("redirectTo", redirectTo);

  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Google sign-in URL was not returned.");

  const authUrl = withExplicitRedirectTo(data.url, redirectTo);
  assertAuthUrlRedirectTo(authUrl, redirectTo);
  logGoogleDev("authUrl", authUrl);

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
  if (result.type === "success") {
    logGoogleCallbackSafe(result.url);

    if (isLocalhostAuthUrl(result.url)) {
      logAuthRedirectBug("BUG: Supabase returned localhost. Check Site URL / redirectTo.", {
        redirectTo,
        callbackHostOnly: (() => {
          try {
            const u = new URL(result.url);
            return `${u.protocol}//${u.host}`;
          } catch {
            return "unparseable";
          }
        })(),
        hint: supabaseSiteUrlHint(),
      });
      throw new Error("Google sign-in could not return to the app. Check Supabase Redirect URLs.");
    }

    const session = await completeOAuthSessionFromUrl(result.url);
    if (!session) throw new Error("Google sign-in did not return a session.");
    logGoogleDev("session_created", {
      userPrefix: (session.user.id || "").slice(0, 8),
      flow: "oauth",
      sessionEstablished: true,
    });
    return session;
  }

  if (result.type === "cancel" || result.type === "dismiss") {
    const cancelled = new Error("User cancelled Google sign-in.") as Error & { code?: string };
    cancelled.code = "ERR_REQUEST_CANCELED";
    throw cancelled;
  }

  throw new Error("Google sign-in was not completed.");
}

/**
 * Canonical Google architecture (YouTrader 3.0 / staging recovery):
 * PATH A — Supabase browser OAuth via ASWebAuthenticationSession.
 *
 * Native Google (PATH B / signInWithIdToken) stays behind enableNativeGoogleSignIn
 * and requires a *distinct* iOS OAuth client. WEB client must never be used as
 * iosClientId. Until that exists, always use browser OAuth.
 */
export async function signInWithGoogle(supabaseClient: SupabaseClient): Promise<Session> {
  // Prefer PATH A unless a validated distinct iOS client unlocks native.
  if (enableNativeGoogleSignIn) {
    if (__DEV__) {
      logGoogleDev("native_path_selected", { reason: "distinct_ios_client" });
    }
    return signInWithGoogleNative(supabaseClient);
  }
  if (__DEV__) {
    logGoogleDev("canonical_browser_oauth", {
      reason: isExpoGo ? "expo_go" : "path_a_supabase_aswebauth",
      redirectTo: getAuthRedirectUri(),
    });
  }
  return signInWithGoogleOAuthBrowser(supabaseClient);
}

export async function signOutGoogleNative() {
  if (!enableNativeGoogleSignIn) return;
  try {
    const { GoogleSignin } = await loadGoogleSignInModule();
    ensureGoogleConfigured(GoogleSignin);
    await GoogleSignin.signOut();
  } catch {
    // Non-fatal — Supabase signOut is the source of truth.
  }
}
