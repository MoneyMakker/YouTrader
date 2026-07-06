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
const LIME = "#B8FF1A";
const LIME_BRIGHT = "#D4FF5C";
const LIME_MID = "#8ECC12";
const LIME_DARK = "#5A9908";
const LIME_DEEP = "#3D6B06";
const HORN = "#6BB010";
const HORN_DARK = "#4A7808";
const HOOF = "#2E4A06";
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

const JUMP_MS = 940;
const PAUSE_MS = 350;
const TURN_MS = 560;
const JUMP_ARC = 22;
const LAND_BOUNCE_MS = 120;

const CANDLE_SLOT_W = 15;
const CANDLE_GAP = 6;
const WICK_W = 3;

const BULL_PX_W = 26;
const BULL_PX_H = 22;

type PixelSpec = { x: number; y: number; w: number; h: number; c: string };
type BullPose = "idle" | "takeoff" | "airborne" | "land";
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

const CANDLE_COUNT = CANDLES.length;
const CANDLE_ROW_H = CHART_FRAME_H - CHART_PAD_TOP - CHART_PAD_BOTTOM - BASELINE_H - BASELINE_MT;

type CandleLayout = {
  x: number;
  bodyTop: number;
  centerX: number;
};

function buildCandleLayout(chartW: number): CandleLayout[] {
  const innerW = chartW - CHART_PAD_H * 2;
  return CANDLES.map((def, i) => {
    const x =
      CANDLE_COUNT === 1
        ? CHART_PAD_H
        : CHART_PAD_H + (i / (CANDLE_COUNT - 1)) * (innerW - CANDLE_SLOT_W);
    const totalH = def.wickTop + def.bodyH + def.wickBottom;
    const bodyTop = CHART_PAD_TOP + CANDLE_ROW_H - totalH + def.wickTop;
    return { x, bodyTop, centerX: x + CANDLE_SLOT_W / 2 };
  });
}

const CHART_AREA_H = 118;
const CHART_TOP_IN_AREA = CHART_AREA_H - CHART_FRAME_H;

function bullStandY(layout: CandleLayout): number {
  return CHART_TOP_IN_AREA + layout.bodyTop - BULL_PX_H * PX;
}

function bullStandX(layout: CandleLayout): number {
  return layout.centerX - (BULL_PX_W * PX) / 2;
}

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

function legSpecs(frame: number, pose: BullPose): PixelSpec[] {
  const f = frame % 3;
  const stride = pose === "takeoff" ? 1 : pose === "airborne" ? 2 : 0;
  const specs: PixelSpec[] = [];

  const frontShift = f === 0 ? 0 : f === 1 ? stride : -stride;
  const backShift = f === 0 ? 0 : f === 1 ? -stride : stride;

  specs.push(
    { x: 8 + backShift, y: 16, w: 2, h: 3, c: LIME_DARK },
    { x: 11 + backShift, y: 17, w: 2, h: 2, c: HOOF },
    { x: 14 + frontShift, y: 16, w: 2, h: 3, c: LIME_DARK },
    { x: 17 + frontShift, y: 17, w: 2, h: 2, c: HOOF },
    { x: 10 + backShift, y: 15, w: 2, h: 2, c: LIME_DEEP },
    { x: 16 + frontShift, y: 15, w: 2, h: 2, c: LIME_DEEP },
  );

  if (pose === "takeoff") {
    specs.push(
      { x: 13, y: 17, w: 2, h: 1, c: HOOF },
      { x: 15, y: 16, w: 2, h: 1, c: LIME_DARK },
    );
  }

  return specs;
}

function tailSpecs(frame: number): PixelSpec[] {
  const f = frame % 4;
  if (f === 0) {
    return [
      { x: 1, y: 11, w: 2, h: 1, c: LIME_MID },
      { x: 0, y: 12, w: 2, h: 1, c: LIME },
      { x: -1, y: 13, w: 2, h: 1, c: LIME_BRIGHT },
      { x: -2, y: 14, w: 2, h: 1, c: LIME_MID },
      { x: -1, y: 15, w: 1, h: 1, c: LIME_DARK },
    ];
  }
  if (f === 1) {
    return [
      { x: 1, y: 10, w: 2, h: 1, c: LIME_MID },
      { x: 0, y: 11, w: 2, h: 1, c: LIME },
      { x: -1, y: 10, w: 2, h: 1, c: LIME_BRIGHT },
      { x: -2, y: 9, w: 2, h: 1, c: LIME },
      { x: -3, y: 8, w: 1, h: 1, c: LIME_MID },
    ];
  }
  if (f === 2) {
    return [
      { x: 1, y: 9, w: 2, h: 1, c: LIME_MID },
      { x: 0, y: 8, w: 2, h: 1, c: LIME },
      { x: -1, y: 7, w: 2, h: 1, c: LIME_BRIGHT },
      { x: -2, y: 6, w: 2, h: 1, c: LIME },
      { x: -1, y: 5, w: 1, h: 1, c: LIME_MID },
    ];
  }
  return [
    { x: 1, y: 10, w: 2, h: 1, c: LIME_MID },
    { x: 0, y: 11, w: 2, h: 1, c: LIME },
    { x: -1, y: 12, w: 2, h: 1, c: LIME_BRIGHT },
    { x: -2, y: 11, w: 2, h: 1, c: LIME },
    { x: -3, y: 10, w: 1, h: 1, c: LIME_DARK },
  ];
}

function bullBodySpecs({
  blink,
  tailFrame,
  legFrame,
  earsPerked,
  headTilt,
  pose,
}: {
  blink: boolean;
  tailFrame: number;
  legFrame: number;
  earsPerked: boolean;
  headTilt: -1 | 0 | 1;
  pose: BullPose;
}): PixelSpec[] {
  const specs: PixelSpec[] = [];
  const tilt = headTilt;
  const y = (row: number) => row + tilt;

  specs.push(
    { x: 15, y: y(0), w: 2, h: 2, c: HORN },
    { x: 17, y: y(0), w: 2, h: 2, c: HORN },
    { x: 14, y: y(1), w: 2, h: 1, c: HORN_DARK },
    { x: 18, y: y(1), w: 2, h: 1, c: HORN_DARK },
    { x: 16, y: y(2), w: 1, h: 1, c: HORN_DARK },
    { x: 17, y: y(2), w: 1, h: 1, c: HORN_DARK },
  );

  specs.push(
    { x: earsPerked ? 12 : 13, y: y(3), w: 2, h: 1, c: LIME_MID },
    { x: earsPerked ? 17 : 16, y: y(3), w: 2, h: 1, c: LIME_MID },
  );

  specs.push(
    { x: 12, y: y(4), w: 8, h: 1, c: LIME_BRIGHT },
    { x: 11, y: y(5), w: 10, h: 1, c: LIME },
    { x: 12, y: y(6), w: 9, h: 1, c: LIME_MID },
    { x: 13, y: y(7), w: 2, h: 2, c: LIME_DARK },
    { x: 17, y: y(7), w: 2, h: 2, c: LIME_DARK },
    { x: 18, y: y(8), w: 3, h: 1, c: LIME_MID },
    { x: 19, y: y(9), w: 2, h: 1, c: LIME_DARK },
  );

  if (blink) {
    specs.push(
      { x: 13, y: y(6), w: 3, h: 1, c: LIME_DEEP },
      { x: 17, y: y(6), w: 3, h: 1, c: LIME_DEEP },
    );
  } else {
    specs.push(
      { x: 13, y: y(5), w: 3, h: 3, c: WHITE },
      { x: 17, y: y(5), w: 3, h: 3, c: WHITE },
      { x: 14, y: y(7), w: 2, h: 2, c: BLACK },
      { x: 18, y: y(7), w: 2, h: 2, c: BLACK },
      { x: 14, y: y(7), w: 1, h: 1, c: WHITE },
    );
  }

  const bodyStretch = pose === "takeoff" || pose === "airborne" ? 1 : 0;
  specs.push(
    { x: 5, y: y(8 + bodyStretch), w: 12, h: 1, c: LIME_BRIGHT },
    { x: 4, y: y(9 + bodyStretch), w: 14, h: 1, c: LIME },
    { x: 4, y: y(10 + bodyStretch), w: 14, h: 2, c: LIME_MID },
    { x: 5, y: y(12 + bodyStretch), w: 12, h: 1, c: LIME },
    { x: 6, y: y(13 + bodyStretch), w: 10, h: 1, c: LIME_DARK },
    { x: 7, y: y(14 + bodyStretch), w: 8, h: 1, c: LIME_DEEP },
  );

  specs.push(...legSpecs(legFrame, pose));
  specs.push(...tailSpecs(tailFrame));
  return specs;
}

const BullMascot = memo(function BullMascot({
  blink,
  tailFrame,
  legFrame,
  earsPerked,
  headTilt,
  pose,
}: {
  blink: boolean;
  tailFrame: number;
  legFrame: number;
  earsPerked: boolean;
  headTilt: -1 | 0 | 1;
  pose: BullPose;
}) {
  return (
    <View style={styles.bullCanvas}>
      <PixelGroup
        specs={bullBodySpecs({ blink, tailFrame, legFrame, earsPerked, headTilt, pose })}
      />
    </View>
  );
});

const DustPuff = memo(function DustPuff({ opacity }: { opacity: Animated.Value }) {
  return (
    <Animated.View pointerEvents="none" style={[styles.dustWrap, { opacity }]}>
      <View style={[styles.dustPixel, { left: 4, top: 8 }]} />
      <View style={[styles.dustPixel, { left: 12, top: 10 }]} />
      <View style={[styles.dustPixel, { left: 20, top: 7 }]} />
      <View style={[styles.dustPixel, { left: 28, top: 11, opacity: 0.7 }]} />
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
        <Text style={styles.bubbleText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
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
  twinkleMs: number;
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
    outputRange: star.pulse
      ? [0.42, 1, 0.55, 0.42]
      : [0.4, 0.72, 0.48, 0.4],
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

const ShootingStar = memo(function ShootingStar({
  startX,
  startY,
  progress,
}: {
  startX: number;
  startY: number;
  progress: Animated.Value;
}) {
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 72] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.55, 0.35, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.shootingStar,
        {
          left: startX,
          top: startY,
          opacity,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    />
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

function dialogueForLanding(landingIndex: number): DialogueKey {
  return landingIndex % 2 === 1 ? "authPixelDontGamble" : "authPixelTradeDiscipline";
}

/** Playful pixel mascot — bull hops candle to candle on a live chart. */
export const PixelNeonBull = memo(function PixelNeonBull() {
  const { width: screenW } = useWindowDimensions();
  const stageW = Math.min(screenW - 32, 360);
  const chartW = stageW * 0.88;
  const layout = useMemo(() => buildCandleLayout(chartW), [chartW]);

  const bullX = useRef(new Animated.Value(bullStandX(layout[0]))).current;
  const bullY = useRef(new Animated.Value(bullStandY(layout[0]))).current;
  const facingScale = useRef(new Animated.Value(1)).current;
  const bodyStretch = useRef(new Animated.Value(1)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const dustOpacity = useRef(new Animated.Value(0)).current;
  const candlePhase = useRef(new Animated.Value(0)).current;

  const starMasterA = useRef(new Animated.Value(0)).current;
  const starMasterB = useRef(new Animated.Value(0)).current;
  const starMasterC = useRef(new Animated.Value(0)).current;
  const shootingProgress = useRef(new Animated.Value(0)).current;
  const sparkleOpacity = useRef(new Animated.Value(0)).current;

  const [blink, setBlink] = useState(false);
  const [tailFrame, setTailFrame] = useState(0);
  const [legFrame, setLegFrame] = useState(0);
  const [earsPerked, setEarsPerked] = useState(false);
  const [headTilt, setHeadTilt] = useState<0 | 1 | -1>(0);
  const [pose, setPose] = useState<BullPose>("idle");
  const [dialogueKey, setDialogueKey] = useState<DialogueKey>("authPixelDontGamble");
  const [shootingStar, setShootingStar] = useState({ x: stageW * 0.12, y: 16, key: 0 });

  const mountedRef = useRef(true);
  const landingCounterRef = useRef(1);
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tailIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const legIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const earsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const headIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shootingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stars = useMemo<StarDef[]>(
    () => [
      { x: stageW * 0.05, y: 12, size: 4, phase: 0, pulse: true, twinkleMs: 2800 },
      { x: stageW * 0.92, y: 18, size: 3, phase: 1, pulse: false, twinkleMs: 3400 },
      { x: stageW * 0.08, y: 52, size: 3, phase: 2, pulse: true, twinkleMs: 3100 },
      { x: stageW * 0.88, y: 48, size: 4, phase: 0.5, pulse: false, twinkleMs: 3600 },
      { x: stageW * 0.42, y: 8, size: 2, phase: 1.2, pulse: false, twinkleMs: 4200 },
      { x: stageW * 0.62, y: 28, size: 2, phase: 0.8, pulse: true, twinkleMs: 3900 },
    ],
    [stageW],
  );

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

    const sparkleLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(5200),
        Animated.timing(sparkleOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(sparkleOpacity, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(6800),
      ]),
    );

    candleLoop.start();
    starLoopA.start();
    starLoopB.start();
    starLoopC.start();
    sparkleLoop.start();

    const scheduleBlink = () => {
      if (!mountedRef.current) return;
      const delay = 2800 + Math.random() * 3400;
      blinkTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setBlink(true);
        blinkTimeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setBlink(false);
          scheduleBlink();
        }, 110);
      }, delay);
    };
    scheduleBlink();

    tailIntervalRef.current = setInterval(() => {
      if (mountedRef.current) setTailFrame((v) => (v + 1) % 4);
    }, 320);

    legIntervalRef.current = setInterval(() => {
      if (mountedRef.current) setLegFrame((v) => (v + 1) % 3);
    }, 220);

    earsIntervalRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      setEarsPerked(true);
      setTimeout(() => {
        if (mountedRef.current) setEarsPerked(false);
      }, 160);
    }, 1600);

    headIntervalRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      const tilts: Array<0 | 1 | -1> = [0, 1, 0, -1, 0];
      const pick = tilts[Math.floor(Math.random() * tilts.length)];
      setHeadTilt(pick);
    }, 1800);

    const scheduleShootingStar = () => {
      if (!mountedRef.current) return;
      const delay = 10000 + Math.random() * 5000;
      shootingTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setShootingStar({
          x: stageW * (0.08 + Math.random() * 0.55),
          y: 8 + Math.random() * 36,
          key: Date.now(),
        });
        shootingProgress.setValue(0);
        Animated.timing(shootingProgress, {
          toValue: 1,
          duration: 680,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }).start(() => scheduleShootingStar());
      }, delay);
    };
    scheduleShootingStar();

    return () => {
      mountedRef.current = false;
      stopAnimatedValue(candlePhase);
      stopAnimatedValue(starMasterA);
      stopAnimatedValue(starMasterB);
      stopAnimatedValue(starMasterC);
      stopAnimatedValue(shootingProgress);
      stopAnimatedValue(sparkleOpacity);
      stopAnimatedValue(bullX);
      stopAnimatedValue(bullY);
      stopAnimatedValue(facingScale);
      stopAnimatedValue(bodyStretch);
      stopAnimatedValue(bubbleOpacity);
      stopAnimatedValue(dustOpacity);
      candleLoop.stop();
      starLoopA.stop();
      starLoopB.stop();
      starLoopC.stop();
      sparkleLoop.stop();
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
      if (tailIntervalRef.current) clearInterval(tailIntervalRef.current);
      if (legIntervalRef.current) clearInterval(legIntervalRef.current);
      if (earsIntervalRef.current) clearInterval(earsIntervalRef.current);
      if (headIntervalRef.current) clearInterval(headIntervalRef.current);
      if (shootingTimeoutRef.current) clearTimeout(shootingTimeoutRef.current);
    };
  }, [
    bodyStretch,
    bullX,
    bullY,
    bubbleOpacity,
    candlePhase,
    dustOpacity,
    facingScale,
    shootingProgress,
    sparkleOpacity,
    stageW,
    starMasterA,
    starMasterB,
    starMasterC,
  ]);

  useEffect(() => {
    let cancelled = false;

    const showBubbleOnCandle = (): Animated.CompositeAnimation =>
      Animated.sequence([
        Animated.timing(bubbleOpacity, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(PAUSE_MS),
        Animated.timing(bubbleOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]);

    const landOnCandle = (candleIndex: number): Animated.CompositeAnimation => {
      const targetX = bullStandX(layout[candleIndex]);
      const targetY = bullStandY(layout[candleIndex]);
      const key = dialogueForLanding(landingCounterRef.current);
      landingCounterRef.current += 1;
      setDialogueKey(key);
      setPose("land");
      setTimeout(() => {
        if (!cancelled) setPose("idle");
      }, 320);

      return Animated.sequence([
        Animated.parallel([
          Animated.timing(bullX, {
            toValue: targetX,
            duration: LAND_BOUNCE_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.sequence([
            Animated.timing(bullY, {
              toValue: targetY + 3,
              duration: 60,
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bullY, {
              toValue: targetY - 3,
              duration: 80,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bullY, {
              toValue: targetY,
              duration: 70,
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
          Animated.sequence([
            Animated.timing(dustOpacity, { toValue: 0.65, duration: 40, useNativeDriver: true }),
            Animated.timing(dustOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
          ]),
        ]),
        showBubbleOnCandle(),
      ]);
    };

    const hopToCandle = (fromIndex: number, toIndex: number): Animated.CompositeAnimation => {
      const fromX = bullStandX(layout[fromIndex]);
      const fromY = bullStandY(layout[fromIndex]);
      const toX = bullStandX(layout[toIndex]);
      const toY = bullStandY(layout[toIndex]);
      const apexY = Math.min(fromY, toY) - JUMP_ARC;

      bullX.setValue(fromX);
      bullY.setValue(fromY);
      bubbleOpacity.setValue(0);
      setPose("takeoff");
      setTimeout(() => {
        if (!cancelled) setPose("airborne");
      }, 160);

      return Animated.sequence([
        Animated.timing(bodyStretch, {
          toValue: 1.08,
          duration: 120,
          useNativeDriver: true,
          isInteraction: false,
        }),
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
              duration: Math.round(JUMP_MS * 0.48),
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bullY, {
              toValue: toY,
              duration: Math.round(JUMP_MS * 0.52),
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
          Animated.sequence([
            Animated.delay(Math.round(JUMP_MS * 0.35)),
            Animated.timing(bodyStretch, {
              toValue: 0.94,
              duration: 140,
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bodyStretch, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
        ]),
      ]);
    };

    const turnAround = (nextScale: number, atIndex: number): Animated.CompositeAnimation => {
      const standY = bullStandY(layout[atIndex]);
      setPose("idle");
      return Animated.sequence([
        Animated.timing(bullY, {
          toValue: standY + 2,
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
          toValue: standY,
          duration: 160,
          easing: Easing.out(Easing.bounce),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(200),
      ]);
    };

    const runTrip = (direction: "right" | "left", onDone: () => void) => {
      if (cancelled) return;

      const startIndex = direction === "right" ? 0 : CANDLE_COUNT - 1;
      const step = direction === "right" ? 1 : -1;
      facingScale.setValue(direction === "right" ? 1 : -1);

      const steps: Animated.CompositeAnimation[] = [
        landOnCandle(startIndex),
      ];

      for (let i = startIndex; i !== startIndex + step * CANDLE_COUNT; i += step) {
        const next = i + step;
        if (next < 0 || next >= CANDLE_COUNT) break;
        steps.push(
          Animated.sequence([
            hopToCandle(i, next),
            landOnCandle(next),
          ]),
        );
      }

      const endIndex = direction === "right" ? CANDLE_COUNT - 1 : 0;
      const nextScale = direction === "right" ? -1 : 1;
      steps.push(turnAround(nextScale, endIndex));

      Animated.sequence(steps).start(({ finished }) => {
        if (finished && !cancelled) onDone();
      });
    };

    bullX.setValue(bullStandX(layout[0]));
    bullY.setValue(bullStandY(layout[0]));
    facingScale.setValue(1);
    landingCounterRef.current = 1;
    setDialogueKey("authPixelDontGamble");

    const loopForever = () => {
      runTrip("right", () => {
        runTrip("left", () => {
          if (!cancelled) loopForever();
        });
      });
    };

    loopForever();

    return () => {
      cancelled = true;
      bullX.stopAnimation();
      bullY.stopAnimation();
      facingScale.stopAnimation();
      bodyStretch.stopAnimation();
      bubbleOpacity.stopAnimation();
      dustOpacity.stopAnimation();
    };
  }, [bodyStretch, bubbleOpacity, bullX, bullY, dustOpacity, facingScale, layout]);

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
          height: 118,
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

        <ShootingStar
          key={shootingStar.key}
          startX={shootingStar.x}
          startY={shootingStar.y}
          progress={shootingProgress}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.nearStarSparkle,
            {
              left: stars[0]?.x ?? 12,
              top: (stars[0]?.y ?? 12) + 6,
              opacity: sparkleOpacity,
            },
          ]}
        />

        <View style={dynamicStyles.chartArea}>
          <ChartArea candlePhase={candlePhase} />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bullOverlay,
              {
                transform: [
                  { translateX: bullX },
                  { translateY: bullY },
                ],
              },
            ]}
          >
            <View style={styles.bullCluster}>
              <SpeechBubble text={t(dialogueKey)} opacity={bubbleOpacity} />
              <Animated.View
                style={{
                  transform: [{ scaleX: facingScale }, { scaleY: bodyStretch }],
                }}
              >
                <BullMascot
                  blink={blink}
                  tailFrame={tailFrame}
                  legFrame={legFrame}
                  earsPerked={earsPerked}
                  headTilt={headTilt}
                  pose={pose}
                />
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
    backgroundColor: "rgba(184,255,26,0.85)",
  },
  starV: {
    position: "absolute",
    width: 1,
    backgroundColor: "rgba(184,255,26,0.85)",
  },
  shootingStar: {
    position: "absolute",
    width: 10,
    height: 2,
    backgroundColor: "rgba(184,255,26,0.55)",
    zIndex: 1,
  },
  nearStarSparkle: {
    position: "absolute",
    width: 4,
    height: 4,
    backgroundColor: "rgba(184,255,26,0.65)",
    transform: [{ rotate: "45deg" }],
    zIndex: 1,
  },
  bullOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 5,
  },
  bullCluster: {
    alignItems: "center",
    width: BULL_PX_W * PX + 36,
    marginLeft: -18,
  },
  bullCanvas: {
    width: BULL_PX_W * PX,
    height: BULL_PX_H * PX,
    position: "relative",
  },
  dustWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -2,
    height: 14,
  },
  dustPixel: {
    position: "absolute",
    width: 3,
    height: 3,
    backgroundColor: DUST,
  },
  bubbleWrap: {
    alignItems: "center",
    marginBottom: 4,
  },
  bubbleBox: {
    borderWidth: 2,
    borderColor: BLACK,
    backgroundColor: WHITE,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 132,
    maxWidth: 188,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleText: {
    color: BLACK,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
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
    height: 118,
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
