/**
 * First-launch funnel: Pain → Profile → Personalized Value → Workspace Prep.
 * Premium futures visual language. No AI copy. No pixel art.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Line,
  Path,
  Stop,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import { YDL_MIN_TOUCH_TARGET } from "../../ydl/accessibility";
import {
  applyMarketSelection,
  buildOnboardingProfilePreview,
  buildPersonalizedValueBullets,
  defaultOnboardingProfile,
  emptyOnboardingProfile,
  FUTURES_INSTRUMENTS,
  MARKET_OPTIONS,
  normalizeOnboardingProfile,
  ONBOARDING_PROFILE_KEY,
  PAIN_OPTIONS,
  PROP_FIRM_OPTIONS,
  SESSION_OPTIONS,
  STYLE_OPTIONS,
  type FuturesInstrument,
  type MarketKind,
  type OnboardingProfilePreview,
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

const LIME = "#B8F255";
const PURPLE = "#8B7CFF";
const RED = "#FF4D6D";
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const HERO_CHART_HEIGHT = 232;
const PREVIEW_CARD_WIDTH = SCREEN_WIDTH - 56;
const PREVIEW_CARD_GAP = 12;
const PREVIEW_PEEK = 14;

const AnimatedPath = Animated.createAnimatedComponent(Path);

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

function MarketStructureGrid() {
  const lines = [];
  for (let x = 16; x < 320; x += 22) {
    lines.push(
      <Line
        key={`v${x}`}
        x1={x}
        y1={8}
        x2={x}
        y2={200}
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={1}
      />,
    );
  }
  for (let y = 16; y < 204; y += 18) {
    lines.push(
      <Line
        key={`h${y}`}
        x1={8}
        y1={y}
        x2={312}
        y2={y}
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={1}
      />,
    );
  }
  return <G>{lines}</G>;
}

/** Screen 1 — chaos → structure equity story with risk boundary + markers. */
function FuturesHeroVisual({
  reduceMotion,
  accentPain,
}: {
  reduceMotion: boolean;
  accentPain: PainPoint | null;
}) {
  const theme = useYdlTheme("dark");
  const progress = useRef(new Animated.Value(0)).current;
  const heroHeight = Math.round(SCREEN_HEIGHT * 0.38);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.delay(400),
        Animated.timing(progress, {
          toValue: 0.2,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion, accentPain]);

  const chaosOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0.18] });
  const calmOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] });
  const riskOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.92] });

  const chaos =
    "M8 148 C28 52, 52 188, 78 88 C98 38, 124 178, 152 98 C172 48, 198 172, 228 92 C252 48, 278 158, 312 118";
  const risk = "M8 108 C64 114, 132 118, 198 112 C252 108, 284 104, 312 100";
  const calm =
    "M8 168 C44 160, 80 148, 116 132 C152 116, 188 96, 224 72 C256 52, 288 36, 312 24";

  return (
    <View
      style={[styles.heroVisual, { minHeight: heroHeight }]}
      testID="onboarding-hero-visual"
      accessibilityElementsHidden
    >
      <View style={[styles.heroFrame, { backgroundColor: theme.colors.surface.card }]}>
        <Svg width="100%" height={HERO_CHART_HEIGHT} viewBox="0 0 320 210">
          <Defs>
            <LinearGradient id="chaosGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={RED} stopOpacity="0.95" />
              <Stop offset="1" stopColor="#FF8A5B" stopOpacity="0.55" />
            </LinearGradient>
            <LinearGradient id="calmGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={PURPLE} stopOpacity="0.85" />
              <Stop offset="1" stopColor={LIME} stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="fillCalm" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={LIME} stopOpacity="0.2" />
              <Stop offset="1" stopColor={LIME} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <MarketStructureGrid />
          <Path
            d="M8 168 C44 160, 80 148, 116 132 C152 116, 188 96, 224 72 C256 52, 288 36, 312 24 L312 200 L8 200 Z"
            fill="url(#fillCalm)"
            opacity={0.6}
          />
          <AnimatedPath
            d={chaos}
            stroke="url(#chaosGrad)"
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
            opacity={chaosOpacity}
          />
          <AnimatedPath
            d={risk}
            stroke={PURPLE}
            strokeWidth={1.6}
            fill="none"
            strokeDasharray="4 4"
            opacity={riskOpacity}
          />
          <AnimatedPath
            d={calm}
            stroke="url(#calmGrad)"
            strokeWidth={3.4}
            fill="none"
            strokeLinecap="round"
            opacity={calmOpacity}
          />
          <Circle cx="78" cy="88" r="4" fill={RED} opacity={0.75} />
          <Circle cx="152" cy="98" r="3.5" fill={RED} opacity={0.6} />
          <Circle cx="224" cy="72" r="4.5" fill={LIME} />
          <Circle cx="312" cy="24" r="5.5" fill={LIME} />
          <Line x1="8" y1="108" x2="312" y2="108" stroke={PURPLE} strokeWidth={0.9} opacity={0.3} />
        </Svg>
        <View style={styles.heroCards}>
          <View style={[styles.miniCard, { backgroundColor: "rgba(8,10,14,0.78)" }]}>
            <YdlText role="caption" color="text.secondary">
              Journal · NY AM
            </YdlText>
            <YdlText role="bodyEmphasized" style={{ color: theme.colors.status.positive }}>
              +$420
            </YdlText>
          </View>
          <View style={[styles.miniCard, { backgroundColor: "rgba(8,10,14,0.78)" }]}>
            <YdlText role="caption" color="text.secondary">
              Daily Risk
            </YdlText>
            <YdlText role="bodyEmphasized" style={{ color: PURPLE }}>
              Protected
            </YdlText>
          </View>
        </View>
      </View>
    </View>
  );
}

function MiniSpark({ color, rising, volatile }: { color: string; rising?: boolean; volatile?: boolean }) {
  const d = volatile
    ? "M2 14 C6 6, 10 18, 16 8 C22 18, 28 4, 34 12 C36 16, 38 10, 38 10"
    : rising
      ? "M2 18 C8 16, 12 12, 18 10 C24 8, 30 4, 38 3"
      : "M2 8 C10 6, 14 14, 22 12 C28 10, 32 16, 38 14";
  return (
    <Svg width={42} height={22} viewBox="0 0 40 22">
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function CheckmarkBadge() {
  return (
    <View style={styles.checkBadge}>
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Path
          d="M3 7 L6 10 L11 4"
          stroke={LIME}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function MarketCard({
  id,
  label,
  description,
  selected,
  onPress,
}: {
  id: MarketKind;
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useYdlTheme("dark");
  const sparkColor =
    id === "futures" ? LIME : id === "crypto" ? PURPLE : id === "forex" ? "#5CC8FF" : "#FFB86B";
  const sparkRising = id === "futures" || id === "stocks";
  const sparkVolatile = id === "crypto";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${description}`}
      testID={`onboarding-market-${id}`}
      style={[
        styles.marketCard,
        {
          minHeight: YDL_MIN_TOUCH_TARGET + 28,
          backgroundColor: theme.colors.surface.card,
          borderColor: selected ? LIME : "rgba(255,255,255,0.08)",
        },
      ]}
    >
      <View style={styles.marketCardTop}>
        <YdlText role="bodyEmphasized">{label}</YdlText>
        <View style={styles.marketCardIcons}>
          <MiniSpark color={sparkColor} rising={sparkRising} volatile={sparkVolatile} />
          {selected ? <CheckmarkBadge /> : null}
        </View>
      </View>
      <YdlText role="caption" color="text.secondary">
        {description}
      </YdlText>
    </Pressable>
  );
}

function ProfilePreviewCard({ preview }: { preview: OnboardingProfilePreview }) {
  const theme = useYdlTheme("dark");
  const propStatus = preview.propActive
    ? preview.propFirmLabel
      ? `Prop · ${preview.propFirmLabel}`
      : "Prop Challenge Tracking enabled"
    : "Prop Challenge Tracking off";

  return (
    <View
      style={[
        styles.profilePreview,
        { backgroundColor: theme.colors.surface.card, borderColor: "rgba(184,242,85,0.4)" },
      ]}
      testID="onboarding-profile-preview"
      accessibilityLabel={`Your trading profile. ${preview.headline}. ${preview.subtitle}. ${preview.focusLine}. ${propStatus}`}
    >
      <YdlText role="label" style={{ color: LIME, letterSpacing: 1.2 }}>
        YOUR TRADING PROFILE
      </YdlText>
      <YdlText role="title">{preview.headline}</YdlText>
      <YdlText role="body" color="text.secondary">
        {preview.subtitle}
      </YdlText>
      <View style={styles.profileFocusRow}>
        <YdlText role="caption" color="text.secondary">
          Focus
        </YdlText>
        <YdlText role="bodyEmphasized">{preview.focusLine}</YdlText>
      </View>
      <YdlText
        role="caption"
        style={{ color: preview.propActive ? LIME : theme.colors.text.secondary }}
      >
        {propStatus}
      </YdlText>
    </View>
  );
}

function PageDots({ count, activeIndex }: { count: number; activeIndex: number }) {
  const theme = useYdlTheme("dark");
  return (
    <View style={styles.pageDots} accessibilityRole="tablist">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.pageDot,
            {
              backgroundColor:
                i === activeIndex ? theme.colors.action.primary : theme.colors.surface.interactive,
              width: i === activeIndex ? 18 : 6,
            },
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === activeIndex }}
        />
      ))}
    </View>
  );
}

function ProductPreviewPager({
  profile,
  onActiveIndexChange,
}: {
  profile: OnboardingProfileV1;
  onActiveIndexChange: (index: number) => void;
}) {
  const theme = useYdlTheme("dark");
  const preview = buildOnboardingProfilePreview(profile);
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const snapInterval = PREVIEW_CARD_WIDTH + PREVIEW_CARD_GAP;

  const updateIndex = useCallback(
    (offsetX: number) => {
      const index = Math.round(offsetX / snapInterval);
      const clamped = Math.max(0, Math.min(index, 3));
      setActiveIndex(clamped);
      onActiveIndexChange(clamped);
    },
    [onActiveIndexChange, snapInterval],
  );

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateIndex(e.nativeEvent.contentOffset.x);
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateIndex(e.nativeEvent.contentOffset.x);
  };

  const cards = [
    {
      id: "journal",
      title: "Journal",
      body: (
        <View style={styles.previewInner}>
          <View style={styles.previewRow}>
            <YdlText role="bodyEmphasized">{preview.primarySymbol} LONG</YdlText>
            <YdlText role="bodyEmphasized" style={{ color: theme.colors.status.positive }}>
              +$420
            </YdlText>
          </View>
          <YdlText role="caption" color="text.secondary">
            Emotion · Focused · Setup · ORB
          </YdlText>
          <YdlText role="caption" color="text.secondary">
            {preview.sessionLabel}
          </YdlText>
        </View>
      ),
    },
    {
      id: "radar",
      title: "Performance Radar",
      body: (
        <Svg width={180} height={120} viewBox="0 0 180 120">
          <Circle cx="90" cy="60" r="42" stroke="rgba(255,255,255,0.12)" strokeWidth={1} fill="none" />
          <Circle cx="90" cy="60" r="28" stroke="rgba(255,255,255,0.08)" strokeWidth={1} fill="none" />
          <Path
            d="M90 22 L128 48 L118 90 L62 90 L52 48 Z"
            fill="rgba(184,242,85,0.18)"
            stroke={LIME}
            strokeWidth={1.5}
          />
          {["P", "C", "R", "D", "S", "T"].map((label, i) => {
            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
            const x = 90 + Math.cos(angle) * 50;
            const y = 60 + Math.sin(angle) * 50;
            return <Circle key={label} cx={x} cy={y} r={2.5} fill={PURPLE} />;
          })}
        </Svg>
      ),
    },
    {
      id: "heatmap",
      title: "Trading Heatmap",
      body: (
        <View style={styles.heatGrid}>
          {Array.from({ length: 28 }).map((_, i) => {
            const selected = i === 9;
            const tone = [0.08, 0.18, 0.35, 0.12, 0.55, 0.22, 0.08][i % 7];
            return (
              <View
                key={i}
                style={[
                  styles.heatCell,
                  {
                    backgroundColor: selected ? LIME : `rgba(139,124,255,${tone})`,
                    borderColor: selected ? "#fff" : "transparent",
                    borderWidth: selected ? 1 : 0,
                  },
                ]}
              />
            );
          })}
        </View>
      ),
    },
    {
      id: "proppass",
      title: "Prop Pass",
      body: (
        <View style={styles.previewInner}>
          <YdlText role="caption" color="text.secondary">
            Challenge status · {preview.propActive ? "Active" : "Ready"}
          </YdlText>
          <View style={styles.bufferBarTrack}>
            <View
              style={[
                styles.bufferBarFill,
                { width: preview.propActive ? "68%" : "32%", backgroundColor: LIME },
              ]}
            />
          </View>
          <YdlText role="caption">
            Target progress {preview.propActive ? "68%" : "32%"}
          </YdlText>
          <YdlText role="caption" color="text.secondary">
            Daily buffer protected · Trailing drawdown OK
          </YdlText>
        </View>
      ),
    },
  ];

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.previewPager,
          { paddingRight: PREVIEW_PEEK },
        ]}
        testID="onboarding-product-previews"
        accessibilityLabel="Product previews"
      >
        {cards.map((card) => (
          <View
            key={card.id}
            style={[
              styles.previewCard,
              {
                width: PREVIEW_CARD_WIDTH,
                marginRight: PREVIEW_CARD_GAP,
                backgroundColor: theme.colors.surface.card,
              },
            ]}
            testID={`onboarding-preview-${card.id}`}
          >
            <YdlText role="label" color="text.secondary">
              {card.title}
            </YdlText>
            {card.body}
          </View>
        ))}
      </ScrollView>
      <PageDots count={cards.length} activeIndex={activeIndex} />
    </View>
  );
}

function WorkspaceAssembly({
  reduceMotion,
  stage,
  preview,
}: {
  reduceMotion: boolean;
  stage: number;
  preview: OnboardingProfilePreview;
}) {
  const theme = useYdlTheme("dark");
  const opacityFor = (minStage: number) => (stage >= minStage || reduceMotion ? 1 : 0.15);

  return (
    <View
      style={[styles.assembly, { backgroundColor: theme.colors.surface.card }]}
      testID="onboarding-workspace-assembly"
      accessibilityElementsHidden
    >
      <View style={[styles.assemblyCard, { opacity: opacityFor(0) }]}>
        <YdlText role="caption" color="text.secondary">
          Journal
        </YdlText>
        <YdlText role="bodyEmphasized">
          {preview.primarySymbol} · +$420
        </YdlText>
      </View>
      <View style={styles.assemblyRow}>
        <View style={[styles.assemblyMetric, { opacity: opacityFor(1) }]}>
          <YdlText role="caption" color="text.secondary">
            Win rate
          </YdlText>
          <YdlText role="bodyEmphasized">58%</YdlText>
        </View>
        <View style={[styles.assemblyMetric, { opacity: opacityFor(1) }]}>
          <YdlText role="caption" color="text.secondary">
            Expectancy
          </YdlText>
          <YdlText role="bodyEmphasized">+$86</YdlText>
        </View>
      </View>
      <View style={{ opacity: opacityFor(2), alignItems: "center" }}>
        <Svg width={140} height={72} viewBox="0 0 140 72">
          <Path
            d="M70 8 L102 30 L92 62 L48 62 L38 30 Z"
            fill="rgba(184,242,85,0.16)"
            stroke={LIME}
            strokeWidth={1.4}
          />
        </Svg>
      </View>
      <View style={[styles.heatGrid, { opacity: opacityFor(3), alignSelf: "center" }]}>
        {Array.from({ length: 21 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.heatCell,
              { backgroundColor: i === 8 ? LIME : `rgba(139,124,255,${0.12 + (i % 5) * 0.08})` },
            ]}
          />
        ))}
      </View>
      <View style={[styles.bufferBarTrack, { opacity: opacityFor(4), marginTop: 8 }]}>
        <View
          style={[
            styles.bufferBarFill,
            {
              width: preview.propActive ? "72%" : "40%",
              backgroundColor: preview.propActive ? PURPLE : LIME,
            },
          ]}
        />
      </View>
      <YdlText role="caption" color="text.secondary" style={{ opacity: opacityFor(4) }}>
        {preview.propActive ? "Prop Pass buffer locked" : "Risk dashboard ready"}
      </YdlText>
    </View>
  );
}

const MARKET_DESCRIPTIONS: Record<MarketKind, string> = {
  futures: "Index & commodity micros",
  crypto: "24/7 digital assets",
  forex: "FX majors & sessions",
  stocks: "Equities & ETFs",
};

export function FirstLaunchFunnel({ onComplete }: Props) {
  const theme = useYdlTheme("dark");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [profile, setProfile] = useState<OnboardingProfileV1>(emptyOnboardingProfile);
  const [prepIndex, setPrepIndex] = useState(0);
  const [previewActiveIndex, setPreviewActiveIndex] = useState(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      sub.remove();
    };
  }, []);

  const persist = useCallback((next: OnboardingProfileV1) => {
    const normalized = normalizeOnboardingProfile(next);
    setProfile(normalized);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void AsyncStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(normalized));
    }, 120);
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(ONBOARDING_PROFILE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as OnboardingProfileV1;
        if (parsed?.version === 1) {
          persist(normalizeOnboardingProfile({ ...emptyOnboardingProfile(), ...parsed }));
        }
      } catch {
        /* ignore corrupt */
      }
    });
  }, [persist]);

  const profilePreview = useMemo(
    () => buildOnboardingProfilePreview(profile),
    [profile],
  );

  const valueBullets = useMemo(
    () => buildPersonalizedValueBullets(profile),
    [profile],
  );

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
    const tickMs = reduceMotion ? 200 : 480;
    const id = setInterval(() => {
      i += 1;
      setPrepIndex(Math.min(i, prepStatuses.length - 1));
      if (i >= prepStatuses.length - 1) {
        clearInterval(id);
        const finished = normalizeOnboardingProfile({
          ...defaultOnboardingProfile(profile),
          completedAt: new Date().toISOString(),
        });
        void AsyncStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(finished));
        setTimeout(() => onComplete(finished), reduceMotion ? 180 : 520);
      }
    }, tickMs);
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

  return (
    <View
      style={[styles.root, { backgroundColor: theme.colors.background.primary }]}
      testID="first-launch-funnel"
    >
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
            <FuturesHeroVisual reduceMotion={!!reduceMotion} accentPain={profile.painPoint} />
            <YdlText role="title" style={styles.headline}>
              The market is not your biggest risk.
            </YdlText>
            <YdlText role="body" color="text.secondary" style={styles.support}>
              Trading days usually fall apart because of tilt, FOMO, inconsistent risk, and decisions
              made without a clear system.
            </YdlText>
            <YdlText role="label" color="text.secondary" style={styles.painLabel}>
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

            <ProfilePreviewCard preview={profilePreview} />

            <YdlText role="label" color="text.secondary">
              Market
            </YdlText>
            <View style={styles.marketGrid}>
              {MARKET_OPTIONS.map((opt) => (
                <MarketCard
                  key={opt.id}
                  id={opt.id}
                  label={opt.label}
                  description={MARKET_DESCRIPTIONS[opt.id]}
                  selected={profile.market === opt.id}
                  onPress={() => {
                    hapticSelect();
                    persist(applyMarketSelection(profile, opt.id));
                  }}
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
                            : [...profile.instruments, id];
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
                    persist({ ...profile, session: opt.id });
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
                    persist({ ...profile, style: opt.id });
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
                            : [...profile.propFirms, opt.id];
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
                if (
                  !profile.market ||
                  !profile.session ||
                  !profile.style ||
                  profile.propChallenge == null
                ) {
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
              Swipe through the workspace that will track your trades, risk, and prop challenge limits.
            </YdlText>
            <ProductPreviewPager
              profile={profile}
              onActiveIndexChange={setPreviewActiveIndex}
            />
            <View
              style={[styles.valueCard, { backgroundColor: theme.colors.surface.card }]}
              accessibilityLabel={`Preview ${previewActiveIndex + 1} of 4. Personalized value.`}
            >
              {valueBullets.map((line) => (
                <YdlText key={line} role="body">
                  {`• ${line}`}
                </YdlText>
              ))}
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
            <WorkspaceAssembly
              reduceMotion={!!reduceMotion}
              stage={prepIndex}
              preview={profilePreview}
            />
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
    paddingVertical: 8,
    minHeight: YDL_MIN_TOUCH_TARGET,
    justifyContent: "center",
  },
  skipSpacer: { height: 40 },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  headline: { marginTop: 4 },
  support: { marginTop: 6, marginBottom: 4 },
  painLabel: { marginTop: 12 },
  choiceCol: { gap: 8, marginTop: 8 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
  },
  heroVisual: { marginBottom: 2, justifyContent: "flex-start" },
  heroFrame: {
    borderRadius: 20,
    overflow: "hidden",
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  heroCards: { flexDirection: "row", gap: 8, paddingHorizontal: 10, marginTop: -2 },
  miniCard: { flex: 1, borderRadius: 12, padding: 10, gap: 2 },
  marketGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  marketCard: {
    width: "47.5%",
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
  },
  marketCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  marketCardIcons: { flexDirection: "row", alignItems: "center", gap: 6 },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(184,242,85,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  profilePreview: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 4,
    marginBottom: 6,
  },
  profileFocusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  valueCard: { borderRadius: 16, padding: 16, gap: 8, marginVertical: 6 },
  previewPager: { paddingVertical: 2 },
  previewCard: { borderRadius: 16, padding: 16, gap: 10 },
  previewInner: { gap: 6 },
  previewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pageDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  pageDot: { height: 6, borderRadius: 3 },
  heatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, width: 168 },
  heatCell: { width: 20, height: 20, borderRadius: 4 },
  bufferBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  bufferBarFill: { height: 8, borderRadius: 4 },
  assembly: { borderRadius: 18, padding: 16, gap: 8 },
  assemblyCard: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 4,
  },
  assemblyRow: { flexDirection: "row", gap: 10 },
  assemblyMetric: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 4,
  },
  prep: { paddingTop: 8, gap: 12 },
});
