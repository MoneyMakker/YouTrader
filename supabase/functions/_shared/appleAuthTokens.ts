/**
 * Shared Apple Sign in with Apple token helpers for Edge Functions.
 * Secrets (booleans only in reports): APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID,
 * APPLE_PRIVATE_KEY (.p8 PEM), optional APPLE_TOKEN_ENCRYPTION_KEY.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import * as jose from "https://deno.land/x/jose@v5.9.6/index.ts";

export type AppleSecretConfig = {
  teamId: string;
  keyId: string;
  clientId: string;
  privateKeyPem: string;
  encryptionKey?: string;
};

export function readAppleSecretConfig(): AppleSecretConfig | null {
  const teamId = (Deno.env.get("APPLE_TEAM_ID") || "").trim();
  const keyId = (Deno.env.get("APPLE_KEY_ID") || "").trim();
  const clientId = (Deno.env.get("APPLE_CLIENT_ID") || Deno.env.get("APPLE_BUNDLE_ID") || "").trim();
  const privateKeyPem = (Deno.env.get("APPLE_PRIVATE_KEY") || "").trim().replace(/\\n/g, "\n");
  const encryptionKey = (Deno.env.get("APPLE_TOKEN_ENCRYPTION_KEY") || "").trim() || undefined;
  if (!teamId || !keyId || !clientId || !privateKeyPem) return null;
  return { teamId, keyId, clientId, privateKeyPem, encryptionKey };
}

export function appleSecretsPresent(): boolean {
  return !!readAppleSecretConfig();
}

export async function createAppleClientSecret(cfg: AppleSecretConfig): Promise<string> {
  const key = await jose.importPKCS8(cfg.privateKeyPem, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return await new jose.SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setSubject(cfg.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 30)
    .sign(key);
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function sealRefreshToken(token: string, encryptionKey?: string): Promise<string> {
  if (!encryptionKey) {
    // Server-protected via RLS + service_role only; ciphertext prefix marks plaintext storage.
    return `plain:${token}`;
  }
  const key = await deriveAesKey(encryptionKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(token));
  const packed = new Uint8Array(iv.length + cipher.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipher), iv.length);
  let binary = "";
  packed.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return `v1:${btoa(binary)}`;
}

export async function openRefreshToken(sealed: string, encryptionKey?: string): Promise<string | null> {
  if (sealed.startsWith("plain:")) return sealed.slice("plain:".length);
  if (!sealed.startsWith("v1:") || !encryptionKey) return null;
  try {
    const key = await deriveAesKey(encryptionKey);
    const raw = atob(sealed.slice(3));
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export async function exchangeAppleAuthorizationCode(
  cfg: AppleSecretConfig,
  authorizationCode: string,
): Promise<{ refreshToken: string | null; accessToken: string | null }> {
  const clientSecret = await createAppleClientSecret(cfg);
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    return { refreshToken: null, accessToken: null };
  }
  const json = (await res.json()) as {
    refresh_token?: string;
    access_token?: string;
  };
  return {
    refreshToken: json.refresh_token || null,
    accessToken: json.access_token || null,
  };
}

export async function revokeAppleRefreshToken(
  cfg: AppleSecretConfig,
  refreshToken: string,
): Promise<"revoked" | "already_revoked" | "failed"> {
  const clientSecret = await createAppleClientSecret(cfg);
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: clientSecret,
    token: refreshToken,
    token_type_hint: "refresh_token",
  });
  const res = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  // Apple returns 200 on success; treat 400 invalid_grant as already revoked.
  if (res.ok) return "revoked";
  if (res.status === 400) return "already_revoked";
  return "failed";
}

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, serviceKey);
}

export async function upsertAppleRefreshToken(
  admin: SupabaseClient,
  userId: string,
  sealed: string,
): Promise<boolean> {
  const { error } = await admin.from("auth_provider_tokens").upsert(
    {
      user_id: userId,
      provider: "apple",
      refresh_token_ciphertext: sealed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  return !error;
}

export async function loadAppleRefreshTokenSealed(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("auth_provider_tokens")
    .select("refresh_token_ciphertext")
    .eq("user_id", userId)
    .eq("provider", "apple")
    .maybeSingle();
  if (error || !data?.refresh_token_ciphertext) return null;
  return String(data.refresh_token_ciphertext);
}

export async function deleteAppleRefreshToken(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  await admin.from("auth_provider_tokens").delete().eq("user_id", userId).eq("provider", "apple");
}
