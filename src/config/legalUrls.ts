import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";

export const APPLE_STANDARD_EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

function resolveUrl(envName: string, fallback: string) {
  const value = (process.env[envName] || "").trim();
  if (!value || /your|example|placeholder|changeme/i.test(value)) return fallback;
  try {
    new URL(value);
    return value;
  } catch {
    return fallback;
  }
}

export const PRIVACY_POLICY_URL = resolveUrl(
  "EXPO_PUBLIC_PRIVACY_POLICY_URL",
  "https://borovikgroup-static-pages.vercel.app/privacy",
);

export const TERMS_OF_USE_EULA_URL = resolveUrl(
  "EXPO_PUBLIC_TERMS_OF_USE_URL",
  APPLE_STANDARD_EULA_URL,
);

export async function openLegalUrl(url: string, label: string) {
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: "#A3FF12",
    });
  } catch {
    Alert.alert(label, `Unable to open ${url}. Please try again later.`);
  }
}
