#!/usr/bin/env node
/** Apply string -> t(key) replacements in source files */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

/** @type {Record<string, string>} */
const REPLACEMENTS = {
  "Add trades to reveal your edge.": "addTradesRevealEdge",
  "Ranked by net P&L": "rankedByNetPnl",
  "Sync firm rules from Supabase to activate the Prop Firm Risk Assistant.": "propSyncActivate",
  "Daily buffer": "dailyBuffer",
  "Day P&L": "dayPnl",
  "To pass": "toPass",
  "Tap for prop firm rules & daily buffer": "propEntryHint",
  "Funded": "funded",
  "Evaluation": "evaluation",
  "Eval account": "evalAccount",
  "Rules, buffers and contract plan update live": "propTemplateHintLive",
  "Stats Dashboard": "statsDashboard",
  "Equity Curve": "equityCurveTitle",
  "Live account story from your journal": "equityCurveSub",
  "Trading DNA": "tradingDna",
  "DNA Score": "dnaScore",
  "Strengths": "strengths",
  "Weakest Area": "weakestArea",
  "Trading Radar": "tradingRadar",
  "Unlock Full Trading Profile": "unlockFullTradingProfile",
  "Heatmap": "heatmap",
  "Log trades to build session intelligence.": "logTradesSessionIntel",
  "Mistakes: watch overtrading, weak notes and trades outside your best session.": "breakdownMistakesHint",
  "Unlocked": "unlocked",
  "Tap to share": "tapToShare",
  "Next Targets": "nextTargets",
  "PROFILE": "radarProfile",
  "PRO RADAR": "proRadar",
  "Unlock full profile": "unlockFullProfile",
  "AI Journal Review": "aiJournalReview",
  "Your journal is exposing hidden patterns.": "detectiveTitle",
  "Main Blind Spot": "mainBlindSpot",
  "Hidden Patterns": "hiddenPatterns",
  "Agent Findings": "agentFindings",
  "Next Trading Rule": "nextTradingRule",
  "Trading Score": "tradingScore",
  "Strength": "strength",
  "Pattern Prediction": "patternPrediction",
  "Top strength patterns": "topStrengthPatterns",
  "Top risk patterns": "topRiskPatterns",
  "Top Opportunity": "topOpportunity",
  "Pass Probability": "passProbability",
  "What it means": "whatItMeans",
  "Recommendation": "recommendation",
  "Hidden Leaks": "hiddenLeaks",
  "Highest-impact behavior patterns to fix first": "hiddenLeaksHint",
  "More trade history is needed before patterns can be detected.": "moreTradeHistoryNeeded",
  "Trader Status": "traderStatus",
  "Share-worthy badges from real journal data": "traderStatusSub",
  "Current Trader Level": "currentTraderLevel",
  "Unlocked Status Badges": "unlockedStatusBadges",
  "Keep logging trades to unlock your first trader-status badge.": "keepLoggingBadges",
  "Session Heatmap": "sessionHeatmap",
  "P&L, win rate, and trade volume by hour": "sessionHeatmapSub",
  "Volume": "volume",
  "Loss leak": "lossLeak",
  "Weak win rate": "weakWinRate",
  "Strong edge": "strongEdge",
  "Signal Timeline": "signalTimeline",
  "Today's Coaching": "todaysCoaching",
  "Next improvement": "nextImprovement",
  "Action Plan": "actionPlan",
  "AI Weekly Report": "aiWeeklyReport",
  "A compact weekly read on P&L, risk, behavior and next focus.": "aiWeeklyReportSub",
  "Best Behavior": "bestBehavior",
  "Main Risk Warning": "mainRiskWarning",
  "Next week focus": "nextWeekFocus",
  "Daily Mission": "dailyMission",
  "View related stats": "viewRelatedStats",
  "Achievement System": "achievementSystem",
  "Behavior-based milestones. No fake rankings, no vanity badges.": "achievementSystemSub",
  "Personal Trading DNA": "personalTradingDna",
  "Compare Yourself": "compareYourself",
  "Anonymous benchmark architecture. User data stays private.": "compareYourselfSub",
  "You Are Improving": "youAreImproving",
  "Real comparison only. If performance declines, the card says so.": "youAreImprovingSub",
  "Prop Firm Risk Assistant": "propFirmRiskAssistant",
  "Unified risk engine fed into Weekly Report, Daily Mission, DNA, Coach and achievements.": "propFirmRiskAssistantSub",
  "Status": "statusLabel",
  "Protect Pass Path": "protectPassPath",
  "Performance Intelligence": "performanceIntelligence",
  "Select a prop firm template to unlock pass-path coaching.": "selectPropTemplatePass",
  "Select a prop firm template to unlock funded/evaluation risk planning.": "selectPropTemplateFunded",
  "Evidence Map": "evidenceMap",
  "Every recommendation is tied back to session and calendar behavior.": "evidenceMapSub",
  "Sync firm templates from Supabase to activate prop-firm-aware coaching.": "syncFirmTemplates",
  "Market headlines are warming up.": "marketHeadlinesWarming",
  "Pull to refresh. Cached news appears here when Supabase or the public fallback returns headlines.": "marketHeadlinesSub",
  "Eastern Time": "easternTime",
  "No scheduled events for this day yet.": "noEventsThisDay",
  "BEST VALUE": "bestValue",
  "Achievement card saved to Photos.": "achievementCardSaved",
  "Export your achievement card": "exportAchievementCard",
  "Share failed": "shareFailed",
  "Save failed": "saveFailed",
  "Try again.": "tryAgain",
  "Related stats": "relatedStats",
  "Sign in failed": "signInFailed",
  "Sign out failed": "signOutFailed",
  "Please try again.": "signOutFailedBody",
  "Terms, Risk Disclosure & Privacy": "termsRiskPrivacy",
  "Sync now": "syncNow",
  "Cloud sign-in is not configured in this build.": "cloudSignInNotConfigured",
  "Keep building your sample.": "keepBuildingSample",
  "Unlock Pro to reveal deeper pattern detection.": "unlockProRevealPatterns",
  "Unlock Pro to see the highest-impact improvement.": "unlockProSeeImprovement",
  "Upgrade to Pro": "upgradeToPro",
  "Building": "building",
};

const files = [
  "App.tsx",
  "src/auth/components/LiveTerminalStatus.tsx",
  "src/auth/ChangePasswordModal.tsx",
  "src/auth/ChangeEmailModal.tsx",
  "src/components/traderStatus/TraderStatusDashboard.tsx",
  "src/components/ui/PremiumLockOverlay.tsx",
  "src/components/ui/YouTraderLottie.tsx",
  "src/components/ai/MarketIntelligenceTools.tsx",
  "src/components/traderStatus/AiAnalyticsProScreen.tsx",
];

let total = 0;

for (const rel of files) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, "utf8");
  let count = 0;

  for (const [text, key] of Object.entries(REPLACEMENTS)) {
    const jsxPattern = `>${text}<`;
    const jsxReplacement = `>{t("${key}")}<`;
    while (src.includes(jsxPattern)) {
      src = src.replace(jsxPattern, jsxReplacement);
      count++;
    }
    const alertPattern = `"${text}"`;
    const alertReplacement = `t("${key}")`;
    // Only replace in Alert.alert contexts - be careful with generic strings
    const alertRegex = new RegExp(`Alert\\.alert\\("${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g");
    if (alertRegex.test(src)) {
      src = src.replace(alertRegex, `Alert.alert(${alertReplacement}`);
      count++;
    }
  }

  if (count > 0) {
    fs.writeFileSync(file, src);
    console.log(`${rel}: ${count} replacements`);
    total += count;
  }
}

console.log(`Total: ${total} replacements`);
