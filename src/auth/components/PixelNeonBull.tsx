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
const DUST = "#6B7280";

const STAGE_H = 228;
const SPEED = 1 / 1.45;
const ms = (value: number) => Math.round(value * SPEED);
const READ_PAUSE_MS = ms(2300);
const JUMP_MS = ms(1280);
const CROUCH_MS = ms(240);
const LAND_SQUASH_MS = ms(190);
const RECOVER_MS = ms(320);
const TURN_MS = ms(520);
const JUMP_ARC = 44;
const STAR_COUNT = 114;

const BULL_PX_W = 36;
const BULL_PX_H = 30;
const BULL_RENDER_H = BULL_PX_H * PX;
const BULL_CLUSTER_W = BULL_PX_W * PX + 40;

type PixelSpec = { x: number; y: number; w: number; h: number; c: string };
type BullPose = "idle" | "crouch" | "airborne" | "land";
type DialogueKey = "authPixelDontGamble" | "authPixelTradeDiscipline";
type StarTone = "lime" | "purple" | "violet" | "white";
type StarKind = "dot" | "cross" | "sparkle";

type StarDef = {
  x: number;
  y: number;
  size: number;
  phase: number;
  pulse: boolean;
  glow: boolean;
  tone: StarTone;
  kind: StarKind;
  brightness: number;
};

const STAR_PALETTE: Record<StarTone, { cross: string; dot: string; glow: string }> = {
  lime: { cross: "rgba(166,255,46,0.96)", dot: "rgba(166,255,46,0.84)", glow: "rgba(166,255,46,0.44)" },
  purple: { cross: "rgba(177,76,255,0.92)", dot: "rgba(177,76,255,0.74)", glow: "rgba(177,76,255,0.40)" },
  violet: { cross: "rgba(140,92,255,0.90)", dot: "rgba(140,92,255,0.68)", glow: "rgba(140,92,255,0.30)" },
  white: { cross: "rgba(255,255,255,0.90)", dot: "rgba(255,255,255,0.66)", glow: "rgba(255,255,255,0.20)" },
};

function seededUnit(index: number, salt: number) {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function pickStarTone(index: number): StarTone {
  const roll = seededUnit(index, 3.1);
  if (roll < 0.32) return "lime";
  if (roll < 0.54) return "purple";
  if (roll < 0.76) return "violet";
  return "white";
}

function pickStarKind(index: number, size: number): StarKind {
  const roll = seededUnit(index, 9.7);
  if (size >= 4 && roll > 0.55) return "sparkle";
  if (roll > 0.78) return "cross";
  return "dot";
}

function buildStarSeeds(count: number): Array<Omit<StarDef, "x"> & { xf: number }> {
  const seeds: Array<Omit<StarDef, "x"> & { xf: number }> = [];
  for (let i = 0; i < count; i += 1) {
    const sizeRoll = seededUnit(i, 1.3);
    const size = sizeRoll < 0.24 ? 1 : sizeRoll < 0.48 ? 2 : sizeRoll < 0.72 ? 3 : sizeRoll < 0.9 ? 4 : 5;
    const tone = pickStarTone(i);
    const kind = pickStarKind(i, size);
    const pulse = size >= 2 && seededUnit(i, 7.5) > 0.38;
    const glow = (tone === "lime" || tone === "purple") && size >= 2 && seededUnit(i, 11.4) > 0.42;
    seeds.push({
      xf: 0.03 + seededUnit(i, 2.2) * 0.94,
      y: Math.round(4 + seededUnit(i, 4.4) * (STAGE_H - 12)),
      size,
      phase: seededUnit(i, 6.8) * 4,
      pulse,
      glow,
      tone,
      kind,
      brightness: 0.52 + seededUnit(i, 8.2) * 0.46,
    });
  }
  return seeds;
}

const STAR_SEEDS = buildStarSeeds(STAR_COUNT);

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

function hornSpecs(y: (row: number) => number): PixelSpec[] {
  return [
    { x: 4, y: y(-1), w: 2, h: 1, c: HORN_TIP },
    { x: 5, y: y(0), w: 3, h: 2, c: HORN_TIP },
    { x: 7, y: y(0), w: 2, h: 2, c: HORN },
    { x: 8, y: y(1), w: 2, h: 2, c: HORN },
    { x: 9, y: y(2), w: 2, h: 1, c: HORN_DARK },
    { x: 10, y: y(3), w: 1, h: 1, c: HORN_DARK },
    { x: 11, y: y(4), w: 1, h: 1, c: HORN_DARK },
    { x: 21, y: y(-1), w: 2, h: 1, c: HORN_TIP },
    { x: 22, y: y(0), w: 3, h: 2, c: HORN_TIP },
    { x: 23, y: y(0), w: 2, h: 2, c: HORN },
    { x: 21, y: y(1), w: 2, h: 2, c: HORN },
    { x: 20, y: y(2), w: 2, h: 1, c: HORN_DARK },
    { x: 19, y: y(3), w: 1, h: 1, c: HORN_DARK },
    { x: 18, y: y(4), w: 1, h: 1, c: HORN_DARK },
  ];
}

function tailSpecs(bodyDrop: number, y: (row: number) => number): PixelSpec[] {
  const d = bodyDrop;
  return [
    { x: 2, y: y(12 + d), w: 2, h: 1, c: LIME_MID },
    { x: 1, y: y(13 + d), w: 2, h: 1, c: LIME },
    { x: 0, y: y(14 + d), w: 2, h: 1, c: LIME_BRIGHT },
    { x: -1, y: y(15 + d), w: 2, h: 1, c: LIME_MID },
    { x: -2, y: y(16 + d), w: 2, h: 1, c: LIME },
    { x: -3, y: y(17 + d), w: 2, h: 1, c: LIME_MID },
    { x: -4, y: y(18 + d), w: 2, h: 1, c: LIME_DARK },
    { x: -5, y: y(17 + d), w: 2, h: 1, c: LIME_MID },
    { x: -6, y: y(16 + d), w: 1, h: 1, c: LIME_DEEP },
  ];
}

function buildBullSpecs(pose: BullPose, blink: boolean): { body: PixelSpec[]; tail: PixelSpec[] } {
  const specs: PixelSpec[] = [];
  const yOff = pose === "crouch" ? 1 : pose === "airborne" ? -1 : 0;
  const y = (row: number) => row + yOff;

  specs.push(...hornSpecs(y));

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
    { x: 14, y: y(10), w: 4, h: 1, c: WHITE },
    { x: 15, y: y(11), w: 2, h: 1, c: WHITE },
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

  specs.push(...legSpecs(pose));
  const tail = tailSpecs(bodyDrop, y);
  return { body: specs, tail };
}

const TAIL_PIVOT_X = 2 * PX + 4;
const TAIL_PIVOT_Y = 14 * PX;

const BullMascot = memo(function BullMascot({
  pose,
  blink,
  tailRotate,
}: {
  pose: BullPose;
  blink: boolean;
  tailRotate: Animated.AnimatedInterpolation<string>;
}) {
  const { body, tail } = useMemo(() => buildBullSpecs(pose, blink), [pose, blink]);
  return (
    <View style={styles.bullCanvas}>
      <Animated.View
        style={[
          styles.tailLayer,
          {
            transform: [
              { translateX: TAIL_PIVOT_X },
              { translateY: TAIL_PIVOT_Y },
              { rotate: tailRotate },
              { translateX: -TAIL_PIVOT_X },
              { translateY: -TAIL_PIVOT_Y },
            ],
          },
        ]}
      >
        <PixelGroup specs={tail} />
      </Animated.View>
      <PixelGroup specs={body} />
    </View>
  );
});

const BullMotionGhost = memo(function BullMotionGhost({
  pose,
  blink,
  tailRotate,
  scaleX,
  squashY,
  tint,
}: {
  pose: BullPose;
  blink: boolean;
  tailRotate: Animated.AnimatedInterpolation<string>;
  scaleX: Animated.AnimatedMultiplication<number>;
  squashY: Animated.Value;
  tint: string;
}) {
  return (
    <View style={styles.trailGhostCluster}>
      <Animated.View style={{ transform: [{ scaleX }, { scaleY: squashY }] }}>
        <BullMascot pose={pose} blink={blink} tailRotate={tailRotate} />
      </Animated.View>
      <View pointerEvents="none" style={[styles.trailGhostTint, { backgroundColor: tint }]} />
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

const TwinkleStar = memo(function TwinkleStar({
  star,
  master,
}: {
  star: StarDef;
  master: Animated.Value;
}) {
  const palette = STAR_PALETTE[star.tone];
  const low = star.brightness * 0.58;
  const mid = star.brightness;
  const high = Math.min(1, star.brightness + (star.pulse ? 0.32 : 0.16));
  const opacity = master.interpolate({
    inputRange: [0, 0.35, 0.7, 1],
    outputRange: star.pulse ? [low, high, mid, low] : [low * 0.88, mid, low * 0.92, low * 0.88],
  });
  const scale = master.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: star.pulse ? [0.92, 1.08, 0.94] : [0.96, 1.04, 0.96],
  });
  const glowStyle =
    star.glow
      ? {
          shadowColor: palette.glow,
          shadowOpacity: star.size >= 4 ? 0.62 : 0.42,
          shadowRadius: star.size + (star.pulse ? 3 : 1),
          shadowOffset: { width: 0, height: 0 },
        }
      : null;

  if (star.kind === "dot") {
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pixelDot,
          glowStyle,
          {
            left: star.x,
            top: star.y,
            width: star.size,
            height: star.size,
            backgroundColor: palette.dot,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
    );
  }

  const arm = star.kind === "sparkle" ? Math.max(2, star.size) : star.size;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.star,
        glowStyle,
        {
          left: star.x,
          top: star.y,
          width: arm,
          height: arm,
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      <View style={[styles.starH, { width: arm, backgroundColor: palette.cross }]} />
      <View style={[styles.starV, { height: arm, backgroundColor: palette.cross }]} />
      {star.kind === "sparkle" ? (
        <>
          <View style={[styles.starDiagA, { width: arm * 0.72, backgroundColor: palette.cross }]} />
          <View style={[styles.starDiagB, { width: arm * 0.72, backgroundColor: palette.cross }]} />
        </>
      ) : null}
    </Animated.View>
  );
});

function stopAnimatedValue(value: Animated.Value) {
  value.stopAnimation();
  value.removeAllListeners();
}

function bullGroundY(): number {
  return STAGE_H - BULL_RENDER_H - 28;
}

function bullLeftStandX(stageW: number): number {
  return Math.max(8, Math.round(stageW * 0.08));
}

function bullRightStandX(stageW: number): number {
  return Math.max(bullLeftStandX(stageW) + 48, Math.round(stageW * 0.92 - BULL_CLUSTER_W));
}

/** Premium pixel mascot — bull leaps across a starfield with discipline messaging. */
export const PixelNeonBull = memo(function PixelNeonBull() {
  const { width: screenW } = useWindowDimensions();
  const stageW = Math.min(screenW - 32, 360);

  const leftX = bullLeftStandX(stageW);
  const rightX = bullRightStandX(stageW);
  const groundY = bullGroundY();

  const bullX = useRef(new Animated.Value(leftX)).current;
  const bullY = useRef(new Animated.Value(groundY)).current;
  const facingScale = useRef(new Animated.Value(1)).current;
  const squashX = useRef(new Animated.Value(1)).current;
  const squashY = useRef(new Animated.Value(1)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const dustOpacity = useRef(new Animated.Value(0)).current;
  const tailSwing = useRef(new Animated.Value(0)).current;
  const trailOpacity = useRef(new Animated.Value(0)).current;
  const starMasterA = useRef(new Animated.Value(0)).current;
  const starMasterB = useRef(new Animated.Value(0)).current;
  const starMasterC = useRef(new Animated.Value(0)).current;
  const starMasterD = useRef(new Animated.Value(0)).current;

  const [blink, setBlink] = useState(false);
  const [pose, setPose] = useState<BullPose>("idle");
  const [dialogueKey, setDialogueKey] = useState<DialogueKey>("authPixelDontGamble");

  const mountedRef = useRef(true);
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scaleX = useMemo(() => Animated.multiply(facingScale, squashX), [facingScale, squashX]);
  const tailRotate = useMemo(
    () =>
      tailSwing.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ["-14deg", "0deg", "14deg"],
      }),
    [tailSwing],
  );
  const trailBackOffset1 = useMemo(() => Animated.multiply(facingScale, -13), [facingScale]);
  const trailBackOffset2 = useMemo(() => Animated.multiply(facingScale, -24), [facingScale]);
  const ghostTrailX1 = useMemo(() => Animated.add(bullX, trailBackOffset1), [bullX, trailBackOffset1]);
  const ghostTrailX2 = useMemo(() => Animated.add(bullX, trailBackOffset2), [bullX, trailBackOffset2]);
  const ghostTrailOpacity1 = useMemo(
    () => trailOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }),
    [trailOpacity],
  );
  const ghostTrailOpacity2 = useMemo(
    () => trailOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.13] }),
    [trailOpacity],
  );

  const stars = useMemo<StarDef[]>(
    () =>
      STAR_SEEDS.map((seed) => ({
        x: Math.round(stageW * seed.xf),
        y: seed.y,
        size: seed.size,
        phase: seed.phase,
        pulse: seed.pulse,
        glow: seed.glow,
        tone: seed.tone,
        kind: seed.kind,
        brightness: seed.brightness,
      })),
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

    const starLoopA = Animated.loop(
      Animated.sequence([
        Animated.timing(starMasterA, {
          toValue: 1,
          duration: 2700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(starMasterA, {
          toValue: 0,
          duration: 2700,
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
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(starMasterB, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const starLoopC = Animated.loop(
      Animated.sequence([
        Animated.delay(1700),
        Animated.timing(starMasterC, {
          toValue: 1,
          duration: 3700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(starMasterC, {
          toValue: 0,
          duration: 3700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const starLoopD = Animated.loop(
      Animated.sequence([
        Animated.delay(2300),
        Animated.timing(starMasterD, {
          toValue: 1,
          duration: 4300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(starMasterD, {
          toValue: 0,
          duration: 4300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    starLoopA.start();
    starLoopB.start();
    starLoopC.start();
    starLoopD.start();

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
      stopAnimatedValue(starMasterA);
      stopAnimatedValue(starMasterB);
      stopAnimatedValue(starMasterC);
      stopAnimatedValue(starMasterD);
      stopAnimatedValue(tailSwing);
      stopAnimatedValue(trailOpacity);
      stopAnimatedValue(bullX);
      stopAnimatedValue(bullY);
      stopAnimatedValue(facingScale);
      stopAnimatedValue(squashX);
      stopAnimatedValue(squashY);
      stopAnimatedValue(bubbleOpacity);
      stopAnimatedValue(dustOpacity);
      starLoopA.stop();
      starLoopB.stop();
      starLoopC.stop();
      starLoopD.stop();
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
      if (poseTimeoutRef.current) clearTimeout(poseTimeoutRef.current);
      poseTimersRef.current.forEach(clearTimeout);
      poseTimersRef.current = [];
    };
  }, [bullX, bullY, bubbleOpacity, dustOpacity, facingScale, squashX, squashY, starMasterA, starMasterB, starMasterC, starMasterD, tailSwing, trailOpacity]);

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
          duration: ms(130),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(READ_PAUSE_MS),
        Animated.timing(bubbleOpacity, {
          toValue: 0,
          duration: ms(175),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]);
    };

    const jumpAcross = (fromX: number, toX: number): Animated.CompositeAnimation => {
      const apexY = groundY - JUMP_ARC;
      const halfJump = Math.round(JUMP_MS * 0.5);
      bullX.setValue(fromX);
      bullY.setValue(groundY);
      tailSwing.setValue(0);
      trailOpacity.setValue(0);

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
            Animated.timing(squashY, { toValue: 0.94, duration: ms(90), useNativeDriver: true, isInteraction: false }),
            Animated.timing(squashX, { toValue: 1.08, duration: ms(90), useNativeDriver: true, isInteraction: false }),
            Animated.timing(squashY, { toValue: 1.04, duration: ms(100), useNativeDriver: true, isInteraction: false }),
            Animated.timing(squashY, { toValue: 1, duration: ms(130), useNativeDriver: true, isInteraction: false }),
            Animated.timing(squashX, { toValue: 1, duration: ms(130), useNativeDriver: true, isInteraction: false }),
          ]),
          Animated.sequence([
            Animated.timing(tailSwing, { toValue: 1, duration: halfJump, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
            Animated.timing(tailSwing, { toValue: -0.65, duration: halfJump, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
            Animated.timing(tailSwing, { toValue: 0, duration: ms(180), easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false }),
          ]),
          Animated.sequence([
            Animated.timing(trailOpacity, {
              toValue: 1,
              duration: ms(55),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.delay(Math.max(0, JUMP_MS - ms(55) - ms(120))),
            Animated.timing(trailOpacity, {
              toValue: 0,
              duration: ms(120),
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
        ]),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(bullY, {
              toValue: groundY + 4,
              duration: ms(70),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bullY, {
              toValue: groundY - 2,
              duration: ms(100),
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bullY, {
              toValue: groundY,
              duration: ms(90),
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
            Animated.timing(dustOpacity, { toValue: 0.7, duration: ms(50), useNativeDriver: true, isInteraction: false }),
            Animated.timing(dustOpacity, { toValue: 0, duration: ms(260), useNativeDriver: true, isInteraction: false }),
          ]),
        ]),
      ]);
    };

    const turnAround = (nextScale: number): Animated.CompositeAnimation => {
      setPoseSafe("idle");
      return Animated.sequence([
        Animated.timing(bullY, {
          toValue: groundY + 2,
          duration: ms(140),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.parallel([
          Animated.timing(facingScale, {
            toValue: nextScale,
            duration: TURN_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.sequence([
            Animated.timing(tailSwing, { toValue: 0.45, duration: ms(160), useNativeDriver: true, isInteraction: false }),
            Animated.timing(tailSwing, { toValue: -0.35, duration: ms(180), useNativeDriver: true, isInteraction: false }),
            Animated.timing(tailSwing, { toValue: 0, duration: ms(160), useNativeDriver: true, isInteraction: false }),
          ]),
        ]),
        Animated.timing(bullY, {
          toValue: groundY,
          duration: ms(180),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(ms(95)),
      ]);
    };

    const beginJump = (fromX: number, toX: number, onDone: () => void) => {
      clearPoseTimers();
      setPoseSafe("crouch");
      schedulePose(() => setPoseSafe("airborne"), CROUCH_MS + 90);
      schedulePose(() => setPoseSafe("land", ms(360)), CROUCH_MS + JUMP_MS);
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
      tailSwing.stopAnimation();
      trailOpacity.stopAnimation();
    };
  }, [bubbleOpacity, bullX, bullY, dustOpacity, facingScale, groundY, leftX, rightX, squashX, squashY, tailSwing, trailOpacity]);

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
        heroArea: {
          position: "absolute",
          left: 0,
          top: 0,
          width: stageW,
          height: STAGE_H,
          zIndex: 2,
        },
      }),
    [stageW],
  );

  const starMasterFor = (phase: number) => {
    const bucket = Math.floor(phase) % 4;
    if (bucket === 0) return starMasterA;
    if (bucket === 1) return starMasterB;
    if (bucket === 2) return starMasterC;
    return starMasterD;
  };

  return (
    <View style={dynamicStyles.wrap}>
      <View style={dynamicStyles.stage}>
        {stars.map((star, i) => (
          <TwinkleStar key={`star-${star.x}-${star.y}-${i}`} star={star} master={starMasterFor(star.phase)} />
        ))}

        <View style={dynamicStyles.heroArea} pointerEvents="none">
          <Animated.View
            style={[
              styles.bullOverlay,
              styles.trailGhostLayer,
              {
                opacity: ghostTrailOpacity2,
                transform: [{ translateX: ghostTrailX2 }, { translateY: bullY }],
              },
            ]}
          >
            <BullMotionGhost
              pose={pose}
              blink={blink}
              tailRotate={tailRotate}
              scaleX={scaleX}
              squashY={squashY}
              tint="rgba(177,76,255,0.50)"
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.bullOverlay,
              styles.trailGhostLayer,
              {
                opacity: ghostTrailOpacity1,
                transform: [{ translateX: ghostTrailX1 }, { translateY: bullY }],
              },
            ]}
          >
            <BullMotionGhost
              pose={pose}
              blink={blink}
              tailRotate={tailRotate}
              scaleX={scaleX}
              squashY={squashY}
              tint="rgba(166,255,46,0.46)"
            />
          </Animated.View>
          <Animated.View
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
                <BullMascot pose={pose} blink={blink} tailRotate={tailRotate} />
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
  },
  starV: {
    position: "absolute",
    width: 1,
  },
  starDiagA: {
    position: "absolute",
    height: 1,
    transform: [{ rotate: "45deg" }],
  },
  starDiagB: {
    position: "absolute",
    height: 1,
    transform: [{ rotate: "-45deg" }],
  },
  pixelDot: {
    position: "absolute",
    zIndex: 1,
  },
  bullOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 5,
  },
  trailGhostLayer: {
    zIndex: 4,
  },
  trailGhostCluster: {
    alignItems: "center",
    width: BULL_CLUSTER_W,
    marginLeft: -20,
  },
  trailGhostTint: {
    ...StyleSheet.absoluteFillObject,
  },
  bullCluster: {
    alignItems: "center",
    width: BULL_CLUSTER_W,
    marginLeft: -20,
  },
  bullCanvas: {
    width: BULL_PX_W * PX,
    height: BULL_PX_H * PX,
    position: "relative",
    overflow: "visible",
  },
  tailLayer: {
    ...StyleSheet.absoluteFillObject,
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
});
