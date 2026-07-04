import type { Session } from "@supabase/supabase-js";
import { isAuthCallbackUrl, isEmailConfirmCallbackUrl, isPasswordResetCallbackUrl } from "./authConfig";
import { completeEmailConfirmationFromUrl } from "./emailConfirmation";
import { completePasswordRecoveryFromUrl } from "./passwordRecovery";

const inFlightByUrl = new Map<string, Promise<AuthDeepLinkResult>>();

export type AuthDeepLinkResult =
  | { kind: "email_confirmed" }
  | { kind: "password_recovery"; session: Session }
  | { kind: "none" };

async function processDeepLinkOnce(url: string): Promise<AuthDeepLinkResult> {
  if (!url || !isAuthCallbackUrl(url)) return { kind: "none" };
  if (isEmailConfirmCallbackUrl(url)) {
    const confirmed = await completeEmailConfirmationFromUrl(url);
    return confirmed ? { kind: "email_confirmed" } : { kind: "none" };
  }
  if (isPasswordResetCallbackUrl(url)) {
    const session = await completePasswordRecoveryFromUrl(url);
    return session ? { kind: "password_recovery", session } : { kind: "none" };
  }
  return { kind: "none" };
}

/** Email confirmation + password-reset deep links. */
export function processAuthDeepLink(url: string): Promise<AuthDeepLinkResult> {
  if (!url) return Promise.resolve({ kind: "none" });
  const existing = inFlightByUrl.get(url);
  if (existing) return existing;
  const task = processDeepLinkOnce(url).finally(() => inFlightByUrl.delete(url));
  inFlightByUrl.set(url, task);
  return task;
}

/** @deprecated Use AuthDeepLinkResult */
export type LegacyAuthDeepLinkSession = Session | null;
