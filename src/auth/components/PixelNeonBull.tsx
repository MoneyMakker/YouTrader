import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { t } from "../../i18n";

const PX = 3;
const LIME = "#A3FF12";
const LIME_BRIGHT = "#C8FF4A";
const LIME_MID = "#7ACC0A";
const LIME_DARK = "#4A8808";
const LIME_DEEP = "#2E5A06";
const HORN = "#6BB010";
const HORN_TIP = "#D4FF5C";
const HORN_DARK = "#3D6B06";
const PURPLE_EYE = "#B026FF";
const PURPLE_GLOW = "#7A18BF";
const PURPLE_CORE = "#D580FF";
const HOOF = "#1A2E04";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const VOID = "#000000";
const WICK = "#2A3040";
const GROUND = "#1A1F2A";
const CANDLE_GREEN = "#3DDB4A";
const CANDLE_GREEN_DARK = "#2A9E34";
const CANDLE_RED = "#FF3B5F";
const CANDLE_RED_DARK = "#CC2F4C";
const DUST = "#6B7280";

const STAGE_H = 228;
const CHART_FRAME_H = 108;
const CHART_PAD_H = 10;
const CHART_PAD_TOP = 10;
const CHART_PAD_BOTTOM = 8;
const BASELINE_H = 2;
const BASELINE_MT = 6;

const READ_PAUSE_MS = 2800;
const JUMP_MS = 1280;
const CROUCH_MS = 240;
const LAND_SQUASH_MS = 190;
const RECOVER_MS = 320;
const TURN_MS = 520;
const JUMP_ARC = 52;

const CANDLE_SLOT_W = 15;
const CANDLE_GAP = 6;
const WICK_W = 3;

const BULL_PX_W = 32;
const BULL_PX_H = 28;

type PixelSpec = { x: number; y: number; w: number; h: number; c: string };
type BullPose = "idle" | "crouch" | "airborne" | "land";
type DialogueKey = "authPixelDontGamble" | "authPixelTradeDiscipline";

type CandleDef = {
  bullish: boolean;
  bodyH: number;
  wickTop: number;
  wickBottom: number;
};

const CANDLES: CandleDef[] = [
  { bullish: true, bodyH: 26, wickTop: 7, wickBottom: 5 },
  { bullish: false, bodyH: 18, wickTop: 5, wickBottom: 7 },
  { bullish: true, bodyH: 38, wickTop: 9, wickBottom: 5 },
  { bullish: true, bodyH: 24, wickTop: 6, wickBottom: 4 },
  { bullish: false, bodyH: 30, wickTop: 7, wickBottom: 6 },
  { bullish: true, bodyH: 32, wickTop: 8, wickBottom: 5 },
  { bullish: false, bodyH: 20, wickTop: 6, wickBottom: 6 },
  { bullish: true, bodyH: 42, wickTop: 10, wickBottom: 5 },
];

const CHART_AREA_H = 118;
const CHART_TOP_IN_AREA = CHART_AREA_H - CHART_FRAME_H;

const Pixel = memo(function Pixel({ x, y, w, h, c }: PixelSpec) {
  return (
    <View
      style={{
        position: "absolute",
        left: x * PX,
        top: y * PX,
        width: w * PX,
        height: h * PX,
        backgroundColor: c,
      }}
    />
  );
});

const PixelGroup = memo(function PixelGroup({ specs }: { specs: PixelSpec[] }) {
  return (
    <>
      {specs.map((p, i) => (
        <Pixel key={`${p.x}-${p.y}-${p.c}-${i}`} {...p} />
      ))}
    </>
  );
});

function legSpecs(pose: BullPose): PixelSpec[] {
  if (pose === "airborne") {
    return [
      { x: 9, y: 22, w: 3, h: 2, c: LIME_DARK },
      { x: 20, y: 22, w: 3, h: 2, c: LIME_DARK },
      { x: 10, y: 23, w: 2, h: 1, c: HOOF },
      { x: 21, y: 23, w: 2, h: 1, c: HOOF },
    ];
  }
  if (pose === "crouch") {
    return [
      { x: 8, y: 23, w: 3, h: 3, c: LIME_DARK },
      { x: 11, y: 24, w: 3, h: 2, c: HOOF },
      { x: 18, y: 23, w: 3, h: 3, c: LIME_DARK },
      { x: 21, y: 24, w: 3, h: 2, c: HOOF },
      { x: 9, y: 22, w: 2, h: 2, c: LIME_DEEP },
      { x: 19, y: 22, w: 2, h: 2, c: LIME_DEEP },
    ];
  }
  if (pose === "land") {
    return [
      { x: 6, y: 23, w: 4, h: 3, c: LIME_DARK },
      { x: 10, y: 24, w: 3, h: 2, c: HOOF },
      { x: 19, y: 23, w: 4, h: 3, c: LIME_DARK },
      { x: 23, y: 24, w: 3, h: 2, c: HOOF },
      { x: 7, y: 22, w: 3, h: 2, c: LIME_DEEP },
      { x: 20, y: 22, w: 3, h: 2, c: LIME_DEEP },
    ];
  }
  return [
    { x: 9, y: 22, w: 3, h: 4, c: LIME_DARK },
    { x: 10, y: 25, w: 3, h: 2, c: HOOF },
    { x: 20, y: 22, w: 3, h: 4, c: LIME_DARK },
    { x: 21, y: 25, w: 3, h: 2, c: HOOF },
    { x: 10, y: 21, w: 2, h: 2, c: LIME_DEEP },
    { x: 21, y: 21, w: 2, h: 2, c: LIME_DEEP },
  ];
}

function buildBullSpecs(pose: BullPose, blink: boolean): PixelSpec[] {
  const specs: PixelSpec[] = [];
  const yOff = pose === "crouch" ? 1 : pose === "airborne" ? -1 : 0;
  const y = (row: number) => row + yOff;

  specs.push(
    { x: 5, y: y(0), w: 3, h: 2, c: HORN_TIP },
    { x: 7, y: y(0), w: 2, h: 2, c: HORN },
    { x: 8, y: y(1), w: 2, h: 2, c: HORN },
    { x: 9, y: y(2), w: 2, h: 1, c: HORN_DARK },
    { x: 10, y: y(3), w: 1, h: 1, c: HORN_DARK },
    { x: 22, y: y(0), w: 3, h: 2, c: HORN_TIP },
    { x: 23, y: y(0), w: 2, h: 2, c: HORN },
    { x: 21, y: y(1), w: 2, h: 2, c: HORN },
    { x: 20, y: y(2), w: 2, h: 1, c: HORN_DARK },
    { x: 19, y: y(3), w: 1, h: 1, c: HORN_DARK },
  );

  specs.push(
    { x: 10, y: y(4), w: 2, h: 1, c: LIME_MID },
    { x: 20, y: y(4), w: 2, h: 1, c: LIME_MID },
    { x: 11, y: y(5), w: 10, h: 1, c: LIME_BRIGHT },
    { x: 10, y: y(6), w: 12, h: 1, c: LIME },
    { x: 11, y: y(7), w: 10, h: 1, c: LIME_MID },
  );

  if (blink) {
    specs.push(
      { x: 12, y: y(7), w: 4, h: 1, c: LIME_DEEP },
      { x: 18, y: y(7), w: 4, h: 1, c: LIME_DEEP },
    );
  } else {
    specs.push(
      { x: 11, y: y(6), w: 1, h: 1, c: PURPLE_GLOW },
      { x: 12, y: y(5), w: 5, h: 5, c: PURPLE_GLOW },
      { x: 13, y: y(6), w: 3, h: 3, c: PURPLE_EYE },
      { x: 14, y: y(7), w: 1, h: 1, c: PURPLE_CORE },
      { x: 15, y: y(6), w: 1, h: 1, c: WHITE },
      { x: 17, y: y(6), w: 1, h: 1, c: PURPLE_GLOW },
      { x: 18, y: y(5), w: 5, h: 5, c: PURPLE_GLOW },
      { x: 19, y: y(6), w: 3, h: 3, c: PURPLE_EYE },
      { x: 20, y: y(7), w: 1, h: 1, c: PURPLE_CORE },
      { x: 21, y: y(6), w: 1, h: 1, c: WHITE },
    );
  }

  specs.push(
    { x: 13, y: y(8), w: 6, h: 1, c: LIME_DARK },
    { x: 14, y: y(9), w: 4, h: 1, c: LIME_DEEP },
    { x: 24, y: y(8), w: 3, h: 2, c: LIME_MID },
    { x: 25, y: y(9), w: 2, h: 1, c: LIME_DARK },
    { x: 26, y: y(10), w: 1, h: 1, c: LIME_DEEP },
  );

  const bodyDrop = pose === "crouch" ? 1 : 0;
  specs.push(
    { x: 6, y: y(10 + bodyDrop), w: 18, h: 1, c: LIME_BRIGHT },
    { x: 5, y: y(11 + bodyDrop), w: 20, h: 1, c: LIME },
    { x: 5, y: y(12 + bodyDrop), w: 20, h: 2, c: LIME_MID },
    { x: 6, y: y(14 + bodyDrop), w: 18, h: 1, c: LIME },
    { x: 7, y: y(15 + bodyDrop), w: 16, h: 1, c: LIME_DARK },
    { x: 8, y: y(16 + bodyDrop), w: 14, h: 1, c: LIME_DEEP },
    { x: 4, y: y(13 + bodyDrop), w: 2, h: 2, c: LIME_MID },
    { x: 24, y: y(13 + bodyDrop), w: 2, h: 2, c: LIME_MID },
  );

  specs.push(
    { x: 2, y: y(12 + bodyDrop), w: 2, h: 1, c: LIME_MID },
    { x: 1, y: y(13 + bodyDrop), w: 2, h: 1, c: LIME },
    { x: 0, y: y(14 + bodyDrop), w: 2, h: 1, c: LIME_BRIGHT },
    { x: -1, y: y(15 + bodyDrop), w: 2, h: 1, c: LIME_MID },
  );

  specs.push(...legSpecs(pose));
  return specs;
}

const BullMascot = memo(function BullMascot({ pose, blink }: { pose: BullPose; blink: boolean }) {
  const specs = useMemo(() => buildBullSpecs(pose, blink), [pose, blink]);
  return (
    <View style={styles.bullCanvas}>
      <PixelGroup specs={specs} />
    </View>
  );
});

const DustPuff = memo(function DustPuff({ opacity }: { opacity: Animated.Value }) {
  return (
    <Animated.View pointerEvents="none" style={[styles.dustWrap, { opacity }]}>
      <View style={[styles.dustPixel, { left: 2, top: 8 }]} />
      <View style={[styles.dustPixel, { left: 10, top: 10 }]} />
      <View style={[styles.dustPixel, { left: 18, top: 7 }]} />
      <View style={[styles.dustPixel, { left: 26, top: 11, opacity: 0.7 }]} />
      <View style={[styles.dustPixel, { left: 34, top: 9, opacity: 0.55 }]} />
    </Animated.View>
  );
});

const SpeechBubble = memo(function SpeechBubble({
  text,
  opacity,
}: {
  text: string;
  opacity: Animated.Value;
}) {
  return (
    <Animated.View style={[styles.bubbleWrap, { opacity }]}>
      <View style={styles.bubbleBox}>
        <View style={styles.bubbleCornerTL} />
        <View style={styles.bubbleCornerTR} />
        <View style={styles.bubbleCornerBL} />
        <View style={styles.bubbleCornerBR} />
        <Text style={styles.bubbleText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>
          {text}
        </Text>
      </View>
      <View style={styles.bubbleTailCol}>
        <View style={styles.bubbleTailMid} />
        <View style={styles.bubbleTailTip} />
      </View>
    </Animated.View>
  );
});

type StarDef = {
  x: number;
  y: number;
  size: number;
  phase: number;
  pulse: boolean;
};

const TwinkleStar = memo(function TwinkleStar({
  star,
  master,
}: {
  star: StarDef;
  master: Animated.Value;
}) {
  const opacity = master.interpolate({
    inputRange: [0, 0.35, 0.7, 1],
    outputRange: star.pulse ? [0.42, 1, 0.55, 0.42] : [0.4, 0.72, 0.48, 0.4],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.star,
        { left: star.x, top: star.y, width: star.size, height: star.size, opacity },
      ]}
    >
      <View style={[styles.starH, { width: star.size }]} />
      <View style={[styles.starV, { height: star.size }]} />
    </Animated.View>
  );
});

const ChartCandle = memo(function ChartCandle({
  def,
  bobY,
}: {
  def: CandleDef;
  bobY: Animated.AnimatedInterpolation<number>;
}) {
  const bodyColor = def.bullish ? CANDLE_GREEN : CANDLE_RED;
  const shade = def.bullish ? CANDLE_GREEN_DARK : CANDLE_RED_DARK;

  return (
    <Animated.View style={[styles.candleSlot, { transform: [{ translateY: bobY }] }]}>
      <View style={[styles.wick, { height: def.wickTop }]} />
      <View style={[styles.candleBody, { height: def.bodyH, backgroundColor: bodyColor }]}>
        <View style={[styles.candleShade, { backgroundColor: shade }]} />
      </View>
      <View style={[styles.wick, { height: def.wickBottom }]} />
    </Animated.View>
  );
});

const ChartArea = memo(function ChartArea({
  candlePhase,
}: {
  candlePhase: Animated.Value;
}) {
  return (
    <View style={styles.chartStack}>
      <View style={styles.chartFrame}>
        <View style={styles.candleRow}>
          {CANDLES.map((def, i) => {
            const bobY = candlePhase.interpolate({
              inputRange: [0, 0.25, 0.5, 0.75, 1],
              outputRange: [0, i % 2 === 0 ? -0.5 : 0.25, 0, i % 2 === 0 ? 0.25 : -0.5, 0],
            });
            return <ChartCandle key={`candle-${i}`} def={def} bobY={bobY} />;
          })}
        </View>
        <View style={styles.chartBaseline} />
      </View>
    </View>
  );
});

function stopAnimatedValue(value: Animated.Value) {
  value.stopAnimation();
  value.removeAllListeners();
}

function bullGroundY(): number {
  const baselineTop = CHART_TOP_IN_AREA + CHART_FRAME_H - CHART_PAD_BOTTOM - BASELINE_H - BASELINE_MT;
  return baselineTop - BULL_PX_H * PX + 2;
}

function bullLeftStandX(): number {
  return Math.max(2, CHART_PAD_H - 6);
}

function bullRightStandX(chartW: number): number {
  return chartW - CHART_PAD_H - BULL_PX_W * PX + 6;
}

/** Premium pixel mascot — bull leaps across the candlestick chart with discipline messaging. */
export const PixelNeonBull = memo(function PixelNeonBull() {
  const { width: screenW } = useWindowDimensions();
  const stageW = Math.min(screenW - 32, 360);
  const chartW = stageW * 0.88;

  const leftX = bullLeftStandX();
  const rightX = bullRightStandX(chartW);
  const groundY = bullGroundY();

  const bullX = useRef(new Animated.Value(leftX)).current;
  const bullY = useRef(new Animated.Value(groundY)).current;
  const facingScale = useRef(new Animated.Value(1)).current;
  const squashX = useRef(new Animated.Value(1)).current;
  const squashY = useRef(new Animated.Value(1)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const dustOpacity = useRef(new Animated.Value(0)).current;
  const candlePhase = useRef(new Animated.Value(0)).current;
  const starMasterA = useRef(new Animated.Value(0)).current;
  const starMasterB = useRef(new Animated.Value(0)).current;
  const starMasterC = useRef(new Animated.Value(0)).current;

  const [blink, setBlink] = useState(false);
  const [pose, setPose] = useState<BullPose>("idle");
  const [dialogueKey, setDialogueKey] = useState<DialogueKey>("authPixelDontGamble");

  const mountedRef = useRef(true);
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scaleX = useMemo(() => Animated.multiply(facingScale, squashX), [facingScale, squashX]);

  const stars = useMemo<StarDef[]>(
    () => [
      { x: stageW * 0.05, y: 12, size: 4, phase: 0, pulse: true },
      { x: stageW * 0.92, y: 18, size: 3, phase: 1, pulse: false },
      { x: stageW * 0.08, y: 52, size: 3, phase: 2, pulse: true },
      { x: stageW * 0.88, y: 48, size: 4, phase: 0.5, pulse: false },
      { x: stageW * 0.42, y: 8, size: 2, phase: 1.2, pulse: false },
      { x: stageW * 0.62, y: 28, size: 2, phase: 0.8, pulse: true },
    ],
    [stageW],
  );

  const setPoseSafe = (next: BullPose, resetMs?: number) => {
    setPose(next);
    if (poseTimeoutRef.current) clearTimeout(poseTimeoutRef.current);
    if (resetMs && resetMs > 0) {
      poseTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) setPose("idle");
      }, resetMs);
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const candleLoop = Animated.loop(
      Animated.timing(candlePhase, {
        toValue: 1,
        duration: 6400,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
        isInteraction: false,
      }),
    );

    const starLoopA = Animated.loop(
      Animated.sequence([
        Animated.timing(starMasterA, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(starMasterA, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const starLoopB = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(starMasterB, {
          toValue: 1,
          duration: 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(starMasterB, {
          toValue: 0,
          duration: 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const starLoopC = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(starMasterC, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(starMasterC, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    candleLoop.start();
    starLoopA.start();
    starLoopB.start();
    starLoopC.start();

    const scheduleBlink = () => {
      if (!mountedRef.current) return;
      const delay = 3200 + Math.random() * 2800;
      blinkTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setBlink(true);
        blinkTimeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setBlink(false);
          scheduleBlink();
        }, 120);
      }, delay);
    };
    scheduleBlink();

    return () => {
      mountedRef.current = false;
      stopAnimatedValue(candlePhase);
      stopAnimatedValue(starMasterA);
      stopAnimatedValue(starMasterB);
      stopAnimatedValue(starMasterC);
      stopAnimatedValue(bullX);
      stopAnimatedValue(bullY);
      stopAnimatedValue(facingScale);
      stopAnimatedValue(squashX);
      stopAnimatedValue(squashY);
      stopAnimatedValue(bubbleOpacity);
      stopAnimatedValue(dustOpacity);
      candleLoop.stop();
      starLoopA.stop();
      starLoopB.stop();
      starLoopC.stop();
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
      if (poseTimeoutRef.current) clearTimeout(poseTimeoutRef.current);
      poseTimersRef.current.forEach(clearTimeout);
      poseTimersRef.current = [];
    };
  }, [bullX, bullY, bubbleOpacity, candlePhase, dustOpacity, facingScale, squashX, squashY, starMasterA, starMasterB, starMasterC]);

  useEffect(() => {
    let cancelled = false;

    const clearPoseTimers = () => {
      poseTimersRef.current.forEach(clearTimeout);
      poseTimersRef.current = [];
    };

    const schedulePose = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        if (!cancelled && mountedRef.current) fn();
      }, ms);
      poseTimersRef.current.push(id);
    };

    const showBubble = (key: DialogueKey): Animated.CompositeAnimation => {
      setDialogueKey(key);
      bubbleOpacity.setValue(0);
      return Animated.sequence([
        Animated.timing(bubbleOpacity, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(READ_PAUSE_MS),
        Animated.timing(bubbleOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]);
    };

    const jumpAcross = (fromX: number, toX: number): Animated.CompositeAnimation => {
      const apexY = groundY - JUMP_ARC;
      bullX.setValue(fromX);
      bullY.setValue(groundY);

      return Animated.sequence([
        Animated.parallel([
          Animated.timing(squashY, {
            toValue: 0.84,
            duration: CROUCH_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(squashX, {
            toValue: 1.12,
            duration: CROUCH_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(bullX, {
            toValue: toX,
            duration: JUMP_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.sequence([
            Animated.timing(bullY, {
              toValue: apexY,
              duration: Math.round(JUMP_MS * 0.46),
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bullY, {
              toValue: groundY,
              duration: Math.round(JUMP_MS * 0.54),
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
          Animated.sequence([
            Animated.timing(squashY, { toValue: 1.05, duration: 120, useNativeDriver: true, isInteraction: false }),
            Animated.timing(squashY, { toValue: 1, duration: 160, useNativeDriver: true, isInteraction: false }),
            Animated.timing(squashX, { toValue: 1, duration: 160, useNativeDriver: true, isInteraction: false }),
          ]),
        ]),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(bullY, {
              toValue: groundY + 4,
              duration: 70,
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bullY, {
              toValue: groundY - 2,
              duration: 100,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bullY, {
              toValue: groundY,
              duration: 90,
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
          Animated.sequence([
            Animated.timing(squashY, {
              toValue: 0.88,
              duration: LAND_SQUASH_MS,
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(squashX, {
              toValue: 1.1,
              duration: LAND_SQUASH_MS,
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(squashY, {
              toValue: 1,
              duration: RECOVER_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(squashX, {
              toValue: 1,
              duration: RECOVER_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
          Animated.sequence([
            Animated.timing(dustOpacity, { toValue: 0.7, duration: 50, useNativeDriver: true, isInteraction: false }),
            Animated.timing(dustOpacity, { toValue: 0, duration: 260, useNativeDriver: true, isInteraction: false }),
          ]),
        ]),
      ]);
    };

    const turnAround = (nextScale: number): Animated.CompositeAnimation => {
      setPoseSafe("idle");
      return Animated.sequence([
        Animated.timing(bullY, {
          toValue: groundY + 2,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(facingScale, {
          toValue: nextScale,
          duration: TURN_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(bullY, {
          toValue: groundY,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(180),
      ]);
    };

    const beginJump = (fromX: number, toX: number, onDone: () => void) => {
      clearPoseTimers();
      setPoseSafe("crouch");
      schedulePose(() => setPoseSafe("airborne"), CROUCH_MS + 90);
      schedulePose(() => setPoseSafe("land", 360), CROUCH_MS + JUMP_MS);
      jumpAcross(fromX, toX).start(({ finished }) => {
        if (finished && !cancelled) onDone();
      });
    };

    const beginBubble = (key: DialogueKey, onDone: () => void) => {
      showBubble(key).start(({ finished }) => {
        if (finished && !cancelled) onDone();
      });
    };

    const beginTurn = (nextScale: number, onDone: () => void) => {
      turnAround(nextScale).start(({ finished }) => {
        if (finished && !cancelled) onDone();
      });
    };

    const runCycle = () => {
      if (cancelled) return;

      bullX.setValue(leftX);
      bullY.setValue(groundY);
      facingScale.setValue(1);
      squashX.setValue(1);
      squashY.setValue(1);
      setPoseSafe("idle");

      beginBubble("authPixelDontGamble", () => {
        beginJump(leftX, rightX, () => {
          beginTurn(-1, () => {
            beginBubble("authPixelTradeDiscipline", () => {
              beginJump(rightX, leftX, () => {
                beginTurn(1, () => {
                  if (!cancelled) runCycle();
                });
              });
            });
          });
        });
      });
    };

    runCycle();

    return () => {
      cancelled = true;
      clearPoseTimers();
      bullX.stopAnimation();
      bullY.stopAnimation();
      facingScale.stopAnimation();
      squashX.stopAnimation();
      squashY.stopAnimation();
      bubbleOpacity.stopAnimation();
      dustOpacity.stopAnimation();
    };
  }, [bubbleOpacity, bullX, bullY, dustOpacity, facingScale, groundY, leftX, rightX, squashX, squashY]);

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          width: stageW,
          height: STAGE_H,
          alignSelf: "center",
          marginBottom: 2,
          overflow: "visible",
          backgroundColor: VOID,
        },
        stage: {
          width: stageW,
          height: STAGE_H,
          position: "relative",
          alignItems: "center",
          backgroundColor: VOID,
        },
        chartArea: {
          position: "absolute",
          bottom: 8,
          width: chartW,
          height: CHART_AREA_H,
          alignItems: "center",
          zIndex: 2,
        },
      }),
    [chartW, stageW],
  );

  const starMasterFor = (phase: number) => {
    if (phase < 0.7) return starMasterA;
    if (phase < 1.4) return starMasterB;
    return starMasterC;
  };

  return (
    <View style={dynamicStyles.wrap}>
      <View style={dynamicStyles.stage}>
        {stars.map((star, i) => (
          <TwinkleStar key={`star-${i}`} star={star} master={starMasterFor(star.phase)} />
        ))}

        <View style={dynamicStyles.chartArea}>
          <ChartArea candlePhase={candlePhase} />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bullOverlay,
              {
                transform: [{ translateX: bullX }, { translateY: bullY }],
              },
            ]}
          >
            <View style={styles.bullCluster}>
              <SpeechBubble text={t(dialogueKey)} opacity={bubbleOpacity} />
              <Animated.View style={{ transform: [{ scaleX }, { scaleY: squashY }] }}>
                <BullMascot pose={pose} blink={blink} />
                <DustPuff opacity={dustOpacity} />
              </Animated.View>
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  star: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  starH: {
    position: "absolute",
    height: 1,
    backgroundColor: "rgba(163,255,18,0.85)",
  },
  starV: {
    position: "absolute",
    width: 1,
    backgroundColor: "rgba(163,255,18,0.85)",
  },
  bullOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 5,
  },
  bullCluster: {
    alignItems: "center",
    width: BULL_PX_W * PX + 40,
    marginLeft: -20,
  },
  bullCanvas: {
    width: BULL_PX_W * PX,
    height: BULL_PX_H * PX,
    position: "relative",
  },
  dustWrap: {
    position: "absolute",
    left: -4,
    right: -4,
    bottom: -2,
    height: 16,
  },
  dustPixel: {
    position: "absolute",
    width: 3,
    height: 3,
    backgroundColor: DUST,
  },
  bubbleWrap: {
    alignItems: "center",
    marginBottom: 6,
  },
  bubbleBox: {
    borderWidth: 2,
    borderColor: BLACK,
    backgroundColor: WHITE,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 148,
    maxWidth: 196,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bubbleCornerTL: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 4,
    height: 4,
    backgroundColor: BLACK,
  },
  bubbleCornerTR: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 4,
    height: 4,
    backgroundColor: BLACK,
  },
  bubbleCornerBL: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 4,
    height: 4,
    backgroundColor: BLACK,
  },
  bubbleCornerBR: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 4,
    height: 4,
    backgroundColor: BLACK,
  },
  bubbleText: {
    color: BLACK,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.35,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  bubbleTailCol: {
    alignItems: "center",
    marginTop: -1,
  },
  bubbleTailMid: {
    width: 10,
    height: 8,
    backgroundColor: WHITE,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: BLACK,
  },
  bubbleTailTip: {
    width: 8,
    height: 8,
    backgroundColor: WHITE,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: BLACK,
    transform: [{ rotate: "45deg" }],
    marginTop: -6,
    marginLeft: 8,
  },
  candleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flex: 1,
    gap: CANDLE_GAP,
  },
  candleSlot: {
    width: CANDLE_SLOT_W,
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
  },
  wick: {
    width: WICK_W,
    backgroundColor: WICK,
  },
  candleBody: {
    width: CANDLE_SLOT_W - 2,
    borderRadius: 2,
    overflow: "hidden",
  },
  candleShade: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  chartBaseline: {
    height: BASELINE_H,
    backgroundColor: GROUND,
    marginTop: BASELINE_MT,
    borderRadius: 1,
  },
  chartStack: {
    width: "100%",
    height: CHART_AREA_H,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  chartFrame: {
    width: "100%",
    height: CHART_FRAME_H,
    borderWidth: 2,
    borderColor: "#1E2430",
    borderRadius: 10,
    backgroundColor: "#050608",
    paddingHorizontal: CHART_PAD_H,
    paddingTop: CHART_PAD_TOP,
    paddingBottom: CHART_PAD_BOTTOM,
    overflow: "visible",
  },
});
