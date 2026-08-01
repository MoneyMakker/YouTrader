import type { Session } from "@supabase/supabase-js";
import type { AuthProvider } from "./types";

function sessionLooksLikeEmailPassword(session: Session): boolean {
  const meta = session.user?.app_metadata as { has_password?: boolean; provider?: string } | undefined;
  return meta?.has_password === true || meta?.provider === "email";
}

/**
 * Resolve the primary authentication provider for Settings presentation.
 * Never treat a bare UUID as a display identity.
 */
export function resolveSessionAuthProvider(session: Session | null | undefined): AuthProvider | null {
  if (!session?.user) return null;

  const identityProviders = (session.user.identities || [])
    .map((identity) => String(identity.provider || "").toLowerCase())
    .filter(Boolean);

  if (identityProviders.includes("apple")) return "apple";
  if (identityProviders.includes("google")) return "google";
  if (identityProviders.includes("email")) return "email";

  const metaProvider = String(session.user.app_metadata?.provider || "").toLowerCase();
  if (metaProvider === "apple" || metaProvider === "google" || metaProvider === "email") {
    return metaProvider;
  }

  if (sessionLooksLikeEmailPassword(session)) return "email";
  if (session.user.email) return "email";
  return "email";
}

/** Safe account identifier for UI — email preferred; never expose UUID. */
export function resolveSessionAccountLabel(session: Session | null | undefined): string {
  const email = (session?.user?.email || "").trim();
  if (email) return email;
  const provider = resolveSessionAuthProvider(session);
  if (provider === "apple") return "Apple";
  if (provider === "google") return "Google";
  return "Account";
}

export function sessionSupportsPasswordControls(session: Session | null | undefined): boolean {
  return resolveSessionAuthProvider(session) === "email";
}

export function sessionSupportsChangeEmail(session: Session | null | undefined): boolean {
  // Change-email requires an app-owned email identity; Apple/Google control theirs.
  return resolveSessionAuthProvider(session) === "email";
}
