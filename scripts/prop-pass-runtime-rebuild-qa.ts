import assert from "node:assert/strict";
import { rebuildPropPassRuntime } from "../src/propPass/persistence/runtimeRebuild";

const user = "00000000-0000-4000-8000-000000000001";
const account = "00000000-0000-4000-8000-000000000002";
const challenge = "00000000-0000-4000-8000-000000000003";
const base = {
  accountRow: { id: account, user_id: user, firm_key: "custom", label: "QA", account_size_minor: 5_000_000, currency: "USD", firm_timezone: "America/Chicago", status: "active", source: "user_created", schema_version: "prop-os-schema-v0" },
  challengeRow: { id: challenge, user_id: user, account_id: account, phase: "evaluation", status: "active", rule_set_version: "qa-rules", starting_balance_minor: 5_000_000, started_at: "2026-08-01T12:00:00.000Z", ended_at: null, reset_of_challenge_id: null, breach_locked: false, schema_version: "prop-os-schema-v0" },
  ruleSnapshotRow: { id: "rules", user_id: user, challenge_id: challenge, rule_set_version: "qa-rules", snapshot: { version: "qa-rules", firmKey: "custom", currency: "USD", firmTimezone: "America/Chicago", tradingDayRolloverHour: 17, profitTargetMinor: 300_000, dailyLossLimitMinor: 100_000, dailyLossBasis: "realized_only", dailyLossPolicyVersion: "daily-loss-v0", drawdown: { kind: "static", amountMinor: 200_000 }, minimumTradingDays: 2 }, template_key: null, template_version_at_capture: null, captured_at: "2026-08-01T12:00:00.000Z", schema_version: "prop-os-schema-v0" },
  executions: [{ id: "exec-a", user_id: user, challenge_id: challenge, account_id: account, trade_client_id: "trade-a", occurred_at: "2026-08-01T15:00:00.000Z", broker_sequence: null, realized_pnl_minor: -20_000, fees_minor: 0, contracts: 2, voided: false, corrects_event_id: null, source: "journal_sync", schema_version: "prop-os-schema-v0" }],
  accountEvents: [], asOfUtc: "2026-08-02T16:00:00.000Z", selectedMode: "balanced" as const, currentDailyPlan: null, persistedTimelineFacts: [], killSwitchConfiguration: null,
};
const result = rebuildPropPassRuntime(base);
assert.equal(result.output.calculationVersion, "build117.pipeline.v2");
assert.equal(result.output.journalApplication.appliedTradeIds.join(","), "trade-a");
assert.equal(result.output.decisionReplay.verdict, "insufficient_data", "P&L must never be substituted for missing planned risk");
assert.equal(result.output.hardRiskRooms?.drawdownRemainingMinor, 180_000);
assert.equal(result.output.status, "needs_input", "missing session facts withhold approval without inventing a stop");
assert.equal(result.output.riskMeter.values.status, "healthy", "optional personal limits default off while account hard rooms remain active");
assert.equal(result.output.dailyPlan.values?.riskPerTradeMinor, 18_000, "balanced allocation is applied only to the hard-capped room");

const funded = rebuildPropPassRuntime({ ...base, challengeRow: { ...base.challengeRow, phase: "funded", status: "funded" } });
assert.equal(funded.output.status, "needs_input");
assert.ok(funded.output.missingInputs.includes("active_rule_version"), "challenge rules are never reinterpreted as Live rules");
console.log("prop-pass-runtime-rebuild-qa: PASS");
