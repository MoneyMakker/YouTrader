/**
 * Lists app-owned OAuth/PKCE storage keys to clear on logout / QA reset.
 * Pure — no RN imports.
 */

export function listPendingOAuthStorageKeys(supabaseAuthStorageKey: string): string[] {
  const base = (supabaseAuthStorageKey || "sb-auth-token").trim();
  return [
    `${base}-code-verifier`,
    // Historical / alternate Supabase JS key shapes
    `${base}-code-verifier-pkce`,
  ];
}

export type PendingOAuthClearPlan = {
  dismissAuthSession: true;
  storageKeys: string[];
  clearProviderBusy: true;
};

export function planPendingOAuthClear(supabaseAuthStorageKey: string): PendingOAuthClearPlan {
  return {
    dismissAuthSession: true,
    storageKeys: listPendingOAuthStorageKeys(supabaseAuthStorageKey),
    clearProviderBusy: true,
  };
}
