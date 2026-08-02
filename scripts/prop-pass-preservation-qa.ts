import assert from "node:assert/strict";
import { calculateCapitalPreservationScore } from "../src/propPass/tradingOs";
const full = { current_drawdown: 100, daily_risk_adherence: 100, weekly_risk_adherence: 100, consecutive_loss_control: 100, position_size_stability: 100, hard_rule_compliance: 0, kill_switch_events: 100, recovery_mode_adherence: 100 } as const;
const disciplined = calculateCapitalPreservationScore({ components: full });
assert.equal(disciplined.status, "safe_to_take"); assert.equal(disciplined.values.score, 80, "hard-rule violations materially cap the score even with otherwise strong performance"); assert.equal(disciplined.values.level, "stable");
const incomplete = calculateCapitalPreservationScore({ components: {} });
assert.equal(incomplete.status, "needs_input"); assert.ok(incomplete.missingInputs.includes("preservation_hard_rule_compliance"));
const riskAtIssue = calculateCapitalPreservationScore({ components: { ...full, hard_rule_compliance: 100, current_drawdown: 10 } });
assert.equal(riskAtIssue.values.primaryImprovementAction, "Reduce risk until drawdown room improves.");
