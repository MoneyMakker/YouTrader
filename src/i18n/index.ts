import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";
import ru from "./locales/ru.json";
import uk from "./locales/uk.json";

export const LANG_STORAGE_KEY = "lang-v1";

export type AppLang = "en" | "ru" | "es" | "fr" | "it" | "uk" | "de";

export const SUPPORTED_LANGS: AppLang[] = ["en", "ru", "es", "fr", "it", "uk", "de"];

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  es: { translation: es },
  fr: { translation: fr },
  it: { translation: it },
  uk: { translation: uk },
  de: { translation: de },
} as const;

let initialized = false;

/** Lazy-load expo-localization so a missing/mismatched native module cannot crash import. */
function readDeviceLanguageCode(): string {
  try {
    // Must match Expo SDK 54 (~17.x). Wrong major versions crash native startup in TestFlight.
    const Localization = require("expo-localization") as typeof import("expo-localization");
    return Localization.getLocales()[0]?.languageCode?.toLowerCase() || "en";
  } catch (error) {
    if (__DEV__) {
      console.warn("[YouTrader:i18n] expo-localization unavailable; defaulting to en", error);
    }
    return "en";
  }
}

export function resolveDeviceLanguage(): AppLang {
  const code = readDeviceLanguageCode();
  if (code === "uk" || code === "ua") return "uk";
  if (SUPPORTED_LANGS.includes(code as AppLang)) return code as AppLang;
  return "en";
}

async function ensureI18nCoreInitialized() {
  if (initialized) return;
  await i18n.use(initReactI18next).init({
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
    parseMissingKeyHandler: (key) => {
      if (__DEV__) console.warn(`[i18n] missing key: ${key}`);
      return key;
    },
  });
  initialized = true;
}

export async function initAppI18n(): Promise<AppLang> {
  await ensureI18nCoreInitialized();

  const stored = await AsyncStorage.getItem(LANG_STORAGE_KEY);
  const next = stored && SUPPORTED_LANGS.includes(stored as AppLang) ? (stored as AppLang) : resolveDeviceLanguage();
  if (i18n.language !== next) await i18n.changeLanguage(next);
  return next;
}

export async function changeAppLanguage(lang: AppLang): Promise<void> {
  await ensureI18nCoreInitialized();
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANG_STORAGE_KEY, lang);
}

export function getAppLanguage(): AppLang {
  const current = i18n.language?.split("-")[0] as AppLang;
  return SUPPORTED_LANGS.includes(current) ? current : "en";
}

export function t(key: string, options?: Record<string, unknown>): string {
  if (!initialized) return key;
  const value = i18n.t(key, options);
  return typeof value === "string" ? value : key;
}

export { i18n };
