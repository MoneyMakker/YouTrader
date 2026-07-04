import type { Session } from "@supabase/supabase-js";
import { processAuthDeepLink, type AuthDeepLinkResult } from "./authDeepLinkCoordinator";

/** @deprecated Use processAuthDeepLink — returns session only for password recovery links. */
export async function handleAuthDeepLink(url: string): Promise<Session | null> {
  const result: AuthDeepLinkResult = await processAuthDeepLink(url);
  if (result.kind === "password_recovery") return result.session;
  return null;
}

export { isAccountLinkingConflict } from "./authErrors";
