import type {
  AccountingEvent,
  FixtureExpectation,
  PropAccountFixture,
  PropChallengeFixture,
  PropRuleSetSnapshot,
} from "../types.ts";

export type PropOsFixture = {
  id: string;
  title: string;
  account: PropAccountFixture;
  challenge: PropChallengeFixture;
  events: AccountingEvent[];
  asOfUtc: string;
  previousReadinessScore?: number | null;
  expect: FixtureExpectation;
};

const TZ = "America/New_York";

function baseRules(over: Partial<PropRuleSetSnapshot> & Pick<PropRuleSetSnapshot, "version" | "drawdown">): PropRuleSetSnapshot {
  return {
    firmKey: "fixture-firm",
    currency: "USD",
    firmTimezone: TZ,
    tradingDayRolloverHour: 0,
    profitTargetMinor: 300_000, // $3,000
    dailyLossLimitMinor: 1_000_000, // $10,000 — room for DD-focused fixtures
    dailyLossBasis: "realized_only",
    dailyLossPolicyVersion: "daily-loss-v0",
    minimumTradingDays: 1,
    intradayRequiresEquityStream: true,
    ...over,
  };
}

function account(id: string): PropAccountFixture {
  return {
    id,
    userId: "user-fixture",
    firmKey: "fixture-firm",
    label: `Account ${id}`,
    accountSizeMinor: 5_000_000,
    currency: "USD",
    timezone: TZ,
    status: "active",
  };
}

function challenge(
  id: string,
  accountId: string,
  rules: PropRuleSetSnapshot,
  extra: Partial<PropChallengeFixture> = {},
): PropChallengeFixture {
  return {
    id,
    accountId,
    phase: "evaluation",
    status: "active",
    ruleSetVersion: rules.version,
    ruleSetSnapshot: rules,
    startingBalanceMinor: 5_000_000,
    startedAtUtc: "2026-01-05T14:00:00.000Z",
    ...extra,
  };
}

function close(
  id: string,
  challengeId: string | null,
  accountId: string | null,
  at: string,
  pnl: number,
  opts: Partial<Extract<AccountingEvent, { kind: "fill_close" }>> = {},
): AccountingEvent {
  return {
    kind: "fill_close",
    id,
    challengeId,
    accountId,
    occurredAtUtc: at,
    realizedPnlMinor: pnl,
    feesMinor: 0,
    contracts: 1,
    ...opts,
  };
}

export const PROP_OS_FIXTURES: PropOsFixture[] = [
  {
    id: "F01_static_dd_near_floor",
    title: "Static DD — profit then loss near floor",
    account: account("acc-f01"),
    challenge: challenge("ch-f01", "acc-f01", baseRules({
      version: "fix-static-v1",
      drawdown: { kind: "static", amountMinor: 200_000 },
    })),
    events: [
      close("t1", "ch-f01", "acc-f01", "2026-01-06T15:00:00.000Z", 50_000),
      close("t2", "ch-f01", "acc-f01", "2026-01-06T16:00:00.000Z", -180_000),
    ],
    asOfUtc: "2026-01-06T17:00:00.000Z",
    expect: {
      status: "active",
      readinessScore: null, // n=2 insufficient
      readinessGate: "insufficient_trade_data",
      equityMinor: 5_000_000 + 50_000 - 180_000,
    },
  },
  {
    id: "F02_eod_trailing",
    title: "EOD trailing — HWM up day1, loss day2 vs old floor",
    account: account("acc-f02"),
    challenge: challenge("ch-f02", "acc-f02", baseRules({
      version: "rs-eod-v1",
      drawdown: { kind: "trailingEndOfDay", amountMinor: 200_000 },
      minimumTradingDays: 0,
    })),
    events: [
      close("d1a", "ch-f02", "acc-f02", "2026-01-06T15:00:00.000Z", 300_000),
      { kind: "day_boundary", id: "eod1", challengeId: "ch-f02", occurredAtUtc: "2026-01-07T05:00:00.000Z", tradingDayId: "2026-01-07" },
      close("d2a", "ch-f02", "acc-f02", "2026-01-07T15:00:00.000Z", -150_000),
    ],
    asOfUtc: "2026-01-07T18:00:00.000Z",
    expect: { status: "at_risk", readinessScore: null, equityMinor: 5_150_000 },
  },
  {
    id: "F03_intraday_with_equity_stream",
    title: "Intraday trailing with complete equity stream",
    account: account("acc-f03"),
    challenge: challenge("ch-f03", "acc-f03", baseRules({
      version: "rs-intra-v1",
      drawdown: { kind: "trailingIntraday", amountMinor: 100_000 },
      intradayRequiresEquityStream: true,
      minimumTradingDays: 0,
    })),
    events: [
      close("c1", "ch-f03", "acc-f03", "2026-01-06T14:00:00.000Z", 50_000),
      { kind: "equity_mark", id: "m1", challengeId: "ch-f03", occurredAtUtc: "2026-01-06T14:30:00.000Z", equityMinor: 5_200_000 },
      { kind: "equity_mark", id: "m2", challengeId: "ch-f03", occurredAtUtc: "2026-01-06T15:00:00.000Z", equityMinor: 5_150_000 },
    ],
    asOfUtc: "2026-01-06T16:00:00.000Z",
    expect: {
      status: "active",
      readinessScore: null,
      equitySource: "equity_stream",
      hwmMinor: 5_200_000,
    },
  },
  {
    id: "F04_daily_loss_breach",
    title: "Daily loss breach mid-day",
    account: account("acc-f04"),
    challenge: challenge("ch-f04", "acc-f04", baseRules({
      version: "rs-daily-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
      dailyLossLimitMinor: 100_000,
      minimumTradingDays: 0,
    })),
    events: [
      close("x1", "ch-f04", "acc-f04", "2026-01-06T15:00:00.000Z", -100_000),
    ],
    asOfUtc: "2026-01-06T16:00:00.000Z",
    expect: {
      status: "breached",
      readinessScore: null,
      breachCodesIncludes: ["daily_loss"],
    },
  },
  {
    id: "F05_firm_tz_not_device",
    title: "Trading day uses firm TZ (event near UTC midnight)",
    account: account("acc-f05"),
    challenge: challenge("ch-f05", "acc-f05", baseRules({
      version: "rs-tz-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
      minimumTradingDays: 0,
    })),
    events: [
      // 2026-01-07 04:30 UTC = 2026-01-06 23:30 America/New_York (EST)
      close("z1", "ch-f05", "acc-f05", "2026-01-07T04:30:00.000Z", 10_000),
    ],
    asOfUtc: "2026-01-07T04:45:00.000Z",
    expect: {
      status: "active",
      readinessScore: null,
      // trading day should be 2026-01-06 in NY
    },
  },
  {
    id: "F06_insufficient_data",
    title: "Readiness insufficient data (n=2)",
    account: account("acc-f06"),
    challenge: challenge("ch-f06", "acc-f06", baseRules({
      version: "rs-insuf-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    })),
    events: [
      close("a", "ch-f06", "acc-f06", "2026-01-06T15:00:00.000Z", 1_000),
      close("b", "ch-f06", "acc-f06", "2026-01-06T16:00:00.000Z", 1_000),
    ],
    asOfUtc: "2026-01-06T17:00:00.000Z",
    expect: { status: "active", readinessScore: null, readinessGate: "insufficient_trade_data" },
  },
  {
    id: "F07_readiness_healthy",
    title: "Readiness healthy path (n>=50)",
    account: account("acc-f07"),
    challenge: challenge("ch-f07", "acc-f07", baseRules({
      version: "rs-ready-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
      dailyLossLimitMinor: 500_000,
      minimumTradingDays: 1,
      profitTargetMinor: 300_000,
    })),
    events: Array.from({ length: 50 }, (_, i) =>
      close(
        `r${i}`,
        "ch-f07",
        "acc-f07",
        new Date(Date.UTC(2026, 0, 6, 14, i % 60, Math.floor(i / 60))).toISOString(),
        2_000,
        { brokerSequence: i },
      ),
    ),
    asOfUtc: "2026-01-06T20:00:00.000Z",
    previousReadinessScore: 40,
    expect: { status: "active", readinessScore: true, expectScoreDelta: false },
  },
  {
    id: "F08_static_breach_score_withheld",
    title: "Static breach — readiness withheld",
    account: account("acc-f08"),
    challenge: challenge("ch-f08", "acc-f08", baseRules({
      version: "rs-breach-v1",
      drawdown: { kind: "static", amountMinor: 100_000 },
      dailyLossLimitMinor: 5_000_000,
      minimumTradingDays: 0,
    })),
    events: [close("b1", "ch-f08", "acc-f08", "2026-01-06T15:00:00.000Z", -150_000)],
    asOfUtc: "2026-01-06T16:00:00.000Z",
    expect: {
      status: "breached",
      readinessScore: null,
      breachCodesIncludes: ["static_drawdown"],
    },
  },
  {
    id: "F09_unassigned_ignored",
    title: "Unassigned trades ignored",
    account: account("acc-f09"),
    challenge: challenge("ch-f09", "acc-f09", baseRules({
      version: "rs-un-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    })),
    events: [
      close("u1", null, null, "2026-01-06T15:00:00.000Z", -500_000),
      close("k1", "ch-f09", "acc-f09", "2026-01-06T16:00:00.000Z", 1_000),
    ],
    asOfUtc: "2026-01-06T17:00:00.000Z",
    expect: { status: "active", readinessScore: null, equityMinor: 5_001_000 },
  },
  {
    id: "F10_duplicate_event",
    title: "Duplicate event id — first wins via void of duplicate not auto; same id sorted once",
    account: account("acc-f10"),
    challenge: challenge("ch-f10", "acc-f10", baseRules({
      version: "rs-dup-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    })),
    events: [
      close("same", "ch-f10", "acc-f10", "2026-01-06T15:00:00.000Z", 5_000, { brokerSequence: 1 }),
      close("same", "ch-f10", "acc-f10", "2026-01-06T15:00:00.000Z", 5_000, { brokerSequence: 1 }),
    ],
    asOfUtc: "2026-01-06T16:00:00.000Z",
    expect: { status: "active", readinessScore: null, equityMinor: 5_005_000 },
  },
  {
    id: "F11_fees_missing",
    title: "Fees missing marked",
    account: account("acc-f11"),
    challenge: challenge("ch-f11", "acc-f11", baseRules({
      version: "rs-fees-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    })),
    events: [
      close("f1", "ch-f11", "acc-f11", "2026-01-06T15:00:00.000Z", 10_000, { feesMinor: null }),
    ],
    asOfUtc: "2026-01-06T16:00:00.000Z",
    expect: {
      status: "active",
      readinessScore: null,
      limitationsIncludes: ["fees_missing"],
    },
  },
  {
    id: "F12_passed_challenge",
    title: "Passed challenge",
    account: account("acc-f12"),
    challenge: challenge("ch-f12", "acc-f12", baseRules({
      version: "rs-pass-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
      profitTargetMinor: 50_000,
      minimumTradingDays: 1,
      dailyLossLimitMinor: 5_000_000,
    })),
    events: [
      close("p1", "ch-f12", "acc-f12", "2026-01-06T15:00:00.000Z", 60_000),
    ],
    asOfUtc: "2026-01-06T16:00:00.000Z",
    expect: { status: "passed", readinessScore: null },
  },
  {
    id: "F13_corrected_trade",
    title: "Corrected trade replaces prior fill",
    account: account("acc-f13"),
    challenge: challenge("ch-f13", "acc-f13", baseRules({
      version: "rs-corr-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    })),
    events: [
      close("old", "ch-f13", "acc-f13", "2026-01-06T15:00:00.000Z", -80_000),
      close("new", "ch-f13", "acc-f13", "2026-01-06T15:05:00.000Z", -10_000, { correctsEventId: "old" }),
    ],
    asOfUtc: "2026-01-06T16:00:00.000Z",
    expect: { status: "active", readinessScore: null, equityMinor: 4_990_000 },
  },
  {
    id: "F14_voided_trade",
    title: "Deleted/voided trade excluded",
    account: account("acc-f14"),
    challenge: challenge("ch-f14", "acc-f14", baseRules({
      version: "rs-void-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    })),
    events: [
      close("v1", "ch-f14", "acc-f14", "2026-01-06T15:00:00.000Z", -90_000, { voided: true }),
      close("v2", "ch-f14", "acc-f14", "2026-01-06T16:00:00.000Z", 5_000),
    ],
    asOfUtc: "2026-01-06T17:00:00.000Z",
    expect: { status: "active", readinessScore: null, equityMinor: 5_005_000 },
  },
  {
    id: "F15_out_of_order_import",
    title: "Out-of-order import sorted by canonical order",
    account: account("acc-f15"),
    challenge: challenge("ch-f15", "acc-f15", baseRules({
      version: "rs-ooo-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    })),
    events: [
      close("later", "ch-f15", "acc-f15", "2026-01-06T17:00:00.000Z", 3_000, { brokerSequence: 2 }),
      close("earlier", "ch-f15", "acc-f15", "2026-01-06T15:00:00.000Z", 2_000, { brokerSequence: 1 }),
    ],
    asOfUtc: "2026-01-06T18:00:00.000Z",
    expect: { status: "active", readinessScore: null, equityMinor: 5_005_000 },
  },
  {
    id: "F16_identical_timestamps",
    title: "Identical timestamps — broker sequence then id",
    account: account("acc-f16"),
    challenge: challenge("ch-f16", "acc-f16", baseRules({
      version: "rs-ts-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    })),
    events: [
      close("b", "ch-f16", "acc-f16", "2026-01-06T15:00:00.000Z", 1_000, { brokerSequence: 2 }),
      close("a", "ch-f16", "acc-f16", "2026-01-06T15:00:00.000Z", 2_000, { brokerSequence: 1 }),
    ],
    asOfUtc: "2026-01-06T16:00:00.000Z",
    expect: { status: "active", readinessScore: null, equityMinor: 5_003_000 },
  },
  {
    id: "F17_partial_fills",
    title: "Partial fills / exits as separate accounting events",
    account: account("acc-f17"),
    challenge: challenge("ch-f17", "acc-f17", baseRules({
      version: "rs-partial-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    })),
    events: [
      close("entry-scale", "ch-f17", "acc-f17", "2026-01-06T14:00:00.000Z", 0, { contracts: 1, brokerSequence: 1 }),
      close("exit-1", "ch-f17", "acc-f17", "2026-01-06T15:00:00.000Z", 4_000, { contracts: 1, brokerSequence: 2 }),
      close("exit-2", "ch-f17", "acc-f17", "2026-01-06T15:30:00.000Z", 6_000, { contracts: 1, brokerSequence: 3 }),
    ],
    asOfUtc: "2026-01-06T16:00:00.000Z",
    expect: { status: "active", readinessScore: null, equityMinor: 5_010_000 },
  },
  {
    id: "F18_overnight_position_approx",
    title: "Overnight position — trade-only marks across days",
    account: account("acc-f18"),
    challenge: challenge("ch-f18", "acc-f18", baseRules({
      version: "rs-ovn-v1",
      drawdown: { kind: "trailingEndOfDay", amountMinor: 200_000 },
    })),
    events: [
      close("open-day", "ch-f18", "acc-f18", "2026-01-06T20:00:00.000Z", 20_000),
      { kind: "day_boundary", id: "bd", challengeId: "ch-f18", occurredAtUtc: "2026-01-07T05:00:00.000Z", tradingDayId: "2026-01-07" },
      close("next-day", "ch-f18", "acc-f18", "2026-01-07T15:00:00.000Z", -15_000),
    ],
    asOfUtc: "2026-01-07T16:00:00.000Z",
    expect: {
      status: "active",
      readinessScore: null,
      limitationsIncludes: ["unrealized_excluded"],
    },
  },
  {
    id: "F19_dst_spring_forward",
    title: "DST spring-forward day (America/New_York 2026-03-08)",
    account: account("acc-f19"),
    challenge: challenge("ch-f19", "acc-f19", baseRules({
      version: "rs-dst-sf-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    }), { startedAtUtc: "2026-03-07T14:00:00.000Z" }),
    events: [
      // 12:30 UTC = 08:30 EDT after spring forward
      close("sf1", "ch-f19", "acc-f19", "2026-03-08T12:30:00.000Z", 1_000),
    ],
    asOfUtc: "2026-03-08T13:00:00.000Z",
    expect: { status: "active", readinessScore: null },
  },
  {
    id: "F20_dst_fall_back",
    title: "DST fall-back day (America/New_York 2026-11-01)",
    account: account("acc-f20"),
    challenge: challenge("ch-f20", "acc-f20", baseRules({
      version: "rs-dst-fb-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    }), { startedAtUtc: "2026-10-31T14:00:00.000Z" }),
    events: [
      close("fb1", "ch-f20", "acc-f20", "2026-11-01T15:30:00.000Z", 1_000),
    ],
    asOfUtc: "2026-11-01T16:00:00.000Z",
    expect: { status: "active", readinessScore: null },
  },
  {
    id: "F21_eod_trailing_breach",
    title: "EOD trailing breach",
    account: account("acc-f21"),
    challenge: challenge("ch-f21", "acc-f21", baseRules({
      version: "rs-eod-br-v1",
      drawdown: { kind: "trailingEndOfDay", amountMinor: 100_000 },
      dailyLossLimitMinor: 5_000_000,
      minimumTradingDays: 0,
    })),
    events: [
      close("up", "ch-f21", "acc-f21", "2026-01-06T15:00:00.000Z", 50_000),
      { kind: "day_boundary", id: "e", challengeId: "ch-f21", occurredAtUtc: "2026-01-07T05:00:00.000Z", tradingDayId: "2026-01-07" },
      close("down", "ch-f21", "acc-f21", "2026-01-07T15:00:00.000Z", -200_000),
    ],
    asOfUtc: "2026-01-07T16:00:00.000Z",
    expect: {
      status: "breached",
      readinessScore: null,
      breachCodesIncludes: ["trailing_drawdown"],
    },
  },
  {
    id: "F22_intraday_without_equity_stream",
    title: "Intraday trailing without required equity stream → incomplete",
    account: account("acc-f22"),
    challenge: challenge("ch-f22", "acc-f22", baseRules({
      version: "rs-intra-miss-v1",
      drawdown: { kind: "trailingIntraday", amountMinor: 100_000 },
      intradayRequiresEquityStream: true,
      minimumTradingDays: 0,
    })),
    events: [
      close("only", "ch-f22", "acc-f22", "2026-01-06T15:00:00.000Z", 20_000),
    ],
    asOfUtc: "2026-01-06T16:00:00.000Z",
    expect: {
      status: "active",
      readinessScore: null,
      equitySource: "incomplete",
      limitationsIncludes: ["intraday_equity_stream_missing"],
      readinessGate: "unsupported_rule_calculation",
    },
  },
  {
    id: "F23_concurrent_accounts",
    title: "Multiple concurrent accounts — events scoped per challenge",
    account: account("acc-f23a"),
    challenge: challenge("ch-f23a", "acc-f23a", baseRules({
      version: "rs-multi-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    })),
    events: [
      close("a1", "ch-f23a", "acc-f23a", "2026-01-06T15:00:00.000Z", 5_000),
      close("b1", "ch-f23b", "acc-f23b", "2026-01-06T15:00:00.000Z", -900_000),
    ],
    asOfUtc: "2026-01-06T16:00:00.000Z",
    expect: { status: "active", readinessScore: null, equityMinor: 5_005_000 },
  },
  {
    id: "F24_challenge_reset",
    title: "Challenge reset event",
    account: account("acc-f24"),
    challenge: challenge("ch-f24", "acc-f24", baseRules({
      version: "rs-reset-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
    })),
    events: [
      close("r0", "ch-f24", "acc-f24", "2026-01-06T15:00:00.000Z", -50_000),
      { kind: "challenge_reset", id: "rst", challengeId: "ch-f24", occurredAtUtc: "2026-01-06T18:00:00.000Z", reason: "firm_reset" },
    ],
    asOfUtc: "2026-01-06T19:00:00.000Z",
    expect: { status: "reset", readinessScore: null },
  },
  {
    id: "F25_failed_then_new_attempt",
    title: "Failed attempt followed by new attempt (separate challenge)",
    account: account("acc-f25"),
    challenge: challenge("ch-f25-2", "acc-f25", baseRules({
      version: "rs-attempt2-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
      profitTargetMinor: 50_000,
      minimumTradingDays: 0,
      dailyLossLimitMinor: 5_000_000,
    }), {
      resetOfChallengeId: "ch-f25-1",
      startedAtUtc: "2026-01-10T14:00:00.000Z",
    }),
    events: [
      close("old-fail", "ch-f25-1", "acc-f25", "2026-01-06T15:00:00.000Z", -500_000),
      close("new-ok", "ch-f25-2", "acc-f25", "2026-01-10T15:00:00.000Z", 60_000),
    ],
    asOfUtc: "2026-01-10T16:00:00.000Z",
    expect: { status: "passed", readinessScore: null, equityMinor: 5_060_000 },
  },
  {
    id: "F26_template_update_ignored",
    title: "Rule template update does not alter historical snapshot",
    account: account("acc-f26"),
    challenge: challenge("ch-f26", "acc-f26", baseRules({
      version: "rs-snap-v1",
      drawdown: { kind: "static", amountMinor: 200_000 },
      dailyLossLimitMinor: 5_000_000,
      minimumTradingDays: 0,
    })),
    events: [
      // Would breach if DD were 50_000 (new template) but snapshot keeps 200_000
      close("s1", "ch-f26", "acc-f26", "2026-01-06T15:00:00.000Z", -80_000),
    ],
    asOfUtc: "2026-01-06T16:00:00.000Z",
    expect: {
      status: "active",
      readinessScore: null,
      // still active under snapshot
    },
  },
  {
    id: "F27_score_delta_drivers",
    title: "Score delta with attributable drivers",
    account: account("acc-f27"),
    challenge: challenge("ch-f27", "acc-f27", baseRules({
      version: "rs-delta-v1",
      drawdown: { kind: "static", amountMinor: 2_000_000 },
      dailyLossLimitMinor: 500_000,
      profitTargetMinor: 300_000,
      minimumTradingDays: 1,
    })),
    events: Array.from({ length: 50 }, (_, i) =>
      close(
        `d${i}`,
        "ch-f27",
        "acc-f27",
        new Date(Date.UTC(2026, 0, 6, 14, i % 60, Math.floor(i / 60))).toISOString(),
        3_000,
        { brokerSequence: i },
      ),
    ),
    asOfUtc: "2026-01-06T20:00:00.000Z",
    previousReadinessScore: 30,
    expect: { status: "active", readinessScore: true, expectScoreDelta: true },
  },
  {
    id: "F28_breach_irreversible",
    title: "Breach irreversible without official correction",
    account: account("acc-f28"),
    challenge: challenge("ch-f28", "acc-f28", baseRules({
      version: "rs-irr-v1",
      drawdown: { kind: "static", amountMinor: 100_000 },
      dailyLossLimitMinor: 5_000_000,
      minimumTradingDays: 0,
    }), {
      breachLocked: true,
      status: "breached",
      breachReasons: [{ code: "static_drawdown", at: "2026-01-06T15:00:00.000Z", tradeId: "bad" }],
    }),
    events: [
      close("bad", "ch-f28", "acc-f28", "2026-01-06T15:00:00.000Z", -150_000),
      close("recover", "ch-f28", "acc-f28", "2026-01-06T16:00:00.000Z", 400_000),
    ],
    asOfUtc: "2026-01-06T17:00:00.000Z",
    expect: { status: "breached", readinessScore: null },
  },
  {
    id: "F29_official_correction_clears_breach",
    title: "Official correction may clear breach",
    account: account("acc-f29"),
    challenge: challenge("ch-f29", "acc-f29", baseRules({
      version: "rs-offcorr-v1",
      drawdown: { kind: "static", amountMinor: 100_000 },
      dailyLossLimitMinor: 5_000_000,
      minimumTradingDays: 0,
    }), {
      breachLocked: true,
      status: "breached",
      breachReasons: [{ code: "static_drawdown", at: "2026-01-06T15:00:00.000Z" }],
    }),
    events: [
      close("bad", "ch-f29", "acc-f29", "2026-01-06T15:00:00.000Z", -150_000),
      {
        kind: "official_correction",
        id: "oc1",
        challengeId: "ch-f29",
        occurredAtUtc: "2026-01-06T16:00:00.000Z",
        clearsBreach: true,
        reason: "bad_tick_voided",
      },
      close("void-bad", "ch-f29", "acc-f29", "2026-01-06T16:05:00.000Z", 0, {
        correctsEventId: "bad",
      }),
      close("ok", "ch-f29", "acc-f29", "2026-01-06T16:30:00.000Z", 10_000),
    ],
    asOfUtc: "2026-01-06T17:00:00.000Z",
    expect: { status: "active", readinessScore: null, equityMinor: 5_010_000 },
  },
];
