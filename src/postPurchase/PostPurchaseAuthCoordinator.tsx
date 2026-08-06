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
import { migrateAnonymousAssessmentToUser, migrateGuestTradesToUser } from "./AnonymousDataMigrationService";
import { REVENUECAT_ENTITLEMENT_ID } from "../config/appConfig";
import { t } from "../i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { POST_PURCHASE_FIRST_ACTION_MARKER_KEY } from "./types";

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
  const failedStageRef = useRef<"auth" | "linking" | "verify" | "migrate" | null>(null);
  const retryUserIdRef = useRef<string | null>(null);
  const linkingResultRef = useRef<LinkingResult | null>(null);

  const setError = useCallback((msg: string, stage: "auth" | "linking" | "verify" | "migrate") => {
    setErrorMessage(msg);
    setPhase("error_recoverable");
    busyRef.current = false;
    failedStageRef.current = stage;
  }, []);

  const gotoIdle = useCallback(() => {
    setPhase("idle");
    setActiveProvider(null);
    setErrorMessage(null);
    busyRef.current = false;
  }, []);

  const handleAuthResult = useCallback(async (userId: string) => {
    retryUserIdRef.current = userId;
    // Phase: linking_revenuecat
    setPhase("linking_revenuecat");

    const linkResult = await linkAnonymousPurchaseToIdentity(userId, anonymousCustomerInfo);
    if (linkResult.status === "not_configured") {
      setError(t("postPurchase.billingUnavailable"), "linking");
      return;
    }
    if (linkResult.status === "failed") {
      setError(linkResult.message || t("postPurchase.linkingFailed"), "linking");
      return;
    }

    // Phase: verifying_entitlement
    setPhase("verifying_entitlement");
    const info = linkResult.customerInfo;
    const hasPro = !!info?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID]?.isActive;
    if (!hasPro) {
      setError(t("postPurchase.entitlementUnverified"), "verify");
      return;
    }

    // Phase: migrating_local_data
    setPhase("migrating_local_data");
    const assessmentMigration = await migrateAnonymousAssessmentToUser(userId);
    if (assessmentMigration.status === "failed") {
      setError(t("postPurchase.migrationFailed"), "migrate");
      return;
    }
    const migrationResult = await migrateGuestTradesToUser(userId);

    // failed migration blocks Main — user stays with retry
    if (migrationResult.status === "failed") {
      setError(t("postPurchase.migrationFailed"), "migrate");
      return;
    }

    // Persisted assessment/setup writes are complete; configure the first
    // Prop Pass surface before allowing Main.
    setPhase("configuring_prop_pass");
    await new Promise((resolve) => setTimeout(resolve, 120));
    const finalResult: LinkingResult = {
      customerInfo: info,
      tradesMigrated: migrationResult.status === "migrated" ? migrationResult.tradesMigrated : 0,
      migrationStatus: migrationResult.status,
    };
    linkingResultRef.current = finalResult;
    await AsyncStorage.setItem(POST_PURCHASE_FIRST_ACTION_MARKER_KEY, userId);
    setPhase("first_action");
    busyRef.current = false;
  }, [anonymousCustomerInfo, setError]);

  const completeFirstAction = useCallback(() => {
    if (!linkingResultRef.current || busyRef.current) return;
    busyRef.current = true;
    setPhase("success");
    const cb = callbacksRef.current.onLinkingComplete;
    const finalResult = linkingResultRef.current;
    // Brief delay so the success visual is visible before the parent clears
    // the marker and acquisition routes to Main.
    setTimeout(() => {
      cb(finalResult);
      void AsyncStorage.removeItem(POST_PURCHASE_FIRST_ACTION_MARKER_KEY);
      linkingResultRef.current = null;
      busyRef.current = false;
    }, 900);
  }, []);

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
      const msg = String(error?.message || t("postPurchase.signinFailed"));
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user cancelled")) {
        gotoIdle();
      } else {
        setError(msg, "auth");
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
      const msg = String(error?.message || t("postPurchase.signinFailed"));
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user cancelled")) {
        gotoIdle();
      } else {
        setError(msg, "auth");
      }
    }
  }, [onAuthenticateEmail, handleAuthResult, gotoIdle, setError]);

  /** Stage-aware retry — resumes the failed stage without repeating OAuth. */
  const retry = useCallback(() => {
    const stage = failedStageRef.current;
    failedStageRef.current = null;
    if (!stage) {
      gotoIdle();
      return;
    }
    busyRef.current = true;
    setErrorMessage(null);

    if (stage === "auth") {
      if (activeProvider) {
        void authenticate(activeProvider);
      } else {
        gotoIdle();
      }
    } else {
      // linking / verify / migrate — resume from the stored userId.
      const userId = retryUserIdRef.current;
      if (!userId) {
        gotoIdle();
        return;
      }
      void handleAuthResult(userId);
    }
  }, [activeProvider, authenticate, gotoIdle, handleAuthResult]);

  /** Resume linking when session already exists (relaunch after auth). */
  const resumeLinking = useCallback(async (userId: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase("linking_revenuecat");
    setErrorMessage(null);
    await handleAuthResult(userId);
  }, [handleAuthResult]);

  const resumeFirstAction = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = false;
    setPhase("first_action");
  }, []);

  return {
    phase,
    activeProvider,
    errorMessage,
    authenticate,
    authenticateEmail,
    retry,
    resumeLinking,
    resumeFirstAction,
    completeFirstAction,
    gotoIdle,
  };
}
