import React, { useEffect, useRef } from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";
import {
  getYdlPressForControl,
  runYdlMotionHaptic,
  ydlTouchTarget,
} from "../../ydl";

const JOURNAL_DAY_LONG_PRESS_MS = 900;
const ROW_PRESS = getYdlPressForControl("row");

type Props = {
  hasTrades: boolean;
  onDayPress: () => void;
  onDayLongPress: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  selected?: boolean;
};

export function JournalCalendarDayPressable({
  hasTrades,
  onDayPress,
  onDayLongPress,
  style,
  children,
  accessibilityLabel,
  accessibilityHint,
  selected = false,
}: Props) {
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressHandledRef = useRef(false);

  const clearHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => () => clearHold(), []);

  const handlePressIn = () => {
    if (!hasTrades) return;
    longPressHandledRef.current = false;
    clearHold();
    holdTimerRef.current = setTimeout(() => {
      longPressHandledRef.current = true;
      runYdlMotionHaptic("Selection");
      onDayLongPress();
    }, JOURNAL_DAY_LONG_PRESS_MS);
  };

  const handlePressOut = () => {
    clearHold();
  };

  const handlePress = () => {
    if (longPressHandledRef.current) {
      longPressHandledRef.current = false;
      return;
    }
    runYdlMotionHaptic("Selection");
    onDayPress();
  };

  return (
    <Pressable
      onPressIn={hasTrades ? handlePressIn : undefined}
      onPressOut={hasTrades ? handlePressOut : undefined}
      onPress={handlePress}
      pressRetentionOffset={ydlTouchTarget.hitSlopLg}
      hitSlop={ydlTouchTarget.hitSlopSm}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        style,
        pressed ? { opacity: ROW_PRESS.opacityTo } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}
