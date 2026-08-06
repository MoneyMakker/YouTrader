/**
 * PostPurchaseAuthScreen — premium native iOS post-purchase authentication.
 *
 * Shown after an anonymous purchase completes with verified active entitlement.
 * Never shown without confirmed Pro entitlement for the anonymous RevenueCat customer.
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import { CheckCircle, Lock, Mail } from "lucide-react-native";
import type { AuthProvider } from "../auth/types";
import type { PostPurchaseAuthPhase } from "./types";
import { C } from "../theme/colors";
import { t } from "../i18n";
import { GoogleGIcon } from "./GoogleGIcon";
import { TradingMotif } from "./TradingMotif";

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

function SuccessAnimation({ visible, reduceMotion }: { visible: boolean; reduceMotion: boolean }) {
  const scale = useRef(new Animated.Value(visible ? 1 : 0.85)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 150, useNativeDriver: true }).start();
      scale.setValue(1);
      return;
    }
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, reduceMotion]);

  if (!visible) return null;
  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <CheckCircle size={22} color={LIME} strokeWidth={2.6} fill="rgba(163,255,18,0.22)" />
    </Animated.View>
  );
}

// ── Breathing pulse around the brand mark ────────────────────────────────────

function BrandPulse({ reduceMotion }: { reduceMotion: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.22] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.halo, { transform: [{ scale: haloScale }], opacity: haloOpacity }]}
    />
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
  const [reduceMotion, setReduceMotion] = useState(false);

  // Keep the official Apple control visible on iOS even when the simulator
  // cannot complete Apple auth; the callback still handles availability.
  const showApple = true;
  // Google always shown — browser OAuth fallback exists when native sign-in is not configured.
  const showGoogle = true;
  const busy = phase !== "idle" && phase !== "error_recoverable";
  const isSuccess = phase === "success";
  const isLinking =
    phase === "linking_revenuecat" || phase === "migrating_local_data" || phase === "verifying_entitlement";

  useEffect(() => {
    void (async () => {
      const enabled = await AccessibilityInfo.isReduceMotionEnabled();
      setReduceMotion(enabled);
    })();
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      setReduceMotion(enabled);
    });
    return () => { sub.remove(); };
  }, []);

  const providerLoading = useCallback((provider: string) => {
    if (isSuccess) return null;
    if (isLinking) return t("loading");
    switch (provider) {
      case "apple": return phase === "authenticating_apple" ? t("loading") : null;
      case "google": return phase === "authenticating_google" ? t("loading") : null;
      case "email": return phase === "authenticating_email" ? t("loading") : null;
    }
    return null;
  }, [phase, isSuccess, isLinking]);

  const handleEmailSubmit = useCallback(async () => {
    const e = email.trim();
    if (!e) { setEmailError(t("postPurchase.emailRequired")); return; }
    if (!e.includes("@")) { setEmailError(t("postPurchase.emailInvalid")); return; }

    if (emailMode === "forgot" && onResetPassword) {
      setEmailError("");
      Keyboard.dismiss();
      try {
        await onResetPassword(e);
        setEmailConfirmSent(true);
      } catch (err: any) {
        setEmailError(err?.message || t("postPurchase.passwordResetFailed"));
      }
      return;
    }

    if (emailMode === "signup" && onSignUpWithEmail) {
      if (!password) { setEmailError(t("postPurchase.passwordRequired")); return; }
      if (confirmPassword && password !== confirmPassword) { setEmailError(t("postPurchase.passwordMismatch")); return; }
      setEmailError("");
      Keyboard.dismiss();
      try {
        const result = await onSignUpWithEmail(e, password);
        if (result === "confirmation_sent") {
          setEmailConfirmSent(true);
        }
      } catch (err: any) {
        setEmailError(err?.message || t("postPurchase.createAccountFailed"));
      }
      return;
    }

    if (!password) { setEmailError(t("postPurchase.passwordRequired")); return; }
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

  useEffect(() => {
    if (isSuccess) {
      AccessibilityInfo.announceForAccessibility(t("postPurchase.successAnnounce"));
    }
  }, [isSuccess]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        {/* ── DECORATIVE LAYER: all pointerEvents="none" ── */}
        <View pointerEvents="none" style={styles.decorativeLayer}>
          <View style={styles.glowOuter} />
          <View style={styles.glowInner} />
          <View style={styles.brandCenter}>
            <BrandPulse reduceMotion={reduceMotion} />
            <View style={[styles.brandCard, COMPACT && styles.brandCardCompact]}>
              <View style={styles.brandInner}>
                <Text style={styles.brandY} maxFontSizeMultiplier={1}>Y</Text>
              </View>
              <View style={styles.checkmarkBadge}>
                <SuccessAnimation visible={isSuccess} reduceMotion={reduceMotion} />
                {!isSuccess ? <CheckCircle size={15} color={LIME} strokeWidth={2.6} /> : null}
              </View>
            </View>
            <View style={[styles.motifWrap, COMPACT && styles.motifWrapCompact]}>
              <TradingMotif reduceMotion={reduceMotion} />
            </View>
          </View>
        </View>

        {/* ── INTERACTIVE LAYER: content + buttons ── */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
          <ScrollView
            contentContainerStyle={[styles.scroll, COMPACT && styles.scrollCompact]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Spacer matching decorative height */}
            <View style={styles.decorativeSpacer} />

            {/* Activation badge — only when entitlement is confirmed */}
            <ActivationBadge />

            {/* Heading */}
            <Text style={[styles.heading, COMPACT && styles.headingCompact]} maxFontSizeMultiplier={1.15}>
              {isSuccess ? t("postPurchase.successHeading") : t("postPurchase.heading")}
            </Text>

            {/* Description or linking phases */}
            {isLinking ? (
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
            {!isSuccess && !isLinking ? (
              <View style={styles.buttonStack}>
                {showApple ? (
                  <View style={styles.appleButtonWrap} testID="post-purchase-apple-button">
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
                    testID="post-purchase-google-button"
                    style={({ pressed }) => [
                      styles.authButton,
                      styles.neutralButton,
                      busy && styles.authButtonDisabled,
                      pressed && !busy && styles.authButtonPressed,
                    ]}
                  >
                    {phase === "authenticating_google" ? (
                      <ActivityIndicator size="small" color={LIME} />
                    ) : (
                      <GoogleGIcon size={20} />
                    )}
                    <Text style={styles.authButtonLabel} maxFontSizeMultiplier={1.15}>
                      {providerLoading("google") || t("authGoogle")}
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => { setEmailModalOpen(true); setEmailError(""); }}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={t("authEmail")}
                  testID="post-purchase-email-button"
                  style={({ pressed }) => [
                    styles.authButton,
                    styles.neutralButton,
                    busy && styles.authButtonDisabled,
                    pressed && !busy && styles.authButtonPressed,
                  ]}
                >
                  {phase === "authenticating_email" ? (
                    <ActivityIndicator size="small" color={LIME} />
                  ) : (
                    <Mail size={18} color={C.sub} strokeWidth={2.2} />
                  )}
                  <Text style={styles.authButtonLabel} maxFontSizeMultiplier={1.15}>
                    {providerLoading("email") || t("authEmail")}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Privacy reassurance */}
            <View style={styles.reassuranceRow}>
              <Lock size={12} color={C.sub} strokeWidth={2} />
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
          <View style={styles.modalOverlay} testID="post-purchase-email-modal">
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
                    <Text style={styles.modalSubmitText} maxFontSizeMultiplier={1.15}>{t("postPurchase.okLabel")}</Text>
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
                    testID="post-purchase-email-input"
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
                          placeholder={t("postPurchase.confirmPassword")}
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
                      accessibilityLabel={emailMode === "forgot" ? t("postPurchase.emailSendLink") : t("postPurchase.continueEmail")}
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
  safe: { flex: 1, backgroundColor: "#06080C" },
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: "#06080C" },

  // ── Decorative layer (all pointerEvents="none") ──
  decorativeLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    alignItems: "center",
    overflow: "hidden",
    paddingTop: 40,
  },
  brandCenter: { position: "relative", alignItems: "center" },
  decorativeSpacer: { height: 160 },

  glowOuter: {
    position: "absolute",
    top: 40,
    left: SCREEN_WIDTH * 0.225,
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.55,
    borderRadius: SCREEN_WIDTH * 0.28,
    backgroundColor: "rgba(163,255,18,0.038)",
  },
  glowInner: {
    position: "absolute",
    top: 88,
    left: SCREEN_WIDTH * 0.34,
    width: SCREEN_WIDTH * 0.32,
    height: SCREEN_WIDTH * 0.32,
    borderRadius: SCREEN_WIDTH * 0.16,
    backgroundColor: "rgba(163,255,18,0.045)",
  },
  halo: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(163,255,18,0.12)",
    top: -12,
  },

  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28, paddingVertical: 40, gap: 18 },
  scrollCompact: { paddingHorizontal: 22, paddingVertical: 20, gap: 12 },

  brandCard: {
    width: 72, height: 72, borderRadius: 22, borderWidth: 1,
    borderColor: "rgba(163,255,18,0.26)",
    backgroundColor: "rgba(13,17,23,0.92)",
    alignItems: "center", justifyContent: "center",
    ...Platform.select({ ios: { shadowColor: "#A3FF12", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } } }),
  },
  brandCardCompact: { width: 64, height: 64, borderRadius: 19 },
  brandInner: {
    width: 52, height: 52, borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(163,255,18,0.16)", backgroundColor: "rgba(163,255,18,0.05)",
    alignItems: "center", justifyContent: "center",
  },
  brandY: { color: LIME, fontSize: 28, fontWeight: "900", letterSpacing: 0.3 },
  checkmarkBadge: {
    position: "absolute", bottom: -5, right: -5, width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#0B0E13", borderWidth: 1, borderColor: "rgba(163,255,18,0.38)",
    alignItems: "center", justifyContent: "center",
  },
  motifWrap: { marginTop: 10 },
  motifWrapCompact: { marginTop: 4, transform: [{ scale: 0.88 }] },

  activationBadge: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 15, paddingVertical: 7, borderRadius: 100,
    borderWidth: 1, borderColor: "rgba(163,255,18,0.22)",
    backgroundColor: "rgba(163,255,18,0.07)",
  },
  activationBadgeText: { color: LIME, fontSize: 12.5, lineHeight: 17, fontWeight: "800", letterSpacing: 0.5 },

  heading: { color: C.text, fontSize: 34, lineHeight: 40, fontWeight: "800", textAlign: "center", letterSpacing: 0.1, maxWidth: 320 },
  headingCompact: { fontSize: 29, lineHeight: 34 },
  description: { color: C.sub, fontSize: 16, lineHeight: 23, fontWeight: "500", textAlign: "center", maxWidth: 330 },
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

  buttonStack: { width: "100%", maxWidth: 340, gap: 12, marginTop: 6 },
  appleButtonWrap: { height: BUTTON_HEIGHT, borderRadius: BUTTON_RADIUS, overflow: "hidden" },
  appleButton: { width: "100%", height: BUTTON_HEIGHT },
  authButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: BUTTON_HEIGHT, borderRadius: BUTTON_RADIUS, borderWidth: 1 },
  neutralButton: { borderColor: "rgba(255,255,255,0.13)", backgroundColor: "rgba(255,255,255,0.045)" },
  authButtonDisabled: { opacity: 0.5 },
  authButtonPressed: { backgroundColor: "rgba(255,255,255,0.09)" },
  authButtonLabel: { fontSize: 16, fontWeight: "800", color: C.text },

  reassuranceRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 },
  reassuranceText: { color: C.sub, fontSize: 12.5, lineHeight: 17, fontWeight: "600", textAlign: "center" },
  legalText: { color: C.muted, fontSize: 11.5, lineHeight: 17, fontWeight: "600", textAlign: "center", marginTop: 2, maxWidth: 310 },
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
