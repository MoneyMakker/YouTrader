import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as AppleAuthentication from "expo-apple-authentication";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IOS_BUNDLE_IDENTIFIER } from "../config/appConfig";

const NONCE_CHARSET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

async function generateRawNonce(length = 32): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += NONCE_CHARSET[bytes[i] % NONCE_CHARSET.length];
  }
  return result;
}
export async function buildAppleNonce(): Promise<{ rawNonce: string; hashedNonce: string }> {
  const rawNonce = await generateRawNonce();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  return { rawNonce, hashedNonce };
}

function resolveBundleIdentifier(): string {
  return (
    Constants.expoConfig?.ios?.bundleIdentifier ||
    Constants.manifest2?.extra?.expoClient?.ios?.bundleIdentifier ||
    IOS_BUNDLE_IDENTIFIER
  );
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const atobFn = (globalThis as { atob?: (value: string) => string }).atob;
    if (!atobFn) return null;
    return JSON.parse(atobFn(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Sanitized Apple auth diagnostics — never log tokens, codes, JWTs, emails, or full user ids. */
function logAppleAuth(event: string, details?: Record<string, unknown>) {
  const payload = {
    bundleId: resolveBundleIdentifier(),
    platform: Platform.OS,
    ...details,
  };
  if (__DEV__) {
    console.log(`[YouTrader:apple-auth] ${event}`, payload);
    return;
  }
  // Release-Staging / TestFlight: visible without __DEV__, still sanitized.
  console.warn(`[YouTrader:apple-auth] ${event}`, payload);
}

export async function signInWithAppleNative(supabaseClient: SupabaseClient) {
  if (Platform.OS !== "ios") {
    throw new Error("Native Apple sign-in is only available on iOS.");
  }
  if (!(await AppleAuthentication.isAvailableAsync())) {
    throw new Error("Sign in with Apple is not available on this device.");
  }

  const { rawNonce, hashedNonce } = await buildAppleNonce();
  logAppleAuth("starting native sign-in", {
    hasRawNonce: !!rawNonce,
    hasHashedNonce: !!hashedNonce,
  });

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (nativeError) {
    const err = nativeError as { code?: string; message?: string };
    logAppleAuth("native authorization failed", {
      appleErrorCode: err?.code || "unknown",
      message: err?.message ? String(err.message).slice(0, 120) : undefined,
    });
    throw nativeError;
  }

  const hasIdentityToken = !!credential.identityToken;
  const hasAuthorizationCode = !!credential.authorizationCode;
  logAppleAuth("native credential received", {
    hasIdentityToken,
    hasAuthorizationCode,
    realUserStatus: credential.realUserStatus,
  });

  if (!credential.identityToken) {
    throw new Error("Apple did not return an identity token.");
  }

  const claims = decodeJwtPayload(credential.identityToken);
  logAppleAuth("identity token claims (sanitized)", {
    iss: typeof claims?.iss === "string" ? claims.iss : undefined,
    aud: typeof claims?.aud === "string" ? claims.aud : undefined,
    hasSub: typeof claims?.sub === "string" && claims.sub.length > 0,
    hasNonceClaim: typeof claims?.nonce === "string" && claims.nonce.length > 0,
  });

  const { error } = await supabaseClient.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });

  if (error) {
    const msg = String(error.message || "");
    const lower = msg.toLowerCase();
    logAppleAuth("supabase signInWithIdToken failed", {
      status: error.status,
      // Prefer short codes over full messages that may echo server detail.
      errorCode:
        lower.includes("not enabled") || lower.includes("provider")
          ? "provider_disabled_or_misconfigured"
          : lower.includes("issuer") || lower.includes("audience")
            ? "audience_or_issuer_mismatch"
            : lower.includes("nonce")
              ? "nonce_validation_failed"
              : "supabase_id_token_error",
      message: msg.slice(0, 160),
      hint:
        lower.includes("issuer") || lower.includes("audience")
          ? `Add "${resolveBundleIdentifier()}" to Supabase Apple provider Client IDs (see AUTH_SETUP.md).`
          : lower.includes("not enabled")
            ? "Enable Apple provider on this Supabase project, or hide the Apple CTA in staging."
            : lower.includes("oauth secret")
              ? "Native signInWithIdToken should be used on iOS — browser OAuth requires a secret."
              : undefined,
    });
    throw error;
  }

  logAppleAuth("supabase session created");
  return credential;
}
