import assert from "node:assert/strict";
import { evaluateLiveAccount } from "../src/propPass/tradingOs/index.ts";

const account = {
  contextType: "live" as const,
  accountId: "live-1",
  startingBalanceMinor: 1_000_000,
  currentBalanceMinor: 980_000,
  currentEquityMinor: 960_000,
  equityHighMinor: 1_000_000,
  realizedPnlMinor: -20_000,
  tradingDay: "2026-08-02",
  timezone: "America/New_York",
};
const componentScores = {
  current_drawdown: 75,
  daily_risk_adherence: 90,
  weekly_risk_adherence: 90,
  consecutive_loss_control: 80,
  position_size_stability: 85,
  hard_rule_compliance: 100,
  kill_switch_events: 100,
  recovery_mode_adherence: 100,
};
const input = {
  account,
  rules: {
    id: "live-rules",
    dailyRiskBudgetMinor: 30_000,
    weeklyLossLimitMinor: 80_000,
    recoveryModeThresholdBps: 300,
  },
  riskRooms: {
    dailyLossRemainingMinor: 25_000,
    maximumLossRemainingMinor: 100_000,
    drawdownRemainingMinor: 80_000,
    weeklyLossRemainingMinor: 60_000,
    configuredDailyRiskBudgetMinor: 30_000,
    configuredPerTradeRiskCapMinor: 20_000,
  },
  normalRiskPerTradeMinor: 20_000,
  normalMaximumContracts: 4,
  recoveryRiskBps: 5_000,
  minimumCompliantProfitableSessions: 3,
  completedCompliantProfitableSessions: 1,
  killSwitch: {
    configuration: {
      maximumDailyLossMinor: 50_000,
      maximumWeeklyLossMinor: 80_000,
      maximumTradeCount: 3,
      consecutiveLossLimit: 2,
      cutoffMinuteLocal: null,
      stopAfterProfitLock: false,
      resetStrategy: "next_trading_day" as const,
    },
    currentDailyLossMinor: 20_000,
    currentWeeklyLossMinor: 20_000,
    currentTradeCount: 1,
    consecutiveLosses: 0,
    currentMinuteLocal: null,
    profitLockStopActive: false,
    manualSessionLockRequested: false,
    manualSessionLockConfirmed: false,
  },
  preservation: { components: componentScores },
};

const active = evaluateLiveAccount(input);
assert.equal(active.status, "safe_to_take");
assert.equal(active.values.state, "active");
assert.equal(active.values.recovery?.active, true);
assert.equal(active.values.liveRisk?.allowedRiskPerTradeMinor, 10_000);
assert.equal(active.values.killSwitch?.active, false);
assert.equal(active.values.weeklyLossRoomMinor, 60_000);
assert.equal(active.values.dailyRiskRemainingMinor, 25_000);
assert.equal(typeof active.values.preservation?.score, "number");

// Kill Switch / Session Lock stops Live trading with review fields
const locked = evaluateLiveAccount({
  ...input,
  killSwitch: {
    ...input.killSwitch,
    manualSessionLockRequested: true,
    manualSessionLockConfirmed: true,
    manualSessionLockActivatedAt: "2026-08-02T14:00:00.000Z",
    manualSessionLockReason: "Need a break after tilt",
    manualSessionLockExpiresAt: "2026-08-03T20:00:00.000Z",
  },
});
assert.equal(locked.status, "stop_trading");
assert.equal(locked.values.state, "stop_trading");
assert.equal(locked.values.killSwitch?.active, true);
assert.equal(locked.values.killSwitch?.manualSessionLockReason, "Need a break after tilt");
assert.equal(locked.values.killSwitch?.manualSessionLockExpiresAt, "2026-08-03T20:00:00.000Z");

const stopped = evaluateLiveAccount({
  ...input,
  killSwitch: { ...input.killSwitch, currentWeeklyLossMinor: 80_000 },
});
assert.equal(stopped.status, "stop_trading");
assert.equal(stopped.values.state, "stop_trading");

// Challenge context never receives Live lifecycle values
assert.equal(
  evaluateLiveAccount({ ...input, account: { ...account, contextType: "challenge" } }).status,
  "needs_input",
);

// Preservation score withheld without complete compliance components (no fabricating)
const withheld = evaluateLiveAccount({
  ...input,
  preservation: { components: {} },
});
assert.equal(withheld.values.preservation?.score, null);

console.log("prop-pass-live-account-integration-qa: PASS");
