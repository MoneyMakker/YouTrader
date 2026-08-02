import type { InstrumentSpec, MoneyMinor, TradingOsResult } from "./contracts";

export type InstrumentSpecificationVersion = Readonly<{
  symbol: string;
  displayName: string;
  exchange: string;
  category: "futures";
  microOf: string | null;
  miniOf: string | null;
  tickSize: number;
  tickValueMinor: MoneyMinor;
  pointValueMinor: MoneyMinor;
  roundTripCommissionMinor: MoneyMinor | null;
  defaultSlippageTicks: number | null;
  maximumSupportedContracts: number | null;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  specificationVersion: string;
  sourceNote: string;
  sourceUrl: string;
  verifiedAt: string;
  userOverrideAllowed: boolean;
  source: "verified_catalogue" | "user_configured";
}>;

export type InstrumentRegistryResolution = Readonly<{
  version: InstrumentSpecificationVersion | null;
  calculationSpec: InstrumentSpec | null;
  versionHistory: InstrumentSpecificationVersion[];
}>;

/**
 * CME contract mechanics verified against primary CME sources on 2026-08-02.
 * Broker commissions and slippage remain intentionally null until configured.
 */
export const VERIFIED_FUTURES_CATALOGUE: readonly InstrumentSpecificationVersion[] = Object.freeze([
  spec("ES", "E-mini S&P 500", "CME", null, null, 0.25, 1_250, 5_000, "https://www.cmegroup.com/content/dam/cmegroup/education/files/a-traders-guide-to-futures.pdf", "CME contract multiplier and minimum tick."),
  spec("MES", "Micro E-mini S&P 500", "CME", "ES", null, 0.25, 125, 500, "https://www.cmegroup.com/articles/faqs/frequently-asked-questions-micro-e-mini-equity-index-futures.html", "CME Micro E-mini contract specifications."),
  spec("NQ", "E-mini Nasdaq-100", "CME", null, null, 0.25, 500, 2_000, "https://www.cmegroup.com/trading/equity-index/files/emini-nasdaq-100-futures-options.pdf", "CME E-mini Nasdaq-100 contract specifications."),
  spec("MNQ", "Micro E-mini Nasdaq-100", "CME", "NQ", null, 0.25, 50, 200, "https://www.cmegroup.com/articles/faqs/frequently-asked-questions-micro-e-mini-equity-index-futures.html", "CME Micro E-mini contract specifications."),
  spec("GC", "Gold", "COMEX", null, null, 0.1, 1_000, 10_000, "https://www.cmegroup.com/education/courses/event-contracts-underlying-markets/product-gold", "CME Gold product overview."),
  spec("MGC", "Micro Gold", "COMEX", "GC", null, 0.1, 100, 1_000, "https://www.cmegroup.com/markets/metals/files/1-oz-futures-comparison.pdf", "CME Gold futures comparison."),
  spec("CL", "WTI Crude Oil", "NYMEX", null, null, 0.01, 1_000, 100_000, "https://www.cmegroup.com/education/articles-and-reports/micro-wti-crude-oil-futures-faq", "CME WTI and Micro WTI contract comparison."),
  spec("MCL", "Micro WTI Crude Oil", "NYMEX", "CL", null, 0.01, 100, 10_000, "https://www.cmegroup.com/education/articles-and-reports/micro-wti-crude-oil-futures-faq", "CME Micro WTI contract specifications."),
]);

export function resolveInstrumentSpecification(input: {
  symbol: string;
  effectiveAt: string;
  catalogue?: readonly InstrumentSpecificationVersion[];
  userVersions?: readonly InstrumentSpecificationVersion[];
}): TradingOsResult<InstrumentRegistryResolution> {
  const symbol = input.symbol.trim().toUpperCase();
  const at = Date.parse(input.effectiveAt);
  if (!symbol || Number.isNaN(at)) return result("needs_input", empty(), ["instrument_lookup_invalid"], [!symbol ? "instrument_symbol" : "instrument_effective_at"]);
  const all = [...(input.catalogue ?? VERIFIED_FUTURES_CATALOGUE), ...(input.userVersions ?? [])];
  const history = all.filter((item) => item.symbol === symbol).sort(compareVersions);
  const malformed = history.flatMap(validateInstrumentVersion);
  if (malformed.length) return result("needs_input", { ...empty(), versionHistory: history }, ["instrument_version_invalid"], malformed);
  if (overlaps(history)) return result("needs_input", { ...empty(), versionHistory: history }, ["instrument_version_overlap"], ["instrument_effective_range"]);
  const candidates = history.filter((item) => Date.parse(item.effectiveFrom) <= at && (item.effectiveTo == null || at < Date.parse(item.effectiveTo)));
  const version = candidates.sort((left, right) => sourcePriority(right) - sourcePriority(left) || Date.parse(right.effectiveFrom) - Date.parse(left.effectiveFrom))[0] ?? null;
  if (!version) return result("needs_input", { ...empty(), versionHistory: history }, ["instrument_version_not_found"], ["instrument_specification_version"]);
  if (version.roundTripCommissionMinor == null || version.defaultSlippageTicks == null) {
    const missing = [version.roundTripCommissionMinor == null ? "instrument_round_trip_commission" : "", version.defaultSlippageTicks == null ? "instrument_default_slippage_ticks" : ""].filter(Boolean);
    return result("needs_input", { version, calculationSpec: null, versionHistory: history }, ["instrument_cost_setup_required"], missing);
  }
  return result("safe_to_take", { version, calculationSpec: toCalculationSpec(version), versionHistory: history }, [], []);
}

export function createUserInstrumentVersion(input: Omit<InstrumentSpecificationVersion, "source">): InstrumentSpecificationVersion {
  const version = Object.freeze({ ...input, symbol: input.symbol.trim().toUpperCase(), source: "user_configured" as const });
  const invalid = validateInstrumentVersion(version);
  if (invalid.length) throw new Error(`Invalid instrument version: ${invalid.join(",")}`);
  return version;
}

function spec(symbol: string, displayName: string, exchange: string, microOf: string | null, miniOf: string | null, tickSize: number, tickValueMinor: MoneyMinor, pointValueMinor: MoneyMinor, sourceUrl: string, sourceNote: string): InstrumentSpecificationVersion {
  return Object.freeze({ symbol, displayName, exchange, category: "futures", microOf, miniOf, tickSize, tickValueMinor, pointValueMinor, roundTripCommissionMinor: null, defaultSlippageTicks: null, maximumSupportedContracts: null, currency: "USD", effectiveFrom: "2026-08-02T00:00:00.000Z", effectiveTo: null, specificationVersion: `cme-2026-08-02-${symbol.toLowerCase()}`, sourceNote, sourceUrl, verifiedAt: "2026-08-02T00:00:00.000Z", userOverrideAllowed: true, source: "verified_catalogue" });
}

function toCalculationSpec(version: InstrumentSpecificationVersion): InstrumentSpec {
  return { symbol: version.symbol, name: version.displayName, category: "futures", exchange: version.exchange, currency: version.currency, tickSize: version.tickSize, tickValueMinor: version.tickValueMinor, pointValueMinor: version.pointValueMinor, roundTripCommissionMinor: version.roundTripCommissionMinor, defaultSlippageTicks: version.defaultSlippageTicks, maximumSupportedContracts: version.maximumSupportedContracts, source: version.source, verifiedAt: version.verifiedAt };
}

function validateInstrumentVersion(item: InstrumentSpecificationVersion): string[] {
  const missing: string[] = [];
  if (!item.symbol) missing.push("instrument_symbol");
  if (!item.displayName) missing.push("instrument_display_name");
  if (!item.exchange) missing.push("instrument_exchange");
  if (!item.currency) missing.push("instrument_currency");
  if (!item.specificationVersion) missing.push("instrument_specification_version");
  if (!item.sourceNote || !item.sourceUrl || !item.verifiedAt) missing.push("instrument_source_verification");
  else if (Number.isNaN(Date.parse(item.verifiedAt))) missing.push("instrument_verification_timestamp");
  if (!Number.isFinite(item.tickSize) || item.tickSize <= 0) missing.push("instrument_tick_size");
  if (!Number.isSafeInteger(item.tickValueMinor) || item.tickValueMinor <= 0) missing.push("instrument_tick_value");
  if (!Number.isSafeInteger(item.pointValueMinor) || item.pointValueMinor <= 0) missing.push("instrument_point_value");
  if (item.roundTripCommissionMinor != null && (!Number.isSafeInteger(item.roundTripCommissionMinor) || item.roundTripCommissionMinor < 0)) missing.push("instrument_commission");
  if (item.defaultSlippageTicks != null && (!Number.isFinite(item.defaultSlippageTicks) || item.defaultSlippageTicks < 0)) missing.push("instrument_slippage");
  if (item.maximumSupportedContracts != null && (!Number.isSafeInteger(item.maximumSupportedContracts) || item.maximumSupportedContracts <= 0)) missing.push("instrument_contract_cap");
  if (Number.isNaN(Date.parse(item.effectiveFrom)) || (item.effectiveTo != null && (Number.isNaN(Date.parse(item.effectiveTo)) || Date.parse(item.effectiveTo) <= Date.parse(item.effectiveFrom)))) missing.push("instrument_effective_range");
  return [...new Set(missing)];
}

function overlaps(history: InstrumentSpecificationVersion[]): boolean {
  const grouped = new Map<string, InstrumentSpecificationVersion[]>();
  for (const item of history) { const key = `${item.symbol}:${item.source}`; grouped.set(key, [...(grouped.get(key) ?? []), item]); }
  return [...grouped.values()].some((items) => items.sort(compareVersions).some((item, index) => index > 0 && Date.parse(item.effectiveFrom) < (items[index - 1].effectiveTo == null ? Infinity : Date.parse(items[index - 1].effectiveTo))));
}

function compareVersions(left: InstrumentSpecificationVersion, right: InstrumentSpecificationVersion): number { return Date.parse(left.effectiveFrom) - Date.parse(right.effectiveFrom) || left.specificationVersion.localeCompare(right.specificationVersion); }
function sourcePriority(item: InstrumentSpecificationVersion): number { return item.source === "user_configured" ? 2 : 1; }
function empty(): InstrumentRegistryResolution { return { version: null, calculationSpec: null, versionHistory: [] }; }
function result(status: TradingOsResult<InstrumentRegistryResolution>["status"], values: InstrumentRegistryResolution, reasons: string[], missingInputs: string[]): TradingOsResult<InstrumentRegistryResolution> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
