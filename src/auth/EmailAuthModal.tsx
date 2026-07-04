import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EMAIL_PASSWORD_MESSAGES } from "./emailPasswordMessages";
import { isValidEmail, normalizeEmail } from "./emailOtpValidation";
import type { EmailAuthModalCopy } from "./types";

const C = {
  bg: "#0A0C10",
  text: "#FFFFFF",
  sub: "#9CA3AF",
  green: "#A3FF12",
  purple: "#B026FF",
  border: "#1E2430",
  inputBg: "#141820",
};

type ViewMode = "signin" | "signup" | "forgot" | "checkEmail";

type Props = {
  visible: boolean;
  copy: EmailAuthModalCopy;
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<"confirmation_sent" | "signed_in">;
  onRequestPasswordReset: (email: string) => Promise<void>;
};

export function EmailAuthModal({ visible, copy, onClose, onSignIn, onSignUp, onRequestPasswordReset }: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ViewMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setView("signin");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError(null);
      setInfo(null);
      setSubmitting(false);
    }
  }, [visible]);

  const runSubmit = async (task: () => Promise<void>) => {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : EMAIL_PASSWORD_MESSAGES.signInFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignIn = () => {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      setError(EMAIL_PASSWORD_MESSAGES.invalidEmail);
      return;
    }
    if (!password) {
      setError(copy.passwordPlaceholder);
      return;
    }
    void runSubmit(async () => {
      await onSignIn(normalized, password);
      onClose();
    });
  };

  const handleSignUp = () => {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      setError(EMAIL_PASSWORD_MESSAGES.invalidEmail);
      return;
    }
    if (password.length < 8) {
      setError(EMAIL_PASSWORD_MESSAGES.passwordMinLength);
      return;
    }
    if (password !== confirmPassword) {
      setError(EMAIL_PASSWORD_MESSAGES.passwordMismatch);
      return;
    }
    void runSubmit(async () => {
      const result = await onSignUp(normalized, password);
      if (result === "confirmation_sent") {
        setView("checkEmail");
        setPassword("");
        setConfirmPassword("");
      } else {
        onClose();
      }
    });
  };

  const handleForgot = () => {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      setError(EMAIL_PASSWORD_MESSAGES.invalidEmail);
      return;
    }
    void runSubmit(async () => {
      await onRequestPasswordReset(normalized);
      setInfo(EMAIL_PASSWORD_MESSAGES.passwordResetSent);
    });
  };

  const title =
    view === "signup"
      ? copy.signUpTitle
      : view === "forgot"
        ? copy.forgotTitle
        : view === "checkEmail"
          ? copy.checkEmailTitle
          : copy.signInTitle;

  const showCredentials = view === "signin" || view === "signup" || view === "forgot";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[
          styles.backdrop,
          { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) },
        ]}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={styles.dismissArea} onPress={onClose} />
          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            {view === "checkEmail" ? <Text style={styles.subtitle}>{copy.checkEmailBody}</Text> : null}

            {showCredentials ? (
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                keyboardAppearance="dark"
                placeholder={copy.emailPlaceholder}
                placeholderTextColor={C.sub}
                selectionColor={C.purple}
                cursorColor={C.green}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                editable={!submitting}
              />
            ) : null}

            {view === "signin" || view === "signup" ? (
              <TextInput
                secureTextEntry
                textContentType={view === "signup" ? "newPassword" : "password"}
                autoComplete={view === "signup" ? "password-new" : "password"}
                keyboardAppearance="dark"
                placeholder={copy.passwordPlaceholder}
                placeholderTextColor={C.sub}
                selectionColor={C.purple}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                editable={!submitting}
              />
            ) : null}

            {view === "signup" ? (
              <TextInput
                secureTextEntry
                textContentType="newPassword"
                autoComplete="password-new"
                keyboardAppearance="dark"
                placeholder={copy.confirmPasswordPlaceholder}
                placeholderTextColor={C.sub}
                selectionColor={C.purple}
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!submitting}
              />
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {info ? <Text style={styles.info}>{info}</Text> : null}

            {view === "signin" ? (
              <>
                <Pressable
                  disabled={submitting}
                  onPress={handleSignIn}
                  style={[styles.primaryBtn, submitting && styles.disabled]}
                >
                  {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryText}>{copy.signIn}</Text>}
                </Pressable>
                <Pressable disabled={submitting} onPress={() => { setView("signup"); setError(null); setInfo(null); }} style={styles.linkBtn}>
                  <Text style={styles.linkText}>{copy.createAccountLink}</Text>
                </Pressable>
                <Pressable disabled={submitting} onPress={() => { setView("forgot"); setError(null); setInfo(null); }} style={styles.linkBtn}>
                  <Text style={styles.linkText}>{copy.forgotPassword}</Text>
                </Pressable>
              </>
            ) : null}

            {view === "signup" ? (
              <>
                <Pressable
                  disabled={submitting}
                  onPress={handleSignUp}
                  style={[styles.primaryBtn, submitting && styles.disabled]}
                >
                  {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryText}>{copy.createAccount}</Text>}
                </Pressable>
                <Pressable disabled={submitting} onPress={() => { setView("signin"); setError(null); }} style={styles.linkBtn}>
                  <Text style={styles.linkText}>{copy.backToSignIn}</Text>
                </Pressable>
              </>
            ) : null}

            {view === "forgot" ? (
              <>
                <Pressable
                  disabled={submitting}
                  onPress={handleForgot}
                  style={[styles.primaryBtn, submitting && styles.disabled]}
                >
                  {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryText}>{copy.sendReset}</Text>}
                </Pressable>
                <Pressable disabled={submitting} onPress={() => { setView("signin"); setError(null); setInfo(null); }} style={styles.linkBtn}>
                  <Text style={styles.linkText}>{copy.backToSignIn}</Text>
                </Pressable>
              </>
            ) : null}

            {view === "checkEmail" ? (
              <Pressable disabled={submitting} onPress={() => { setView("signin"); setError(null); }} style={styles.linkBtn}>
                <Text style={styles.linkText}>{copy.backToSignIn}</Text>
              </Pressable>
            ) : null}

            <Pressable onPress={onClose} style={styles.linkBtn}>
              <Text style={styles.cancelText}>{copy.cancel}</Text>
            </Pressable>
          </View>
          <Pressable style={styles.dismissArea} onPress={onClose} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)" },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, minHeight: "100%" },
  dismissArea: { flexGrow: 1, minHeight: 24 },
  card: {
    backgroundColor: C.bg,
    borderRadius: 24,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  title: { color: C.text, fontSize: 20, fontWeight: "800" },
  subtitle: { color: C.sub, fontSize: 14, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.35)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.inputBg,
    color: C.text,
    fontSize: 16,
    fontWeight: "600",
  },
  error: { color: "#F87171", fontSize: 14, lineHeight: 20 },
  info: { color: C.green, fontSize: 14, lineHeight: 20 },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "800" },
  linkBtn: { alignItems: "center", paddingVertical: 6 },
  linkText: { color: C.purple, fontSize: 15, fontWeight: "600" },
  cancelText: { color: C.sub, fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.6 },
});
