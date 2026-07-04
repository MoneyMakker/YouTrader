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
    logGoogleDev("callbackUrl", result.url);

    if (isLocalhostAuthUrl(result.url)) {
      logAuthRedirectBug("BUG: Supabase returned localhost. Check Site URL / redirectTo.", {
        redirectTo,
        callbackUrl: result.url,
        hint: supabaseSiteUrlHint(),
      });
      throw new Error("Google sign-in could not return to the app. Check Supabase Redirect URLs.");
    }

    const session = await completeOAuthSessionFromUrl(result.url);
    if (!session) throw new Error("Google sign-in did not return a session.");
    logGoogleDev("session_created", { userId: session.user.id, flow: "oauth" });
    return session;
  }

  if (result.type === "cancel" || result.type === "dismiss") {
    const cancelled = new Error("User cancelled Google sign-in.") as Error & { code?: string };
    cancelled.code = "ERR_REQUEST_CANCELED";
    throw cancelled;
  }

  throw new Error("Google sign-in was not completed.");
}

/** Native Google on iOS when configured; browser OAuth for Expo Go. */
export async function signInWithGoogle(supabaseClient: SupabaseClient): Promise<Session> {
  if (enableNativeGoogleSignIn) {
    return signInWithGoogleNative(supabaseClient);
  }
  if (__DEV__ && isExpoGo) {
    logGoogleDev("expo_go_oauth_unstable", getAuthRedirectUri());
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
