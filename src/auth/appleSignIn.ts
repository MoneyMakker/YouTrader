import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as AppleAuthentication from "expo-apple-authentication";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IOS_BUNDLE_IDENTIFIER } from "../config/appConfig";

const NONCE_CHARSET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function generateRawNonce(length = 32): string {
  const values = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(values);
    let result = "";
    for (let i = 0; i < length; i++) {
      result += NONCE_CHARSET[values[i] % NONCE_CHARSET.length];
    }
    return result;
  }
  let result = "";
  for (let i = 0; i < length; i++) {
    result += NONCE_CHARSET[Math.floor(Math.random() * NONCE_CHARSET.length)];
  }
  return result;
}
export async function buildAppleNonce(): Promise<{ rawNonce: string; hashedNonce: string }> {
  const rawNonce = generateRawNonce();
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

function logAppleDev(event: string, details?: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log(`[YouTrader:apple-auth] ${event}`, {
    bundleId: resolveBundleIdentifier(),
    platform: Platform.OS,
    ...details,
  });
}

export async function signInWithAppleNative(supabaseClient: SupabaseClient) {
  if (Platform.OS !== "ios") {
    throw new Error("Native Apple sign-in is only available on iOS.");
  }
  if (!(await AppleAuthentication.isAvailableAsync())) {
    throw new Error("Sign in with Apple is not available on this device.");
  }

  const { rawNonce, hashedNonce } = await buildAppleNonce();
  logAppleDev("starting native sign-in", { hasNonce: true });

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error("Apple did not return an identity token.");
  }

  const claims = decodeJwtPayload(credential.identityToken);
  logAppleDev("received identity token", {
    iss: claims?.iss,
    aud: claims?.aud,
    sub: claims?.sub ? "[present]" : "[missing]",
  });

  const { error } = await supabaseClient.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });

  if (error) {
    logAppleDev("supabase signInWithIdToken failed", {
      message: error.message,
      status: error.status,
      hint:
        String(error.message).toLowerCase().includes("issuer") ||
        String(error.message).toLowerCase().includes("audience")
          ? `Add "${resolveBundleIdentifier()}" to Supabase Apple provider Client IDs (see AUTH_SETUP.md).`
          : String(error.message).toLowerCase().includes("oauth secret")
            ? "Native signInWithIdToken should be used on iOS — browser OAuth requires a secret."
            : undefined,
    });
    throw error;
  }

  logAppleDev("supabase session created");
  return credential;
}
