import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateKillSwitch } from "../../src/propPass/tradingOs/killSwitch";
import { rebuildPropPassRuntime } from "../../src/propPass/persistence/runtimeRebuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cockpit = fs.readFileSync(path.join(root, "src/propPass/ui/PropPassSessionCockpit.tsx"), "utf8");

const configuration = {
  maximumDailyLossMinor: null,
  maximumWeeklyLossMinor: null,
  maximumTradeCount: null,
  consecutiveLossLimit: null,
  cutoffMinuteLocal: null,
  stopAfterProfitLock: false,
  resetStrategy: "next_trading_day" as const,
};
const manual = evaluateKillSwitch({
  configuration,
  currentDailyLossMinor: 0,
  currentWeeklyLossMinor: null,
  currentTradeCount: 0,
  consecutiveLosses: 0,
  currentMinuteLocal: null,
  profitLockStopActive: false,
  manualSessionLockRequested: true,
  manualSessionLockConfirmed: true,
  manualSessionLockReason: "Step away after revenge sizing",
  manualSessionLockExpiresAt: "2026-08-03T18:00:00.000Z",
});
assert.equal(manual.values.manualSessionLockReason, "Step away after revenge sizing");
assert.equal(manual.values.manualSessionLockExpiresAt, "2026-08-03T18:00:00.000Z");

const user = "00000000-0000-4000-8000-000000000011";
const account = "00000000-0000-4000-8000-000000000012";
const challenge = "00000000-0000-4000-8000-000000000013";
const challengeBase = {
  accountRow: { id: account, user_id: user, firm_key: "custom", label: "QA Challenge", account_size_minor: 5_000_000, currency: "USD", firm_timezone: "America/Chicago", status: "active", source: "user_created", schema_version: "prop-os-schema-v0" },
  challengeRow: { id: challenge, user_id: user, account_id: account, phase: "evaluation", status: "active", rule_set_version: "qa-rules", starting_balance_minor: 5_000_000, started_at: "2026-08-01T12:00:00.000Z", ended_at: null, reset_of_challenge_id: null, breach_locked: false, schema_version: "prop-os-schema-v0" },
  ruleSnapshotRow: { id: "rules", user_id: user, challenge_id: challenge, rule_set_version: "qa-rules", snapshot: { version: "qa-rules", firmKey: "custom", currency: "USD", firmTimezone: "America/Chicago", tradingDayRolloverHour: 17, profitTargetMinor: 300_000, dailyLossLimitMinor: 100_000, dailyLossBasis: "realized_only", dailyLossPolicyVersion: "daily-loss-v0", drawdown: { kind: "static", amountMinor: 200_000 }, minimumTradingDays: 2 }, template_key: null, template_version_at_capture: null, captured_at: "2026-08-01T12:00:00.000Z", schema_version: "prop-os-schema-v0" },
  executions: [],
  accountEvents: [],
  asOfUtc: "2026-08-02T16:00:00.000Z",
  selectedMode: "balanced" as const,
  currentDailyPlan: null,
  persistedTimelineFacts: [],
  liveRiskSettings: null,
  recoveryState: null,
};
const lockedChallenge = rebuildPropPassRuntime({
  ...challengeBase,
  killSwitchSettings: {
    configuredAt: "2026-08-02T16:00:00.000Z",
    manualSessionLockRequested: true,
    manualSessionLockConfirmed: true,
    manualSessionLockActivatedAt: "2026-08-02T16:00:00.000Z",
    manualSessionLockReason: "Challenge tilt break",
    manualSessionLockExpiresAt: "2026-08-03T20:00:00.000Z",
    configuration,
  },
});
assert.equal(lockedChallenge.output.status, "stop_trading");
assert.equal(lockedChallenge.output.killSwitch?.values.manualSessionLockReason, "Challenge tilt break");
assert.equal(lockedChallenge.output.liveLifecycle, null, "challenge session lock must not require live lifecycle");

const lockedLive = rebuildPropPassRuntime({
  accountRow: { id: account, user_id: user, firm_key: "custom", label: "QA Live", account_size_minor: 5_000_000, currency: "USD", firm_timezone: "America/Chicago", status: "active", source: "user_created", schema_version: "prop-os-schema-v0" },
  challengeRow: { id: challenge, user_id: user, account_id: account, phase: "funded", status: "funded", rule_set_version: "qa-rules", starting_balance_minor: 5_000_000, started_at: "2026-08-01T12:00:00.000Z", ended_at: null, reset_of_challenge_id: null, breach_locked: false, schema_version: "prop-os-schema-v0" },
  ruleSnapshotRow: { id: "rules", user_id: user, challenge_id: challenge, rule_set_version: "qa-rules", snapshot: { version: "qa-rules", firmKey: "custom", currency: "USD", firmTimezone: "America/Chicago", tradingDayRolloverHour: 17, profitTargetMinor: 300_000, dailyLossLimitMinor: 100_000, dailyLossBasis: "realized_only", dailyLossPolicyVersion: "daily-loss-v0", drawdown: { kind: "static", amountMinor: 200_000 }, minimumTradingDays: 2 }, template_key: null, template_version_at_capture: null, captured_at: "2026-08-01T12:00:00.000Z", schema_version: "prop-os-schema-v0" },
  executions: [],
  accountEvents: [],
  asOfUtc: "2026-08-02T16:00:00.000Z",
  selectedMode: "balanced",
  currentDailyPlan: null,
  persistedTimelineFacts: [],
  liveRiskSettings: {
    configuredAt: "2026-08-02T16:00:00.000Z",
    selectedMode: "calm",
    weekStartsOn: 1,
    normalRiskPerTradeMinor: 10_000,
    normalMaximumContracts: 2,
    recoveryRiskBps: 5_000,
    minimumCompliantProfitableSessions: 3,
    rules: { id: "live-v1", dailyRiskBudgetMinor: 50_000, weeklyLossLimitMinor: 100_000, maximumDrawdownMinor: 200_000, perTradeRiskCapMinor: 20_000, maximumTrades: 4, consecutiveLossLimit: 2, recoveryModeThresholdBps: 30 },
  },
  recoveryState: {
    state: {
      active: false,
      belowEquityHighBps: 0,
      normalRiskPerTradeMinor: 10_000,
      reducedRiskPerTradeMinor: 10_000,
      normalMaximumContracts: 2,
      reducedMaximumContracts: 2,
      activationReason: null,
      exitCriteria: [],
      exitProgress: { completedCompliantProfitableSessions: 1, requiredCompliantProfitableSessions: 3 },
      scalingDisabled: false,
      gamblerDisabled: false,
    },
    updatedAt: "2026-08-02T16:00:00.000Z",
  },
  killSwitchSettings: {
    configuredAt: "2026-08-02T16:00:00.000Z",
    manualSessionLockRequested: true,
    manualSessionLockConfirmed: true,
    manualSessionLockActivatedAt: "2026-08-02T16:00:00.000Z",
    manualSessionLockReason: "Need a break after tilt",
    manualSessionLockExpiresAt: "2026-08-03T20:00:00.000Z",
    configuration,
  },
});
assert.equal(lockedLive.output.liveLifecycle?.values.killSwitch?.manualSessionLockReason, "Need a break after tilt");
assert.match(cockpit, /manualSessionLockReason/);
assert.match(cockpit, /manualSessionLockExpiresAt/);
assert.match(cockpit, /formatReviewExpiry/);

console.log("sessionLockReviewSurfacing.selftest: PASS");
