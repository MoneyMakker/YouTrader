import React, { memo, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Palette ───────────────────────────────────────────────────────────────
const PX = 3;
const PURPLE = "#8A2EFF";
const PURPLE_MID = "#6B1FD4";
const PURPLE_DARK = "#4A128F";
const PURPLE_LIGHT = "#A85CFF";
const PURPLE_HOT = "#C084FC";
const NEON_GREEN = "#A3FF12";
const WHITE = "#FFFFFF";
const VOID = "#000000";
const WICK = "#2A3040";
const GROUND = "#1A1F2A";
const CANDLE_GREEN = "#3DDB4A";
const CANDLE_GREEN_DARK = "#2A9E34";
const CANDLE_RED = "#FF3B5F";
const CANDLE_RED_DARK = "#CC2F4C";
const MONITOR_BEZEL = "#1E2430";
const MONITOR_SCREEN = "#0D1117";
const MONITOR_GLOW = "#1A3D2A";
const KEY_GRAY = "#2A3040";

// ─── Stage layout ──────────────────────────────────────────────────────────
const STAGE_W = Math.min(SCREEN_W - 32, 380);
const STAGE_H = 196;
const CHART_W = STAGE_W * 0.52;
const CHART_H = 112;
const CHART_TOP = 28;
const OPERATOR_W = STAGE_W * 0.4;
const BULL_GRID_W = 20;
const BULL_GRID_H = 18;
const COMPUTER_W = 14;
const COMPUTER_H = 16;

const SCAN_DURATION_MS = 2800;
const DRIFT_DURATION_MS = 4800;
const BREATH_IN_MS = 900;
const BREATH_OUT_MS = 900;
const THINK_FLASH_MS = 220;

type PixelSpec = { x: number; y: number; w: number; h: number; c: string };
type IndicatorKind = "+" | "%";

type CandleDef = {
  bullish: boolean;
  bodyH: number;
  wickTop: number;
  wickBottom: number;
};

const CANDLES: CandleDef[] = [
  { bullish: true, bodyH: 22, wickTop: 6, wickBottom: 4 },
  { bullish: false, bodyH: 16, wickTop: 4, wickBottom: 6 },
  { bullish: true, bodyH: 32, wickTop: 8, wickBottom: 4 },
  { bullish: true, bodyH: 20, wickTop: 5, wickBottom: 3 },
  { bullish: false, bodyH: 26, wickTop: 6, wickBottom: 5 },
  { bullish: true, bodyH: 28, wickTop: 7, wickBottom: 4 },
  { bullish: false, bodyH: 18, wickTop: 5, wickBottom: 5 },
  { bullish: true, bodyH: 36, wickTop: 9, wickBottom: 4 },
];

const CANDLE_SLOT_W = 7;
const CANDLE_GAP = 3;

// ─── Primitives ──────────────────────────────────────────────────────────────
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

// ─── Chart candlesticks (standard Views) ───────────────────────────────────
const ChartCandle = memo(function ChartCandle({
  def,
  showIndicator,
  indicatorKind,
  indicatorScale,
  indicatorOpacity,
}: {
  def: CandleDef;
  showIndicator: boolean;
  indicatorKind: IndicatorKind;
  indicatorScale?: Animated.AnimatedInterpolation<number>;
  indicatorOpacity?: Animated.AnimatedInterpolation<number> | Animated.Value;
}) {
  const bodyColor = def.bullish ? CANDLE_GREEN : CANDLE_RED;
  const shade = def.bullish ? CANDLE_GREEN_DARK : CANDLE_RED_DARK;

  return (
    <View style={styles.candleSlot}>
      {showIndicator ? (
        <Animated.View
          style={[
            styles.indicatorBubble,
            indicatorScale != null && indicatorOpacity != null
              ? { opacity: indicatorOpacity, transform: [{ scale: indicatorScale }] }
              : null,
          ]}
        >
          <Text style={styles.indicatorText}>{indicatorKind}</Text>
        </Animated.View>
      ) : null}
      <View style={[styles.wick, { height: def.wickTop }]} />
      <View style={[styles.candleBody, { height: def.bodyH, backgroundColor: bodyColor }]}>
        <View style={[styles.candleShade, { backgroundColor: shade }]} />
      </View>
      <View style={[styles.wick, { height: def.wickBottom }]} />
    </View>
  );
});

const ChartArea = memo(function ChartArea({
  driftX,
  scanX,
  activeIndex,
  indicatorKind,
  indicatorVisible,
  indicatorScale,
  indicatorOpacity,
}: {
  driftX: Animated.AnimatedInterpolation<number>;
  scanX: Animated.AnimatedInterpolation<number>;
  activeIndex: number;
  indicatorKind: IndicatorKind;
  indicatorVisible: boolean;
  indicatorScale: Animated.AnimatedInterpolation<number>;
  indicatorOpacity: Animated.Value;
}) {
  return (
    <Animated.View
      style={[
        styles.chartArea,
        {
          transform: [{ translateX: driftX }],
        },
      ]}
    >
      <View style={styles.chartFrame}>
        <View style={styles.candleRow}>
          {CANDLES.map((def, i) => (
            <ChartCandle
              key={`candle-${i}`}
              def={def}
              showIndicator={indicatorVisible && activeIndex === i}
              indicatorKind={indicatorKind}
              indicatorScale={indicatorScale}
              indicatorOpacity={indicatorOpacity}
            />
          ))}
        </View>
        <View style={styles.chartBaseline} />
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.scannerLaser,
          {
            transform: [{ translateX: scanX }],
          },
        ]}
      />
      <View pointerEvents="none" style={styles.scannerGlowTrack} />
    </Animated.View>
  );
});

// ─── Retro computer sprite ───────────────────────────────────────────────────
function computerSpecs(screenTint: string): PixelSpec[] {
  return [
    { x: 0, y: 0, w: 14, h: 1, c: MONITOR_BEZEL },
    { x: 0, y: 1, w: 1, h: 8, c: MONITOR_BEZEL },
    { x: 13, y: 1, w: 1, h: 8, c: MONITOR_BEZEL },
    { x: 1, y: 1, w: 12, h: 7, c: MONITOR_SCREEN },
    { x: 2, y: 2, w: 10, h: 5, c: screenTint },
    { x: 3, y: 3, w: 3, h: 1, c: NEON_GREEN },
    { x: 7, y: 3, w: 4, h: 1, c: MONITOR_GLOW },
    { x: 3, y: 5, w: 8, h: 1, c: MONITOR_GLOW },
    { x: 0, y: 9, w: 14, h: 1, c: MONITOR_BEZEL },
    { x: 4, y: 10, w: 6, h: 2, c: KEY_GRAY },
    { x: 2, y: 12, w: 10, h: 1, c: KEY_GRAY },
    { x: 1, y: 13, w: 12, h: 2, c: KEY_GRAY },
    { x: 3, y: 14, w: 2, h: 1, c: PURPLE_DARK },
    { x: 6, y: 14, w: 2, h: 1, c: PURPLE_DARK },
    { x: 9, y: 14, w: 2, h: 1, c: PURPLE_DARK },
  ];
}

const RetroComputer = memo(function RetroComputer({ screenTint }: { screenTint: string }) {
  return (
    <View style={styles.computerCanvas}>
      <PixelGroup specs={computerSpecs(screenTint)} />
    </View>
  );
});

// ─── Bull sprite (idle operator) ─────────────────────────────────────────────
function bullHorns(think: boolean): PixelSpec[] {
  const hornColor = think ? PURPLE_HOT : PURPLE;
  const hornMid = think ? PURPLE_LIGHT : PURPLE_MID;
  return [
    { x: 0, y: 0, w: 2, h: 1, c: hornColor },
    { x: -1, y: 1, w: 2, h: 1, c: hornMid },
    { x: -1, y: 2, w: 1, h: 2, c: PURPLE_DARK },
    { x: 0, y: 4, w: 2, h: 1, c: hornMid },
    { x: 14, y: 0, w: 2, h: 1, c: hornColor },
    { x: 15, y: 1, w: 2, h: 1, c: hornMid },
    { x: 16, y: 2, w: 1, h: 2, c: PURPLE_DARK },
    { x: 14, y: 4, w: 2, h: 1, c: hornMid },
  ];
}

function bullBodySpecs(blink: boolean, think: boolean): PixelSpec[] {
  const eye: PixelSpec = blink
    ? { x: 8, y: 7, w: 2, h: 1, c: PURPLE_DARK }
    : { x: 9, y: 7, w: 1, h: 1, c: think ? WHITE : NEON_GREEN };

  return [
    ...bullHorns(think),
    { x: 1, y: 5, w: 14, h: 1, c: PURPLE },
    { x: 0, y: 6, w: 16, h: 1, c: PURPLE_LIGHT },
    { x: 0, y: 7, w: 16, h: 1, c: PURPLE },
    { x: 1, y: 8, w: 14, h: 1, c: PURPLE_MID },
    { x: 11, y: 8, w: 5, h: 1, c: PURPLE },
    { x: 12, y: 9, w: 4, h: 1, c: PURPLE_MID },
    { x: 13, y: 10, w: 3, h: 1, c: PURPLE },
    eye,
    { x: 2, y: 11, w: 12, h: 1, c: PURPLE },
    { x: 3, y: 12, w: 10, h: 1, c: PURPLE_MID },
    { x: 4, y: 13, w: 8, h: 1, c: PURPLE },
    { x: 4, y: 14, w: 3, h: 2, c: PURPLE_MID },
    { x: 11, y: 14, w: 3, h: 2, c: PURPLE_MID },
    { x: 4, y: 16, w: 3, h: 1, c: PURPLE_DARK },
    { x: 11, y: 16, w: 3, h: 1, c: PURPLE_DARK },
  ];
}

const BullOperator = memo(function BullOperator({ blink, thinking }: { blink: boolean; thinking: boolean }) {
  return (
    <View style={styles.bullCanvas}>
      <PixelGroup specs={bullBodySpecs(blink, thinking)} />
    </View>
  );
});

// ─── Animation helpers ───────────────────────────────────────────────────────
function stopAnimatedValue(value: Animated.Value) {
  value.stopAnimation();
  value.removeAllListeners();
}

function candleIndexFromScan(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * (CANDLES.length - 1));
}

function scanTravelWidth() {
  const inner = CANDLES.length * CANDLE_SLOT_W + (CANDLES.length - 1) * CANDLE_GAP;
  return inner - 2;
}

/** Premium pixel AI chart scanner — candles, laser sweep, operator bull. */
export const PixelNeonBull = memo(function PixelNeonBull() {
  const scanProgress = useRef(new Animated.Value(0)).current;
  const chartDrift = useRef(new Animated.Value(0)).current;
  const bullBreath = useRef(new Animated.Value(1)).current;
  const hornThink = useRef(new Animated.Value(0)).current;
  const indicatorPop = useRef(new Animated.Value(0)).current;

  const [activeIndex, setActiveIndex] = useState(0);
  const [indicatorKind, setIndicatorKind] = useState<IndicatorKind>("+");
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const [blink, setBlink] = useState(false);
  const [thinking, setThinking] = useState(false);

  const mountedRef = useRef(true);
  const scanDirectionRef = useRef<1 | -1>(1);
  const indicatorToggleRef = useRef(false);
  const breathLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const scanLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const driftLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicatorHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const driftX = chartDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-3, 3],
  });

  const scanX = scanProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, scanTravelWidth()],
  });

  const bullScale = bullBreath;
  const bullOffsetY = bullBreath.interpolate({
    inputRange: [0.96, 1.04],
    outputRange: [2, -2],
  });

  const hornTintOpacity = hornThink.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const indicatorScale = indicatorPop.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  useEffect(() => {
    mountedRef.current = true;

    const triggerThinkPulse = (index: number) => {
      if (!mountedRef.current) return;

      setThinking(true);
      setActiveIndex(index);
      hornThink.setValue(0);
      indicatorToggleRef.current = !indicatorToggleRef.current;
      setIndicatorKind(indicatorToggleRef.current ? "%" : "+");
      setIndicatorVisible(true);
      indicatorPop.setValue(0);

      Animated.sequence([
        Animated.timing(hornThink, {
          toValue: 1,
          duration: THINK_FLASH_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(hornThink, {
          toValue: 0,
          duration: THINK_FLASH_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]).start();

      Animated.spring(indicatorPop, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
        isInteraction: false,
      }).start();

      if (thinkTimeoutRef.current) clearTimeout(thinkTimeoutRef.current);
      thinkTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) setThinking(false);
      }, THINK_FLASH_MS * 2 + 40);

      if (indicatorHideRef.current) clearTimeout(indicatorHideRef.current);
      indicatorHideRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        Animated.timing(indicatorPop, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
          isInteraction: false,
        }).start(({ finished }) => {
          if (finished && mountedRef.current) setIndicatorVisible(false);
        });
      }, 680);
    };

    const scheduleBlink = () => {
    if (!mountedRef.current) return;
    const delay = 2200 + Math.random() * 2600;
    blinkTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setBlink(true);
      blinkTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setBlink(false);
        scheduleBlink();
      }, 90);
    }, delay);
    };

    breathLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(bullBreath, {
          toValue: 1.04,
          duration: BREATH_IN_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(bullBreath, {
          toValue: 0.96,
          duration: BREATH_OUT_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    breathLoopRef.current.start();

    driftLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(chartDrift, {
          toValue: 1,
          duration: DRIFT_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(chartDrift, {
          toValue: 0,
          duration: DRIFT_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    driftLoopRef.current.start();

    const runScanLeg = (toValue: number) =>
      Animated.timing(scanProgress, {
        toValue,
        duration: SCAN_DURATION_MS,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
        isInteraction: false,
      });

    scanLoopRef.current = Animated.loop(
      Animated.sequence([
        runScanLeg(1),
        runScanLeg(0),
      ]),
    );
    scanLoopRef.current.start();

    const scanListenerId = scanProgress.addListener(({ value }) => {
      if (!mountedRef.current) return;
      setActiveIndex(candleIndexFromScan(value));

      const nearStart = value <= 0.04;
      const nearEnd = value >= 0.96;
      if (nearStart && scanDirectionRef.current === -1) {
        scanDirectionRef.current = 1;
        triggerThinkPulse(candleIndexFromScan(value));
      } else if (nearEnd && scanDirectionRef.current === 1) {
        scanDirectionRef.current = -1;
        triggerThinkPulse(candleIndexFromScan(value));
      }
    });

    scheduleBlink();

    return () => {
      mountedRef.current = false;
      scanProgress.removeListener(scanListenerId);
      stopAnimatedValue(scanProgress);
      stopAnimatedValue(chartDrift);
      stopAnimatedValue(bullBreath);
      stopAnimatedValue(hornThink);
      stopAnimatedValue(indicatorPop);
      breathLoopRef.current?.stop();
      scanLoopRef.current?.stop();
      driftLoopRef.current?.stop();
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
      if (thinkTimeoutRef.current) clearTimeout(thinkTimeoutRef.current);
      if (indicatorHideRef.current) clearTimeout(indicatorHideRef.current);
    };
  }, [bullBreath, chartDrift, hornThink, indicatorPop, scanProgress]);

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <View style={styles.topRow}>
          <ChartArea
            driftX={driftX}
            scanX={scanX}
            activeIndex={activeIndex}
            indicatorKind={indicatorKind}
            indicatorVisible={indicatorVisible}
            indicatorScale={indicatorScale}
            indicatorOpacity={indicatorPop}
          />

          <View style={styles.operatorArea}>
            <Animated.View
              style={[
                styles.bullSlot,
                {
                  transform: [{ scale: bullScale }, { translateY: bullOffsetY }],
                },
              ]}
            >
              <BullOperator blink={blink} thinking={thinking} />
              <Animated.View pointerEvents="none" style={[styles.hornTintOverlay, { opacity: hornTintOpacity }]} />
            </Animated.View>

            <View style={styles.computerSlot}>
              <RetroComputer screenTint={thinking ? MONITOR_GLOW : MONITOR_SCREEN} />
            </View>
          </View>
        </View>

        <View style={styles.groundLine} />
        <View style={styles.stageLabelRow}>
          <Text style={styles.stageLabel}>AI SCAN</Text>
          <Text style={styles.stageLabelDim}>LIVE</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: STAGE_W,
    height: STAGE_H,
    alignSelf: "center",
    marginBottom: 2,
    overflow: "visible",
    backgroundColor: VOID,
  },
  stage: {
    width: STAGE_W,
    height: STAGE_H,
    position: "relative",
    backgroundColor: VOID,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: 18,
    height: STAGE_H - 24,
  },
  chartArea: {
    width: CHART_W,
    height: CHART_H,
    position: "relative",
    marginTop: CHART_TOP - 18,
  },
  chartFrame: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#1E2430",
    borderRadius: 6,
    backgroundColor: "#050608",
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 6,
    overflow: "hidden",
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
    width: 1,
    backgroundColor: WICK,
  },
  candleBody: {
    width: CANDLE_SLOT_W - 2,
    borderRadius: 1,
    overflow: "hidden",
  },
  candleShade: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
  },
  chartBaseline: {
    height: 2,
    backgroundColor: GROUND,
    marginTop: 4,
    borderRadius: 1,
  },
  scannerLaser: {
    position: "absolute",
    left: 6,
    top: 8,
    width: 2,
    height: CHART_H - 18,
    backgroundColor: NEON_GREEN,
    shadowColor: NEON_GREEN,
    shadowOpacity: 0.95,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 4,
  },
  scannerGlowTrack: {
    position: "absolute",
    left: 6,
    top: 8,
    right: 6,
    height: CHART_H - 18,
    backgroundColor: "rgba(163,255,18,0.03)",
    zIndex: 1,
  },
  operatorArea: {
    width: OPERATOR_W,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: 4,
    paddingBottom: 4,
  },
  bullSlot: {
    position: "relative",
    zIndex: 3,
  },
  bullCanvas: {
    width: BULL_GRID_W * PX,
    height: BULL_GRID_H * PX,
    position: "relative",
  },
  hornTintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(192,132,252,0.22)",
  },
  computerSlot: {
    zIndex: 2,
    marginBottom: 2,
  },
  computerCanvas: {
    width: COMPUTER_W * PX,
    height: COMPUTER_H * PX,
    position: "relative",
  },
  groundLine: {
    position: "absolute",
    bottom: 20,
    left: STAGE_W * 0.06,
    width: STAGE_W * 0.88,
    height: 2,
    backgroundColor: GROUND,
  },
  stageLabelRow: {
    position: "absolute",
    bottom: 4,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stageLabel: {
    color: NEON_GREEN,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  stageLabelDim: {
    color: "#4B5563",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  indicatorBubble: {
    position: "absolute",
    top: -16,
    zIndex: 6,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(163,255,18,0.18)",
    borderWidth: 1,
    borderColor: NEON_GREEN,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  indicatorText: {
    color: NEON_GREEN,
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 11,
  },
});
