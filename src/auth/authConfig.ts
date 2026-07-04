import Constants from "expo-constants";
import { makeRedirectUri } from "expo-auth-session";
import { IOS_BUNDLE_IDENTIFIER, isExpoGo } from "../config/appConfig";

/** Deep-link scheme for dev build, TestFlight, and App Store. */
export const AUTH_APP_SCHEME = "youtrader";

const LOCALHOST_PATTERN = /localhost|127\.0\.0\.1/i;

export function isLocalhostAuthUrl(url: string): boolean {
  return LOCALHOST_PATTERN.test(url);
}

export function assertNotLocalhostAuthUrl(url: string, label: string): void {
  if (isLocalhostAuthUrl(url)) {
    throw new Error(`${label} must not use localhost on mobile. Got: ${url}`);
  }
}

/**
 * Redirect URIs for Google OAuth, email confirmation, and password reset.
 */
export function getAuthRedirectUri(): string {
  if (isExpoGo) {
    const uri = makeRedirectUri({ path: "auth", preferLocalhost: false });
    assertNotLocalhostAuthUrl(uri, "getAuthRedirectUri");
    return uri;
  }
  return `${AUTH_APP_SCHEME}://auth`;
}

export function getPasswordResetRedirectUri(): string {
  if (isExpoGo) {
    const uri = makeRedirectUri({ path: "auth/reset-password", preferLocalhost: false });
    assertNotLocalhostAuthUrl(uri, "getPasswordResetRedirectUri");
    return uri;
  }
  return `${AUTH_APP_SCHEME}://auth/reset-password`;
}

export function getEmailConfirmRedirectUri(): string {
  if (isExpoGo) {
    const uri = makeRedirectUri({ path: "auth", preferLocalhost: false });
    assertNotLocalhostAuthUrl(uri, "getEmailConfirmRedirectUri");
    return uri;
  }
  return `${AUTH_APP_SCHEME}://auth`;
}

export function isEmailConfirmCallbackUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes("auth/confirm")) return true;
  if (isPasswordResetCallbackUrl(url)) return false;
  return /[?#&]type=(signup|email_change)/i.test(url);
}

export function isPasswordResetCallbackUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes("reset-password") ||
    /[?#&]type=recovery/i.test(url)
  );
}

/** @deprecated Use getAuthRedirectUri */
export const resolveAuthRedirectUri = getAuthRedirectUri;

export function logAuthRedirectDev(context: string) {
  if (!__DEV__) return;
  console.log(`[YouTrader:auth] ${context}`, {
    redirectUri: getAuthRedirectUri(),
    isExpoGo,
    bundleId: Constants.expoConfig?.ios?.bundleIdentifier || IOS_BUNDLE_IDENTIFIER,
  });
}

export function logAuthRedirectBug(message: string, details?: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log(`[YouTrader:auth] ${message}`, details);
}

export function supabaseSiteUrlHint(): string {
  const redirectUri = getAuthRedirectUri();
  return isExpoGo
    ? `Set Supabase Site URL to ${redirectUri} (not localhost). Add the same URI to Redirect URLs.`
    : "Set Supabase Site URL to youtrader://auth (not localhost). Add youtrader://auth to Redirect URLs.";
}

/** Ensures Supabase authorize URL always carries the mobile redirect target. */
export function withExplicitRedirectTo(authUrl: string, redirectTo: string): string {
  const url = new URL(authUrl);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

export function readRedirectToFromAuthUrl(authUrl: string): string | null {
  try {
    return new URL(authUrl).searchParams.get("redirect_to");
  } catch {
    return null;
  }
}

export function assertAuthUrlRedirectTo(authUrl: string, redirectTo: string): void {
  const embedded = readRedirectToFromAuthUrl(authUrl);
  if (embedded !== redirectTo) {
    throw new Error(
      `OAuth authUrl is missing redirect_to. Add this exact URL to Supabase Redirect URLs: ${redirectTo}`,
    );
  }
  assertNotLocalhostAuthUrl(embedded, "redirect_to");
}

export function isAuthCallbackUrl(url: string): boolean {
  if (!url) return false;
  if (isLocalhostAuthUrl(url)) return true;
  if (isPasswordResetCallbackUrl(url)) return true;
  if (isEmailConfirmCallbackUrl(url)) return true;
  if (isExpoGo) {
    return /[?#&](code|access_token|token_hash|error)=/i.test(url) || url.includes("--/auth");
  }
  return false;
}
