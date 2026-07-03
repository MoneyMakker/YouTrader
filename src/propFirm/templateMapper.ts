import type { PropFirmPhase, PropFirmTemplate, PropFirmUserOverrides } from "./types";

const money = (value: number) => `$${Math.round(value / 1000)}K`;

function parsePhases(raw: unknown): PropFirmPhase[] {
  if (!Array.isArray(raw)) return ["evaluation", "funded"];
  const allowed: PropFirmPhase[] = ["evaluation", "challenge", "funded", "live"];
  return raw.filter((item): item is PropFirmPhase => typeof item === "string" && allowed.includes(item as PropFirmPhase));
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  return typeof raw === "object" && raw && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function normalizeRemoteTemplate(row: unknown): PropFirmTemplate | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const key = String(r.slug || r.key || "").trim();
  if (!key) return null;

  const isActive = r.is_active !== false && r.isActive !== false;
  if (!isActive) return null;

  const accountSize = Number(r.account_size ?? r.accountSize);
  const dailyLossLimit = Number(r.daily_loss_limit ?? r.dailyLossLimit);
  const maxLossLimit = Number(r.max_loss_limit ?? r.maxLossLimit);
  const evaluationContracts = Number(r.evaluation_contracts ?? r.evaluationContracts);
  const liveContracts = Number(r.live_contracts ?? r.liveContracts);
  const evaluationTargetRaw = r.profit_target ?? r.evaluation_target ?? r.evaluationTarget;
  const evaluationTarget = Number(
    evaluationTargetRaw != null ? evaluationTargetRaw : Math.round(accountSize * 0.06),
  );

  if (
    !Number.isFinite(accountSize) ||
    !Number.isFinite(dailyLossLimit) ||
    !Number.isFinite(maxLossLimit) ||
    !Number.isFinite(evaluationContracts) ||
    !Number.isFinite(liveContracts) ||
    !Number.isFinite(evaluationTarget)
  ) {
    return null;
  }

  const rules = parseJsonObject(r.rules);
  const trailingDrawdown = Boolean(
    r.trailing_drawdown ?? r.trailingDrawdown ?? rules.trailingDrawdown ?? rules.drawdownType === "trailing",
  );
  const trailingDrawdownAmount = Number(r.trailing_drawdown_amount ?? r.trailingDrawdownAmount);
  const staticDrawdownRaw = r.static_drawdown ?? r.staticDrawdown;
  const staticDrawdown = trailingDrawdown
    ? null
    : Number.isFinite(Number(staticDrawdownRaw))
      ? Number(staticDrawdownRaw)
      : maxLossLimit;

  const evaluationRiskPct = Number(rules.evaluationRiskPct ?? rules.evaluation_risk_pct ?? 0.1);
  const liveRiskPct = Number(rules.liveRiskPct ?? rules.live_risk_pct ?? 0.08);
  const company = String(r.company || r.name || r.firm || "Unknown");
  const accountName = String(r.account_name || r.accountName || "Evaluation");
  const lastVerified =
    typeof r.last_verified === "string"
      ? r.last_verified.slice(0, 10)
      : typeof r.updated_at === "string"
        ? r.updated_at.slice(0, 10)
        : typeof r.created_at === "string"
          ? r.created_at.slice(0, 10)
          : undefined;

  return {
    key,
    label: String(r.label || `${money(accountSize)} ${accountName}`),
    firm: String(r.name || company),
    company,
    accountName,
    accountSize,
    evaluationTarget,
    dailyLossLimit,
    maxLossLimit,
    staticDrawdown,
    trailingDrawdown,
    trailingDrawdownAmount: Number.isFinite(trailingDrawdownAmount) ? trailingDrawdownAmount : trailingDrawdown ? maxLossLimit : null,
    evaluationContracts,
    liveContracts,
    evaluationRiskPct: Number.isFinite(evaluationRiskPct) ? evaluationRiskPct : 0.1,
    liveRiskPct: Number.isFinite(liveRiskPct) ? liveRiskPct : 0.08,
    minTradingDays: Number(r.min_trading_days ?? r.minTradingDays ?? 0) || 0,
    consistencyRule: parseJsonObject(r.consistency_rule ?? r.consistencyRule),
    scalingRules: parseJsonObject(r.scaling_rules ?? r.scalingRules),
    newsRestrictions: parseJsonObject(r.news_restrictions ?? r.newsRestrictions),
    weekendHoldingAllowed: Boolean(r.weekend_holding_allowed ?? r.weekendHoldingAllowed ?? false),
    payoutRules: parseJsonObject(r.payout_rules ?? r.payoutRules),
    supportedPhases: parsePhases(r.supported_phases ?? r.supportedPhases),
    isCustom: Boolean(r.is_custom ?? r.isCustom ?? key.includes("custom")),
    isActive: isActive,
    sourceUrl: typeof (r.source_url ?? rules.sourceUrl) === "string" ? String(r.source_url ?? rules.sourceUrl) : undefined,
    lastVerified,
  };
}

export function applyUserOverrides(
  template: PropFirmTemplate,
  overrides: PropFirmUserOverrides | null | undefined,
): PropFirmTemplate {
  if (!overrides) return template;
  return {
    ...template,
    firm: overrides.customCompany || template.firm,
    company: overrides.customCompany || template.company,
    dailyLossLimit: overrides.dailyLossLimit ?? template.dailyLossLimit,
    maxLossLimit: overrides.maxLossLimit ?? template.maxLossLimit,
    evaluationTarget: overrides.profitTarget ?? template.evaluationTarget,
    evaluationContracts: overrides.evaluationContracts ?? template.evaluationContracts,
    liveContracts: overrides.liveContracts ?? template.liveContracts,
    minTradingDays: overrides.minTradingDays ?? template.minTradingDays,
    weekendHoldingAllowed: overrides.weekendHoldingAllowed ?? template.weekendHoldingAllowed,
  };
}

export const PROP_FIRM_SELECT_COLUMNS =
  "slug,name,company,account_name,account_size,daily_loss_limit,max_loss_limit,evaluation_contracts,live_contracts,trailing_drawdown,trailing_drawdown_amount,static_drawdown,profit_target,min_trading_days,consistency_rule,scaling_rules,news_restrictions,weekend_holding_allowed,payout_rules,last_verified,source_url,supported_phases,is_custom,is_active,rules,created_at,updated_at";

export const PROP_RULES_CACHE_KEY = "prop-firm-templates-v2";
