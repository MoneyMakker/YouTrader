import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  openLegalUrl,
  PRIVACY_POLICY_URL,
  TERMS_OF_USE_EULA_URL,
} from "../config/legalUrls";
import { EmailAuthModal } from "./EmailAuthModal";
import { AuthScreenBackground } from "./components/AuthScreenBackground";
import { LiveTerminalStatus } from "./components/LiveTerminalStatus";
import { PixelNeonBull } from "./components/PixelNeonBull";
import {
  AnimatedPressable,
  GlowBorderCard,
  PremiumLoadingBar,
  ShimmerPlaceholder,
} from "../components/ui/premium";
import type { AuthProvider, AuthScreenCopy, EmailAuthModalCopy } from "./types";

const C = {
  bg: "#000000",
  text: "#FFFFFF",
  sub: "#9CA3AF",
  green: "#A3FF12",
  purple: "#B026FF",
  btnBg: "#0A0C10",
};

const FADE_MS = 560;
const HERO_FALLBACK_SIZE = 88;

type Props = {
  busy: boolean;
  copy: AuthScreenCopy;
  emailModalCopy: EmailAuthModalCopy;
  showApple: boolean;
  onSignIn: (provider: AuthProvider) => void | Promise<void>;
  onSignInWithEmailPassword: (email: string, password: string) => Promise<void>;
  onSignUpWithEmailPassword: (email: string, password: string) => Promise<"confirmation_sent" | "signed_in">;
  onRequestPasswordReset: (email: string) => Promise<void>;
};

type SafeHeroBoundaryProps = {
  children: React.ReactNode;
  fallback: React.ReactNode;
};

type SafeHeroBoundaryState = {
  failed: boolean;
};

class SafeHeroBoundary extends React.PureComponent<SafeHeroBoundaryProps, SafeHeroBoundaryState> {
  state: SafeHeroBoundaryState = { failed: false };

  static getDerivedStateFromError(): SafeHeroBoundaryState {
    return { failed: true };
  }

  componentDidCatch() {
    this.setState({ failed: true });
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function StaticSafeHero() {
  return (
    <View style={styles.staticHero} accessible accessibilityRole="image">
      <View style={styles.staticHeroHornLeft} />
      <View style={styles.staticHeroHornRight} />
      <View style={styles.staticHeroFace}>
        <View style={styles.staticHeroEye} />
        <View style={styles.staticHeroEye} />
      </View>
      <View style={styles.staticHeroGlow} />
    </View>
  );
}

function AuthProviderButton({
  label,
  borderColor,
  glowColor,
  busy,
  onPress,
  delay,
}: {
  label: string;
  borderColor: string;
  glowColor: string;
  busy: boolean;
  onPress: () => void;
  delay: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }),
      ]),
    ]).start();
  }, [delay, opacity, translateY]);

  const pressIn = () => Animated.timing(glow, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  const pressOut = () => Animated.timing(glow, { toValue: 0, duration: 220, useNativeDriver: true }).start();

  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Animated.View style={[styles.btnGlow, { shadowColor: glowColor, shadowOpacity }]}>
        <AnimatedPressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          haptic
          scaleTo={0.975}
          contentStyle={[styles.providerBtn, { borderColor }, busy && styles.disabled]}
        >
          {busy ? <ActivityIndicator color={C.green} /> : <Text style={styles.providerText}>{label}</Text>}
        </AnimatedPressable>
      </Animated.View>
    </Animated.View>
  );
}

export function AuthScreen({
  busy,
  copy,
  emailModalCopy,
  showApple,
  onSignIn,
  onSignInWithEmailPassword,
  onSignUpWithEmailPassword,
  onRequestPasswordReset,
}: Props) {
  const [emailOpen, setEmailOpen] = useState(false);

  const mascotOpacity = useRef(new Animated.Value(0)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineY = useRef(new Animated.Value(12)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const appleOpacity = useRef(new Animated.Value(0)).current;
  const appleY = useRef(new Animated.Value(12)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const actionsY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(120),
      Animated.timing(mascotOpacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(280),
      Animated.parallel([
        Animated.timing(headlineOpacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
        Animated.spring(headlineY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 2 }),
      ]),
    ]).start();
    Animated.sequence([
      Animated.delay(460),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
    if (showApple) {
      Animated.sequence([
        Animated.delay(540),
        Animated.parallel([
          Animated.timing(appleOpacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
          Animated.spring(appleY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }),
        ]),
      ]).start();
    }
    Animated.sequence([
      Animated.delay(showApple ? 610 : 520),
      Animated.parallel([
        Animated.timing(actionsOpacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
        Animated.spring(actionsY, { toValue: 0, useNativeDriver: true, speed: 13, bounciness: 2 }),
      ]),
    ]).start();
  }, [
    showApple,
    headlineOpacity,
    headlineY,
    mascotOpacity,
    subtitleOpacity,
    appleOpacity,
    appleY,
    actionsOpacity,
    actionsY,
  ]);

  const buttonBaseDelay = showApple ? 640 : 560;

  return (
    <SafeAreaView style={styles.root}>
      <AuthScreenBackground />
      <View style={styles.terminalLayer} pointerEvents="none">
        <LiveTerminalStatus />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <Animated.View style={[styles.mascotSlot, { opacity: mascotOpacity }]}>
                <SafeHeroBoundary fallback={<StaticSafeHero />}>
                  <PixelNeonBull />
                </SafeHeroBoundary>
              </Animated.View>
              <Animated.Text
                style={[styles.headline, { opacity: headlineOpacity, transform: [{ translateY: headlineY }] }]}
              >
                {copy.headline}
              </Animated.Text>
              <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>{copy.subtitle}</Animated.Text>
              {busy ? (
                <Animated.View pointerEvents="none" style={[styles.initSkeleton, { opacity: subtitleOpacity }]}>
                  <PremiumLoadingBar indeterminate height={3} tone="lime" style={styles.initBar} />
                  <View style={styles.skeletonRow}>
                    <ShimmerPlaceholder width="38%" height={5} radius={999} tone="lime" />
                    <ShimmerPlaceholder width="24%" height={5} radius={999} tone="purple" />
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <Animated.View style={[styles.actions, { opacity: actionsOpacity, transform: [{ translateY: actionsY }] }]}>
              {showApple ? (
                <Animated.View style={{ opacity: appleOpacity, transform: [{ translateY: appleY }] }}>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={18}
                    style={styles.appleBtn}
                    onPress={() => void onSignIn("apple")}
                  />
                </Animated.View>
              ) : null}

              <AuthProviderButton
                label={copy.google}
                borderColor="rgba(163,255,18,0.55)"
                glowColor={C.green}
                busy={busy}
                delay={buttonBaseDelay}
                onPress={() => void onSignIn("google")}
              />
              <AuthProviderButton
                label={copy.email}
                borderColor="rgba(176,38,255,0.5)"
                glowColor={C.purple}
                busy={busy}
                delay={buttonBaseDelay + 70}
                onPress={() => setEmailOpen(true)}
              />
            </Animated.View>

            <View style={styles.footer}>
              <GlowBorderCard tone="neutral" animated={false} radius={18} contentStyle={styles.secureCard}>
                <Text style={styles.secureNote}>{copy.secureNote}</Text>
              </GlowBorderCard>
              <Text style={styles.terms}>
                {copy.termsPrefix}
                <Text style={styles.termsLink} onPress={() => void openLegalUrl(TERMS_OF_USE_EULA_URL, copy.termsLabel)}>
                  {copy.termsLabel}
                </Text>
                {copy.termsAnd}
                <Text style={styles.termsLink} onPress={() => void openLegalUrl(PRIVACY_POLICY_URL, copy.privacyLabel)}>
                  {copy.privacyLabel}
                </Text>
                {copy.termsSuffix}
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <EmailAuthModal
        visible={emailOpen}
        copy={emailModalCopy}
        onClose={() => setEmailOpen(false)}
        onSignIn={onSignInWithEmailPassword}
        onSignUp={onSignUpWithEmailPassword}
        onRequestPasswordReset={onRequestPasswordReset}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  terminalLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  flex: { flex: 1, zIndex: 2 },
  scroll: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 36,
    minHeight: "100%",
  },
  hero: { alignItems: "center", paddingBottom: 20, width: "100%" },
  mascotSlot: { width: "100%", alignItems: "center", marginBottom: 20 },
  headline: {
    color: C.text,
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.7,
    lineHeight: 38,
    marginBottom: 14,
    maxWidth: 340,
    paddingHorizontal: 4,
  },
  subtitle: {
    color: C.sub,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  actions: { gap: 13, marginTop: 24, width: "100%" },
  appleBtn: { width: "100%", height: 54 },
  btnGlow: {
    borderRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
  },
  providerBtn: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: C.btnBg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  providerText: { color: C.text, fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  disabled: { opacity: 0.6 },
  footer: { marginTop: 44, gap: 16, paddingHorizontal: 8 },
  initSkeleton: {
    width: "100%",
    maxWidth: 260,
    marginTop: 16,
    gap: 10,
  },
  initBar: {
    opacity: 0.72,
  },
  skeletonRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  secureCard: {
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  secureNote: {
    color: C.sub,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    opacity: 0.38,
  },
  terms: {
    color: C.sub,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    opacity: 0.55,
  },
  termsLink: {
    color: "rgba(255,255,255,0.85)",
    textDecorationLine: "underline",
    fontWeight: "500",
  },
  staticHero: {
    width: HERO_FALLBACK_SIZE,
    height: HERO_FALLBACK_SIZE,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,12,16,0.92)",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.34)",
    shadowColor: C.green,
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  staticHeroFace: {
    width: 52,
    height: 36,
    borderRadius: 16,
    backgroundColor: "rgba(163,255,18,0.92)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  staticHeroEye: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.bg,
  },
  staticHeroHornLeft: {
    position: "absolute",
    top: 20,
    left: 24,
    width: 18,
    height: 10,
    borderTopLeftRadius: 10,
    borderColor: "rgba(163,255,18,0.78)",
    borderLeftWidth: 3,
    borderTopWidth: 3,
    transform: [{ rotate: "-18deg" }],
  },
  staticHeroHornRight: {
    position: "absolute",
    top: 20,
    right: 24,
    width: 18,
    height: 10,
    borderTopRightRadius: 10,
    borderColor: "rgba(163,255,18,0.78)",
    borderRightWidth: 3,
    borderTopWidth: 3,
    transform: [{ rotate: "18deg" }],
  },
  staticHeroGlow: {
    position: "absolute",
    bottom: 14,
    width: 46,
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(163,255,18,0.34)",
  },
});
