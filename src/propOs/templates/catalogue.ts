import type { PropRuleSetSnapshot } from "../types";
import {
  TemplateSizeUnsupportedError,
  type PropOsRuleTemplate,
  type RuleConfirmationSummary,
} from "./types";

/**
 * Explicitly verified internal templates only.
 * Do not claim comprehensive prop-firm coverage.
 */
export const PROP_OS_INTERNAL_TEMPLATES: readonly PropOsRuleTemplate[] = [
  {
    templateId: "internal.apex-demo.eval.static",
    version: "2026.07.1",
    firmKey: "apex-demo",
    displayName: "Apex Demo (Internal)",
    programLabel: "Evaluation — static drawdown",
    supportedAccountSizesMinor: [5_000_000, 10_000_000],
    currency: "USD",
    firmTimezone: "America/New_York",
    tradingDayRolloverHour: 0,
    profitTargetBySizeMinor: { "5000000": 300_000, "10000000": 600_000 },
    dailyLossBySizeMinor: { "5000000": 100_000, "10000000": 200_000 },
    dailyLossBasis: "realized_only",
    drawdown: {
      kind: "static",
      amountBySizeMinor: { "5000000": 200_000, "10000000": 400_000 },
      timing: "static",
    },
    minimumTradingDays: 1,
    consistencyRule: null,
    unsupportedFields: ["consistency_rule", "news_trading_policy"],
    source: {
      evidence: "internal-verified-demo-seed-v1",
      effectiveDate: "2026-07-01",
    },
  },
  {
    templateId: "internal.apex-demo.eval.trailing",
    version: "2026.07.1",
    firmKey: "apex-demo",
    displayName: "Apex Demo Trailing (Internal)",
    programLabel: "Evaluation — trailing drawdown",
    supportedAccountSizesMinor: [5_000_000],
    currency: "USD",
    firmTimezone: "America/New_York",
    tradingDayRolloverHour: 0,
    profitTargetBySizeMinor: { "5000000": 300_000 },
    dailyLossBySizeMinor: { "5000000": 100_000 },
    dailyLossBasis: "realized_only",
    drawdown: {
      kind: "trailingEndOfDay",
      amountBySizeMinor: { "5000000": 200_000 },
      timing: "eod",
      stopTrailingAfterTarget: false,
    },
    minimumTradingDays: 1,
    consistencyRule: null,
    unsupportedFields: ["consistency_rule", "intraday_equity_stream"],
    source: {
      evidence: "internal-verified-demo-trailing-v1",
      effectiveDate: "2026-07-01",
    },
  },
  {
    templateId: "internal.custom.confirmed",
    version: "2026.07.1",
    firmKey: "custom",
    displayName: "Custom (explicit confirm)",
    programLabel: "Custom rules — must confirm every field",
    supportedAccountSizesMinor: [2_500_000, 5_000_000, 10_000_000],
    currency: "USD",
    firmTimezone: "America/New_York",
    tradingDayRolloverHour: 0,
    profitTargetBySizeMinor: {
      "2500000": 150_000,
      "5000000": 300_000,
      "10000000": 600_000,
    },
    dailyLossBySizeMinor: {
      "2500000": 50_000,
      "5000000": 100_000,
      "10000000": 200_000,
    },
    dailyLossBasis: "realized_only",
    drawdown: {
      kind: "static",
      amountBySizeMinor: {
        "2500000": 100_000,
        "5000000": 200_000,
        "10000000": 400_000,
      },
      timing: "static",
    },
    minimumTradingDays: undefined,
    consistencyRule: null,
    unsupportedFields: [
      "firm_verified_rules",
      "consistency_rule",
      "news_trading_policy",
      "weekend_holding",
    ],
    source: {
      evidence: "user-confirmed-custom-path",
      effectiveDate: "2026-07-01",
    },
  },
] as const;

export function listPropOsInternalTemplates(): readonly PropOsRuleTemplate[] {
  return PROP_OS_INTERNAL_TEMPLATES;
}

export function getPropOsTemplate(
  templateId: string,
  version?: string,
): PropOsRuleTemplate | null {
  const matches = PROP_OS_INTERNAL_TEMPLATES.filter((t) => t.templateId === templateId);
  if (!matches.length) return null;
  if (version) return matches.find((t) => t.version === version) ?? null;
  return matches[matches.length - 1] ?? null;
}

export function buildRuleSnapshotFromTemplate(
  template: PropOsRuleTemplate,
  accountSizeMinor: number,
): PropRuleSetSnapshot {
  const key = String(accountSizeMinor);
  if (!template.supportedAccountSizesMinor.includes(accountSizeMinor)) {
    throw new TemplateSizeUnsupportedError(template.templateId, accountSizeMinor);
  }
  const profitTargetMinor = template.profitTargetBySizeMinor[key];
  const dailyLossLimitMinor = template.dailyLossBySizeMinor[key];
  const drawdownAmount = template.drawdown.amountBySizeMinor[key];
  if (
    profitTargetMinor == null ||
    dailyLossLimitMinor == null ||
    drawdownAmount == null
  ) {
    throw new TemplateSizeUnsupportedError(template.templateId, accountSizeMinor);
  }

  return {
    version: `${template.templateId}@${template.version}`,
    firmKey: template.firmKey,
    currency: template.currency,
    firmTimezone: template.firmTimezone,
    tradingDayRolloverHour: template.tradingDayRolloverHour,
    profitTargetMinor,
    dailyLossLimitMinor,
    dailyLossBasis: template.dailyLossBasis,
    dailyLossPolicyVersion: "daily-loss-v0",
    drawdown: {
      kind: template.drawdown.kind,
      amountMinor: drawdownAmount,
      stopTrailingAfterTarget: template.drawdown.stopTrailingAfterTarget,
    },
    minimumTradingDays: template.minimumTradingDays,
  };
}

export function buildRuleConfirmationSummary(
  template: PropOsRuleTemplate,
  accountSizeMinor: number,
): RuleConfirmationSummary {
  const ruleSnapshot = buildRuleSnapshotFromTemplate(template, accountSizeMinor);
  return {
    templateId: template.templateId,
    templateVersion: template.version,
    accountSizeMinor,
    currency: template.currency,
    profitTargetMinor: ruleSnapshot.profitTargetMinor,
    dailyLossLimitMinor: ruleSnapshot.dailyLossLimitMinor ?? null,
    drawdownLimitMinor: ruleSnapshot.drawdown.amountMinor,
    drawdownKind: ruleSnapshot.drawdown.kind,
    drawdownTiming: template.drawdown.timing,
    resetBehavior: "new_attempt_required",
    minimumTradingDays: ruleSnapshot.minimumTradingDays ?? null,
    unsupportedFields: template.unsupportedFields,
    ruleSnapshot,
  };
}
