#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const localesDir = path.join(process.cwd(), "src/i18n/locales");
const langs = ["en", "ru", "es", "fr", "it", "uk", "de"];
function tr(en, ru, es, fr, it, uk, de) { return { en, ru, es, fr, it, uk, de }; }

/** @type {Record<string, Record<string, string>>} */
const T = {
  aiFallbackBuildingJournal: tr("You are building journal data", "Ты накапливаешь данные журнала", "Estás construyendo datos del diario", "Vous construisez des données journal", "Stai costruendo dati del diario", "Ти накопичуєш дані журналу", "Du baust Journal-Daten auf"),
  aiFallbackSessionStatsReview: tr("Your risk and session stats can now be reviewed", "Risk и session stats можно анализировать", "Tus stats de riesgo y sesión ya se pueden revisar", "Vos stats risque et session sont analysables", "I tuoi stats rischio e sessione sono analizzabili", "Risk і session stats можна аналізувати", "Risk- und Session-Stats sind jetzt analysierbar"),
  aiFallbackProtectWeakSessions: tr("Protect weak sessions", "Защищай слабые сессии", "Protege sesiones débiles", "Protégez les sessions faibles", "Proteggi sessioni deboli", "Захищай слабкі сесії", "Schwache Sessions schützen"),
  aiFallbackAvoidSizeAfterEmotional: tr("Avoid changing size after emotional trades", "Не меняй size после эмоциональных сделок", "Evita cambiar size tras trades emocionales", "Évitez de changer la taille après trades émotionnels", "Evita di cambiare size dopo trade emotivi", "Не міняй size після емоційних угод", "Size nach emotionalen Trades nicht ändern"),
  aiFallbackRespectDailyStop: tr("Respect daily stop rules", "Соблюдай daily stop rules", "Respeta reglas de stop diario", "Respectez les règles de stop journalier", "Rispetta le regole di stop giornaliero", "Дотримуйся daily stop rules", "Daily-Stop-Regeln einhalten"),
  aiFallbackNoSizeAfterLosses: tr("No size increase after losses", "Не увеличивай size после losses", "Sin aumento de size tras pérdidas", "Pas d'augmentation de taille après pertes", "Niente aumento size dopo perdite", "Не збільшуй size після losses", "Keine Size-Erhöhung nach Verlusten"),
  aiFallbackJournalEveryTrade: tr("Journal every trade", "Логируй каждую сделку", "Registra cada operación", "Journalisez chaque trade", "Registra ogni operazione", "Логуй кожну угоду", "Jeden Trade loggen"),
  aiFallbackTradePlannedSetups: tr("Trade only planned setups", "Торгуй только planned setups", "Opera solo setups planificados", "Tradez seulement setups planifiés", "Opera solo setup pianificati", "Торгуй лише planned setups", "Nur geplante Setups traden"),
  achWhyItMatters: tr("Why it matters", "Почему это важно", "Por qué importa", "Pourquoi c'est important", "Perché conta", "Чому це важливо", "Warum es wichtig ist"),
  microProgress: tr("Progress", "Прогресс", "Progreso", "Progrès", "Progresso", "Прогрес", "Fortschritt"),
  microUnlockedLabel: tr("Unlocked", "Разблокировано", "Desbloqueado", "Débloqué", "Sbloccato", "Розблоковано", "Freigeschaltet"),
  unlockSeriousTraderTools: tr("Unlock serious trader tools.", "Открой серьёзные инструменты трейдера.", "Desbloquea herramientas serias.", "Débloquez des outils pro.", "Sblocca strumenti seri.", "Відкрий серйозні інструменти.", "Schalte ernsthafte Trader-Tools frei."),
  hiddenLeaksFoundTitle: tr("Your journal found 3 hidden leaks", "Журнал нашёл 3 hidden leaks", "Tu diario encontró 3 hidden leaks", "Votre journal a trouvé 3 hidden leaks", "Il diario ha trovato 3 hidden leaks", "Журнал знайшов 3 hidden leaks", "Dein Journal fand 3 Hidden Leaks"),
};

for (const lang of langs) {
  const file = path.join(localesDir, `${lang}.json`);
  const current = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [key, translations] of Object.entries(T)) {
    if (translations[lang]) current[key] = translations[lang];
  }
  fs.writeFileSync(file, `${JSON.stringify(Object.fromEntries(Object.keys(current).sort().map((k) => [k, current[k]])), null, 2)}\n`);
}
console.log(`Polish patch 2: ${Object.keys(T).length} keys`);
