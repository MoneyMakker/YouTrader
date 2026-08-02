import assert from "node:assert/strict";
import {
  calculateAllowedRisk,
  calculateMaximumSafeWithdrawal,
  calculatePayoutReadiness,
  calculatePositionSize,
  calculateRulesComplianceScore,
  compareRiskModes,
  contractFloor,
  createDecisionReplay,
  createDailyTradingPlan,
  evaluateKillSwitch,
  evaluateRecoveryMode,
  moneyAdd,
  moneyApplyBasisPointsFloor,
  moneySubtract,
  recommendScaling,
  RISK_MODE_POLICIES,
  simulateWhatIf,
  buildChallengeTimeline,
} from "../src/propPass/tradingOs/index";

let seed = 0x1172026;
const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 >>> 0; return seed; };
const integer = (minimum: number, maximum: number) => minimum + random() % (maximum - minimum + 1);
let cases = 0;

for (let iteration = 0; iteration < 1_000; iteration += 1) {
  const daily = integer(0, 2_000_000);
  const maximum = integer(0, 2_000_000);
  const drawdown = integer(0, 2_000_000);
  const dailyBudget = integer(0, 2_000_000);
  const perTrade = integer(0, 2_000_000);
  const hardMinimum = Math.min(daily, maximum, drawdown, dailyBudget, perTrade);
  const rooms = { dailyLossRemainingMinor: daily, maximumLossRemainingMinor: maximum, drawdownRemainingMinor: drawdown, configuredDailyRiskBudgetMinor: dailyBudget, configuredPerTradeRiskCapMinor: perTrade };
  const calm = calculateAllowedRisk(RISK_MODE_POLICIES.calm, rooms, "challenge").values;
  const balanced = calculateAllowedRisk(RISK_MODE_POLICIES.balanced, rooms, "challenge").values;
  const gambler = calculateAllowedRisk(RISK_MODE_POLICIES.gambler, rooms, "challenge").values;
  assert.ok(calm.allowedRiskMinor <= balanced.allowedRiskMinor); // 1
  assert.ok(balanced.allowedRiskMinor <= gambler.allowedRiskMinor); // 2
  assert.ok(gambler.allowedRiskMinor <= hardMinimum); // 3
  assert.equal(moneyApplyBasisPointsFloor(hardMinimum, 2_250), Math.floor(hardMinimum * 2_250 / 10_000)); // 4
  assert.equal(moneySubtract(moneyAdd(daily, maximum), maximum), daily); // 5
  const divisor = integer(1, 50_000);
  assert.ok(contractFloor(hardMinimum, divisor) * divisor <= hardMinimum); // 6
  assert.ok((contractFloor(hardMinimum, divisor) + 1) * divisor > hardMinimum); // 7
  const modes = compareRiskModes(rooms, "challenge", divisor);
  assert.ok(modes.every((mode) => mode.riskPerTradeMinor <= hardMinimum)); // 8
  assert.ok(modes.every((mode) => mode.maximumProjectedDamageMinor <= hardMinimum)); // 9
  if (hardMinimum === 0) assert.ok(modes.every((mode) => mode.recommendedContracts === 0)); // 10
  const instrument = { symbol: "MES", name: "MES", category: "futures" as const, exchange: "CME", currency: "USD", tickSize: 0.25, tickValueMinor: 125, pointValueMinor: 500, roundTripCommissionMinor: 100, defaultSlippageTicks: 1, maximumSupportedContracts: 100, source: "verified_catalogue" as const, verifiedAt: "2026-08-02T00:00:00.000Z" };
  const sized = calculatePositionSize({ plan: { instrument, stopDistance: integer(1, 100), stopUnit: "ticks" }, allowedRiskMinor: balanced.allowedRiskMinor, propMaximumContracts: 50 });
  assert.ok((sized.values.actualRiskMinor ?? 0) <= balanced.allowedRiskMinor); // 11
  assert.ok((sized.values.recommendedContracts ?? 0) <= 50); // 12
  assert.ok((sized.values.recommendedContracts ?? 0) <= instrument.maximumSupportedContracts); // 13
  cases += 13;
}

const account = { contextType: "challenge" as const, accountId: "qa", startingBalanceMinor: 5_000_000, currentBalanceMinor: 5_010_000, currentEquityMinor: 5_010_000, equityHighMinor: 5_010_000, realizedPnlMinor: 10_000, tradingDay: "2026-08-02", timezone: "America/Chicago" };
const rooms = { dailyLossRemainingMinor: 100_000, maximumLossRemainingMinor: 200_000, drawdownRemainingMinor: 180_000, configuredDailyRiskBudgetMinor: 80_000, configuredPerTradeRiskCapMinor: 50_000 };
const whatIfInput = { account, riskRooms: rooms, remainingTargetMinor: 290_000, dailyLossLimitMinor: 100_000, drawdownLimitMinor: 200_000, maximumLossLimitMinor: 200_000 };
const before = JSON.stringify(whatIfInput);
simulateWhatIf({ ...whatIfInput, scenario: { kind: "next_trade_loss", riskMinor: 10_000 } });
assert.equal(JSON.stringify(whatIfInput), before); // 14 What-If is pure

const plan = createDailyTradingPlan({ snapshotId: "plan", generatedAt: "2026-08-02T12:00:00.000Z", account, challengeRules: { id: "r", effectiveDate: "2026-08-02", templateVersion: "r", maximumContracts: 5, stopAfterLosses: 2 }, liveRules: null, riskRooms: rooms, selectedMode: "balanced", preferredInstrument: "MES", intendedSessionId: "rth", instrumentSpecificationVersion: "mes-v1", recentLossStreak: 0 });
assert.ok(Object.isFrozen(plan.values)); // 15 immutable daily plan
assert.equal(createDecisionReplay({ plan: plan.values, trade: { id: "loss", riskMinor: 10_000, realizedPnlMinor: -10_000, sequenceToday: 1 } }).verdict, "good_decision"); // 16
assert.equal(createDecisionReplay({ plan: plan.values, trade: { id: "profit", riskMinor: 10_000, realizedPnlMinor: 20_000, sequenceToday: 1, ruleViolationId: "daily_loss" } }).verdict, "rule_violation"); // 17

const fact = { type: "challenge_started" as const, occurredAt: "2026-08-02T12:00:00.000Z", accountId: "qa", snapshot: { equityMinor: 5_000_000, balanceMinor: 5_000_000 } };
assert.equal(buildChallengeTimeline([fact, fact]).length, 1); // 18 timeline idempotency
assert.equal(calculateRulesComplianceScore({ components: {} }).values.score, null); // 19 score withheld on missing facts
const compliance = { risk_per_trade: 100, allowed_session: 100, maximum_trades: 100, stop_after_losses: 100, position_size_stability: 100, kill_switch: 0, daily_plan: 100, intervention_overrides: 100, possible_revenge_pattern: 100 };
assert.ok((calculateRulesComplianceScore({ components: compliance }).values.score ?? 100) < 90); // 20 profit cannot mask Kill Switch noncompliance

const payout = calculatePayoutReadiness({ currentEquityMinor: 1_200_000, startingBalanceMinor: 1_000_000, eligibleProfitMinor: 200_000, completedTradingDays: 10, minimumTradingDays: 8, consistencyPassed: true, payoutThresholdMinor: 50_000, maximumLossFloorMinor: 1_000_000, postPayoutReserveMinor: 50_000 });
assert.ok(payout.values.recommendedMaximumPayoutMinor <= payout.values.eligibleProfitMinor); // 21
assert.ok((payout.values.safetyBufferAfterPayoutMinor ?? -1) >= 0); // 22
const withdrawal = calculateMaximumSafeWithdrawal({ currentEquityMinor: 1_200_000, equityHighMinor: 1_200_000, realizedEligibleProfitMinor: 200_000, staticLossFloorMinor: 950_000, trailingDrawdownFloorMinor: 1_000_000, postWithdrawalReserveMinor: 50_000, dailyRiskReserveMinor: 25_000, weeklyRiskReserveMinor: 50_000, recoverySafetyReserveMinor: 75_000, recoveryModeActive: false, priorWithdrawalsMinor: 0 });
assert.ok(withdrawal.values.recommendedMaximumWithdrawalMinor <= withdrawal.values.eligibleAmountMinor); // 23
assert.ok((withdrawal.values.resultingBufferMinor ?? -1) >= 0); // 24

const scalingBase = { currentRiskPerTradeMinor: 10_000, currentContracts: 1, maximumAllowedRiskPerTradeMinor: 25_000, maximumAllowedContracts: 3, userMaximumRiskPerTradeMinor: 20_000, riskStepMinor: 5_000, requiresNewEquityHigh: true, atNewEquityHigh: true, minimumProfitableSessions: 3, completedCompliantProfitableSessions: 1, currentDrawdownBps: 0, maximumAcceptableDrawdownBps: 250, capitalPreservationScore: 90, minimumPreservationScore: 80, stablePositionSizing: true, recoveryModeActive: false, killSwitchActive: false, weeklyRiskRoomPositive: true };
assert.equal(recommendScaling(scalingBase).values.eligible, false); // 25 never scale after one session
assert.equal(evaluateRecoveryMode({ currentEquityMinor: 960_000, equityHighMinor: 1_000_000, normalRiskPerTradeMinor: 20_000, normalMaximumContracts: 4, activationDrawdownBps: 300, recoveryRiskBps: 5_000, minimumCompliantProfitableSessions: 3, completedCompliantProfitableSessions: 1 }).values.active, true); // 26 one win cannot exit recovery
const stopped = evaluateKillSwitch({ configuration: { maximumDailyLossMinor: 50_000, maximumWeeklyLossMinor: null, maximumTradeCount: null, consecutiveLossLimit: null, cutoffMinuteLocal: null, stopAfterProfitLock: false, resetStrategy: "next_trading_day" }, currentDailyLossMinor: 50_000, currentWeeklyLossMinor: null, currentTradeCount: null, consecutiveLosses: null, currentMinuteLocal: null, profitLockStopActive: false, manualSessionLockRequested: false, manualSessionLockConfirmed: false });
assert.equal(stopped.status, "stop_trading"); // 27
assert.equal(stopped.values.recommendedRiskMinor, 0); // 28
assert.equal(stopped.values.recommendedContracts, 0); // 29

assert.equal(cases, 13_000);
console.log("prop-pass-build117-invariants-qa: PASS (29 invariants, 13,000 generated assertions)");
