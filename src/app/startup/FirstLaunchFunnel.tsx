/**
 * First-launch funnel: Pain → Profile → Personalized Value → Workspace Prep.
 * Premium futures visual language. No AI copy. No pixel art.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop, Line, Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import { YDL_MIN_TOUCH_TARGET } from "../../ydl/accessibility";
import {
  FUTURES_INSTRUMENTS,
  MARKET_OPTIONS,
  ONBOARDING_PROFILE_KEY,
  PAIN_OPTIONS,
  PROP_FIRM_OPTIONS,
  SESSION_OPTIONS,
  STYLE_OPTIONS,
  buildPersonalizedValueBullets,
  defaultOnboardingProfile,
  emptyOnboardingProfile,
  type FuturesInstrument,
  type MarketKind,
  type OnboardingProfileV1,
  type PainPoint,
  type PropFirmPref,
  type SessionPref,
  type StylePref,
} from "./onboardingProfile";

type Step = 0 | 1 | 2 | 3;

type Props = {
  onComplete: (profile: OnboardingProfileV1) => void;
};

function ProgressBar({ step, total }: { step: number; total: number }) {
  const theme = useYdlTheme("dark");
  return (
    <View
      style={styles.progressRow}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: step + 1 }}
      accessibilityLabel={`Onboarding step ${step + 1} of ${total}`}
      testID="onboarding-progress"
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressSeg,
            {
              backgroundColor:
                i <= step ? theme.colors.action.primary : theme.colors.surface.interactive,
            },
          ]}
        />
      ))}
    </View>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const theme = useYdlTheme("dark");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={testID}
      style={[
        styles.chip,
        {
          minHeight: YDL_MIN_TOUCH_TARGET,
          backgroundColor: selected ? theme.colors.action.primary : theme.colors.surface.card,
          borderColor: selected ? theme.colors.action.primary : "rgba(255,255,255,0.08)",
        },
      ]}
    >
      <YdlText
        role="bodyEmphasized"
        style={{ color: selected ? theme.colors.action.primaryText : theme.colors.text.primary }}
      >
        {label}
      </YdlText>
    </Pressable>
  );
}

function FuturesHeroVisual({ reduceMotion }: { reduceMotion: boolean }) {
  const theme = useYdlTheme("dark");
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0.15,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  const chaos = "M12 120 C40 40, 70 180, 110 90 C140 40, 170 160, 210 70 C240 30, 270 150, 308 100";
  const calm = "M12 140 C50 130, 90 110, 130 100 C170 90, 210 70, 250 55 C280 45, 300 38, 308 34";

  return (
    <View style={styles.heroVisual} testID="onboarding-hero-visual" accessibilityElementsHidden>
      <Svg width="100%" height={180} viewBox="0 0 320 180">
        <Defs>
          <LinearGradient id="chaosGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FF4D6D" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#FF8A5B" stopOpacity="0.55" />
          </LinearGradient>
          <LinearGradient id="calmGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={theme.colors.action.primary} stopOpacity="0.7" />
            <Stop offset="1" stopColor={theme.colors.status.positive} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Line x1="12" y1="150" x2="308" y2="150" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <Path d={chaos} stroke="url(#chaosGrad)" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.35} />
        <Path d={calm} stroke="url(#calmGrad)" strokeWidth={3.5} fill="none" strokeLinecap="round" />
        <Circle cx="308" cy="34" r="5" fill={theme.colors.status.positive} />
      </Svg>
      <View style={styles.heroCards}>
        <View style={[styles.miniCard, { backgroundColor: theme.colors.surface.card }]}>
          <YdlText role="caption" color="text.secondary">
            MES · NY AM
          </YdlText>
          <YdlText role="bodyEmphasized" style={{ color: theme.colors.status.positive }}>
            +$420
          </YdlText>
        </View>
        <View style={[styles.miniCard, { backgroundColor: theme.colors.surface.card }]}>
          <YdlText role="caption" color="text.secondary">
            Daily risk
          </YdlText>
          <YdlText role="bodyEmphasized">Protected</YdlText>
        </View>
      </View>
    </View>
  );
}

export function FirstLaunchFunnel({ onComplete }: Props) {
  const theme = useYdlTheme("dark");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [profile, setProfile] = useState<OnboardingProfileV1>(emptyOnboardingProfile);
  const [prepIndex, setPrepIndex] = useState(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      sub.remove();
    };
  }, []);

  const persist = (next: OnboardingProfileV1) => {
    setProfile(next);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void AsyncStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(next));
    }, 120);
  };

  useEffect(() => {
    void AsyncStorage.getItem(ONBOARDING_PROFILE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as OnboardingProfileV1;
        if (parsed?.version === 1) setProfile({ ...emptyOnboardingProfile(), ...parsed });
      } catch {
        /* ignore corrupt */
      }
    });
  }, []);

  const prepStatuses = useMemo(
    () => [
      "Mapping your trading session…",
      "Preparing your risk dashboard…",
      "Setting up your performance metrics…",
      "Building your journal workspace…",
      "Your YouTrader profile is ready.",
    ],
    [],
  );

  useEffect(() => {
    if (step !== 3) return;
    setPrepIndex(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setPrepIndex(Math.min(i, prepStatuses.length - 1));
      if (i >= prepStatuses.length - 1) {
        clearInterval(id);
        const finished = {
          ...defaultOnboardingProfile(profile),
          ...profile,
          completedAt: new Date().toISOString(),
        };
        void AsyncStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(finished));
        setTimeout(() => onComplete(finished), reduceMotion ? 200 : 700);
      }
    }, reduceMotion ? 180 : 480);
    return () => clearInterval(id);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const hapticSelect = () => {
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const skipEarly = () => {
    const next = defaultOnboardingProfile({
      ...profile,
      skippedSteps: [...new Set([...profile.skippedSteps, step])],
    });
    persist(next);
    setStep(2);
  };

  const selectPain = (id: PainPoint) => {
    hapticSelect();
    persist({ ...profile, painPoint: id });
    setTimeout(() => setStep(1), reduceMotion ? 80 : 220);
  };

  const valueBullets = buildPersonalizedValueBullets(defaultOnboardingProfile(profile));

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background.primary }]} testID="first-launch-funnel">
      <ProgressBar step={step} total={4} />

      {step <= 1 ? (
        <Pressable
          onPress={skipEarly}
          accessibilityRole="button"
          accessibilityLabel="Skip"
          testID="onboarding-skip"
          style={styles.skip}
          hitSlop={12}
        >
          <YdlText role="caption" color="text.secondary">
            Skip
          </YdlText>
        </Pressable>
      ) : (
        <View style={styles.skipSpacer} />
      )}

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <View testID="onboarding-screen-1">
            <FuturesHeroVisual reduceMotion={!!reduceMotion} />
            <YdlText role="title" style={styles.headline}>
              The market is not your biggest risk.
            </YdlText>
            <YdlText role="body" color="text.secondary" style={styles.support}>
              Trading days usually fall apart because of tilt, FOMO, inconsistent risk, and decisions
              made without a clear system.
            </YdlText>
            <YdlText role="label" color="text.secondary" style={{ marginTop: 18 }}>
              What hurts your trading most?
            </YdlText>
            <View style={styles.choiceCol}>
              {PAIN_OPTIONS.map((opt) => (
                <ChoiceChip
                  key={opt.id}
                  label={opt.label}
                  selected={profile.painPoint === opt.id}
                  onPress={() => selectPain(opt.id)}
                  testID={`onboarding-pain-${opt.id}`}
                />
              ))}
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <View testID="onboarding-screen-2">
            <YdlText role="title" style={styles.headline}>
              Build your YouTrader profile
            </YdlText>
            <YdlText role="body" color="text.secondary" style={styles.support}>
              Choose how you trade so your journal, statistics, and performance views match your real
              workflow.
            </YdlText>

            <YdlText role="label" color="text.secondary">
              Market
            </YdlText>
            <View style={styles.choiceWrap}>
              {MARKET_OPTIONS.map((opt) => (
                <ChoiceChip
                  key={opt.id}
                  label={opt.label}
                  selected={profile.market === opt.id}
                  onPress={() => {
                    hapticSelect();
                    persist({
                      ...profile,
                      market: opt.id as MarketKind,
                      instruments: opt.id === "futures" ? profile.instruments : [],
                    });
                  }}
                  testID={`onboarding-market-${opt.id}`}
                />
              ))}
            </View>

            {profile.market === "futures" ? (
              <>
                <YdlText role="label" color="text.secondary">
                  Instruments
                </YdlText>
                <View style={styles.choiceWrap}>
                  {FUTURES_INSTRUMENTS.map((id) => {
                    const selected = profile.instruments.includes(id);
                    return (
                      <ChoiceChip
                        key={id}
                        label={id}
                        selected={selected}
                        onPress={() => {
                          hapticSelect();
                          const instruments = selected
                            ? profile.instruments.filter((x) => x !== id)
                            : [...profile.instruments, id as FuturesInstrument];
                          persist({ ...profile, instruments });
                        }}
                        testID={`onboarding-instrument-${id}`}
                      />
                    );
                  })}
                </View>
              </>
            ) : null}

            <YdlText role="label" color="text.secondary">
              Session
            </YdlText>
            <View style={styles.choiceWrap}>
              {SESSION_OPTIONS.map((opt) => (
                <ChoiceChip
                  key={opt.id}
                  label={opt.label}
                  selected={profile.session === opt.id}
                  onPress={() => {
                    hapticSelect();
                    persist({ ...profile, session: opt.id as SessionPref });
                  }}
                  testID={`onboarding-session-${opt.id}`}
                />
              ))}
            </View>

            <YdlText role="label" color="text.secondary">
              Style
            </YdlText>
            <View style={styles.choiceWrap}>
              {STYLE_OPTIONS.map((opt) => (
                <ChoiceChip
                  key={opt.id}
                  label={opt.label}
                  selected={profile.style === opt.id}
                  onPress={() => {
                    hapticSelect();
                    persist({ ...profile, style: opt.id as StylePref });
                  }}
                  testID={`onboarding-style-${opt.id}`}
                />
              ))}
            </View>

            <YdlText role="label" color="text.secondary">
              Are you currently trading a prop challenge?
            </YdlText>
            <View style={styles.choiceWrap}>
              <ChoiceChip
                label="Yes"
                selected={profile.propChallenge === true}
                onPress={() => {
                  hapticSelect();
                  persist({ ...profile, propChallenge: true });
                }}
                testID="onboarding-prop-yes"
              />
              <ChoiceChip
                label="Not yet"
                selected={profile.propChallenge === false}
                onPress={() => {
                  hapticSelect();
                  persist({ ...profile, propChallenge: false, propFirms: [] });
                }}
                testID="onboarding-prop-no"
              />
            </View>

            {profile.propChallenge === true ? (
              <>
                <YdlText role="label" color="text.secondary">
                  Prop firm
                </YdlText>
                <View style={styles.choiceWrap}>
                  {PROP_FIRM_OPTIONS.map((opt) => {
                    const selected = profile.propFirms.includes(opt.id);
                    return (
                      <ChoiceChip
                        key={opt.id}
                        label={opt.label}
                        selected={selected}
                        onPress={() => {
                          hapticSelect();
                          const propFirms = selected
                            ? profile.propFirms.filter((x) => x !== opt.id)
                            : [...profile.propFirms, opt.id as PropFirmPref];
                          persist({ ...profile, propFirms });
                        }}
                        testID={`onboarding-firm-${opt.id}`}
                      />
                    );
                  })}
                </View>
              </>
            ) : null}

            <YdlButton
              label="Continue"
              onPress={() => {
                if (!profile.market || !profile.session || !profile.style || profile.propChallenge == null) {
                  persist(defaultOnboardingProfile(profile));
                }
                setStep(2);
              }}
              testID="onboarding-profile-continue"
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View testID="onboarding-screen-3">
            <YdlText role="title" style={styles.headline}>
              Your trading system, built around you
            </YdlText>
            <YdlText role="body" color="text.secondary" style={styles.support}>
              YouTrader will turn every futures trade into clear performance data and better execution
              habits.
            </YdlText>
            <View style={[styles.valueCard, { backgroundColor: theme.colors.surface.card }]}>
              {valueBullets.map((line) => (
                <YdlText key={line} role="body">
                  {`• ${line}`}
                </YdlText>
              ))}
            </View>
            <View style={styles.compareRow}>
              <View style={[styles.compareCard, { backgroundColor: theme.colors.surface.card }]}>
                <YdlText role="label" color="text.secondary">
                  Without a journal
                </YdlText>
                <YdlText role="caption" color="text.secondary">
                  Inconsistent risk · Scattered decisions · Unclear edge
                </YdlText>
              </View>
              <View style={[styles.compareCard, { backgroundColor: theme.colors.surface.card }]}>
                <YdlText role="label">With YouTrader</YdlText>
                <YdlText role="caption" color="text.secondary">
                  Journal · Performance Radar · Trading Heatmap · Prop Pass
                </YdlText>
              </View>
            </View>
            <YdlButton
              label="Continue"
              onPress={() => setStep(3)}
              testID="onboarding-value-continue"
            />
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.prep} testID="onboarding-screen-4">
            <YdlText role="title" style={styles.headline}>
              Preparing your trading workspace
            </YdlText>
            <View style={[styles.valueCard, { backgroundColor: theme.colors.surface.card }]}>
              {prepStatuses.map((status, index) => (
                <YdlText
                  key={status}
                  role="body"
                  color={index <= prepIndex ? "text.primary" : "text.tertiary"}
                  accessibilityLabel={index === prepIndex ? status : undefined}
                >
                  {index <= prepIndex ? `✓ ${status}` : status}
                </YdlText>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  progressSeg: { flex: 1, height: 3, borderRadius: 2 },
  skip: {
    alignSelf: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: YDL_MIN_TOUCH_TARGET,
    justifyContent: "center",
  },
  skipSpacer: { height: 44 },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  headline: { marginTop: 8 },
  support: { marginTop: 8, marginBottom: 8 },
  choiceCol: { gap: 10, marginTop: 10 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
  },
  heroVisual: { marginBottom: 8 },
  heroCards: { flexDirection: "row", gap: 10, marginTop: -8 },
  miniCard: { flex: 1, borderRadius: 12, padding: 12, gap: 4 },
  valueCard: { borderRadius: 16, padding: 16, gap: 10, marginVertical: 8 },
  compareRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  compareCard: { flex: 1, borderRadius: 14, padding: 12, gap: 6 },
  prep: { paddingTop: 24, gap: 16 },
});
