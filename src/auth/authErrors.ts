import type { AuthProvider } from "./types";

export const APPLE_SIGN_IN_USER_MESSAGE =
  "Apple sign in couldn't be completed. Please try again or use email login.";

export const GOOGLE_SIGN_IN_USER_MESSAGE =
  "Google sign in couldn't be completed. Please try again or use email login.";

export const EMAIL_SIGN_IN_USER_MESSAGE =
  "Email sign in couldn't be completed. Please try again or use another sign-in method.";

/** @deprecated Email login is password-only */
export const EMAIL_MAGIC_LINK_FINISH_MESSAGE = EMAIL_SIGN_IN_USER_MESSAGE;

export const EMAIL_CHECK_INBOX_MESSAGE = "Check your email to finish signing in.";

export const ACCOUNT_LINKING_CONFLICT_MESSAGE =
  "This email is already connected to another sign-in method. Please use that method to continue.";

export function isAuthCancellation(error: unknown): boolean {
  const record = error as { code?: string | number; message?: string };
  if (record?.code === "ERR_REQUEST_CANCELED") return true;
  if (record?.code === "SIGN_IN_CANCELLED") return true;
  if (record?.code === 1001 || record?.code === "1001") return true;
  const message = String(record?.message || "").toLowerCase();
  return message.includes("canceled") || message.includes("cancelled");
}

export function isAccountLinkingConflict(error: unknown): boolean {
  const record = error as { code?: string; message?: string };
  const message = String(record?.message || "").toLowerCase();
  const code = String(record?.code || "").toLowerCase();
  return (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("already linked") ||
    message.includes("identity is already") ||
    message.includes("email address is already") ||
    message.includes("user already exists") ||
    code === "user_already_exists" ||
    code === "email_exists" ||
    code === "identity_already_exists" ||
    (code === "email_address_invalid" && message.includes("already"))
  );
}

export function userFacingAuthError(provider: AuthProvider, error?: unknown): string {
  if (isAccountLinkingConflict(error)) return ACCOUNT_LINKING_CONFLICT_MESSAGE;
  const record = error as { message?: string; code?: string };
  const message = String(record?.message || "").toLowerCase();
  const code = String(record?.code || "").toLowerCase();

  if (provider === "email") {
    if (
      message.includes("flow state") ||
      message.includes("code verifier") ||
      message.includes("pkce") ||
      code.includes("flow_state") ||
      code === "pkce_verifier_missing"
    ) {
      return EMAIL_MAGIC_LINK_FINISH_MESSAGE;
    }
    if (message.includes("expired") || message.includes("invalid") || message.includes("otp")) {
      return "That code is incorrect or expired. Please try again.";
    }
    if (message.includes("redirect") || message.includes("localhost")) {
      return "Sign-in could not return to the app. Check Supabase Redirect URLs include youtrader://auth";
    }
    return EMAIL_SIGN_IN_USER_MESSAGE;
  }

  if (provider === "apple") return APPLE_SIGN_IN_USER_MESSAGE;
  if (provider === "google") return GOOGLE_SIGN_IN_USER_MESSAGE;
  return "Please try again.";
}

export function logAuthDev(provider: AuthProvider, error: unknown, extra?: Record<string, unknown>) {
  const record = error as { message?: string; code?: string | number; status?: number; failLine?: string; flow?: string };
  const payload = {
    message: record?.message,
    code: record?.code,
    status: record?.status,
    failLine: record?.failLine,
    flow: record?.flow,
    ...extra,
  };
  if (provider === "email") {
    console.warn("[YouTrader:email-auth] sign-in failed", payload);
    return;
  }
  if (!__DEV__) return;
  console.log(`[YouTrader:${provider}-auth] sign-in failed`, payload);
}
