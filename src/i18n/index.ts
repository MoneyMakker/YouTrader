import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

export const LANG_STORAGE_KEY = "lang-v1";

export type AppLang = "en" | "ru" | "es" | "fr" | "it" | "uk" | "de";

export const SUPPORTED_LANGS: AppLang[] = ["en", "ru", "es", "fr", "it", "uk", "de"];

const LOCALE_LOADERS: Record<AppLang, () => Promise<Record<string, string>>> = {
  en: async () => en,
  ru: async () => (await import("./locales/ru.json")).default,
  es: async () => (await import("./locales/es.json")).default,
  fr: async () => (await import("./locales/fr.json")).default,
  it: async () => (await import("./locales/it.json")).default,
  uk: async () => (await import("./locales/uk.json")).default,
  de: async () => (await import("./locales/de.json")).default,
};

const loadedLocales = new Set<AppLang>(["en"]);
let initialized = false;

function readDeviceLanguageCode(): string {
  try {
    const Localization = require("expo-localization") as typeof import("expo-localization");
    return Localization.getLocales()[0]?.languageCode?.toLowerCase() || "en";
  } catch {
    return "en";
  }
}

export function resolveDeviceLanguage(): AppLang {
  const code = readDeviceLanguageCode();
  if (code === "uk" || code === "ua") return "uk";
  if (SUPPORTED_LANGS.includes(code as AppLang)) return code as AppLang;
  return "en";
}

export function bootstrapI18nSync(): void {
  if (initialized) return;
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
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

async function ensureLocaleBundle(lang: AppLang): Promise<void> {
  if (loadedLocales.has(lang)) return;
  const bundle = await LOCALE_LOADERS[lang]();
  i18n.addResourceBundle(lang, "translation", bundle, true, true);
  loadedLocales.add(lang);
}

async function ensureI18nCoreInitialized() {
  bootstrapI18nSync();
}

export async function initAppI18n(): Promise<AppLang> {
  await ensureI18nCoreInitialized();

  const stored = await AsyncStorage.getItem(LANG_STORAGE_KEY);
  const next = stored && SUPPORTED_LANGS.includes(stored as AppLang) ? (stored as AppLang) : resolveDeviceLanguage();
  if (next !== "en") {
    await ensureLocaleBundle(next);
  }
  if (i18n.language !== next) await i18n.changeLanguage(next);
  return next;
}

export async function changeAppLanguage(lang: AppLang): Promise<void> {
  await ensureI18nCoreInitialized();
  await ensureLocaleBundle(lang);
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

bootstrapI18nSync();
