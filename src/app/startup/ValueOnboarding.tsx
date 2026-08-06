import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import { YDL_MIN_TOUCH_TARGET } from "../../ydl/accessibility";
import type { AcquisitionPhase } from "./acquisitionState";

type Props = {
  phase: AcquisitionPhase;
  onPhaseChange: (phase: AcquisitionPhase) => void;
  onComplete: (profile?: string) => void;
  onExistingAuth: () => void;
};

const STEPS = [
  { key: "workspace", titleKey: "onboarding.value.workspaceTitle", bodyKey: "onboarding.value.workspaceBody", fallbackTitle: "More Than a Trading Journal", fallbackBody: "Your all-in-one futures workspace for trades, ideas, notes, and review." },
  { key: "futures", titleKey: "onboarding.value.futuresTitle", bodyKey: "onboarding.value.futuresBody", fallbackTitle: "Built for Prop Futures Traders", fallbackBody: "Plan position size, risk, targets, and challenge limits before you trade." },
  { key: "context", titleKey: "onboarding.value.contextTitle", bodyKey: "onboarding.value.contextBody", fallbackTitle: "Stay Ready for Market Moves", fallbackBody: "Keep market news and economic events in view before they change the day." },
  { key: "edge", titleKey: "onboarding.value.edgeTitle", bodyKey: "onboarding.value.edgeBody", fallbackTitle: "See Your Edge. Improve What Matters.", fallbackBody: "Stats and Prop Pass turn your trading habits into a more repeatable process." },
] as const;

const PROFILE_OPTIONS = [
  ["new", "onboarding.profile.new"],
  ["challenge", "onboarding.profile.challenge"],
  ["funded", "onboarding.profile.funded"],
] as const;

export function ValueOnboarding({ phase, onPhaseChange, onComplete, onExistingAuth }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useYdlTheme("dark");
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [profile, setProfile] = useState<string | null>(null);
  const step = STEPS[index];
  const isPersonalization = phase === "onboarding_personalization";
  const title = useMemo(() => {
    const translated = t(step.titleKey);
    return translated === step.titleKey ? step.fallbackTitle : translated;
  }, [i18n.language, step, t]);
  const body = useMemo(() => {
    const translated = t(step.bodyKey);
    return translated === step.bodyKey ? step.fallbackBody : translated;
  }, [i18n.language, step, t]);
  const skipLabel = t("skip") !== "skip" ? t("skip") : "Skip";

  if (isPersonalization) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background.primary, paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]} testID="value-onboarding-personalization">
        <Pressable onPress={() => onComplete()} style={styles.topLink} accessibilityRole="button" testID="onboarding-personalization-skip">
          <YdlText role="bodyEmphasized" color="text.secondary">{skipLabel}</YdlText>
        </Pressable>
        <View style={styles.content}>
          <YdlText role="caption" color="text.secondary" style={styles.stepLabel}>{t("onboarding.personalization.eyebrow")}</YdlText>
          <YdlText role="title" style={styles.title}>{t("onboarding.personalization.title")}</YdlText>
          <YdlText role="body" color="text.secondary" style={styles.body}>{t("onboarding.personalization.body")}</YdlText>
          <View style={styles.options}>
            {PROFILE_OPTIONS.map(([key, translationKey]) => (
              <Pressable key={key} onPress={() => { setProfile(key); onComplete(key); }} style={[styles.option, profile === key && styles.optionSelected]} testID={`onboarding-profile-${key}`}>
                <YdlText role="bodyEmphasized" color={profile === key ? "action.primary" : "text.primary"}>{t(translationKey)}</YdlText>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable onPress={onExistingAuth} accessibilityRole="button" testID="value-onboarding-existing-auth">
          <YdlText role="bodyEmphasized" color="text.secondary">{t("onboarding.alreadyAccount")}</YdlText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background.primary, paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]} testID="value-onboarding" accessibilityLabel="YouTrader value onboarding">
      <View style={styles.topRow}>
        <Pressable onPress={onExistingAuth} accessibilityRole="button" testID="value-onboarding-existing-auth">
          <YdlText role="bodyEmphasized" color="text.secondary">{t("onboarding.alreadyAccount")}</YdlText>
        </Pressable>
        <Pressable onPress={() => onComplete()} accessibilityRole="button" accessibilityLabel={skipLabel} hitSlop={12} style={styles.skip} testID="value-onboarding-skip">
          <YdlText role="bodyEmphasized" color="text.secondary">{skipLabel}</YdlText>
        </Pressable>
      </View>
      <View style={styles.content} accessibilityLiveRegion="polite">
        <YdlText role="caption" color="action.primary" style={styles.stepLabel}>{t(`onboarding.value.${step.key}Eyebrow`)}</YdlText>
        <YdlText role="title" style={styles.title}>{title}</YdlText>
        <YdlText role="body" color="text.secondary" style={styles.body}>{body}</YdlText>
        <View style={styles.previewCard}>
          <YdlText role="caption" color="text.secondary">{t(`onboarding.value.${step.key}Preview`)}</YdlText>
          <View style={styles.previewLine} />
          <View style={styles.previewLineShort} />
        </View>
      </View>
      <View style={styles.dots} accessible accessibilityLabel={`Slide ${index + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => <View key={s.key} style={[styles.dot, { backgroundColor: i === index ? theme.colors.action.primary : theme.colors.border.subtle }]} />)}
      </View>
      <View style={styles.footer}>
        <Pressable onPress={() => index > 0 ? setIndex((v) => v - 1) : undefined} disabled={index === 0} style={styles.back} testID="value-onboarding-back">
          <YdlText role="bodyEmphasized" color="text.secondary">{index > 0 ? t("onboarding.back") : ""}</YdlText>
        </Pressable>
        <YdlButton label={t("onboarding.continue")} onPress={() => index === STEPS.length - 1 ? onPhaseChange("onboarding_personalization") : setIndex((v) => v + 1)} fullWidth testID="value-onboarding-continue" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  topRow: { minHeight: YDL_MIN_TOUCH_TARGET, alignItems: "center", justifyContent: "space-between", flexDirection: "row" },
  topLink: { minHeight: YDL_MIN_TOUCH_TARGET, justifyContent: "center", alignSelf: "flex-end" },
  skip: { minHeight: YDL_MIN_TOUCH_TARGET, justifyContent: "center", paddingHorizontal: 4, alignSelf: "flex-end" },
  content: { flex: 1, justifyContent: "center", gap: 16 },
  stepLabel: { letterSpacing: 1.2 },
  title: { maxWidth: 340 },
  body: { maxWidth: 350, lineHeight: 22 },
  previewCard: { borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.05)", padding: 18, gap: 14, marginTop: 8 },
  previewLine: { height: 10, width: "78%", borderRadius: 5, backgroundColor: "rgba(163,255,18,0.26)" },
  previewLineShort: { height: 8, width: "48%", borderRadius: 4, backgroundColor: "rgba(255,255,255,0.10)" },
  dots: { flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footer: { paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  back: { minWidth: 50, minHeight: 44, justifyContent: "center" },
  options: { gap: 10, marginTop: 12 },
  option: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.04)", justifyContent: "center", paddingHorizontal: 18 },
  optionSelected: { borderColor: "#A3FF12", backgroundColor: "rgba(163,255,18,0.10)" },
});
