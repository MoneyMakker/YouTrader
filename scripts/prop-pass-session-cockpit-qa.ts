import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const cockpit = fs.readFileSync(path.join(root, "src/propPass/ui/PropPassSessionCockpit.tsx"), "utf8");
const liveSettings = fs.readFileSync(path.join(root, "src/propPass/ui/PropPassLiveSettingsEditor.tsx"), "utf8");
const screen = fs.readFileSync(path.join(root, "src/propPass/PropPassInternalScreen.tsx"), "utf8");
const availability = fs.readFileSync(path.join(root, "src/propPass/usePropPassAvailability.ts"), "utf8");

const cockpitKeys = [
  "propPass.cockpit.checkNextTrade",
  "propPass.plan.title",
  "propPass.cockpit.contractCalculator",
  "propPass.cockpit.whatIfSimulator",
  "propPass.cockpit.riskRules",
  "propPass.cockpit.payoutPlanner",
  "propPass.cockpit.safeWithdrawal",
  "propPass.cockpit.timeline",
  "propPass.cockpit.decisionReplay",
  "propPass.cockpit.capitalPreservation",
  "propPass.cockpit.survivalCapacity",
  "propPass.cockpit.dailyRiskCalendar",
  "propPass.cockpit.breachReplay",
  "propPass.cockpit.sessionLock",
  "propPass.cockpit.dailyRiskUsed",
  "propPass.cockpit.dailyRiskRemaining",
  "propPass.cockpit.weeklyLossRoom",
  "propPass.commandCenter.drawdownRoom",
  "propPass.cockpit.drawdownFloor",
  "propPass.cockpit.tradesUsedAllowed",
  "propPass.cockpit.lossStreak",
  "propPass.cockpit.riskMode",
  "propPass.cockpit.recoveryMode",
  "propPass.cockpit.profitProtection",
  "propPass.cockpit.insufficientTradingEvidence",
  "propPass.cockpit.noFabricatedScore",
  "propPass.cockpit.preservationMissingEvidence",
  "propPass.cockpit.row.manualLock",
  "propPass.sessionLock.reasonLabel",
  "propPass.cockpit.row.reviewExpires",
  "propPass.cockpit.calculationTrace",
  "propPass.cockpit.contractsRoundDown",
  "propPass.cockpit.survivalDisclaimer",
  "propPass.cockpit.unavailable.equity",
];

for (const key of cockpitKeys) {
  assert.match(cockpit, new RegExp(key.replace(/\./g, "\\.")), `Cockpit missing i18n key: ${key}`);
}

for (const required of ["buildDailyRiskCalendar", "calendarFactFromPipelineOutput", "prop-pass-calendar-day-", "formatReviewExpiry", "prop-pass-preservation-insufficient", "capitalPreservation", "consecutiveLosses"]) {
  assert.match(cockpit, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Cockpit route missing: ${required}`);
}

assert.match(cockpit, /useTranslation/);
assert.match(cockpit, /useYdlReduceMotion/);
assert.match(cockpit, /withTiming/);
assert.match(cockpit, /runYdlHaptic/);
assert.match(cockpit, /enteredDanger/);
assert.doesNotMatch(cockpit, /#[A-Fa-f0-9]{6}/, "Cockpit must use semantic theme tokens");
assert.doesNotMatch(cockpit, /pass probability/i, "Cockpit must not expose fabricated passage probability");
assert.match(cockpit, /resolveKillSwitchValues/);
assert.match(screen, /<PropPassSessionCockpit/);
assert.doesNotMatch(screen, /<PropPassPassProbability/);
assert.match(availability, /getRuntimeState\(resolvedAccountId\)/);
assert.match(availability, /runtimeError/);
assert.match(liveSettings, /op: "save_live_settings"/);
assert.match(liveSettings, /op: "activate_session_lock"/);
assert.match(liveSettings, /confirm: true/);
assert.match(liveSettings, /reason: normalizedReason/);
assert.match(liveSettings, /expiresAt:/);
assert.match(liveSettings, /propPass\.sessionLock\.reviewIn24Hours/);
assert.match(liveSettings, /minimumCompliantProfitableSessions/);
assert.match(liveSettings, /propPass\.liveSettings\.validationBody/);
assert.match(liveSettings, /propPass\.liveSettings\.saveFailedBody/);
assert.match(liveSettings, /useTranslation/);
assert.doesNotMatch(liveSettings, /#[A-Fa-f0-9]{6}/, "Live settings must use semantic theme tokens");
assert.match(screen, /automaticallyAdjustKeyboardInsets/);
assert.match(screen, /keyboardShouldPersistTaps="handled"/);

console.log("prop-pass-session-cockpit-qa: PASS");
