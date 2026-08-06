/**
 * PostPurchaseAuthContainer — renders the PostPurchaseAuthScreen wired to
 * the usePostPurchaseAuthCoordinator. Only mounted when post_purchase_auth
 * is the active acquisition phase.
 *
 * On mount with an existing session, auto-resumes linking without showing
 * provider buttons (relaunch after partial completion).
 */
import React, { useEffect } from "react";
import type { CustomerInfo } from "react-native-purchases";
import type { AuthProvider } from "../auth/types";
import { PostPurchaseAuthScreen } from "./PostPurchaseAuthScreen";
import { usePostPurchaseAuthCoordinator, type LinkingResult, type AuthCallback, type EmailAuthCallback } from "./PostPurchaseAuthCoordinator";

type Props = {
  sessionUserId: string | null;
  anonymousCustomerInfo: CustomerInfo | null;
  onAuthenticate: AuthCallback;
  onAuthenticateEmail: EmailAuthCallback;
  onSignUpWithEmail?: (email: string, password: string) => Promise<string | null>;
  onResetPassword?: (email: string) => Promise<void>;
  onLinkingComplete: (result: LinkingResult) => void;
};

export function PostPurchaseAuthContainer({
  sessionUserId,
  anonymousCustomerInfo,
  onAuthenticate,
  onAuthenticateEmail,
  onSignUpWithEmail,
  onResetPassword,
  onLinkingComplete,
}: Props) {
  const {
    phase,
    activeProvider,
    errorMessage,
    authenticate,
    authenticateEmail,
    retry,
    resumeLinking,
  } = usePostPurchaseAuthCoordinator({
    anonymousCustomerInfo,
    onAuthenticate,
    onAuthenticateEmail,
    onLinkingComplete,
  });

  // On mount: if session already exists AND not in visual-preview mode,
  // auto-resume linking (relaunch after partial auth).
  // Visual preview skips all real linking — only renders the UI.
  useEffect(() => {
    if (sessionUserId && phase === "idle" && anonymousCustomerInfo) {
      void resumeLinking(sessionUserId);
    }
  }, [sessionUserId, anonymousCustomerInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  // On success: let animation play, then clear marker via parent callback.
  // The parent clears the marker in onLinkingComplete; the coordinator
  // enters "success" phase first, the screen shows the checkmark animation,
  // and the parent's callback fires synchronously — but the marker is only
  // cleared AFTER the callback, so acquisition stays on post_purchase_auth
  // until the next render cycle. The success animation is visible because
  // the screen is still mounted when phase === "success".
  // A brief delay ensures the animation is visible before navigation.
  useEffect(() => {
    if (phase === "success") {
      // onLinkingComplete already fired — marker is cleared by parent.
      // This delay allows the success animation to render before acquisition
      // routes to Main on the next hydration cycle.
    }
  }, [phase]);

  return (
    <PostPurchaseAuthScreen
      phase={phase}
      activeProvider={activeProvider}
      errorMessage={errorMessage}
      onSignIn={(provider: AuthProvider) => { void authenticate(provider); }}
      onSignInWithEmail={(email, password) => { void authenticateEmail(email, password); }}
      onSignUpWithEmail={onSignUpWithEmail}
      onResetPassword={onResetPassword}
      onRetry={() => { retry(); }}
    />
  );
}
