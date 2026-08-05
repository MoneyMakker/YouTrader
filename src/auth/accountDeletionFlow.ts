/**
 * Pure Apple lifecycle decision helpers.
 *
 * HTTP 200 alone never means success: the response body must be consumed.
 * After server-side deletion the Supabase user no longer exists, so remote
 * sign-out answers 403 user_not_found — local teardown must still complete.
 */

export type StoreAppleTokenEvidence = {
  authorizationCodePresent: boolean;
  ok: boolean;
  stored: boolean;
  pass: boolean;
};

export type DeleteAccountEvidence = {
  ok: boolean;
  appleRevoked: boolean;
  manualAppleRevocationRequired: boolean;
  pass: boolean;
};

export type PostDeletionTeardownPlan = {
  enterAccountDeletingState: true;
  blockAuthenticatedShell: true;
  clearCustomerInfo: true;
  clearLocalUserCaches: true;
  clearSupabaseSession: true;
  resetNavigationRootToAuth: true;
  forceLocalTeardown: true;
  callPurchasesLogOut: false;
};

function readBoolean(body: unknown, key: string): boolean {
  if (!body || typeof body !== "object") return false;
  return (body as Record<string, unknown>)[key] === true;
}

export function evaluateStoreAppleTokenResponse(
  authorizationCodePresent: boolean,
  body: unknown,
): StoreAppleTokenEvidence {
  const ok = readBoolean(body, "ok");
  const stored = readBoolean(body, "stored");
  return {
    authorizationCodePresent,
    ok,
    stored,
    pass: authorizationCodePresent && ok && stored,
  };
}

export function evaluateDeleteAccountResponse(body: unknown): DeleteAccountEvidence {
  const ok = readBoolean(body, "ok");
  const appleRevoked = readBoolean(body, "appleRevoked");
  const manualAppleRevocationRequired = readBoolean(body, "manualAppleRevocationRequired");
  return {
    ok,
    appleRevoked,
    manualAppleRevocationRequired,
    pass: ok && appleRevoked && !manualAppleRevocationRequired,
  };
}

/** Deletion teardown never depends on the remote sign-out result. */
export function planPostDeletionTeardown(): PostDeletionTeardownPlan {
  return {
    enterAccountDeletingState: true,
    blockAuthenticatedShell: true,
    clearCustomerInfo: true,
    clearLocalUserCaches: true,
    clearSupabaseSession: true,
    resetNavigationRootToAuth: true,
    forceLocalTeardown: true,
    callPurchasesLogOut: false,
  };
}

export type BootstrapSessionVerdict =
  | "valid"
  | "deleted_user"
  | "expired_refresh"
  | "network_retryable";

type SessionValidationError = {
  status?: number | null;
  code?: string | null;
  name?: string | null;
  message?: string | null;
} | null | undefined;

/**
 * A cached session must only be purged for a genuinely invalid user.
 * Transient network failures keep a valid offline session usable.
 */
export function classifyBootstrapSession(error: SessionValidationError): BootstrapSessionVerdict {
  if (!error) return "valid";
  const code = (error.code || "").toLowerCase();
  const name = (error.name || "").toLowerCase();
  const message = (error.message || "").toLowerCase();
  if (name.includes("retryable") || message.includes("network request failed") || message.includes("fetch failed")) {
    return "network_retryable";
  }
  if (code.includes("user_not_found") || message.includes("user from sub claim in jwt does not exist")) {
    return "deleted_user";
  }
  if (code.includes("refresh_token") || message.includes("refresh token")) {
    return "expired_refresh";
  }
  if (error.status === 401 || error.status === 403) return "deleted_user";
  return "network_retryable";
}

export function shouldPurgeCachedSession(verdict: BootstrapSessionVerdict): boolean {
  return verdict === "deleted_user" || verdict === "expired_refresh";
}

/** Responses correlated to a superseded attempt must never close a gate. */
export function isStaleLifecycleResponse(
  responseCorrelationId: string | null | undefined,
  activeCorrelationId: string | null | undefined,
): boolean {
  if (!activeCorrelationId) return true;
  return responseCorrelationId !== activeCorrelationId;
}
