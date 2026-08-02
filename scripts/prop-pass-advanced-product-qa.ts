import assert from "node:assert/strict";
import { buildDailyRiskCalendar, buildPayoutPlanner, calculateAccountSurvival, calculateRulesComplianceScore, createBreachReplay, RULES_COMPLIANCE_WEIGHTS, type PayoutReadinessValues, type TradingOsResult } from "../src/propPass/tradingOs/index";

assert.equal(Object.values(RULES_COMPLIANCE_WEIGHTS).reduce((sum, value) => sum + value, 0), 100);
const compliance = calculateRulesComplianceScore({ components: { risk_per_trade: 100, allowed_session: 100, maximum_trades: 100, stop_after_losses: 100, position_size_stability: 100, kill_switch: 0, daily_plan: 100, intervention_overrides: 100, possible_revenge_pattern: 100 } });
assert.equal(compliance.values.score, 85, "profitability is not a score input and Kill Switch violations remain material");
assert.equal(calculateRulesComplianceScore({ components: {} }).status, "needs_input");

const rooms = { dailyLossRemainingMinor: 60_000, maximumLossRemainingMinor: 120_000, drawdownRemainingMinor: 90_000, weeklyLossRemainingMinor: 110_000, configuredDailyRiskBudgetMinor: 60_000, configuredPerTradeRiskCapMinor: 30_000 };
const survival = calculateAccountSurvival({ context: "live", riskRooms: rooms, lossPerContractMinor: 12_500, targetDistanceMinor: null });
assert.equal(survival.status, "safe_to_take");
assert.equal(survival.values.prediction, false);
assert.ok(survival.values.modes.every((mode) => mode.maximumRiskLossesRemaining == null || mode.maximumRiskLossesRemaining >= 0));

const breach = createBreachReplay({ tradeId: "trade-1", occurredAt: "2026-08-02T14:00:00.000Z", ruleId: "daily_loss", ruleValueMinor: 50_000, accountValueBeforeMinor: 5_000_000, accountValueAfterMinor: 4_994_000, bufferBeforeMinor: 5_000, plannedRiskMinor: 3_000, actualRiskMinor: 6_000, actualContracts: 2, recommendedContracts: 1 });
assert.equal(breach.status, "rule_violation");
assert.equal(breach.values?.breachAmountMinor, 1_000);
assert.equal(breach.values?.counterfactual.projectedRiskMinor, 3_000);
assert.equal(breach.values?.counterfactual.changesMarketOutcome, false);

const readiness: TradingOsResult<PayoutReadinessValues> = { status: "safe_to_take", values: { eligibleProfitMinor: 200_000, completedTradingDays: 6, minimumTradingDays: 5, consistencyPassed: true, payoutThresholdMinor: 50_000, safetyFloorMinor: 4_800_000, postPayoutReserveMinor: 50_000, safetyBufferAfterPayoutMinor: 50_000, recommendedMaximumPayoutMinor: 100_000, blockers: [] }, reasons: [], missingInputs: [], appliedHardLimits: [], relatedRuleIds: [] };
const planner = buildPayoutPlanner({ readiness, currentEquityMinor: 5_000_000, tradingDayId: "2026-08-02", scenarioAmountsMinor: [50_000, 100_000, 150_000] });
assert.deepEqual(planner.values.scenarios.map((scenario) => scenario.permitted), [true, true, false]);
assert.ok(planner.values.scenarios.every((scenario) => scenario.resultingBufferMinor != null));

const day = { tradingDayId: "2026-08-02", plan: null, tradeIds: ["t1", "t1"], riskUsedMinor: 10_000, riskRemainingMinor: 20_000, health: "healthy" as const, interventions: [], timeline: [], replays: [], killSwitchActive: false, markers: [] };
const calendar = buildDailyRiskCalendar([day, day]);
assert.equal(calendar.length, 1);
assert.deepEqual(calendar[0].tradeIds, ["t1"]);
assert.equal(calendar[0].semanticState, "within_plan");

console.log("prop-pass-advanced-product-qa: PASS");
