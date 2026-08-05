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
  | "error_recoverable";

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
