#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const localesDir = path.join(process.cwd(), "src/i18n/locales");
const langs = ["en", "ru", "es", "fr", "it", "uk", "de"];

/** @type {Record<string, Partial<Record<string, string>>>} */
const PATCH = {
  macro: { es: "Macro", fr: "Macroéco", it: "Macroeconomia", de: "Makro" },
  ticks: { es: "Tics", fr: "Tics", de: "Tics" },
  count: { fr: "Opérations", de: "Anzahl" },
  mode: { fr: "Mode actif" },
  points: { fr: "Pts" },
  tags: { fr: "Étiquettes", de: "Markierungen" },
  trades: { fr: "Opérations", de: "Geschäfte" },
  volume: { fr: "Volume", it: "Volume scambiato" },
  authEmailPasswordPlaceholder: { it: "Parola d'ordine" },
  statusLabel: { de: "Zustand" },
  symbol: { de: "Ticker" },
  moodPatient: { fr: "Patience" },
  rewardDiscipline: { ru: "+3 Дисциплина", uk: "+3 Дисципліна", fr: "+3 Discipline mentale" },
  levelTop5: { es: "Top 5 %", fr: "Top 5 %", it: "Top 5 %", de: "Top 5 %", en: "Top 5%" },
  levelTop10: { es: "Top 10 %", fr: "Top 10 %", it: "Top 10 %", de: "Top 10 %", en: "Top 10%" },
  levelTop25: { es: "Top 25 %", fr: "Top 25 %", it: "Top 25 %", de: "Top 25 %", en: "Top 25%" },
  fallbackPropFirm: { es: "Firma prop", fr: "Firme prop", it: "Società prop" },
  direction: { fr: "Sens" },
  focusLabel: { fr: "Priorité", it: "Priorità" },
  journal: { fr: "Carnet", de: "Tagebuch" },
  notifications: { fr: "Alertes" },
  stats: { fr: "Statistiques", de: "Statistik" },
  account: { it: "Conto" },
  exportTitle: { de: "Exportieren" },
  news: { de: "Nachrichten" },
};

for (const lang of langs) {
  const file = path.join(localesDir, `${lang}.json`);
  const current = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [key, translations] of Object.entries(PATCH)) {
    if (translations[lang]) current[key] = translations[lang];
  }
  fs.writeFileSync(file, `${JSON.stringify(Object.fromEntries(Object.keys(current).sort().map((k) => [k, current[k]])), null, 2)}\n`);
}
console.log("Supplement patch applied");
