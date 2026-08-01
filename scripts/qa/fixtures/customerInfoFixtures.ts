/**
 * Deterministic CustomerInfo fixtures for subscription contract tests.
 * CONTRACT PASS only — does not prove live RevenueCat E2E.
 */

export type CustomerInfoFixture = {
  id: string;
  activeSubscriptions?: string[];
  entitlements?: {
    active?: Record<
      string,
      {
        productIdentifier?: string | null;
        expirationDate?: string | null;
        willRenew?: boolean | null;
        periodType?: string | null;
        unsubscribeDetectedAt?: string | null;
        isActive?: boolean;
      } | null
    >;
  };
  allExpirationDates?: Record<string, string | null>;
};

const ENT = "YouTrader Pro";
const EXP_TRIAL = "2026-08-08T00:00:00.000Z";
const EXP_MONTH = "2026-09-01T00:00:00.000Z";
const EXP_YEAR = "2027-08-01T00:00:00.000Z";
const EXP_WEEK = "2026-08-08T00:00:00.000Z";

function active(
  productId: string,
  opts: {
    periodType?: string;
    willRenew?: boolean;
    expirationDate?: string;
    unsubscribeDetectedAt?: string | null;
  } = {},
): CustomerInfoFixture["entitlements"] {
  return {
    active: {
      [ENT]: {
        productIdentifier: productId,
        expirationDate: opts.expirationDate || EXP_MONTH,
        willRenew: opts.willRenew ?? true,
        periodType: opts.periodType || "NORMAL",
        unsubscribeDetectedAt: opts.unsubscribeDetectedAt ?? null,
        isActive: true,
      },
    },
  };
}

export const CUSTOMER_INFO_FIXTURES: Record<string, CustomerInfoFixture | null> = {
  weekly_active: {
    id: "weekly_active",
    activeSubscriptions: ["youtrader_pro_weekly"],
    entitlements: active("youtrader_pro_weekly", {
      periodType: "NORMAL",
      expirationDate: EXP_WEEK,
    }),
    allExpirationDates: { youtrader_pro_weekly: EXP_WEEK },
  },
  monthly_trial: {
    id: "monthly_trial",
    activeSubscriptions: ["youtrader_pro_monthly"],
    entitlements: active("youtrader_pro_monthly", {
      periodType: "TRIAL",
      expirationDate: EXP_TRIAL,
    }),
  },
  monthly_converted: {
    id: "monthly_converted",
    activeSubscriptions: ["youtrader_pro_monthly"],
    entitlements: active("youtrader_pro_monthly", {
      periodType: "NORMAL",
      expirationDate: EXP_MONTH,
    }),
  },
  annual_trial: {
    id: "annual_trial",
    activeSubscriptions: ["youtrader_pro_yearly__"],
    entitlements: active("youtrader_pro_yearly__", {
      periodType: "INTRO",
      expirationDate: EXP_TRIAL,
    }),
  },
  annual_converted: {
    id: "annual_converted",
    activeSubscriptions: ["youtrader_pro_yearly__"],
    entitlements: active("youtrader_pro_yearly__", {
      periodType: "NORMAL",
      expirationDate: EXP_YEAR,
    }),
  },
  trial_canceled_access_active: {
    id: "trial_canceled_access_active",
    activeSubscriptions: ["youtrader_pro_yearly__"],
    entitlements: active("youtrader_pro_yearly__", {
      periodType: "TRIAL",
      willRenew: false,
      expirationDate: EXP_TRIAL,
      unsubscribeDetectedAt: "2026-08-01T00:00:00.000Z",
    }),
  },
  expired: {
    id: "expired",
    activeSubscriptions: [],
    entitlements: { active: {} },
    allExpirationDates: { youtrader_pro_monthly: "2026-07-01T00:00:00.000Z" },
  },
  billing_issue: {
    id: "billing_issue",
    activeSubscriptions: ["youtrader_pro_monthly"],
    entitlements: active("youtrader_pro_monthly", {
      periodType: "NORMAL",
      willRenew: false,
      expirationDate: EXP_MONTH,
    }),
  },
  unknown_product: {
    id: "unknown_product",
    activeSubscriptions: ["some_other_sku"],
    entitlements: active("some_other_sku", { periodType: "NORMAL" }),
  },
  missing_customer_info: null,
};

export const REVENUECAT_CONTRACT = {
  weeklyProductId: "youtrader_pro_weekly",
  monthlyProductId: "youtrader_pro_monthly",
  yearlyProductId: "youtrader_pro_yearly__",
  entitlementId: "YouTrader Pro",
  offeringId: "default",
  expectedPackageCountWhenComplete: 3,
  weeklyTrialDays: 0,
  monthlyTrialDays: 3,
  yearlyTrialDays: 7,
} as const;
