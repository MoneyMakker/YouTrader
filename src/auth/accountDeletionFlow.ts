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

/** Responses correlated to a superseded attempt must never close a gate. */
export function isStaleLifecycleResponse(
  responseCorrelationId: string | null | undefined,
  activeCorrelationId: string | null | undefined,
): boolean {
  if (!activeCorrelationId) return true;
  return responseCorrelationId !== activeCorrelationId;
}
