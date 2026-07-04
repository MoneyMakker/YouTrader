#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const localesDir = path.join(process.cwd(), "src/i18n/locales");
const en = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8"));
const langs = ["ru", "es", "fr", "it", "uk", "de"];

/** Keys intentionally kept EN (brand/terms/product/legal IDs) */
const ALLOWLIST = new Set([
  "premiumAccess",
  "tradingRadar",
  "dnaScore",
  "heatmap",
  "pnl",
  "tradingScore",
  "proRadar",
  "tradingDna",
  "watchlistPlaceholder",
  "authPasswordMasked",
  "authEmailPlaceholder",
  "authTermsSuffix",
  "moodFomo",
  "ok",
  "ev",
  "slAmount",
  "tpAmount",
  "pnl",
  "winLoss",
  "profitFactor",
  "stopLoss",
  "stopLossPrice",
  "takeProfit",
  "takeProfitPrice",
  "recovery",
  "expectancy",
  "performanceIntelligence",
  "preMarketBrief",
  "aiOpportunityScanner",
  "marketIntelHeader",
  "youTraderRiskCoach",
  "hiddenLeaksBenefit",
  "propHealthLabel",
  "propMet",
  "propPhaseEval",
  "propPhaseChallenge",
  "propPhaseLive",
  "propSurvival",
  "propTrend",
  "propStaticDrawdown",
  "propTrailingDrawdown",
  "propAccountHealthScore",
  "propAccountHealthSubtitle",
  "evaluation",
  "stabilityScore",
  "riskCtrl",
  "rewardRiskLabel",
  "localCoachAgentConsEvidence",
  "scoreLabelShort",
  "confidencePrefix",
  "fallbackMarketIntel",
  "levelEliteTitle",
  "levelFundedTitle",
  "levelConsistentTitle",
  "levelRookieTitle",
  "careerConsistent",
  "careerDisciplined",
  "careerProfessional",
  "careerElite",
  "careerLegend",
  "rankRookieTrader",
  "rankConsistentTrader",
  "rankDisciplinedTrader",
  "rankEliteExecution",
  "rankGenericTrader",
  "rewardTradingScore",
  "rewardPropProgress",
  "rewardAchievementBadge",
  "agentRisk",
  "agentDiscipline",
  "agentPropFirm",
  "agentSession",
  "agentPsychology",
  "agentInstrument",
  "agentStreak",
  "agentExecution",
  "agentConsistency",
  "proPattern",
  "easternTime",
]);

console.log("=== Locale EN remainder report ===\n");
for (const lang of langs) {
  const loc = JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), "utf8"));
  const same = Object.keys(en).filter((k) => en[k] === loc[k]);
  const unintentional = same.filter((k) => !ALLOWLIST.has(k));
  console.log(`${lang.toUpperCase()}: ${same.length} total EN-identical, ${unintentional.length} unintentional`);
  if (unintentional.length) {
    console.log(`  Unintentional: ${unintentional.slice(0, 30).join(", ")}${unintentional.length > 30 ? "..." : ""}`);
  }
}
