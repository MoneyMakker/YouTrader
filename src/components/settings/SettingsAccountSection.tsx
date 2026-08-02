import React, { useMemo } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import {
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Lock,
  LogOut,
  Mail,
  Trash2,
} from "lucide-react-native";
import type { AuthProvider } from "../../auth/types";
import {
  openAppleAppsUsingAppleIdSettings,
  openAppleSubscriptionManagement,
  requestAccountDeletion,
} from "../../auth/accountDeletion";
import {
  resolveSessionAccountLabel,
  resolveSessionAuthProvider,
  sessionSupportsChangeEmail,
  sessionSupportsPasswordControls,
} from "../../auth/resolveSessionAuthProvider";
import {
  enableNativeAppleSignIn,
  enableNativeGoogleSignIn,
} from "../../config/appConfig";
import { GlassCard } from "../ui/GlassCard";
import { AnimatedPressable } from "../ui/premium";
import { t } from "../../i18n";
import { C } from "../../theme/colors";

type Props = {
  session: Session | null;
  authBusy: boolean;
  authConfigured: boolean;
  /** Compact row for main Settings list. */
  mode?: "row" | "details";
  onOpenDetails?: () => void;
  onBack?: () => void;
  onSignIn: (provider: AuthProvider) => void;
  onSignOut: () => void;
  onChangePassword: () => void;
  onChangeEmail: () => void;
};

const LIME = "#A3FF12";
const CARD_RADIUS = 28;
const ICON_SIZE = 20;
const ICON_STROKE = 2.4;

function isApplePrivateRelayEmail(email: string | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith("@privaterelay.appleid.com");
}

function providerLabel(provider: AuthProvider | null): string {
  if (provider === "apple") return t("accountProviderApple");
  if (provider === "google") return t("accountProviderGoogle");
  return t("accountProviderEmail");
}

function PremiumButton({
  label,
  onPress,
  icon: Icon,
  variant,
  disabled,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon: typeof Mail;
  variant: "primary" | "secondary" | "danger";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const contentStyle = [
    styles.premiumBtn,
    variant === "primary" && styles.premiumBtnPrimary,
    variant === "secondary" && styles.premiumBtnSecondary,
    variant === "danger" && styles.premiumBtnDanger,
    disabled && styles.premiumBtnDisabled,
    style,
  ];

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      haptic
      contentStyle={contentStyle}
      testID={testID}
    >
      <Icon
        size={18}
        color={buttonIconColor(variant, disabled)}
        strokeWidth={ICON_STROKE}
      />
      <Text
        style={[
          styles.premiumBtnLabel,
          variant === "primary" && styles.premiumBtnLabelPrimary,
          variant === "danger" && styles.premiumBtnLabelDanger,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        maxFontSizeMultiplier={1.25}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

function buttonIconColor(
  variant: "primary" | "secondary" | "danger",
  disabled?: boolean,
): string {
  if (disabled) return C.muted;
  if (variant === "primary") return LIME;
  if (variant === "danger") return C.sub;
  return LIME;
}

function AccountIdentityBlock({
  label,
  provider,
  privateRelay,
  compact,
}: {
  label: string;
  provider: AuthProvider | null;
  privateRelay: boolean;
  compact: boolean;
}) {
  return (
    <View style={styles.emailCapsule}>
      <View style={styles.emailIconWrap}>
        <CircleUserRound size={ICON_SIZE} color={LIME} strokeWidth={ICON_STROKE} />
      </View>
      <View style={styles.emailCopy}>
        <Text
          style={[styles.emailValue, compact && styles.emailValueCompact]}
          numberOfLines={1}
          ellipsizeMode="middle"
          maxFontSizeMultiplier={1.2}
          accessibilityLabel={label}
        >
          {label}
        </Text>
        <Text style={styles.providerValue} numberOfLines={1} maxFontSizeMultiplier={1.15}>
          {providerLabel(provider)}
        </Text>
        {privateRelay ? (
          <View style={styles.relayRow}>
            <Text style={styles.relayAppleMark}>{"\uf8ff"}</Text>
            <Text style={styles.relayBadgeText} maxFontSizeMultiplier={1.15}>
              {t("accountPrivateRelay")}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function SettingsAccountSection({
  session,
  authBusy,
  authConfigured,
  mode = "details",
  onOpenDetails,
  onBack,
  onSignIn,
  onSignOut,
  onChangePassword,
  onChangeEmail,
}: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 375;
  const provider = resolveSessionAuthProvider(session);
  const accountLabel = resolveSessionAccountLabel(session);
  const privateRelay = isApplePrivateRelayEmail(session?.user?.email);
  const showChangeEmail = sessionSupportsChangeEmail(session);
  const showChangePassword = sessionSupportsPasswordControls(session);
  const cardPadding = useMemo(() => (compact ? 16 : 20), [compact]);

  const confirmDeleteAccount = () => {
    Alert.alert(t("deleteAccountConfirmTitle"), t("deleteAccountConfirmBody"), [
      { text: t("cancel") || "Cancel", style: "cancel" },
      {
        text: t("deleteAccountManageSubscription"),
        onPress: () => openAppleSubscriptionManagement(),
      },
      {
        text: t("deleteAccountContinue"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            const result = await requestAccountDeletion();
            if (!result.ok) {
              Alert.alert(t("deleteAccount"), t("deleteAccountFailed"));
              return;
            }
            if (result.manualAppleRevocationRequired) {
              Alert.alert(t("deleteAccount"), t("deleteAccountAppleManualRevokeBody"), [
                { text: t("deleteAccountAppleManualRevokeAction"), onPress: () => openAppleAppsUsingAppleIdSettings() },
                { text: t("ok") || "OK", style: "cancel" },
              ]);
            } else {
              Alert.alert(t("deleteAccount"), t("deleteAccountSuccess"));
            }
            onSignOut();
          })();
        },
      },
    ]);
  };

  if (mode === "row") {
    if (!session?.user) {
      return (
        <GlassCard style={[styles.card, { borderRadius: CARD_RADIUS, padding: cardPadding }]} intensity={46}>
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.25}>
            {t("account")}
          </Text>
          {authConfigured ? (
            <View style={styles.signedOutStack}>
              <Text style={styles.signedOutNote} maxFontSizeMultiplier={1.25}>
                {t("authSecureNote")}
              </Text>
              <View style={styles.authButtonStack}>
                {enableNativeAppleSignIn ? (
                  <Pressable
                    disabled={authBusy}
                    onPress={() => onSignIn("apple")}
                    style={({ pressed }) => [
                      styles.authProviderBtn,
                      styles.authAppleBtn,
                      authBusy && styles.disabledBtn,
                      pressed && styles.premiumBtnSecondaryPressed,
                    ]}
                  >
                    <Text style={[styles.authProviderIcon, styles.authAppleIcon]}>{"\uf8ff"}</Text>
                    <Text style={[styles.authProviderText, styles.authAppleText]} maxFontSizeMultiplier={1.2}>
                      {t("authApple")}
                    </Text>
                  </Pressable>
                ) : null}
                {enableNativeGoogleSignIn ? (
                  <Pressable
                    disabled={authBusy}
                    onPress={() => onSignIn("google")}
                    style={({ pressed }) => [
                      styles.authProviderBtn,
                      authBusy && styles.disabledBtn,
                      pressed && styles.premiumBtnPrimaryPressed,
                    ]}
                  >
                    <Text style={styles.authProviderIcon}>G</Text>
                    <Text style={styles.authProviderText} maxFontSizeMultiplier={1.2}>
                      {t("authGoogle")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : (
            <Text style={styles.signedOutNote} maxFontSizeMultiplier={1.25}>
              {t("cloudSignInNotConfigured")}
            </Text>
          )}
        </GlassCard>
      );
    }

    return (
      <Pressable
        onPress={onOpenDetails}
        accessibilityRole="button"
        accessibilityLabel={`${t("account")}, ${accountLabel}, ${providerLabel(provider)}`}
        testID="settings-account-row"
        style={({ pressed }) => [styles.rowPressable, pressed && styles.rowPressed]}
      >
        <GlassCard style={[styles.card, styles.rowCard, { borderRadius: CARD_RADIUS, padding: cardPadding }]} intensity={46}>
          <View style={styles.rowInner}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowSectionLabel} maxFontSizeMultiplier={1.2}>
                {t("account")}
              </Text>
              <Text
                style={styles.rowEmail}
                numberOfLines={1}
                ellipsizeMode="middle"
                maxFontSizeMultiplier={1.2}
                accessibilityLabel={accountLabel}
              >
                {accountLabel}
              </Text>
              <Text style={styles.rowProvider} numberOfLines={1} maxFontSizeMultiplier={1.15}>
                {providerLabel(provider)}
              </Text>
            </View>
            <ChevronRight size={22} color={C.sub} strokeWidth={ICON_STROKE} />
          </View>
        </GlassCard>
      </Pressable>
    );
  }

  return (
    <View style={styles.glowShell} testID="settings-account-details">
      <GlassCard
        style={[styles.card, { borderRadius: CARD_RADIUS, padding: cardPadding }]}
        intensity={46}
      >
        <View style={styles.detailsHeader}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t("more.back")}
              hitSlop={12}
              style={styles.backBtn}
              testID="settings-account-back"
            >
              <ChevronLeft size={22} color={C.text} strokeWidth={ICON_STROKE} />
            </Pressable>
          ) : null}
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.25}>
            {t("account")}
          </Text>
        </View>

        {session?.user ? (
          <View style={styles.signedInStack}>
            <View style={styles.accountGroup}>
              <Text style={styles.groupLabel} maxFontSizeMultiplier={1.2}>
                {t("accountCurrentAccount")}
              </Text>
              <AccountIdentityBlock
                label={accountLabel}
                provider={provider}
                privateRelay={privateRelay}
                compact={compact}
              />
            </View>

            {(showChangeEmail || showChangePassword) ? (
              <View style={styles.buttonGroup}>
                {showChangeEmail ? (
                  <PremiumButton
                    label={t("authChangeEmail")}
                    icon={Mail}
                    onPress={onChangeEmail}
                    variant="secondary"
                    testID="settings-change-email"
                  />
                ) : null}
                {showChangePassword ? (
                  <PremiumButton
                    label={t("authChangePassword")}
                    icon={Lock}
                    onPress={onChangePassword}
                    variant="secondary"
                    testID="settings-change-password"
                  />
                ) : null}
              </View>
            ) : null}

            <PremiumButton
              label={t("signOut")}
              icon={LogOut}
              onPress={onSignOut}
              variant="danger"
              testID="settings-sign-out"
            />
            <PremiumButton
              label={t("deleteAccount")}
              icon={Trash2}
              onPress={confirmDeleteAccount}
              variant="danger"
              testID="settings-delete-account"
            />
          </View>
        ) : (
          <Text style={styles.signedOutNote} maxFontSizeMultiplier={1.25}>
            {t("cloudSignInNotConfigured")}
          </Text>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  glowShell: {
    position: "relative",
    borderRadius: CARD_RADIUS + 4,
    marginVertical: 2,
  },
  card: {
    borderColor: "rgba(163,255,18,0.28)",
    backgroundColor: "rgba(8,10,14,0.72)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.45,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
      },
      android: { elevation: 8 },
    }),
  },
  rowPressable: { borderRadius: CARD_RADIUS + 4 },
  rowPressed: { opacity: 0.92 },
  rowCard: { marginVertical: 0 },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowSectionLabel: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  rowEmail: {
    color: C.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  rowProvider: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  signedInStack: { gap: 16, marginTop: 16, paddingBottom: 8 },
  signedOutStack: { gap: 6, marginTop: 14 },
  accountGroup: { gap: 10 },
  groupLabel: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  emailCapsule: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(0,0,0,0.42)",
    minWidth: 0,
  },
  emailIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(163,255,18,0.08)",
  },
  emailCopy: { flex: 1, minWidth: 0, gap: 4 },
  emailValue: {
    color: C.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  emailValueCompact: {
    fontSize: 14,
    lineHeight: 19,
  },
  providerValue: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  relayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  relayAppleMark: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "700",
  },
  relayBadgeText: {
    color: LIME,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  buttonGroup: { gap: 10 },
  premiumBtn: {
    minHeight: 54,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  premiumBtnPrimary: {
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.55)",
    backgroundColor: "rgba(163,255,18,0.12)",
  },
  premiumBtnPrimaryPressed: {
    backgroundColor: "rgba(163,255,18,0.20)",
    borderColor: "rgba(163,255,18,0.72)",
  },
  premiumBtnSecondary: {
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.42)",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  premiumBtnSecondaryPressed: {
    backgroundColor: "rgba(163,255,18,0.08)",
    borderColor: "rgba(163,255,18,0.55)",
  },
  premiumBtnDanger: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  premiumBtnDisabled: { opacity: 0.5 },
  premiumBtnLabel: {
    color: C.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    flexShrink: 1,
  },
  premiumBtnLabelPrimary: { color: LIME },
  premiumBtnLabelDanger: { color: C.sub },
  signedOutNote: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  authButtonStack: { gap: 10, marginTop: 10 },
  authProviderBtn: {
    minHeight: 54,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.42)",
    backgroundColor: C.greenSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  authAppleBtn: {
    backgroundColor: C.card2,
    borderColor: "rgba(255,255,255,0.22)",
  },
  authProviderIcon: {
    width: 24,
    color: LIME,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  authAppleIcon: { color: C.text },
  authProviderText: { color: LIME, fontSize: 15, fontWeight: "900", flexShrink: 1 },
  authAppleText: { color: C.text },
  disabledBtn: { opacity: 0.55 },
});
