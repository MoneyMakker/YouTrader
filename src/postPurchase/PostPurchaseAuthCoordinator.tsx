/**
 * PostPurchaseAuthCoordinator — shared state machine for Apple, Google, and Email
 * post-purchase authentication. Prevents duplicate taps, manages linking + migration.
 */
import { useCallback, useRef, useState } from "react";
import type { CustomerInfo } from "react-native-purchases";
import type { AuthProvider } from "../auth/types";
import type { PostPurchaseAuthPhase, PostPurchaseState } from "./types";
import { INITIAL_POST_PURCHASE_STATE } from "./types";
import { linkAnonymousPurchaseToIdentity } from "./RevenueCatIdentityLinker";
import { migrateGuestTradesToUser } from "./AnonymousDataMigrationService";

export type LinkingSuccess = {
  customerInfo: CustomerInfo;
  tradesMigrated: number;
  migrationStatus: "migrated" | "already_migrated" | "no_guest_data";
};

export type CoordinatorCallbacks = {
  /** Called when a provider authentication succeeds and returns the Supabase session. */
  onAuthenticate: (provider: AuthProvider) => Promise<{ userId: string } | null>;
  /** Called after linking + migration complete — consumes CustomerInfo and transitions. */
  onLinkingComplete: (result: LinkingSuccess) => void;
  /** Called when the user cancels authentication (back to idle). */
  onCancel?: () => void;
};

export function usePostPurchaseAuthCoordinator(callbacks: CoordinatorCallbacks) {
  const [state, setState] = useState<PostPurchaseState>(INITIAL_POST_PURCHASE_STATE);
  const { onAuthenticate, onLinkingComplete, onCancel } = callbacks;
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const transition = useCallback((phase: PostPurchaseAuthPhase, provider: AuthProvider | null = null) => {
    setState((s) => ({
      phase,
      activeProvider: provider,
      errorMessage: phase === "error_recoverable" ? s.errorMessage : null,
      attemptGeneration: phase === "idle" ? s.attemptGeneration : s.attemptGeneration,
    }));
  }, []);

  const setError = useCallback((message: string) => {
    setState((s) => ({ ...s, phase: "error_recoverable", errorMessage: message }));
  }, []);

  const attemptLinking = useCallback(async (userId: string, anonymousInfo: CustomerInfo | null) => {
    transition("linking_revenuecat");
    const linkResult = await linkAnonymousPurchaseToIdentity(userId, anonymousInfo);
    if (linkResult.status === "not_configured" || linkResult.status === "failed") {
      setError(linkResult.status === "not_configured" ? "Billing is not available. Please try again." : (linkResult.message || "Linking failed."));
      return;
    }

    transition("migrating_local_data");
    const migrationResult = await migrateGuestTradesToUser(userId);

    transition("verifying_entitlement");
    callbacksRef.current.onLinkingComplete({
      customerInfo: linkResult.customerInfo,
      tradesMigrated: migrationResult.status === "migrated" ? migrationResult.tradesMigrated : 0,
      migrationStatus: migrationResult.status === "already_migrated" ? "already_migrated"
        : migrationResult.status === "no_guest_data" ? "no_guest_data"
        : "migrated",
    });
  }, [transition, setError]);

  const authenticate = useCallback(async (provider: AuthProvider) => {
    if (state.phase !== "idle" && state.phase !== "error_recoverable") return;

    const providerPhase: Record<AuthProvider, PostPurchaseAuthPhase> = {
      apple: "authenticating_apple",
      google: "authenticating_google",
      email: "authenticating_email",
    };
    transition(providerPhase[provider], provider);

    try {
      const result = await onAuthenticate(provider);
      if (!result) {
        // Cancelled — back to idle, preserve purchase data.
        transition("idle");
        onCancel?.();
        return;
      }

      await attemptLinking(result.userId, null);
    } catch (error: any) {
      const msg = String(error?.message || "Authentication failed");
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user cancelled")) {
        transition("idle");
        onCancel?.();
      } else {
        setError(msg);
      }
    }
  }, [state.phase, transition, onAuthenticate, onCancel, attemptLinking, setError]);

  const retry = useCallback(() => {
    const provider = state.activeProvider;
    if (!provider) {
      transition("idle");
      return;
    }
    void authenticate(provider);
  }, [state.activeProvider, state.phase, authenticate, transition]);

  return { state, authenticate, retry, transition };
}
