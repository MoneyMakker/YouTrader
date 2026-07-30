import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useYdlSheetAppearanceStyle, useYdlSheetBackdrop, ydlSheetAnimationConfigs } from "./YdlSheetBackdrop";
import { YdlSheetHandle } from "./YdlSheetHandle";
import type {
  GorhomBottomSheetModalHandle,
  YdlBottomSheetModalProps,
  YdlBottomSheetModalRef,
} from "./sheet.types";
import { runYdlHaptic } from "../haptics";
import { subscribeYdlReduceMotion } from "../motion/accessibility";

function resolveSizing(sizing: YdlBottomSheetModalProps["sizing"]) {
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

export const YdlBottomSheetModal = forwardRef<YdlBottomSheetModalRef, YdlBottomSheetModalProps>(
  function YdlBottomSheetModal(
    {
      children,
      sizing,
      open,
      enablePanDownToClose = true,
      backdrop = "pressable",
      appearance = "dark",
      accessibilityLabel = "Modal bottom sheet",
      style,
      hapticOnSettle = false,
      onOpenChange,
    },
    ref,
  ) {
    const innerRef = useRef<GorhomBottomSheetModalHandle>(null);
    const resolved = resolveSizing(sizing);
    const renderBackdrop = useYdlSheetBackdrop({ mode: backdrop, appearance });
    const appearanceStyle = useYdlSheetAppearanceStyle(appearance);
    const wasOpen = useRef(false);

    useEffect(() => subscribeYdlReduceMotion(() => undefined), []);

    const api = useMemo<YdlBottomSheetModalRef>(
      () => ({
        present: () => {
          innerRef.current?.present();
        },
        dismiss: () => innerRef.current?.dismiss(),
        snapToIndex: (index: number) => innerRef.current?.snapToIndex(index),
      }),
      [],
    );

    useImperativeHandle(ref, () => api, [api]);

    useEffect(() => {
      if (open === undefined) return;
      if (open) api.present();
      else api.dismiss();
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

    return (
      <BottomSheetModal
        ref={innerRef}
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
      </BottomSheetModal>
    );
  },
);

export {
  BottomSheetScrollView as YdlModalSheetScrollView,
  BottomSheetTextInput as YdlModalSheetTextInput,
  BottomSheetView as YdlModalSheetView,
};
