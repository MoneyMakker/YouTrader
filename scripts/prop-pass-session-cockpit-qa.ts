import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const cockpit = fs.readFileSync(path.join(root, "src/propPass/ui/PropPassSessionCockpit.tsx"), "utf8");
const liveSettings = fs.readFileSync(path.join(root, "src/propPass/ui/PropPassLiveSettingsEditor.tsx"), "utf8");
const screen = fs.readFileSync(path.join(root, "src/propPass/PropPassInternalScreen.tsx"), "utf8");
const availability = fs.readFileSync(path.join(root, "src/propPass/usePropPassAvailability.ts"), "utf8");

for (const required of ["Check Next Trade", "Today’s Plan", "Contract Calculator", "What-If Simulator", "Risk Rules", "Payout Planner", "Safe Withdrawal", "Timeline", "Decision Replay", "Capital Preservation", "Survival Capacity", "Daily Risk Calendar", "Breach Replay", "Session Lock", "buildDailyRiskCalendar", "calendarFactFromPipelineOutput", "prop-pass-calendar-day-", "Manual lock"]) assert.match(cockpit, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Cockpit route missing: ${required}`);
for (const required of ["Daily risk used", "Daily risk remaining", "Weekly loss room", "Drawdown room", "Trades used / allowed", "Risk mode"]) assert.ok(cockpit.includes(required), `Cockpit metric missing: ${required}`);
assert.match(cockpit, /useYdlReduceMotion/);
assert.match(cockpit, /withTiming/);
assert.match(cockpit, /runYdlHaptic/);
assert.match(cockpit, /enteredDanger/);
assert.match(cockpit, /How this was calculated/);
assert.match(cockpit, /Contracts always round down/);
assert.match(cockpit, /prediction or passage probability/);
assert.doesNotMatch(cockpit, /#[A-Fa-f0-9]{6}/, "Cockpit must use semantic theme tokens");
assert.doesNotMatch(cockpit, /pass probability/i, "Cockpit must not expose fabricated passage probability");
assert.match(screen, /<PropPassSessionCockpit/);
assert.doesNotMatch(screen, /<PropPassPassProbability/);
assert.match(availability, /getRuntimeState\(resolvedAccountId\)/);
assert.match(availability, /runtimeError/);
assert.match(liveSettings, /op: "save_live_settings"/);
assert.match(liveSettings, /op: "activate_session_lock"/);
assert.match(liveSettings, /confirm: true/);
assert.match(liveSettings, /reason: normalizedReason/);
assert.match(liveSettings, /expiresAt:/);
assert.match(liveSettings, /Review in 24 hours/);
assert.match(liveSettings, /minimumCompliantProfitableSessions/);
assert.match(liveSettings, /Recovery requires at least two compliant profitable sessions/);
assert.match(liveSettings, /Your prior saved rules remain active/);
assert.doesNotMatch(liveSettings, /#[A-Fa-f0-9]{6}/, "Live settings must use semantic theme tokens");
assert.match(screen, /automaticallyAdjustKeyboardInsets/);
assert.match(screen, /keyboardShouldPersistTaps="handled"/);

console.log("prop-pass-session-cockpit-qa: PASS");
