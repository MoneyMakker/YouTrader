/**
 * PostPurchaseAuthContainer — renders the PostPurchaseAuthScreen wired to
 * the usePostPurchaseAuthCoordinator. Only mounted when post_purchase_auth
 * is the active acquisition phase.
 */
import React from "react";
import type { CustomerInfo } from "react-native-purchases";
import type { AuthProvider } from "../auth/types";
import { PostPurchaseAuthScreen } from "./PostPurchaseAuthScreen";
import { usePostPurchaseAuthCoordinator, type LinkingResult, type AuthCallback, type EmailAuthCallback } from "./PostPurchaseAuthCoordinator";

type Props = {
  anonymousCustomerInfo: CustomerInfo | null;
  onAuthenticate: AuthCallback;
  onAuthenticateEmail: EmailAuthCallback;
  onLinkingComplete: (result: LinkingResult) => void;
};

export function PostPurchaseAuthContainer({
  anonymousCustomerInfo,
  onAuthenticate,
  onAuthenticateEmail,
  onLinkingComplete,
}: Props) {
  const {
    phase,
    activeProvider,
    errorMessage,
    authenticate,
    authenticateEmail,
    retry,
  } = usePostPurchaseAuthCoordinator({
    anonymousCustomerInfo,
    onAuthenticate,
    onAuthenticateEmail,
    onLinkingComplete,
  });

  return (
    <PostPurchaseAuthScreen
      phase={phase}
      activeProvider={activeProvider}
      errorMessage={errorMessage}
      onSignIn={(provider: AuthProvider) => { void authenticate(provider); }}
      onSignInWithEmail={(email, password) => { void authenticateEmail(email, password); }}
      onRetry={() => { retry(); }}
    />
  );
}
