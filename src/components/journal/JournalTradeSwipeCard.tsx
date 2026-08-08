import React, { useEffect, useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Trash2 } from "lucide-react-native";
import { t } from "../../i18n";
import { C } from "../../theme/colors";
import { AnimatedPressable } from "../ui/premium/AnimatedPressable";
import { getYdlCardInteraction, runYdlMotionHaptic, ydlSpace, ydlTouchTarget } from "../../ydl";

const SWIPE_WIDTH = 84;
const OPEN_THRESHOLD = 46;
const HORIZONTAL_ACTIVATION = 12;
const CARD_PRESS = getYdlCardInteraction("press");

type JournalTradeSwipeCardProps = {
  children: React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
  onDeletePress: () => void;
  onSwipeReveal?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function JournalTradeSwipeCard({
  children,
  onPress,
  onLongPress,
  onDeletePress,
  onSwipeReveal,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: JournalTradeSwipeCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const dragStartX = useRef(0);
  const isOpenRef = useRef(false);
  const revealHapticSentRef = useRef(false);
  const onSwipeRevealRef = useRef(onSwipeReveal);
  onSwipeRevealRef.current = onSwipeReveal;

  useEffect(() => {
    return () => {
      translateX.stopAnimation();
    };
  }, [translateX]);

  const animateTo = (toValue: number) => {
    const wasOpen = isOpenRef.current;
    isOpenRef.current = toValue !== 0;
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      tension: 280,
      friction: 28,
      overshootClamping: true,
    }).start(({ finished }) => {
      if (finished && !wasOpen && toValue !== 0) {
        if (!revealHapticSentRef.current) {
          revealHapticSentRef.current = true;
          onSwipeRevealRef.current?.();
        }
      }
      if (finished && toValue === 0) {
        revealHapticSentRef.current = false;
      }
    });
  };

  const closeSwipe = () => animateTo(0);

  const isHorizontalSwipe = (dx: number, dy: number) =>
    Math.abs(dx) > HORIZONTAL_ACTIVATION && Math.abs(dx) > Math.abs(dy) * 1.55;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => isHorizontalSwipe(gesture.dx, gesture.dy),
      onPanResponderGrant: () => {
        translateX.stopAnimation((value) => {
          dragStartX.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(0, Math.max(-SWIPE_WIDTH, dragStartX.current + gesture.dx));
        translateX.setValue(next);
        if (
          !revealHapticSentRef.current &&
          !isOpenRef.current &&
          next <= -OPEN_THRESHOLD
        ) {
          revealHapticSentRef.current = true;
          onSwipeRevealRef.current?.();
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const projected = dragStartX.current + gesture.dx;
        const shouldOpen =
          projected < -OPEN_THRESHOLD ||
          (gesture.vx < -0.7 && projected < -28);
        if (shouldOpen) {
          animateTo(-SWIPE_WIDTH);
          return;
        }
        animateTo(0);
      },
      onPanResponderTerminationRequest: () => true,
      onShouldBlockNativeResponder: () => false,
    }),
  ).current;

  const deleteReveal = translateX.interpolate({
    inputRange: [-SWIPE_WIDTH, -OPEN_THRESHOLD, 0],
    outputRange: [1, 0.72, 0.42],
    extrapolate: "clamp",
  });

  const handlePress = () => {
    if (isOpenRef.current) {
      closeSwipe();
      return;
    }
    runYdlMotionHaptic("CardPress");
    onPress();
  };

  const handleLongPress = () => {
    if (isOpenRef.current) {
      closeSwipe();
      return;
    }
    runYdlMotionHaptic("Selection");
    onLongPress();
  };

  const handleDeletePress = () => {
    closeSwipe();
    onDeletePress();
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.actions, { opacity: deleteReveal }]}
        pointerEvents="box-none"
      >
        <Pressable
          style={styles.deleteAction}
          onPress={handleDeletePress}
          testID="journal.trade.delete.swipe"
          accessibilityRole="button"
          accessibilityLabel={t("deleteTrade")}
        >
          <Trash2 size={18} color={C.white} strokeWidth={2.2} />
          <Text style={styles.deleteLabel}>{t("deleteTrade")}</Text>
        </Pressable>
      </Animated.View>
      <Animated.View
        style={[styles.cardTrack, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <AnimatedPressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={420}
          press="card"
          scaleTo={CARD_PRESS.scale}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          hitSlop={ydlTouchTarget.hitSlopSm}
        >
          {children}
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: ydlSpace.sm,
    overflow: "hidden",
    borderRadius: 24,
  },
  actions: {
    ...StyleSheet.absoluteFill,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  deleteAction: {
    width: SWIPE_WIDTH,
    height: "100%",
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  deleteLabel: {
    color: C.white,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  cardTrack: {
    width: "100%",
  },
});
