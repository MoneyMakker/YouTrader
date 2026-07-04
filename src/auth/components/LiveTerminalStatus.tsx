import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Platform, StyleSheet, Text } from "react-native";
import { t } from "../../i18n";

const { width: W, height: H } = Dimensions.get("window");

const STATUS_LINE_KEYS = [
  "terminalAiAgentConnected",
  "terminalMarketScanComplete",
  "terminalRiskEngineUpdated",
  "terminalEdgeScoreRecalculated",
  "terminalLiquidityFound",
  "terminalTradeHistorySynced",
  "terminalPerformanceIndexed",
  "terminalWorkflowOptimized",
  "terminalPatternDetected",
  "terminalCloudBackupComplete",
] as const;

const POSITION_SLOTS = [
  { top: H * 0.13, left: 22, align: "left" as const },
  { top: H * 0.19, right: 20, align: "right" as const },
  { top: H * 0.54, left: 18, align: "left" as const },
  { top: H * 0.6, right: 22, align: "right" as const },
  { top: H * 0.7, left: 28, align: "left" as const },
  { top: H * 0.76, right: 26, align: "right" as const },
  { top: H * 0.84, left: 24, align: "left" as const },
];

function shuffleMessages() {
  const next = [...STATUS_LINE_KEYS];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickSlot(lastIndex: number) {
  let index = Math.floor(Math.random() * POSITION_SLOTS.length);
  if (POSITION_SLOTS.length > 1) {
    while (index === lastIndex) {
      index = Math.floor(Math.random() * POSITION_SLOTS.length);
    }
  }
  return index;
}

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

/** One ambient status line — fade in, hold 2–3s, fade out, wait 4–8s. */
export function LiveTerminalStatus() {
  const opacity = useRef(new Animated.Value(0)).current;
  const [message, setMessage] = useState("");
  const [slotIndex, setSlotIndex] = useState(0);
  const queueRef = useRef<(typeof STATUS_LINE_KEYS)[number][]>(shuffleMessages());
  const queuePosRef = useRef(0);
  const lastSlotRef = useRef(-1);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const nextMessage = () => {
      if (queuePosRef.current >= queueRef.current.length) {
        queueRef.current = shuffleMessages();
        queuePosRef.current = 0;
      }
      const key = queueRef.current[queuePosRef.current];
      queuePosRef.current += 1;
      const slot = pickSlot(lastSlotRef.current);
      lastSlotRef.current = slot;
      setMessage(t(key));
      setSlotIndex(slot);
    };

    const fadeCycle = () =>
      new Promise<void>((resolve) => {
        opacity.setValue(0);
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.045,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(randomBetween(2000, 3000)),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      });

    const runLoop = async () => {
      await new Promise((r) => setTimeout(r, 1600));
      while (mountedRef.current) {
        nextMessage();
        await fadeCycle();
        if (!mountedRef.current) break;
        await new Promise((r) => setTimeout(r, randomBetween(4000, 8000)));
      }
    };

    void runLoop();
    return () => {
      mountedRef.current = false;
      opacity.stopAnimation();
    };
  }, [opacity]);

  if (!message) return null;

  const slot = POSITION_SLOTS[slotIndex];
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.line,
        {
          opacity,
          top: slot.top,
          left: slot.left,
          right: slot.right,
          textAlign: slot.align,
          maxWidth: W * 0.4,
        },
      ]}
    >
      {message}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  line: {
    position: "absolute",
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.4,
    color: "rgba(163,255,18,0.9)",
    lineHeight: 14,
  },
});
