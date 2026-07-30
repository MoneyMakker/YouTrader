import "react-native-gesture-handler";
import { createElement } from "react";
import { registerRootComponent } from "expo";
import App from "./App";
import { YdlSheetRoot } from "./src/ydl/sheets";

/**
 * Production entry: gesture-handler first, then sheet modal provider once.
 * Storybook swaps this entry when STORYBOOK_ENABLED=true.
 */
function Root() {
  return createElement(YdlSheetRoot, null, createElement(App));
}

registerRootComponent(Root);
