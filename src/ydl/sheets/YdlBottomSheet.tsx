import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useYdlSheetAppearanceStyle, useYdlSheetBackdrop, ydlSheetAnimationConfigs } from "./YdlSheetBackdrop";
import { YdlSheetHandle } from "./YdlSheetHandle";
import type { GorhomBottomSheetHandle, YdlBottomSheetProps, YdlBottomSheetRef } from "./sheet.types";
import { runYdlHaptic } from "../haptics";
import { subscribeYdlReduceMotion } from "../motion/accessibility";

function resolveSizing(sizing: YdlBottomSheetProps["sizing"]) {
  if (sizing.mode === "fixed") {
    return {
      enableDynamicSizing: false as const,
      snapPoints: [...sizing.snapPoints],
      indexWhenOpen: sizing.initialSnapIndex ?? 0,
      maxDynamicContentSize: undefined as number | undefined,
    };
  }
  return {
    enableDynamicSizing: true as const,
    snapPoints: undefined as string[] | number[] | undefined,
    indexWhenOpen: 0,
    maxDynamicContentSize: sizing.maxDynamicContentSize,
  };
}

export const YdlBottomSheet = forwardRef<YdlBottomSheetRef, YdlBottomSheetProps>(
  function YdlBottomSheet(
    {
      children,
      sizing,
      open,
      enablePanDownToClose = true,
      backdrop = "pressable",
      appearance = "dark",
      accessibilityLabel = "Bottom sheet",
      style,
      hapticOnSettle = false,
      onOpenChange,
    },
    ref,
  ) {
    const innerRef = useRef<GorhomBottomSheetHandle>(null);
    const resolved = resolveSizing(sizing);
    const renderBackdrop = useYdlSheetBackdrop({ mode: backdrop, appearance });
    const appearanceStyle = useYdlSheetAppearanceStyle(appearance);
    const wasOpen = useRef(false);

    useEffect(() => subscribeYdlReduceMotion(() => undefined), []);

    const api = useMemo<YdlBottomSheetRef>(
      () => ({
        open: () => innerRef.current?.snapToIndex(resolved.indexWhenOpen),
        close: () => innerRef.current?.close(),
        snapToIndex: (index: number) => innerRef.current?.snapToIndex(index),
      }),
      [resolved.indexWhenOpen],
    );

    useImperativeHandle(ref, () => api, [api]);

    useEffect(() => {
      if (open === undefined) return;
      if (open) api.open();
      else api.close();
    }, [api, open]);

    const onChange = useCallback(
      (index: number) => {
        const isOpen = index >= 0;
        if (isOpen !== wasOpen.current) {
          wasOpen.current = isOpen;
          onOpenChange?.(isOpen);
          if (hapticOnSettle) {
            runYdlHaptic(isOpen ? "selection" : "impactLight");
          }
        }
      },
      [hapticOnSettle, onOpenChange],
    );

    const handleComponent = useCallback(
      (props: React.ComponentProps<typeof YdlSheetHandle>) => (
        <YdlSheetHandle {...props} appearance={appearance} accessibilityLabel={`${accessibilityLabel} handle`} />
      ),
      [accessibilityLabel, appearance],
    );

    const indexProps =
      open === undefined
        ? ({ defaultIndex: -1 } as const)
        : ({ index: open ? resolved.indexWhenOpen : -1 } as const);

    return (
      <BottomSheet
        ref={innerRef}
        {...indexProps}
        enableDynamicSizing={resolved.enableDynamicSizing}
        snapPoints={resolved.snapPoints}
        maxDynamicContentSize={resolved.maxDynamicContentSize}
        enablePanDownToClose={enablePanDownToClose}
        backdropComponent={renderBackdrop}
        handleComponent={handleComponent}
        backgroundStyle={appearanceStyle.backgroundStyle}
        style={style}
        animationConfigs={ydlSheetAnimationConfigs()}
        accessible
        accessibilityLabel={accessibilityLabel}
        onChange={onChange}
      >
        {children}
      </BottomSheet>
    );
  },
);

export {
  BottomSheetScrollView as YdlSheetScrollView,
  BottomSheetTextInput as YdlSheetTextInput,
  BottomSheetView as YdlSheetView,
};
