/** Pure helpers for Supabase auth storage keys (no React Native imports). */

export function getSupabaseAuthStorageKeyFromUrl(supabaseUrl: string): string {
  const url = supabaseUrl.trim();
  try {
    const hostname = new URL(url).hostname;
    const projectRef = hostname.split(".")[0];
    if (!projectRef) return "sb-auth-token";
    return `sb-${projectRef}-auth-token`;
  } catch {
    return "sb-auth-token";
  }
}

export function getSupabaseAuthStorageKey(): string {
  return getSupabaseAuthStorageKeyFromUrl(process.env.EXPO_PUBLIC_SUPABASE_URL || "");
}

export function getPkceCodeVerifierStorageKey(): string {
  return `${getSupabaseAuthStorageKey()}-code-verifier`;
}

export const PRODUCTION_AUTH_REDIRECT_URI = "youtrader://auth";
export const PRODUCTION_PASSWORD_RESET_REDIRECT_URI = "youtrader://auth/reset-password";
export const PRODUCTION_EMAIL_CONFIRM_REDIRECT_URI = "youtrader://auth/confirm";
