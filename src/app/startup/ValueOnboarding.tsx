/**
 * Concise account-first value onboarding (3 screens).
 * No pricing, purchase, or paywall. Completes → Auth.
 */

import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import { YDL_MIN_TOUCH_TARGET } from "../../ydl/accessibility";

type Props = {
  onComplete: () => void;
};

const STEPS = [
  {
    key: "journal",
    titleKey: "onboarding.value.journalTitle",
    bodyKey: "onboarding.value.journalBody",
    fallbackTitle: "Journal every trade",
    fallbackBody:
      "Keep trades, notes, and results organized in one place so your review stays clear.",
  },
  {
    key: "stats",
    titleKey: "onboarding.value.statsTitle",
    bodyKey: "onboarding.value.statsBody",
    fallbackTitle: "Understand what actually works",
    fallbackBody:
      "Stats reveal performance patterns from your journal — not memory or emotion.",
  },
  {
    key: "prop",
    titleKey: "onboarding.value.propTitle",
    bodyKey: "onboarding.value.propBody",
    fallbackTitle: "Protect the trading account",
    fallbackBody:
      "Prop Pass helps plan risk and protect challenge and funded accounts with clear guardrails.",
  },
] as const;

export function ValueOnboarding({ onComplete }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useYdlTheme("dark");
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const title = useMemo(() => {
    const translated = t(step.titleKey);
    return translated === step.titleKey ? step.fallbackTitle : translated;
  }, [i18n.language, step, t]);

  const body = useMemo(() => {
    const translated = t(step.bodyKey);
    return translated === step.bodyKey ? step.fallbackBody : translated;
  }, [i18n.language, step, t]);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.background.primary,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
      testID="value-onboarding"
      accessibilityLabel="YouTrader onboarding"
    >
      <View style={styles.topRow}>
        <Pressable
          onPress={onComplete}
          accessibilityRole="button"
          accessibilityLabel={t("skip") !== "skip" ? t("skip") : "Skip"}
          hitSlop={12}
          style={styles.skip}
          testID="value-onboarding-skip"
        >
          <YdlText role="bodyEmphasized" color="text.secondary">
            {t("skip") !== "skip" ? t("skip") : "Skip"}
          </YdlText>
        </Pressable>
      </View>

      <View style={styles.content} accessibilityLiveRegion="polite">
        <YdlText role="caption" color="text.secondary" style={styles.stepLabel}>
          {index + 1} / {STEPS.length}
        </YdlText>
        <YdlText role="title" style={styles.title}>
          {title}
        </YdlText>
        <YdlText role="body" color="text.secondary" style={styles.body}>
          {body}
        </YdlText>
      </View>

      <View style={styles.dots} accessible accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <View
            key={s.key}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === index ? theme.colors.action.primary : theme.colors.border.subtle,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <YdlButton
          label={
            isLast
              ? t("getStarted") !== "getStarted"
                ? t("getStarted")
                : "Get Started"
              : t("continue") !== "continue"
                ? t("continue")
                : "Continue"
          }
          onPress={() => {
            if (isLast) onComplete();
            else setIndex((v) => Math.min(STEPS.length - 1, v + 1));
          }}
          fullWidth
          testID={isLast ? "value-onboarding-get-started" : "value-onboarding-continue"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  topRow: { minHeight: YDL_MIN_TOUCH_TARGET, alignItems: "flex-end", justifyContent: "center" },
  skip: { minHeight: YDL_MIN_TOUCH_TARGET, justifyContent: "center", paddingHorizontal: 4 },
  content: { flex: 1, justifyContent: "center", gap: 16 },
  stepLabel: { letterSpacing: 0.4 },
  title: { maxWidth: 320 },
  body: { maxWidth: 340, lineHeight: 22 },
  dots: { flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footer: { paddingBottom: 8 },
});
