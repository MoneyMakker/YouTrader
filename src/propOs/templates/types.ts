import type { DailyLossBasis, DrawdownKind, PropRuleSetSnapshot } from "../types";

/**
 * Versioned, production-neutral rule template catalogue entry.
 * Not comprehensive firm coverage — explicitly verified internal set only.
 */
export type PropOsRuleTemplate = {
  templateId: string;
  version: string;
  firmKey: string;
  displayName: string;
  programLabel: string;
  supportedAccountSizesMinor: readonly number[];
  currency: string;
  firmTimezone: string;
  tradingDayRolloverHour: number;
  /** Per-size or single target table (minor units). */
  profitTargetBySizeMinor: Readonly<Record<string, number>>;
  dailyLossBySizeMinor: Readonly<Record<string, number>>;
  dailyLossBasis: DailyLossBasis;
  drawdown: {
    kind: DrawdownKind;
    /** Per-size amount minor. */
    amountBySizeMinor: Readonly<Record<string, number>>;
    timing: "eod" | "intraday" | "static";
    stopTrailingAfterTarget?: boolean;
  };
  minimumTradingDays?: number;
  consistencyRule: null;
  unsupportedFields: readonly string[];
  source: {
    evidence: string;
    effectiveDate: string;
  };
};

export type RuleConfirmationSummary = {
  templateId: string;
  templateVersion: string;
  accountSizeMinor: number;
  currency: string;
  profitTargetMinor: number;
  dailyLossLimitMinor: number | null;
  drawdownLimitMinor: number;
  drawdownKind: DrawdownKind;
  drawdownTiming: string;
  resetBehavior: string;
  minimumTradingDays: number | null;
  unsupportedFields: readonly string[];
  ruleSnapshot: PropRuleSetSnapshot;
};

export class TemplateSizeUnsupportedError extends Error {
  readonly field = "accountSizeMinor";
  constructor(templateId: string, size: number) {
    super(`Template ${templateId} does not support account size ${size}`);
    this.name = "TemplateSizeUnsupportedError";
  }
}
