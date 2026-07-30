import "react-native-url-polyfill/auto";
import { LogBox } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { configureNotificationHandler } from "./src/notifications/push";
import { isExpoGo } from "./src/config/appConfig";
import { markAppStart } from "./src/lib/startupPerf";

if (isExpoGo && __DEV__) {
  LogBox.ignoreLogs([
    /RevenueCat/i,
    /react-native-purchases/i,
    /\[Purchases\]/i,
  ]);
}

WebBrowser.maybeCompleteAuthSession();
configureNotificationHandler();
markAppStart();

export { default } from "./src/app/YouTraderApp";
