/**
 * PostPurchaseAuthCoordinator — single shared runtime owner for Apple, Google,
 * and Email post-purchase linking.
 *
 * Owns the complete sequence:
 *   authentication → Purchases.logIn → consume CustomerInfo → refresh →
 *   verify entitlement → migrate → mark complete → navigate to Main.
 *
 * Never calls Purchases.logOut.
 */
import { useCallback, useRef, useState } from "react";
import type { CustomerInfo } from "react-native-purchases";
import type { AuthProvider } from "../auth/types";
import type { PostPurchaseAuthPhase } from "./types";
import { linkAnonymousPurchaseToIdentity } from "./RevenueCatIdentityLinker";
import { migrateGuestTradesToUser } from "./AnonymousDataMigrationService";

export type LinkingResult = {
  customerInfo: CustomerInfo;
  tradesMigrated: number;
  migrationStatus: "migrated" | "already_migrated" | "no_guest_data" | "failed";
};

export type AuthCallback = (provider: AuthProvider) => Promise<{ userId: string } | null>;
export type EmailAuthCallback = (email: string, password: string) => Promise<{ userId: string } | null>;

export type CoordinatorProps = {
  anonymousCustomerInfo: CustomerInfo | null;
  onAuthenticate: AuthCallback;
  onAuthenticateEmail: EmailAuthCallback;
  onLinkingComplete: (result: LinkingResult) => void;
};

export function usePostPurchaseAuthCoordinator({
  anonymousCustomerInfo,
  onAuthenticate,
  onAuthenticateEmail,
  onLinkingComplete,
}: CoordinatorProps) {
  const [phase, setPhase] = useState<PostPurchaseAuthPhase>("idle");
  const [activeProvider, setActiveProvider] = useState<AuthProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const callbacksRef = useRef({ onLinkingComplete });
  callbacksRef.current = { onLinkingComplete };
  const busyRef = useRef(false);

  const setError = useCallback((msg: string) => {
    setErrorMessage(msg);
    setPhase("error_recoverable");
    busyRef.current = false;
  }, []);

  const gotoIdle = useCallback(() => {
    setPhase("idle");
    setActiveProvider(null);
    setErrorMessage(null);
    busyRef.current = false;
  }, []);

  const handleAuthResult = useCallback(async (userId: string) => {
    // Phase: linking_revenuecat
    setPhase("linking_revenuecat");

    const linkResult = await linkAnonymousPurchaseToIdentity(userId, anonymousCustomerInfo);
    if (linkResult.status === "not_configured") {
      setError("Billing is not available. Please try again.");
      return;
    }
    if (linkResult.status === "failed") {
      setError(linkResult.message || "Linking failed. Please try again.");
      return;
    }

    // Phase: verifying_entitlement
    setPhase("verifying_entitlement");
    const info = linkResult.customerInfo;
    const hasPro = !!info?.entitlements?.active?.["pro"]?.isActive;
    if (!hasPro) {
      setError("Your Pro access could not be verified. Please try again.");
      return;
    }

    // Phase: migrating_local_data
    setPhase("migrating_local_data");
    const migrationResult = await migrateGuestTradesToUser(userId);

    // failed migration blocks Main — user stays with retry
    if (migrationResult.status === "failed") {
      setError("Data migration failed. Your purchase and journal are preserved — Retry to continue.");
      return;
    }

    // Phase: success
    setPhase("success");
    busyRef.current = false;
    callbacksRef.current.onLinkingComplete({
      customerInfo: info,
      tradesMigrated: migrationResult.status === "migrated" ? migrationResult.tradesMigrated : 0,
      migrationStatus: migrationResult.status,
    });
  }, [anonymousCustomerInfo, setError]);

  const authenticate = useCallback(async (provider: AuthProvider) => {
    if (busyRef.current) return;
    busyRef.current = true;

    const providerPhase: Record<AuthProvider, PostPurchaseAuthPhase> = {
      apple: "authenticating_apple",
      google: "authenticating_google",
      email: "authenticating_email",
    };
    setPhase(providerPhase[provider]);
    setActiveProvider(provider);
    setErrorMessage(null);

    try {
      const result = await onAuthenticate(provider);
      if (!result) {
        // Cancelled — preserve purchase.
        gotoIdle();
        return;
      }
      await handleAuthResult(result.userId);
    } catch (error: any) {
      const msg = String(error?.message || "Authentication failed");
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user cancelled")) {
        gotoIdle();
      } else {
        setError(msg);
      }
    }
  }, [onAuthenticate, handleAuthResult, gotoIdle, setError]);

  const authenticateEmail = useCallback(async (email: string, password: string) => {
    if (busyRef.current) return;
    busyRef.current = true;

    setPhase("authenticating_email");
    setActiveProvider("email");
    setErrorMessage(null);

    try {
      const result = await onAuthenticateEmail(email, password);
      if (!result) {
        gotoIdle();
        return;
      }
      await handleAuthResult(result.userId);
    } catch (error: any) {
      const msg = String(error?.message || "Authentication failed");
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user cancelled")) {
        gotoIdle();
      } else {
        setError(msg);
      }
    }
  }, [onAuthenticateEmail, handleAuthResult, gotoIdle, setError]);

  const retry = useCallback(() => {
    if (!activeProvider) {
      gotoIdle();
      return;
    }
    void authenticate(activeProvider);
  }, [activeProvider, authenticate, gotoIdle]);

  return {
    phase,
    activeProvider,
    errorMessage,
    authenticate,
    authenticateEmail,
    retry,
    gotoIdle,
  };
}
