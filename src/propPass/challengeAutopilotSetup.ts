import type { PropRuleSetSnapshot, DrawdownKind } from "../propOs/types";
import type { PropOsRuleTemplate } from "../propOs/templates";

export type AutopilotAccountType = "challenge" | "funded" | "live";
export type AutopilotRiskMode = "calm" | "balanced" | "gambler";

export type AutopilotRuleDraft = Readonly<{
  profitTarget: string;
  minimumTradingDays: string;
  dailyLossLimit: string;
  maximumLossLimit: string;
  drawdownKind: DrawdownKind;
  maximumContracts: string;
  timezone: string;
}>;

export type AutopilotRuleBuildResult =
  | { ok: true; accountSizeMinor: number; ruleSnapshot: PropRuleSetSnapshot }
  | { ok: false; field: keyof AutopilotRuleDraft | "accountSize" };

export const AUTOPILOT_PERSISTED_FIELDS = [
  "account_type",
  "account_name",
  "starting_balance",
  "timezone",
  "profit_target",
  "minimum_days",
  "daily_loss",
  "maximum_loss",
  "drawdown_model",
  "maximum_contracts",
] as const;

export const AUTOPILOT_NEEDS_INPUT_FIELDS = [
  "preferred_instrument",
  "consistency",
  "allowed_session",
  "stop_after_losses",
  "cutoff",
  "payout_threshold",
  "payout_minimum_days",
  "reserve",
  "risk_mode",
] as const;

/** Decimal text → integer minor units without binary floating-point multiplication. */
export function parseMajorToMinor(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const major = Number(whole);
  const minor = major * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

export function parsePositiveInteger(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) ? value : null;
}

export function minorToMajorText(minor: number | undefined): string {
  if (!Number.isSafeInteger(minor) || minor == null) return "";
  const whole = Math.floor(minor / 100);
  const fraction = String(minor % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function draftFromTemplate(
  template: PropOsRuleTemplate,
  accountSizeMinor: number,
): AutopilotRuleDraft | null {
  const key = String(accountSizeMinor);
  const profitTarget = template.profitTargetBySizeMinor[key];
  const dailyLoss = template.dailyLossBySizeMinor[key];
  const maximumLoss = template.drawdown.amountBySizeMinor[key];
  if (profitTarget == null || dailyLoss == null || maximumLoss == null) return null;
  return {
    profitTarget: minorToMajorText(profitTarget),
    minimumTradingDays:
      template.minimumTradingDays == null ? "" : String(template.minimumTradingDays),
    dailyLossLimit: minorToMajorText(dailyLoss),
    maximumLossLimit: minorToMajorText(maximumLoss),
    drawdownKind: template.drawdown.kind,
    maximumContracts: "",
    timezone: template.firmTimezone,
  };
}

export function buildAutopilotRuleSnapshot(input: {
  template: PropOsRuleTemplate;
  accountSize: string;
  draft: AutopilotRuleDraft;
}): AutopilotRuleBuildResult {
  const accountSizeMinor = parseMajorToMinor(input.accountSize);
  if (accountSizeMinor == null) return { ok: false, field: "accountSize" };
  const profitTargetMinor = parseMajorToMinor(input.draft.profitTarget);
  if (profitTargetMinor == null) return { ok: false, field: "profitTarget" };
  const dailyLossLimitMinor = parseMajorToMinor(input.draft.dailyLossLimit);
  if (dailyLossLimitMinor == null) return { ok: false, field: "dailyLossLimit" };
  const maximumLossLimitMinor = parseMajorToMinor(input.draft.maximumLossLimit);
  if (maximumLossLimitMinor == null) return { ok: false, field: "maximumLossLimit" };
  const minimumTradingDays = parsePositiveInteger(input.draft.minimumTradingDays);
  if (input.draft.minimumTradingDays.trim() && minimumTradingDays == null) {
    return { ok: false, field: "minimumTradingDays" };
  }
  const maximumContracts = parsePositiveInteger(input.draft.maximumContracts);
  if (input.draft.maximumContracts.trim() && maximumContracts == null) {
    return { ok: false, field: "maximumContracts" };
  }
  if (!input.draft.timezone.trim()) return { ok: false, field: "timezone" };

  return {
    ok: true,
    accountSizeMinor,
    ruleSnapshot: {
      version: `${input.template.templateId}@${input.template.version}:user-confirmed`,
      firmKey: input.template.firmKey,
      currency: input.template.currency,
      firmTimezone: input.draft.timezone.trim(),
      tradingDayRolloverHour: input.template.tradingDayRolloverHour,
      profitTargetMinor,
      dailyLossLimitMinor,
      dailyLossBasis: input.template.dailyLossBasis,
      dailyLossPolicyVersion: "daily-loss-v0",
      drawdown: {
        kind: input.draft.drawdownKind,
        amountMinor: maximumLossLimitMinor,
        stopTrailingAfterTarget: input.template.drawdown.stopTrailingAfterTarget,
      },
      minimumTradingDays: minimumTradingDays ?? undefined,
      maxContracts: maximumContracts ?? undefined,
      intradayRequiresEquityStream:
        input.draft.drawdownKind === "trailingIntraday" ? true : undefined,
    },
  };
}
