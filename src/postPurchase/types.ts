/**
 * Post-purchase authentication types.
 */
import type { AuthProvider } from "../auth/types";

export type PostPurchaseAuthPhase =
  | "idle"
  | "authenticating_apple"
  | "authenticating_google"
  | "authenticating_email"
  | "linking_revenuecat"
  | "migrating_local_data"
  | "verifying_entitlement"
  | "success"
  | "error_recoverable";

export type AnonymousEntitlementStatus =
  | "loading"
  | "active"
  | "inactive"
  | "unknown";

export type PostPurchaseState = {
  phase: PostPurchaseAuthPhase;
  activeProvider: AuthProvider | null;
  errorMessage: string | null;
  attemptGeneration: number;
};

export const INITIAL_POST_PURCHASE_STATE: PostPurchaseState = {
  phase: "idle",
  activeProvider: null,
  errorMessage: null,
  attemptGeneration: 0,
};

/** Persisted marker so relaunch can restore the post-purchase auth screen. */
export const POST_PURCHASE_LINKING_MARKER_KEY = "yt-post-purchase-linking-marker-v1";
