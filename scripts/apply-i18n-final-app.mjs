#!/usr/bin/env node
/** Final App.tsx i18n string replacements */
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "App.tsx");
let src = fs.readFileSync(file, "utf8");
let count = 0;

/** @type {Array<[string, string, "literal"|"jsx"]>} */
const REPLACEMENTS = [
  ['"Market update"', 't("fallbackMarketUpdate")', "literal"],
  ['"Economic event"', 't("fallbackEconomicEvent")', "literal"],
  ['"No cached reason yet."', 't("fallbackNoCachedReason")', "literal"],
  ['"No change summary."', 't("fallbackNoChangeSummary")', "literal"],
  ['"Prop firm"', 't("fallbackPropFirm")', "literal"],
  ['"Market Intel"', 't("fallbackMarketIntel")', "literal"],
  ['"Educational market context only. Not financial advice."', 't("fallbackMarketContextCaution")', "literal"],
  ['"Voice note"', 't("voiceNoteLabel")', "literal"],
  ['"Need trades"', 't("needTrades")', "literal"],
  ['"UNLOCKED"', 't("badgeUnlocked")', "literal"],
  ['"NEXT TARGET"', 't("badgeNextTarget")', "literal"],
  ['"LOCKED"', 't("badgeLocked")', "literal"],
  ['"Achievement share failed"', 't("achievementShareFailed")', "literal"],
  ['"Achievement save failed"', 't("achievementSaveFailed")', "literal"],
  ['"Export your achievement card"', 't("exportAchievementCard")', "literal"],
  ['"Share Card"', 't("sharePnlCard")', "literal"],
  ['"Save Image"', 't("saveImage")', "literal"],
  ['"Maintain consistency."', 't("maintainConsistency")', "literal"],
  ['"Pro Pattern"', 't("proPattern")', "literal"],
  ['"Revenge Trading Alert"', 't("revengeTradingAlert")', "literal"],
  ['"Revenge Trading Check"', 't("revengeTradingCheck")', "literal"],
  ['"Unlock premium exports."', 't("unlockPremiumExports")', "literal"],
  ['"Unlock Full Trading Profile"', 't("unlockFullTradingProfile")', "literal"],
  ['"Premium exports"', 't("premiumExports")', "literal"],
  ['"Full radar profile score"', 't("radarUnlockBullet1")', "literal"],
  ['"Strengths and weakest-area insights"', 't("radarUnlockBullet2")', "literal"],
  ['"Advanced performance metrics"', 't("radarUnlockBullet3")', "literal"],
  ['"Share and save performance cards"', 't("premiumExportsBullet1")', "literal"],
  ['"Unlimited monthly PDF reports"', 't("premiumExportsBullet2")', "literal"],
  ['"Advanced AI analytics"', 't("premiumExportsBullet3")', "literal"],
  ['"Build a clean trading sample"', 't("coachMissionSampleTitle")', "literal"],
  ['"Connect a prop firm template"', 't("coachMissionPropTitle")', "literal"],
  ['"Risk Agent"', 't("agentRisk")', "literal"],
  ['"Discipline Agent"', 't("agentDiscipline")', "literal"],
  ['"Prop Firm Agent"', 't("agentPropFirm")', "literal"],
  ['"Session Agent"', 't("agentSession")', "literal"],
  ['"Psychology Agent"', 't("agentPsychology")', "literal"],
  ['"Instrument Agent"', 't("agentInstrument")', "literal"],
  ['"Streak Agent"', 't("agentStreak")', "literal"],
  ['"Execution Agent"', 't("agentExecution")', "literal"],
  ['"Consistency Agent"', 't("agentConsistency")', "literal"],
  ['"Strengths"', 't("strengthsSection")', "literal"],
  ['"Monthly Performance Report"', 't("monthlyPerformanceReport")', "literal"],
  ['"Keep building your sample."', 't("keepBuildingSample")', "literal"],
  ['"Unlock Pro to reveal deeper pattern detection."', 't("unlockProRevealPatterns")', "literal"],
  ['"Unlock Pro to see the highest-impact improvement."', 't("unlockProSeeImprovement")', "literal"],
  ['"Tap to share"', 't("tapToShare")', "literal"],
  ['"Trading Score"', 't("tradingScore")', "literal"],
  ['"Win Rate"', 't("winRate")', "literal"],
  ['"Risk Ctrl"', 't("riskCtrl")', "literal"],
  ['"Consistency"', 't("consistency")', "literal"],
  ['"Recovery"', 't("recovery")', "literal"],
  ['"Profit Factor"', 't("profitFactor")', "literal"],
  ['"Reward Risk"', 't("rewardRiskLabel")', "literal"],
  ['"Risk"', 't("riskLabel")', "literal"],
  ['"Morning"', 't("sessionMorning")', "literal"],
  ['"Midday"', 't("sessionMidday")', "literal"],
  ['"Afternoon"', 't("sessionAfternoon")', "literal"],
  ['"Monday"', 't("weekdayMonday")', "literal"],
  ['"Tuesday"', 't("weekdayTuesday")', "literal"],
  ['"Wednesday"', 't("weekdayWednesday")', "literal"],
  ['"Thursday"', 't("weekdayThursday")', "literal"],
  ['"Friday"', 't("weekdayFriday")', "literal"],
  ['"Saturday"', 't("weekdaySaturday")', "literal"],
  ['"Sunday"', 't("weekdaySunday")', "literal"],
  ['"Daily Brief"', 't("dailyBrief")', "literal"],
  ['"Focus"', 't("focusLabel")', "literal"],
  ['"Score"', 't("scoreLabelShort")', "literal"],
  ['"Metric"', 't("metricDefault")', "literal"],
];

for (const [from, to, mode] of REPLACEMENTS) {
  while (src.includes(from)) {
    src = src.replace(from, to);
    count++;
  }
}

// Pro unlock message (long string)
const radarMsg =
  '"Pro unlocks Profit Factor, Consistency, Recovery, strengths, and weakest-area analysis in your full Trading Radar."';
if (src.includes(radarMsg)) {
  src = src.replace(radarMsg, 't("radarUnlockMessage")');
  count++;
}

// RADAR_PRO_ONLY_LABELS -> keys
src = src.replace(
  'const RADAR_PRO_ONLY_LABELS = new Set(["Consistency", "Recovery", "Profit Factor"]);',
  'const RADAR_PRO_ONLY_KEYS = new Set(["consistency", "recovery", "profitFactor"]);',
);
count++;

src = src.replace(/RADAR_PRO_ONLY_LABELS/g, "RADAR_PRO_ONLY_KEYS");
src = src.replace(/isAxisLocked\(axis\.label\)/g, 'isAxisLocked(axis.key)');
src = src.replace(/isAxisLocked\(label\)/g, "isAxisLocked(key)");
src = src.replace(/!isAxisLocked\(axis\.label\)/g, "!isAxisLocked(axis.key)");

// DNA rings - add key field and t() for explanations
const dnaRingsOld = `  const rings = [
    { label: t("winRate"), value: Math.min(100, stats.wr), display: \`\${stats.wr.toFixed(0)}%\`, color: C.green, target: "55%+", explanation: "Percentage of closed trades that finished green." },
    { label: t("riskLabel"), value: drawdownControl, display: \`\${drawdownControl.toFixed(0)}%\`, color: drawdownControl >= 70 ? C.green : C.yellow, target: "70%+", explanation: "How well your drawdown is controlled relative to current profit and buffer." },
    { label: t("consistency"), value: consistency, display: \`\${consistency.toFixed(0)}%\`, color: C.purple, target: "70%+", explanation: "Green day rate plus daily P&L stability." },
    { label: t("recovery"), value: Math.min(100, Math.max(0, recoveryFactor / 4) * 100), display: recoveryFactor ? recoveryFactor.toFixed(1) : "—", color: C.green, target: "3.0+", explanation: "Net P&L divided by max drawdown." },
    { label: t("profitFactor"), value: Math.min(100, (stats.pf / 2.5) * 100), display: stats.pf ? stats.pf.toFixed(2) : "—", color: C.green, target: "1.5+", explanation: "Gross wins divided by gross losses." },
    { label: t("rewardRiskLabel"), value: Math.min(100, (stats.avgWinLoss / 2.5) * 100), display: stats.avgWinLoss ? stats.avgWinLoss.toFixed(2) : "—", color: C.purple, target: "1.5+", explanation: "Average win size divided by average loss size." },
  ];`;

// If rings weren't replaced yet by script order, do simpler explanation replacements
const explanationMap = [
  ['explanation: "Percentage of closed trades that finished green."', 'explanation: t("radarWinRateExp")'],
  ['explanation: "How well your drawdown is controlled relative to current profit and buffer."', 'explanation: t("radarRiskExp")'],
  ['explanation: "Green day rate plus daily P&L stability."', 'explanation: t("radarConsistencyExp")'],
  ['explanation: "Net P&L divided by max drawdown."', 'explanation: t("radarRecoveryExp")'],
  ['explanation: "Gross wins divided by gross losses."', 'explanation: t("radarProfitFactorExp")'],
  ['explanation: "Average win size divided by average loss size."', 'explanation: t("radarRewardRiskExp")'],
  ['explanation: "Percent of trades closed green."', 'explanation: t("radarWinRateExpShort")'],
  ['explanation: "Drawdown control relative to total performance and risk buffer."', 'explanation: t("radarRiskCtrlExp")'],
  ['explanation: "Green-day quality plus daily P&L stability."', 'explanation: t("radarConsistencyExpShort")'],
];
for (const [from, to] of explanationMap) {
  while (src.includes(from)) {
    src = src.replace(from, to);
    count++;
  }
}

// Target prefix in DNA
src = src.replace(
  '<Text style={styles.terminalSub}>Target {weakest.target}</Text>',
  '<Text style={styles.terminalSub}>{t("targetPrefix")} {weakest.target}</Text>',
);
src = src.replace(
  '<Text style={styles.bottomSheetText}>Target: {selected.target}</Text>',
  '<Text style={styles.bottomSheetText}>{t("targetPrefix")}: {selected.target}</Text>',
);

// Next level prefix
src = src.replace(
  '<SafeText style={styles.traderLevelTop}>Next · {level.nextLevel}</SafeText>',
  '<SafeText style={styles.traderLevelTop}>{t("nextLevelPrefix")} {level.nextLevel}</SafeText>',
);

// Confidence prefix
src = src.replace(/Confidence: \{/g, '{t("confidencePrefix")} {');

// Pro radar axes - inject key field after label replacements
const axesBlock = `  const axes = [
    { label: t("winRate"), value: \`\${stats.wr.toFixed(0)}%\`, score: Math.min(100, stats.wr), target: "55%+", explanation: t("radarWinRateExpShort") },
    { label: t("riskCtrl"), value: \`\${drawdownControl.toFixed(0)}%\`, score: drawdownControl, target: "70%+", explanation: t("radarRiskCtrlExp") },
    { label: t("consistency"), value: \`\${consistency.toFixed(0)}%\`, score: consistency, target: "70%+", explanation: t("radarConsistencyExpShort") },
    { label: t("recovery"), value: recoveryFactor ? recoveryFactor.toFixed(1) : "—", score: Math.min(100, (recoveryFactor / 4) * 100), target: "3.0+", explanation: t("radarRecoveryExp") },
    { label: t("profitFactor"), value: stats.pf ? stats.pf.toFixed(2) : "—", score: Math.min(100, (stats.pf / 2.5) * 100), target: "1.5+", explanation: t("radarProfitFactorExp") },
    { label: t("rewardRiskLabel"), value: stats.avgWinLoss ? stats.avgWinLoss.toFixed(2) : "—", score: Math.min(100, (stats.avgWinLoss / 2.5) * 100), target: "1.5+", explanation: t("radarRewardRiskExp") },
  ];`;

// Add keys to axes if not present - read current state and patch manually via regex
src = src.replace(
  /const axes = \[\n    \{ label: t\("winRate"\),/,
  'const axes = [\n    { key: "winRate", label: t("winRate"),',
);
src = src.replace(
  /\{ label: t\("riskCtrl"\), value:/,
  '{ key: "riskCtrl", label: t("riskCtrl"), value:',
);
src = src.replace(
  /\{ label: t\("consistency"\), value: `\$\{consistency/g,
  '{ key: "consistency", label: t("consistency"), value: `${consistency',
);
// Only second occurrence for premium radar - need careful approach

// Pro-only label map in radar unlock section
src = src.replace(
  '{[t("profitFactor"), t("consistency"), t("recovery")].map((label) => (',
  '{(["profitFactor", "consistency", "recovery"] as const).map((key) => (',
);
src = src.replace(
  /<Text key={label} style={styles\.radarProTag}>{label}<\/Text>/,
  '<Text key={key} style={styles.radarProTag}>{t(key)}</Text>',
);

fs.writeFileSync(file, src);
console.log(`App.tsx: ${count}+ replacements applied`);
