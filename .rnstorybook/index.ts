import "react-native-gesture-handler";
import { createElement } from "react";
import { registerRootComponent } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { view } from "./storybook.requires";
import { YdlSheetRoot } from "../src/ydl/sheets";

/**
 * Optional capture mode for Phase 6 visual baselines.
 * Set EXPO_PUBLIC_YDL_VR_STORY to a story id, e.g.:
 *   youtrader-phase6-visualregressiongallery--dark-gallery
 * When set: open that story and hide on-device chrome for clean screenshots.
 */
const vrStory = process.env.EXPO_PUBLIC_YDL_VR_STORY?.trim();
const captureMode = Boolean(vrStory);

const StorybookUIRoot = view.getStorybookUI({
  shouldPersistSelection: !captureMode,
  onDeviceUI: !captureMode,
  ...(vrStory
    ? {
        initialSelection: vrStory,
      }
    : {}),
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  },
});

/** Sheet provider once at Storybook root (MetricExplanationSheet / YdlBottomSheetModal). */
function Root() {
  return createElement(YdlSheetRoot, null, createElement(StorybookUIRoot));
}

registerRootComponent(Root);
