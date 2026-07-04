import type { AuthError } from "@supabase/supabase-js";
import { EMAIL_MAGIC_LINK_FINISH_MESSAGE } from "./authErrors";
import { getAuthRedirectUri } from "./authConfig";
import { parseAuthCallbackUrl, redactSecret, type ParsedAuthUrl } from "./authUrlParse";

export { parseAuthCallbackUrl, type ParsedAuthUrl } from "./authUrlParse";

export const EMAIL_AUTH_LOG_TAG = "[YouTrader:email-auth]";

export type EmailAuthFlowMethod =
  | "verifyOtp"
  | "exchangeCodeForSession"
  | "setSession"
  | "pkce_verifier_missing"
  | "callback_params_missing"
  | "supabase_not_configured"
  | "localhost_redirect"
  | "callback_error_params"
  | "not_auth_callback";

export type EmailAuthFailureMeta = {
  failStep: string;
  failLine: string;
  flow: EmailAuthFlowMethod;
  supabaseError?: SerializedSupabaseError | null;
  parsedQuery?: Record<string, string>;
  parsedHash?: Record<string, string>;
  incomingUrl?: string;
  emailRedirectTo?: string;
  expectedRedirectUri?: string;
};

export type SerializedSupabaseError = {
  message: string;
  code?: string;
  status?: number;
  name?: string;
};

/** Always logs — visible in Xcode / TestFlight device logs. */
export function logEmailAuth(event: string, payload?: Record<string, unknown>) {
  if (payload && Object.keys(payload).length > 0) {
    console.warn(EMAIL_AUTH_LOG_TAG, event, payload);
  } else {
    console.warn(EMAIL_AUTH_LOG_TAG, event);
  }
}

export function redactEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return redactSecret(email);
  return `${(local || "").slice(0, 2)}…@${domain}`;
}

export function serializeSupabaseError(error: unknown): SerializedSupabaseError | null {
  if (!error) return null;
  const record = error as AuthError & { status?: number; name?: string };
  return {
    message: String(record.message || "Unknown Supabase error"),
    code: record.code ? String(record.code) : undefined,
    status: typeof record.status === "number" ? record.status : undefined,
    name: record.name ? String(record.name) : undefined,
  };
}

export function createEmailAuthFailure(
  message: string,
  meta: EmailAuthFailureMeta,
  cause?: unknown,
): Error & EmailAuthFailureMeta {
  const error = new Error(message) as Error & EmailAuthFailureMeta;
  Object.assign(error, meta);
  if (meta.supabaseError?.code) {
    (error as Error & { code?: string }).code = meta.supabaseError.code;
  }
  if (cause && typeof cause === "object" && cause !== null && "stack" in cause) {
    error.stack = String((cause as Error).stack || error.stack);
  }
  logEmailAuth("auth_failed", {
    failStep: meta.failStep,
    failLine: meta.failLine,
    flow: meta.flow,
    message,
    supabaseError: meta.supabaseError,
    incomingUrl: meta.incomingUrl,
    parsedQuery: meta.parsedQuery,
    parsedHash: meta.parsedHash,
    emailRedirectTo: meta.emailRedirectTo,
    expectedRedirectUri: meta.expectedRedirectUri,
  });
  return error;
}

export function getEmailAuthFailureMeta(error: unknown): EmailAuthFailureMeta | null {
  if (!error || typeof error !== "object") return null;
  const record = error as EmailAuthFailureMeta;
  if (!record.failLine || !record.flow) return null;
  return record;
}

export function userFacingEmailAuthAlertMessage(error: unknown): string {
  logEmailAuth("user_alert", {
    detail: formatEmailAuthAlertDetail(error),
  });
  return EMAIL_MAGIC_LINK_FINISH_MESSAGE;
}

export function formatEmailAuthAlertDetail(error: unknown): string {
  const meta = getEmailAuthFailureMeta(error);
  const serialized = serializeSupabaseError(error);
  const lines: string[] = [];

  if (meta?.failLine) lines.push(`Failed at: ${meta.failLine}`);
  if (meta?.flow) lines.push(`Flow: ${meta.flow}`);
  if (meta?.failStep) lines.push(`Step: ${meta.failStep}`);

  const message = meta ? error instanceof Error ? error.message : String(error) : serialized?.message;
  if (message) lines.push(`Message: ${message}`);

  const code = meta?.supabaseError?.code || serialized?.code || (error as { code?: string })?.code;
  if (code) lines.push(`Code: ${code}`);

  if (serialized?.status) lines.push(`HTTP status: ${serialized.status}`);

  if (meta?.expectedRedirectUri) {
    lines.push(`Expected redirect: ${meta.expectedRedirectUri}`);
  }
  if (meta?.emailRedirectTo) {
    lines.push(`Sent redirectTo: ${meta.emailRedirectTo}`);
    lines.push(
      `Redirect match: ${meta.emailRedirectTo === meta.expectedRedirectUri ? "YES" : "NO — add exact URL to Supabase Redirect URLs"}`,
    );
  }

  if (meta?.parsedQuery && Object.keys(meta.parsedQuery).length) {
    lines.push(`Query: ${JSON.stringify(meta.parsedQuery)}`);
  }
  if (meta?.parsedHash && Object.keys(meta.parsedHash).length) {
    lines.push(`Hash: ${JSON.stringify(meta.parsedHash)}`);
  }

  if (!lines.length) {
    return serialized?.message || (error instanceof Error ? error.message : String(error)) || "Unknown email auth error.";
  }

  return lines.join("\n");
}

export function logSignInWithOtpStart(email: string, emailRedirectTo: string) {
  const expectedRedirectUri = getAuthRedirectUri();
  logEmailAuth("signInWithOtp_request", {
    email: redactEmail(email),
    emailRedirectTo,
    expectedRedirectUri,
    redirectExactMatch: emailRedirectTo.startsWith(expectedRedirectUri),
    supabaseRedirectHint: "Add youtrader://auth to Supabase → Auth → URL Configuration → Redirect URLs",
  });
}

export function logSignInWithOtpResponse(email: string, error: unknown | null) {
  logEmailAuth("signInWithOtp_response", {
    email: redactEmail(email),
    ok: !error,
    supabaseError: serializeSupabaseError(error),
  });
}

export function logDeepLinkReceived(url: string, isAuthCallback: boolean) {
  const parsed = parseAuthCallbackUrl(url);
  logEmailAuth("deep_link_received", {
    url,
    isAuthCallback,
    hasTokenHash: parsed.hasTokenHash,
    hasCode: parsed.hasCode,
    hasAccessToken: parsed.hasAccessToken,
    hasRefreshToken: parsed.hasRefreshToken,
    hasType: parsed.hasType,
    hasError: parsed.hasError,
    query: parsed.query,
    hash: parsed.hash,
  });
}

export function logAuthFlowSelected(flow: EmailAuthFlowMethod, parsed: ParsedAuthUrl, url: string) {
  logEmailAuth("auth_flow_selected", {
    flow,
    url,
    hasTokenHash: parsed.hasTokenHash,
    hasCode: parsed.hasCode,
    hasAccessToken: parsed.hasAccessToken,
    hasRefreshToken: parsed.hasRefreshToken,
    type: parsed.merged.type || null,
    query: parsed.query,
    hash: parsed.hash,
  });
}

export function logSupabaseAuthResponse(
  flow: EmailAuthFlowMethod,
  failLine: string,
  response: { sessionUserId?: string | null; error: unknown | null },
) {
  logEmailAuth("supabase_auth_response", {
    flow,
    failLine,
    ok: !response.error && !!response.sessionUserId,
    sessionUserId: response.sessionUserId || null,
    supabaseError: serializeSupabaseError(response.error),
  });
}
