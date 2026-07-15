import React, { useMemo } from "react";
import {
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
  Check,
  CircleUserRound,
  Cloud,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
} from "lucide-react-native";
import type { AuthProvider } from "../../auth/types";
import { userHasPasswordSet } from "../../auth/emailPasswordAuth";
import { GlassCard } from "../ui/GlassCard";
import { AnimatedPressable, PremiumLoadingBar, ShimmerPlaceholder } from "../ui/premium";
import { t } from "../../i18n";
import { C } from "../../theme/colors";

type CloudSyncStatus = "off" | "syncing" | "synced" | "error";

type Props = {
  session: Session | null;
  authBusy: boolean;
  authConfigured: boolean;
  cloudSyncEnabled: boolean;
  cloudSyncStatus: CloudSyncStatus;
  cloudSyncMessage: string;
  lastCloudSyncAt: string | null;
  onSignIn: (provider: AuthProvider) => void;
  onSignOut: () => void;
  onChangePassword: () => void;
  onChangeEmail: () => void;
  onSyncNow: () => void;
};

const LIME = "#A3FF12";
const CARD_RADIUS = 28;
const ICON_SIZE = 20;
const ICON_STROKE = 2.4;

function isApplePrivateRelayEmail(email: string | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith("@privaterelay.appleid.com");
}

function emailFontSize(email: string, compact: boolean): number {
  const len = email.length;
  if (compact) {
    if (len <= 22) return 14;
    if (len <= 32) return 13;
    return 12;
  }
  if (len <= 26) return 16;
  if (len <= 36) return 14;
  if (len <= 46) return 13;
  return 12;
}

function formatLastSync(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} • ${time}`;
}

function PremiumButton({
  label,
  onPress,
  icon: Icon,
  variant,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  icon: typeof Mail;
  variant: "primary" | "secondary" | "danger";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
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
    >
      <Icon
        size={18}
        color={buttonIconColor(variant, disabled, false)}
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
  pressed?: boolean,
): string {
  if (disabled) return C.muted;
  if (variant === "primary") return LIME;
  if (variant === "danger") return pressed ? C.red : C.sub;
  return C.purple;
}

function EmailCapsule({ email, privateRelay, compact }: { email: string; privateRelay: boolean; compact: boolean }) {
  const fontSize = emailFontSize(email, compact);

  return (
    <View style={styles.emailCapsule}>
      <View style={styles.emailIconWrap}>
        <CircleUserRound size={ICON_SIZE} color={C.purple} strokeWidth={ICON_STROKE} />
      </View>
      <View style={styles.emailCopy}>
        <Text
          style={[styles.emailValue, { fontSize, lineHeight: fontSize + 6 }]}
          numberOfLines={2}
          ellipsizeMode="middle"
          adjustsFontSizeToFit={Platform.OS === "ios"}
          minimumFontScale={0.78}
          maxFontSizeMultiplier={1.2}
        >
          {email}
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

function PasswordStatusRow({ hasPassword }: { hasPassword: boolean }) {
  return (
    <View style={styles.passwordCard}>
      <View style={styles.passwordIconWrap}>
        <Lock size={ICON_SIZE - 2} color={hasPassword ? LIME : C.sub} strokeWidth={ICON_STROKE} />
      </View>
      <View style={styles.passwordCopy}>
        <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.2}>
          {t("accountPasswordLabel")}
        </Text>
        <Text style={styles.fieldSubLabel} maxFontSizeMultiplier={1.15}>
          {t("accountStatusLabel")}
        </Text>
        <Text
          style={[styles.fieldValue, hasPassword ? styles.fieldValueActive : styles.fieldValueMuted]}
          maxFontSizeMultiplier={1.2}
        >
          {hasPassword ? t("authPasswordMasked") : t("authPasswordNotSet")}
        </Text>
      </View>
    </View>
  );
}

function CloudSyncStatusCard({
  status,
  message,
  lastSyncAt,
}: {
  status: CloudSyncStatus;
  message: string;
  lastSyncAt: string | null;
}) {
  const isSyncing = status === "syncing";
  const isSynced = status === "synced";
  const isError = status === "error";

  const statusLine = isSyncing
    ? message || t("cloudSyncing")
    : isSynced
      ? t("accountSyncedAcross")
      : isError
        ? message || t("cloudSyncError")
        : t("cloudSyncActive");

  const cardStyle = isSyncing
    ? styles.syncCardSyncing
    : isSynced
      ? styles.syncCardSynced
      : isError
        ? styles.syncCardError
        : styles.syncCardActive;

  const iconColor = isSyncing ? C.yellow : isSynced ? LIME : isError ? C.red : C.purple;

  return (
    <View style={[styles.syncCard, cardStyle]}>
      <View style={styles.syncCardTop}>
        <View style={[styles.syncIconWrap, { borderColor: `${iconColor}44`, backgroundColor: `${iconColor}14` }]}>
          {isSyncing ? (
            <View style={styles.syncMiniSkeleton}>
              <ShimmerPlaceholder width={22} height={7} radius={999} tone="yellow" />
              <ShimmerPlaceholder width={16} height={7} radius={999} tone="purple" />
            </View>
          ) : (
            <Cloud size={ICON_SIZE + 2} color={iconColor} strokeWidth={ICON_STROKE} />
          )}
        </View>
        <View style={styles.syncCopy}>
          <Text style={styles.syncSectionTitle} maxFontSizeMultiplier={1.2}>
            {t("accountCloudSync")}
          </Text>
          <View style={styles.syncStatusRow}>
            {isSynced ? <Check size={14} color={LIME} strokeWidth={ICON_STROKE} /> : null}
            <Text
              style={[
                styles.syncStatusText,
                isSynced && styles.syncStatusSuccess,
                isError && styles.syncStatusError,
              ]}
              numberOfLines={2}
              maxFontSizeMultiplier={1.2}
            >
              {statusLine}
            </Text>
          </View>
        </View>
      </View>
      {lastSyncAt ? (
        <View style={styles.lastSyncBlock}>
          <Text style={styles.fieldSubLabel} maxFontSizeMultiplier={1.15}>
            {t("accountLastSyncLabel")}
          </Text>
          <Text style={styles.lastSyncValue} numberOfLines={2} maxFontSizeMultiplier={1.2}>
            {formatLastSync(lastSyncAt)}
          </Text>
        </View>
      ) : null}
      {isSyncing ? <PremiumLoadingBar indeterminate height={3} tone="yellow" style={styles.syncLoadingBar} /> : null}
    </View>
  );
}

export function SettingsAccountSection({
  session,
  authBusy,
  authConfigured,
  cloudSyncEnabled,
  cloudSyncStatus,
  cloudSyncMessage,
  lastCloudSyncAt,
  onSignIn,
  onSignOut,
  onChangePassword,
  onChangeEmail,
  onSyncNow,
}: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 375;
  const email = session?.user?.email || session?.user?.id || "";
  const privateRelay = isApplePrivateRelayEmail(session?.user?.email);
  const hasPassword = userHasPasswordSet(session);
  const isSyncing = cloudSyncStatus === "syncing";

  const cardPadding = useMemo(() => (compact ? 16 : 20), [compact]);

  return (
    <View style={styles.glowShell}>
      <View pointerEvents="none" style={styles.glowOrbLime} />
      <View pointerEvents="none" style={styles.glowOrbPurple} />
      <GlassCard
        style={[styles.card, { borderRadius: CARD_RADIUS, padding: cardPadding }]}
        intensity={46}
      >
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.25}>
          {t("account").toUpperCase()}
        </Text>

        {session?.user ? (
          <View style={styles.signedInStack}>
            <View style={styles.accountGroup}>
              <Text style={styles.groupLabel} maxFontSizeMultiplier={1.2}>
                {t("accountCurrentAccount")}
              </Text>
              <EmailCapsule email={email} privateRelay={privateRelay} compact={compact} />
            </View>

            <PasswordStatusRow hasPassword={hasPassword} />

            <View style={styles.buttonGroup}>
              <PremiumButton
                label={t("authChangeEmail")}
                icon={Mail}
                onPress={onChangeEmail}
                variant="secondary"
              />
              <PremiumButton
                label={t("authChangePassword")}
                icon={Lock}
                onPress={onChangePassword}
                variant="secondary"
              />
            </View>

            <CloudSyncStatusCard
              status={cloudSyncStatus}
              message={cloudSyncMessage}
              lastSyncAt={lastCloudSyncAt}
            />

            {cloudSyncEnabled ? (
              <PremiumButton
                label={t("syncNow")}
                icon={RefreshCw}
                onPress={onSyncNow}
                variant="primary"
                disabled={isSyncing}
              />
            ) : null}

            <PremiumButton
              label={t("signOut")}
              icon={LogOut}
              onPress={onSignOut}
              variant="danger"
            />
          </View>
        ) : authConfigured ? (
          <View style={styles.signedOutStack}>
            <Text style={styles.signedOutNote} maxFontSizeMultiplier={1.25}>
              {t("authSecureNote")}
            </Text>
            <View style={styles.authButtonStack}>
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
            </View>
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
  glowOrbLime: {
    position: "absolute",
    left: -8,
    top: 18,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(163,255,18,0.07)",
    ...Platform.select({
      ios: {
        shadowColor: LIME,
        shadowOpacity: 0.35,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {},
    }),
  },
  glowOrbPurple: {
    position: "absolute",
    right: -10,
    bottom: 24,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(176,38,255,0.08)",
    ...Platform.select({
      ios: {
        shadowColor: C.purple,
        shadowOpacity: 0.28,
        shadowRadius: 26,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {},
    }),
  },
  card: {
    borderColor: "rgba(176,38,255,0.38)",
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
  sectionTitle: {
    color: C.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  signedInStack: { gap: 18, marginTop: 16 },
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
    borderColor: "rgba(176,38,255,0.35)",
    backgroundColor: "rgba(176,38,255,0.10)",
  },
  emailCopy: { flex: 1, minWidth: 0 },
  emailValue: {
    color: C.text,
    fontWeight: "800",
  },
  relayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.32)",
    backgroundColor: "rgba(176,38,255,0.08)",
  },
  relayAppleMark: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "700",
  },
  relayBadgeText: {
    color: C.purple,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  passwordCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  passwordIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  passwordCopy: { flex: 1, minWidth: 0, gap: 2 },
  fieldLabel: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  fieldSubLabel: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  fieldValue: {
    color: C.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    marginTop: 2,
  },
  fieldValueActive: { color: LIME },
  fieldValueMuted: { color: C.muted },
  syncMiniSkeleton: {
    width: 24,
    alignItems: "center",
    gap: 3,
  },
  syncLoadingBar: {
    marginTop: 12,
    opacity: 0.72,
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
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.28,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 4 },
    }),
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
    borderColor: "rgba(176,38,255,0.48)",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  premiumBtnSecondaryPressed: {
    backgroundColor: "rgba(176,38,255,0.10)",
    borderColor: "rgba(176,38,255,0.65)",
  },
  premiumBtnDanger: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  premiumBtnDangerPressed: {
    borderColor: "rgba(255,59,95,0.35)",
    backgroundColor: "rgba(255,59,95,0.06)",
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
  premiumBtnLabelDangerPressed: { color: C.red },
  syncCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 14,
  },
  syncCardActive: {
    borderColor: "rgba(176,38,255,0.40)",
    backgroundColor: "rgba(176,38,255,0.06)",
  },
  syncCardSynced: {
    borderColor: "rgba(163,255,18,0.42)",
    backgroundColor: "rgba(163,255,18,0.06)",
  },
  syncCardSyncing: {
    borderColor: "rgba(255,209,102,0.40)",
    backgroundColor: "rgba(255,209,102,0.05)",
  },
  syncCardError: {
    borderColor: "rgba(255,59,95,0.40)",
    backgroundColor: "rgba(255,59,95,0.05)",
  },
  syncCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  syncIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  syncCopy: { flex: 1, minWidth: 0, gap: 6 },
  syncSectionTitle: {
    color: C.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  syncStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  syncStatusText: {
    color: C.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    flex: 1,
    minWidth: 0,
  },
  syncStatusSuccess: { color: LIME },
  syncStatusError: { color: C.red },
  lastSyncBlock: { gap: 4, paddingTop: 2 },
  lastSyncValue: {
    color: C.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
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
