import React, { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { C } from "../theme";
import { styles } from "../styles";

export function AiIntelligencePulse({ tone = C.green }: { tone?: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={[
        styles.aiIntelligencePulse,
        { borderColor: `${tone}66`, backgroundColor: `${tone}14`, shadowColor: tone },
        {
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] }) }],
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
        },
      ]}
    >
      <View style={[styles.aiIntelligencePulseCore, { backgroundColor: tone }]} />
    </Animated.View>
  );
}

export function AiFlowRail({ nodes, tone = C.purple }: { nodes: string[]; tone?: string }) {
  const travel = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(travel, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    animation.start();
    return () => animation.stop();
  }, [travel]);
  return (
    <View style={styles.aiFlowRail}>
      <View style={[styles.aiFlowTrack, { backgroundColor: `${tone}32` }]} />
      <Animated.View
        style={[
          styles.aiFlowSignal,
          { backgroundColor: tone, shadowColor: tone },
          { transform: [{ translateX: travel.interpolate({ inputRange: [0, 1], outputRange: [0, 220] }) }] },
        ]}
      />
      <View style={styles.aiFlowNodes}>
        {nodes.map((node) => (
          <View key={node} style={styles.aiFlowNode}>
            <View style={[styles.aiFlowNodeDot, { borderColor: `${tone}80`, backgroundColor: `${tone}18`, shadowColor: tone }]}>
              <View style={[styles.aiFlowNodeCore, { backgroundColor: tone }]} />
            </View>
            <Text style={styles.aiFlowNodeLabel}>{node}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function AiImageScan({ active }: { active: boolean }) {
  const scan = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      scan.stopAnimation();
      scan.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, scan]);
  if (!active) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.aiImageScanLine,
        {
          opacity: scan.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 0.9, 0.2] }),
          transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [8, 190] }) }],
        },
      ]}
    />
  );
}

export function AiGuardianRing({ ratio, tone, label }: { ratio: number; tone: string; label: string }) {
  const normalized = Math.max(0, Math.min(1, ratio));
  const circumference = 2 * Math.PI * 34;
  return (
    <View style={styles.aiGuardianRingWrap}>
      <Svg width={86} height={86} viewBox="0 0 86 86">
        <Circle cx="43" cy="43" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
        <Circle
          cx="43"
          cy="43"
          r="34"
          fill="none"
          stroke={tone}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - normalized)}
          rotation="-90"
          origin="43, 43"
        />
      </Svg>
      <View style={styles.aiGuardianRingCenter}>
        <Text style={[styles.aiGuardianRingValue, { color: tone }]}>{Math.round(normalized * 100)}%</Text>
        <Text style={styles.aiGuardianRingLabel}>{label}</Text>
      </View>
    </View>
  );
}

export function AiAnimatedBar({ ratio, tone }: { ratio: number; tone: string }) {
  const progress = useRef(new Animated.Value(0)).current;
  const normalized = Math.max(0, Math.min(1, ratio));
  useEffect(() => {
    Animated.spring(progress, { toValue: normalized, damping: 18, stiffness: 130, mass: 0.8, useNativeDriver: true }).start();
  }, [normalized, progress]);
  return (
    <View style={styles.aiAnimatedBarTrack}>
      <Animated.View style={[styles.aiAnimatedBarFill, { backgroundColor: tone, transform: [{ scaleX: progress }] }]} />
    </View>
  );
}

