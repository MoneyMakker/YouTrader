import React, { useEffect, useState } from "react";
import { Text, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { C } from "../../../theme/colors";

export type TypingTextProps = Omit<TextProps, "children"> & {
  text: string;
  speedMs?: number;
  startDelayMs?: number;
  enabled?: boolean;
  onComplete?: () => void;
  textStyle?: StyleProp<TextStyle>;
};

export function TypingText({
  text,
  speedMs = 22,
  startDelayMs = 0,
  enabled = true,
  onComplete,
  textStyle,
  ...rest
}: TypingTextProps) {
  const [visibleText, setVisibleText] = useState(enabled ? "" : text);

  useEffect(() => {
    if (!enabled) {
      setVisibleText(text);
      onComplete?.();
      return;
    }

    setVisibleText("");
    let index = 0;
    let interval: ReturnType<typeof setInterval> | undefined;

    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        index += 1;
        setVisibleText(text.slice(0, index));
        if (index >= text.length) {
          if (interval) clearInterval(interval);
          onComplete?.();
        }
      }, speedMs);
    }, startDelayMs);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [enabled, onComplete, speedMs, startDelayMs, text]);

  return (
    <Text {...rest} style={[{ color: C.text }, textStyle]}>
      {visibleText}
    </Text>
  );
}
