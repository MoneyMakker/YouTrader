/**
 * PostPurchaseAuthBridge — manages UI state for the PostPurchaseAuthScreen
 * and dispatches auth calls. Linking is handled by the parent via
 * session change detection (onAuthStateChange).
 */
import React, { useCallback, useState } from "react";
import type { AuthProvider } from "../auth/types";
import type { PostPurchaseAuthPhase } from "./types";
import { PostPurchaseAuthScreen } from "./PostPurchaseAuthScreen";

type Props = {
  onSignInWithApple: () => Promise<void>;
  onSignInWithGoogle: () => Promise<void>;
  onSignInWithEmail: (email: string, password: string) => Promise<void>;
};

export function PostPurchaseAuthBridge({
  onSignInWithApple,
  onSignInWithGoogle,
  onSignInWithEmail,
}: Props) {
  const [phase, setPhase] = useState<PostPurchaseAuthPhase>("idle");
  const [activeProvider, setActiveProvider] = useState<AuthProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const busy = phase !== "idle" && phase !== "error_recoverable";

  const wrapAuth = useCallback(async (
    provider: AuthProvider,
    fn: () => Promise<void>,
  ) => {
    if (busy) return;
    const providerPhase: Record<AuthProvider, PostPurchaseAuthPhase> = {
      apple: "authenticating_apple",
      google: "authenticating_google",
      email: "authenticating_email",
    };
    setPhase(providerPhase[provider]);
    setActiveProvider(provider);
    setErrorMessage(null);
    try {
      await fn();
      // Auth dispatched — parent handles linking via session change.
      // Keep showing loading until the parent redirects away.
    } catch (e: any) {
      const msg = String(e?.message || "Sign-in failed");
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user cancelled")) {
        setPhase("idle");
        setActiveProvider(null);
      } else {
        setPhase("error_recoverable");
        setErrorMessage(msg);
      }
    }
  }, [busy]);

  const handleSignIn = useCallback((provider: AuthProvider) => {
    switch (provider) {
      case "apple": void wrapAuth("apple", onSignInWithApple); break;
      case "google": void wrapAuth("google", onSignInWithGoogle); break;
      case "email": break; // email opens modal; handled via onSignInWithEmail prop
    }
  }, [wrapAuth, onSignInWithApple, onSignInWithGoogle]);

  const handleEmailSignIn = useCallback(async (email: string, password: string) => {
    if (busy) return;
    setPhase("authenticating_email");
    setActiveProvider("email");
    setErrorMessage(null);
    try {
      await onSignInWithEmail(email, password);
    } catch (e: any) {
      const msg = String(e?.message || "Sign-in failed");
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user cancelled")) {
        setPhase("idle");
        setActiveProvider(null);
      } else {
        setPhase("error_recoverable");
        setErrorMessage(msg);
      }
    }
  }, [busy, onSignInWithEmail]);

  return (
    <PostPurchaseAuthScreen
      phase={phase}
      activeProvider={activeProvider}
      errorMessage={errorMessage}
      onSignIn={handleSignIn}
      onSignInWithEmail={handleEmailSignIn}
      onRetry={() => {
        if (activeProvider) handleSignIn(activeProvider);
      }}
    />
  );
}
