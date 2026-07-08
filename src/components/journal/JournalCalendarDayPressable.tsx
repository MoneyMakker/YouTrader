import React, { useEffect, useRef } from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";

const JOURNAL_DAY_LONG_PRESS_MS = 900;

type Props = {
  hasTrades: boolean;
  onDayPress: () => void;
  onDayLongPress: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export function JournalCalendarDayPressable({
  hasTrades,
  onDayPress,
  onDayLongPress,
  style,
  children,
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
    onDayPress();
  };

  return (
    <Pressable
      onPressIn={hasTrades ? handlePressIn : undefined}
      onPressOut={hasTrades ? handlePressOut : undefined}
      onPress={handlePress}
      pressRetentionOffset={{ top: 14, left: 14, bottom: 14, right: 14 }}
      style={style}
    >
      {children}
    </Pressable>
  );
}
