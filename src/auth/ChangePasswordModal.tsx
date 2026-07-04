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
import { t } from "../i18n";
import { EMAIL_PASSWORD_MESSAGES } from "./emailPasswordMessages";

const C = {
  bg: "#0A0C10",
  text: "#FFFFFF",
  sub: "#9CA3AF",
  green: "#A3FF12",
  purple: "#B026FF",
  border: "#1E2430",
  inputBg: "#141820",
};

type Props = {
  visible: boolean;
  title?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
};

export function ChangePasswordModal({
  visible,
  title,
  submitLabel,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const modalTitle = title ?? t("authChangePassword");
  const modalSubmit = submitLabel ?? t("authUpdatePassword");

  useEffect(() => {
    if (!visible) {
      setPassword("");
      setConfirm("");
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError(EMAIL_PASSWORD_MESSAGES.passwordMinLength);
      return;
    }
    if (password !== confirm) {
      setError(EMAIL_PASSWORD_MESSAGES.passwordMismatch);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(password);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : EMAIL_PASSWORD_MESSAGES.signInFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[
          styles.backdrop,
          { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={styles.card}>
            <Text style={styles.title}>{modalTitle}</Text>
            <TextInput
              secureTextEntry
              placeholder={t("authNewPasswordPlaceholder")}
              placeholderTextColor={C.sub}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              editable={!submitting}
            />
            <TextInput
              secureTextEntry
              placeholder={t("authEmailConfirmPasswordPlaceholder")}
              placeholderTextColor={C.sub}
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              editable={!submitting}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable disabled={submitting} onPress={() => void handleSubmit()} style={[styles.primaryBtn, submitting && styles.disabled]}>
              {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryText}>{modalSubmit}</Text>}
            </Pressable>
            <Pressable onPress={onClose} style={styles.linkBtn}>
              <Text style={styles.cancelText}>{t("cancel")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)", justifyContent: "center", paddingHorizontal: 24 },
  scroll: { flexGrow: 1, justifyContent: "center" },
  card: {
    backgroundColor: C.bg,
    borderRadius: 24,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  title: { color: C.text, fontSize: 20, fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.35)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.inputBg,
    color: C.text,
    fontSize: 16,
  },
  error: { color: "#F87171", fontSize: 14 },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "800" },
  linkBtn: { alignItems: "center", paddingVertical: 8 },
  cancelText: { color: C.sub, fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.6 },
});
