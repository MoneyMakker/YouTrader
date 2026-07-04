#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const localesDir = path.join(process.cwd(), "src/i18n/locales");
const langs = ["en", "ru", "es", "fr", "it", "uk", "de"];
function tr(en, ru, es, fr, it, uk, de) { return { en, ru, es, fr, it, uk, de }; }
const T = {
  aiInsightProtectedBuffer: tr("You protected the prop-firm buffer.", "Ты защитил prop-firm buffer.", "Protegiste el buffer prop.", "Vous avez protégé le buffer prop.", "Hai protetto il buffer prop.", "Ти захистив prop-firm buffer.", "Du hast den Prop-Buffer geschützt."),
  aiInsightHealthyPf: tr("Winners paid for losses with a healthy profit factor.", "Winners покрыли losses с хорошим profit factor.", "Ganancias cubrieron pérdidas con buen profit factor.", "Gains ont couvert pertes avec bon profit factor.", "I winner hanno coperto le loss con buon profit factor.", "Winners покрили losses з хорошим profit factor.", "Gewinner deckten Verluste mit gutem Profit Factor."),
  aiInsightConsistentExecution: tr("Execution stayed consistent across the sample.", "Исполнение было стабильным на выборке.", "Ejecución consistente en la muestra.", "Exécution régulière sur l'échantillon.", "Esecuzione consistente sul campione.", "Виконання було стабільним на вибірці.", "Ausführung blieb konsistent in der Stichprobe."),
  aiInsightBuildingEvidence: tr("You kept building journal evidence instead of trading blind.", "Ты накапливал доказательства в журнале, а не торговал вслепую.", "Seguiste acumulando evidencia en el diario.", "Vous avez accumulé des preuves dans le journal.", "Hai accumulato evidenze nel diario.", "Ти накопичував докази в журналі.", "Du hast Journal-Evidenz statt blindem Trading aufgebaut."),
  aiInsightAvgLossLarger: tr("Average loss is larger than average win.", "Средний loss больше среднего win.", "Pérdida media mayor que ganancia media.", "Perte moyenne supérieure au gain moyen.", "Loss medio maggiore del win medio.", "Середній loss більший за середній win.", "Durchschnittlicher Verlust größer als Gewinn."),
  aiInsightDrawdownReached: tr("Drawdown reached {{amount}}.", "Drawdown достиг {{amount}}.", "Drawdown alcanzó {{amount}}.", "Drawdown atteint {{amount}}.", "Drawdown ha raggiunto {{amount}}.", "Drawdown досяг {{amount}}.", "Drawdown erreichte {{amount}}."),
  aiInsightPfBelowOne: tr("Profit factor is below 1.00.", "Profit factor ниже 1.00.", "Profit factor por debajo de 1.00.", "Profit factor inférieur à 1.00.", "Profit factor sotto 1.00.", "Profit factor нижче 1.00.", "Profit Factor unter 1.00."),
};
for (const lang of langs) {
  const file = path.join(localesDir, `${lang}.json`);
  const current = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [key, translations] of Object.entries(T)) {
    if (translations[lang]) current[key] = translations[lang];
  }
  fs.writeFileSync(file, `${JSON.stringify(Object.fromEntries(Object.keys(current).sort().map((k) => [k, current[k]])), null, 2)}\n`);
}
console.log("Patch 3 done");
