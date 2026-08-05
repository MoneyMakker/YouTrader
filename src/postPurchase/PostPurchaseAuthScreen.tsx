/**
 * PostPurchaseAuthScreen — premium iOS post-purchase authentication.
 *
 * Shown after an anonymous purchase completes with verified active entitlement.
 * The screen is never shown without confirmed Pro entitlement for the anonymous
 * RevenueCat customer.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AccessibilityInfo,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import { CheckCircle, Lock, Mail } from "lucide-react-native";
import type { AuthProvider } from "../auth/types";
import type { PostPurchaseAuthPhase } from "./types";
import { C } from "../theme/colors";
import { t } from "../i18n";
import { enableNativeAppleSignIn, enableNativeGoogleSignIn } from "../config/appConfig";

type Props = {
  phase: PostPurchaseAuthPhase;
  activeProvider: AuthProvider | null;
  errorMessage: string | null;
  onSignIn: (provider: AuthProvider) => void;
  onSignInWithEmail: (email: string, password: string) => void;
  onSignUpWithEmail?: (email: string, password: string) => Promise<string | null>;
  onResetPassword?: (email: string) => Promise<void>;
  onRetry: () => void;
};

const LIME = "#A3FF12";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COMPACT = SCREEN_WIDTH < 375;
const BUTTON_HEIGHT = 56;
const BUTTON_RADIUS = 16;

// ── Success checkmark animation ─────────────────────────────────────────────

function SuccessAnimation({ visible }: { visible: boolean }) {
  const scale = useRef(new Animated.Value(visible ? 1 : 0.85)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <CheckCircle size={24} color={LIME} strokeWidth={2.8} fill="rgba(163,255,18,0.22)" />
    </Animated.View>
  );
}

// ── Activation badge ─────────────────────────────────────────────────────────

function ActivationBadge() {
  return (
    <View style={styles.activationBadge} accessibilityRole="text">
      <CheckCircle size={14} color={LIME} strokeWidth={2.4} />
      <Text style={styles.activationBadgeText} maxFontSizeMultiplier={1.15}>
        {t("postPurchase.activatedBadge")}
      </Text>
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function PostPurchaseAuthScreen({
  phase,
  activeProvider,
  errorMessage,
  onSignIn,
  onSignInWithEmail,
  onSignUpWithEmail,
  onResetPassword,
  onRetry,
}: Props) {
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailMode, setEmailMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  const showApple = enableNativeAppleSignIn ?? true;
  const showGoogle = enableNativeGoogleSignIn ?? true;
  const busy = phase !== "idle" && phase !== "error_recoverable";
  const isSuccess = phase === "success";

  const providerLoading = useCallback((provider: string) => {
    if (isSuccess) return null;
    if (phase === "linking_revenuecat" || phase === "migrating_local_data" || phase === "verifying_entitlement") {
      return t("loading");
    }
    switch (provider) {
      case "apple": return phase === "authenticating_apple" ? t("loading") : null;
      case "google": return phase === "authenticating_google" ? t("loading") : null;
      case "email": return phase === "authenticating_email" ? t("loading") : null;
    }
    return null;
  }, [phase, isSuccess]);

  const handleEmailSubmit = useCallback(async () => {
    const e = email.trim();
    if (!e) { setEmailError("Email is required."); return; }
    if (!e.includes("@")) { setEmailError("Enter a valid email."); return; }

    if (emailMode === "forgot" && onResetPassword) {
      setEmailError("");
      Keyboard.dismiss();
      try {
        await onResetPassword(e);
        setEmailConfirmSent(true);
      } catch (err: any) {
        setEmailError(err?.message || "Password reset failed.");
      }
      return;
    }

    if (emailMode === "signup" && onSignUpWithEmail) {
      if (!password) { setEmailError("Password is required."); return; }
      if (confirmPassword && password !== confirmPassword) { setEmailError("Passwords do not match."); return; }
      setEmailError("");
      Keyboard.dismiss();
      try {
        const result = await onSignUpWithEmail(e, password);
        if (result === "confirmation_sent") {
          setEmailConfirmSent(true);
        }
      } catch (err: any) {
        setEmailError(err?.message || "Create account failed.");
      }
      return;
    }

    // signin
    if (!password) { setEmailError("Password is required."); return; }
    setEmailError("");
    Keyboard.dismiss();
    onSignInWithEmail(e, password);
  }, [email, password, confirmPassword, emailMode, onSignInWithEmail, onSignUpWithEmail, onResetPassword]);

  const closeEmailModal = useCallback(() => {
    setEmailModalOpen(false);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setEmailError("");
    setEmailConfirmSent(false);
    setEmailMode("signin");
  }, []);

  const handleApplePress = useCallback(() => {
    if (busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSignIn("apple");
  }, [busy, onSignIn]);

  const handleGooglePress = useCallback(() => {
    if (busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSignIn("google");
  }, [busy, onSignIn]);

  const openTermsOfService = useCallback(() => {
    void Linking.openURL("https://youtrader.app/terms");
  }, []);
  const openPrivacyPolicy = useCallback(() => {
    void Linking.openURL("https://youtrader.app/privacy");
  }, []);

  // Announce loading / success for accessibility
  useEffect(() => {
    if (isSuccess) {
      AccessibilityInfo.announceForAccessibility("Account linked. Entering YouTrader.");
    }
  }, [isSuccess]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        {/* Green radial glow behind brand symbol */}
        <View style={styles.glowContainer}>
          <View style={styles.glow} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
          <ScrollView
            contentContainerStyle={[styles.scroll, COMPACT && styles.scrollCompact]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Brand symbol — Y + checkmark */}
            <View style={styles.brandWrap}>
              <View style={styles.brandCircle}>
                <Text style={styles.brandY} maxFontSizeMultiplier={1}>Y</Text>
                <View style={styles.checkmarkBadge}>
                  <SuccessAnimation visible={isSuccess} />
                  {!isSuccess ? <CheckCircle size={16} color={LIME} strokeWidth={2.8} /> : null}
                </View>
              </View>
            </View>

            {/* Activation badge — only when entitlement is confirmed */}
            <ActivationBadge />

            {/* Heading */}
            <Text style={[styles.heading, COMPACT && styles.headingCompact]} maxFontSizeMultiplier={1.15}>
              {isSuccess ? t("postPurchase.successHeading") : t("postPurchase.heading")}
            </Text>

            {/* Description or linking phases */}
            {phase === "linking_revenuecat" || phase === "migrating_local_data" || phase === "verifying_entitlement" ? (
              <View style={styles.linkingRow}>
                <ActivityIndicator size="small" color={LIME} />
                <Text style={styles.linkingText} maxFontSizeMultiplier={1.15}>
                  {phase === "linking_revenuecat" ? t("postPurchase.linkingLinking")
                   : phase === "verifying_entitlement" ? t("postPurchase.linkingVerifying")
                   : t("postPurchase.linkingMigrating")}
                </Text>
              </View>
            ) : (
              <Text style={styles.description} maxFontSizeMultiplier={1.25}>
                {t("postPurchase.description")}
              </Text>
            )}

            {/* Error with retry */}
            {phase === "error_recoverable" && errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText} maxFontSizeMultiplier={1.2}>{errorMessage}</Text>
                <Pressable
                  onPress={onRetry}
                  accessibilityRole="button"
                  accessibilityLabel={t("retry") || "Retry"}
                  style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
                >
                  <Text style={styles.retryText} maxFontSizeMultiplier={1.15}>
                    {t("retry") || "Retry"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Auth buttons — hidden during linking phases and success */}
            {!isSuccess && phase !== "linking_revenuecat" && phase !== "migrating_local_data" && phase !== "verifying_entitlement" ? (
              <View style={styles.buttonStack}>
                {showApple ? (
                  <View style={styles.appleButtonWrap}>
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                      cornerRadius={BUTTON_RADIUS}
                      style={styles.appleButton}
                      onPress={handleApplePress}
                    />
                  </View>
                ) : null}

                {showGoogle ? (
                  <Pressable
                    onPress={handleGooglePress}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={t("authGoogle")}
                    style={({ pressed }) => [
                      styles.authButton,
                      styles.googleButton,
                      busy && styles.authButtonDisabled,
                      pressed && !busy && styles.authButtonPressed,
                    ]}
                  >
                    {phase === "authenticating_google" ? (
                      <ActivityIndicator size="small" color={LIME} />
                    ) : (
                      <Text style={styles.googleIcon}>G</Text>
                    )}
                    <Text style={[styles.authButtonLabel, styles.googleLabel]} maxFontSizeMultiplier={1.15}>
                      {providerLoading("google") || t("authGoogle")}
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => { setEmailModalOpen(true); setEmailError(""); }}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={t("authEmail")}
                  style={({ pressed }) => [
                    styles.authButton,
                    styles.emailButton,
                    busy && styles.authButtonDisabled,
                    pressed && !busy && styles.authButtonPressed,
                  ]}
                >
                  {phase === "authenticating_email" ? (
                    <ActivityIndicator size="small" color={LIME} />
                  ) : (
                    <Mail size={18} color={C.sub} strokeWidth={2.2} />
                  )}
                  <Text style={[styles.authButtonLabel, styles.emailLabel]} maxFontSizeMultiplier={1.15}>
                    {providerLoading("email") || t("authEmail")}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Privacy reassurance */}
            <View style={styles.reassuranceRow}>
              <Lock size={12} color={C.muted} strokeWidth={2} />
              <Text style={styles.reassuranceText} maxFontSizeMultiplier={1.2}>
                {t("postPurchase.reassurance")}
              </Text>
            </View>

            {/* Legal */}
            <Text style={styles.legalText} maxFontSizeMultiplier={1.2}>
              {t("postPurchase.legalPrefix")}{" "}
              <Text style={styles.legalLink} onPress={openTermsOfService}>
                {t("termsOfService")}
              </Text>
              {" "}{t("and")}{" "}
              <Text style={styles.legalLink} onPress={openPrivacyPolicy}>
                {t("privacyPolicy")}
              </Text>
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Email modal */}
        {emailModalOpen && !isSuccess ? (
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!busy) closeEmailModal(); }} />
            <View style={styles.modalCard}>
              {emailConfirmSent ? (
                <>
                  <Text style={styles.modalTitle} maxFontSizeMultiplier={1.15}>
                    {emailMode === "forgot" ? t("postPurchase.emailCheckEmail") : t("postPurchase.emailConfirmEmail")}
                  </Text>
                  <Text style={styles.description} maxFontSizeMultiplier={1.2}>
                    {emailMode === "forgot"
                      ? t("postPurchase.emailResetBody")
                      : t("postPurchase.emailCheckBody")}
                  </Text>
                  <Pressable
                    onPress={closeEmailModal}
                    style={({ pressed }) => [styles.modalSubmit, pressed && styles.modalSubmitPressed]}
                  >
                    <Text style={styles.modalSubmitText} maxFontSizeMultiplier={1.15}>OK</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle} maxFontSizeMultiplier={1.15}>
                    {emailMode === "signup" ? t("postPurchase.emailCreateAccount") : emailMode === "forgot" ? t("postPurchase.emailForgotPassword") : t("authEmail")}
                  </Text>
                  {emailError ? (
                    <Text style={styles.emailErrorText} maxFontSizeMultiplier={1.15}>{emailError}</Text>
                  ) : null}
                  <TextInput
                    style={styles.modalInput}
                    placeholder={t("authEmail")}
                    placeholderTextColor={C.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    value={email}
                    onChangeText={(txt) => { setEmail(txt); setEmailError(""); }}
                    editable={!busy}
                  />
                  {emailMode !== "forgot" ? (
                    <>
                      <TextInput
                        style={styles.modalInput}
                        placeholder={t("accountPasswordLabel")}
                        placeholderTextColor={C.muted}
                        secureTextEntry
                        textContentType="password"
                        value={password}
                        onChangeText={(txt) => { setPassword(txt); setEmailError(""); }}
                        editable={!busy}
                      />
                      {emailMode === "signup" ? (
                        <TextInput
                          style={styles.modalInput}
                          placeholder="Confirm password"
                          placeholderTextColor={C.muted}
                          secureTextEntry
                          textContentType="newPassword"
                          value={confirmPassword}
                          onChangeText={(txt) => { setConfirmPassword(txt); setEmailError(""); }}
                          editable={!busy}
                        />
                      ) : null}
                    </>
                  ) : null}
                  <View style={styles.modalActions}>
                    <Pressable
                      onPress={closeEmailModal}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={t("cancel") || "Cancel"}
                      style={({ pressed }) => [styles.modalCancel, pressed && styles.modalCancelPressed]}
                    >
                      <Text style={styles.modalCancelText} maxFontSizeMultiplier={1.15}>
                        {t("cancel") || "Cancel"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { void handleEmailSubmit(); }}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={emailMode === "forgot" ? "Send Reset Link" : t("postPurchase.continueEmail")}
                      style={({ pressed }) => [styles.modalSubmit, busy && styles.modalSubmitDisabled, pressed && !busy && styles.modalSubmitPressed]}
                    >
                      {phase === "authenticating_email" ? (
                        <ActivityIndicator size="small" color={LIME} />
                      ) : (
                        <Text style={styles.modalSubmitText} maxFontSizeMultiplier={1.15}>
                          {emailMode === "forgot" ? t("postPurchase.emailSendLink") : t("postPurchase.continueEmail")}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                  <View style={styles.emailAltLinks}>
                    {emailMode === "signin" ? (
                      <>
                        <Text style={styles.emailAltLink} onPress={() => { setEmailMode("signup"); setEmailError(""); setPassword(""); setConfirmPassword(""); }}>
                          {t("postPurchase.emailCreateLink")}
                        </Text>
                        <Text style={styles.emailAltSeparator}> · </Text>
                        <Text style={styles.emailAltLink} onPress={() => { setEmailMode("forgot"); setEmailError(""); setPassword(""); }}>
                          {t("postPurchase.emailForgotLink")}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.emailAltLink} onPress={() => { setEmailMode("signin"); setEmailError(""); setPassword(""); setConfirmPassword(""); }}>
                        {t("postPurchase.emailBackToSignIn")}
                      </Text>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080A0E" },
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: "#080A0E" },
  glowContainer: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  glow: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: SCREEN_WIDTH * 0.45,
    backgroundColor: "rgba(163,255,18,0.06)",
    transform: [{ translateY: -120 }],
  },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28, paddingVertical: 48, gap: 20 },
  scrollCompact: { paddingHorizontal: 22, paddingVertical: 32, gap: 16 },
  brandWrap: { alignItems: "center", justifyContent: "center", marginBottom: 4 },
  brandCircle: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 1.5, borderColor: "rgba(163,255,18,0.28)",
    backgroundColor: "rgba(8,10,14,0.85)",
    alignItems: "center", justifyContent: "center", position: "relative",
  },
  brandY: { color: LIME, fontSize: 34, fontWeight: "900", letterSpacing: 0.5 },
  checkmarkBadge: {
    position: "absolute", bottom: -4, right: -4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "rgba(8,10,14,0.95)",
    borderWidth: 1, borderColor: "rgba(163,255,18,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  activationBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
    borderWidth: 1, borderColor: "rgba(163,255,18,0.22)",
    backgroundColor: "rgba(163,255,18,0.08)",
  },
  activationBadgeText: { color: LIME, fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.4 },
  heading: { color: C.text, fontSize: 38, lineHeight: 44, fontWeight: "800", textAlign: "center", letterSpacing: 0.2, maxWidth: 340 },
  headingCompact: { fontSize: 32, lineHeight: 38 },
  description: { color: C.sub, fontSize: 17, lineHeight: 24, fontWeight: "600", textAlign: "center", maxWidth: 340 },
  linkingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  linkingText: { color: C.sub, fontSize: 15, fontWeight: "700" },
  errorBox: {
    width: "100%", maxWidth: 340, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,59,95,0.25)",
    backgroundColor: "rgba(255,59,95,0.08)", alignItems: "center", gap: 10,
  },
  errorText: { color: C.sub, fontSize: 14, lineHeight: 19, fontWeight: "700", textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(163,255,18,0.35)", backgroundColor: "rgba(163,255,18,0.10)" },
  retryBtnPressed: { backgroundColor: "rgba(163,255,18,0.18)" },
  retryText: { color: LIME, fontSize: 14, fontWeight: "800" },
  buttonStack: { width: "100%", maxWidth: 340, gap: 12, marginTop: 4 },
  appleButtonWrap: { height: BUTTON_HEIGHT, borderRadius: BUTTON_RADIUS, overflow: "hidden" },
  appleButton: { width: "100%", height: BUTTON_HEIGHT },
  authButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: BUTTON_HEIGHT, borderRadius: BUTTON_RADIUS, borderWidth: 1 },
  googleButton: { borderColor: "rgba(255,255,255,0.14)", backgroundColor: "#1A1D24" },
  emailButton: { borderColor: "rgba(255,255,255,0.14)", backgroundColor: "#1A1D24" },
  authButtonDisabled: { opacity: 0.5 },
  authButtonPressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  googleIcon: { color: C.text, fontSize: 19, fontWeight: "900", width: 24, textAlign: "center" },
  authButtonLabel: { fontSize: 16, fontWeight: "800" },
  googleLabel: { color: C.text },
  emailLabel: { color: C.text },
  reassuranceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  reassuranceText: { color: C.muted, fontSize: 12, lineHeight: 17, fontWeight: "600", textAlign: "center" },
  legalText: { color: C.muted, fontSize: 11, lineHeight: 16, fontWeight: "600", textAlign: "center", marginTop: 2, maxWidth: 300 },
  legalLink: { color: C.sub, textDecorationLine: "underline" },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  modalCard: { width: "100%", maxWidth: 340, backgroundColor: "#0D1117", borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", padding: 24, gap: 14 },
  modalTitle: { color: C.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  emailErrorText: { color: C.sub, fontSize: 13, fontWeight: "700", textAlign: "center", paddingHorizontal: 4 },
  modalInput: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)", paddingHorizontal: 16, color: C.text, fontSize: 16, fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalCancel: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  modalCancelPressed: { backgroundColor: "rgba(255,255,255,0.05)" },
  modalCancelText: { color: C.sub, fontSize: 15, fontWeight: "800" },
  modalSubmit: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: "rgba(163,255,18,0.35)", backgroundColor: "rgba(163,255,18,0.10)", alignItems: "center", justifyContent: "center" },
  modalSubmitDisabled: { opacity: 0.5 },
  modalSubmitPressed: { backgroundColor: "rgba(163,255,18,0.18)" },
  modalSubmitText: { color: LIME, fontSize: 15, fontWeight: "800" },
  emailAltLinks: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  emailAltLink: { color: C.sub, fontSize: 13, fontWeight: "700" },
  emailAltSeparator: { color: C.muted, fontSize: 13, fontWeight: "600" },
});
