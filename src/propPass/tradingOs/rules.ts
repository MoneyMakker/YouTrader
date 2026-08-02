import type { ChallengeRules, LiveRiskRules, MoneyMinor } from "./contracts";
import { moneyMax, moneySubtract } from "./financialMath";

export type EditableRuleTemplate = Readonly<{
  id: string;
  label: string;
  effectiveDate: string;
  templateVersion: string;
  archived: boolean;
  disclaimer: "Verify these rules against your current prop-firm agreement.";
  challenge: ChallengeRules;
  live: LiveRiskRules;
}>;
export type RuleValidation = { valid: boolean; missingInputs: string[]; reasons: string[] };

/** Editable rules are configuration, never a claim that a firm rule is current. */
export function validateEditableRuleTemplate(template: EditableRuleTemplate): RuleValidation {
  const missingInputs: string[] = [];
  const reasons: string[] = [];
  if (!template.id) missingInputs.push("template_id");
  if (!template.effectiveDate) missingInputs.push("effective_date");
  if (!template.templateVersion) missingInputs.push("template_version");
  if (template.disclaimer !== "Verify these rules against your current prop-firm agreement.") reasons.push("required_rule_disclaimer_missing");
  for (const [key, value] of Object.entries({ daily_loss: template.challenge.dailyLossLimitMinor, maximum_loss: template.challenge.maximumLossLimitMinor, profit_target: template.challenge.profitTargetMinor, maximum_contracts: template.challenge.maximumContracts })) {
    if (value != null && (!Number.isSafeInteger(value) || value < 0)) reasons.push(`invalid_${key}`);
  }
  if (template.challenge.drawdownType != null && template.challenge.drawdownCalculation == null) missingInputs.push("drawdown_calculation");
  return { valid: !missingInputs.length && !reasons.length, missingInputs, reasons };
}

/** New version, never mutates a template or any historical plan snapshot. */
export function duplicateEditableRuleTemplate(template: EditableRuleTemplate, next: Pick<EditableRuleTemplate, "id" | "label" | "effectiveDate" | "templateVersion">): EditableRuleTemplate {
  return Object.freeze({ ...template, ...next, archived: false, challenge: Object.freeze({ ...template.challenge, id: next.id, effectiveDate: next.effectiveDate, templateVersion: next.templateVersion }), live: Object.freeze({ ...template.live, id: next.id }) });
}

export function payoutSafetyFloor(currentEquityMinor: MoneyMinor, maximumLossFloorMinor: MoneyMinor, postPayoutReserveMinor: MoneyMinor): MoneyMinor {
  return moneyMax(maximumLossFloorMinor, moneySubtract(currentEquityMinor, postPayoutReserveMinor));
}
