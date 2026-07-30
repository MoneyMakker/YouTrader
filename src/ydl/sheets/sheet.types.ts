import type { ElementRef, ReactNode, Ref } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type BottomSheet from "@gorhom/bottom-sheet";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";

/**
 * Snap points for fixed sheets.
 * - number: absolute points from the bottom of the screen (dp)
 * - `${number}%`: percentage of the container height
 */
export type YdlSheetSnapPoint = number | `${number}%`;

/**
 * Explicit sizing mode — never rely on library defaults silently.
 * - fixed: use snapPoints (enableDynamicSizing = false)
 * - dynamic: size to content (enableDynamicSizing = true)
 */
export type YdlSheetSizing =
  | {
      mode: "fixed";
      snapPoints: readonly YdlSheetSnapPoint[];
      /** Index into snapPoints when opened. Default 0. */
      initialSnapIndex?: number;
    }
  | {
      mode: "dynamic";
      /** Optional cap for dynamic height (dp). */
      maxDynamicContentSize?: number;
    };

export type YdlSheetBackdropMode = "none" | "pressable" | "static";

export type YdlSheetAppearance = "dark" | "light";

export type YdlBottomSheetRef = {
  open: () => void;
  close: () => void;
  snapToIndex: (index: number) => void;
};

export type YdlBottomSheetModalRef = {
  present: () => void;
  dismiss: () => void;
  snapToIndex: (index: number) => void;
};

type YdlSheetSharedProps = {
  children: ReactNode;
  sizing: YdlSheetSizing;
  /** Default true. */
  enablePanDownToClose?: boolean;
  /** Default "pressable". */
  backdrop?: YdlSheetBackdropMode;
  appearance?: YdlSheetAppearance;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Optional restrained haptic on successful open/close only.
   * Default false — never fires while dragging.
   */
  hapticOnSettle?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export type YdlBottomSheetProps = YdlSheetSharedProps & {
  /**
   * Controlled open state. When provided, sheet index follows open.
   * Uncontrolled sheets start closed until open() is called via ref.
   */
  open?: boolean;
};

export type YdlBottomSheetModalProps = YdlSheetSharedProps & {
  /** Controlled visibility for modal sheets. */
  open?: boolean;
};

/** Internal handles — not part of the public app API. */
export type GorhomBottomSheetHandle = ElementRef<typeof BottomSheet>;
export type GorhomBottomSheetModalHandle = ElementRef<typeof BottomSheetModal>;

export type YdlSheetRefProp<T> = Ref<T>;
