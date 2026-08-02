import assert from "node:assert/strict";
import {
  VERIFIED_FUTURES_CATALOGUE,
  calculatePositionSize,
  createUserInstrumentVersion,
  resolveInstrumentSpecification,
  type InstrumentSpecificationVersion,
} from "../src/propPass/tradingOs/index";

const effectiveAt = "2026-08-02T15:00:00.000Z";
const catalogueOnly = resolveInstrumentSpecification({ symbol: "mes", effectiveAt });
assert.equal(catalogueOnly.status, "needs_input");
assert.equal(catalogueOnly.values.version?.specificationVersion, "cme-2026-08-02-mes");
assert.equal(catalogueOnly.values.calculationSpec, null);
assert.deepEqual(catalogueOnly.missingInputs.sort(), ["instrument_default_slippage_ticks", "instrument_round_trip_commission"]);

const userVersion = createUserInstrumentVersion({
  ...VERIFIED_FUTURES_CATALOGUE.find((item) => item.symbol === "MES")!,
  effectiveFrom: "2026-08-02T00:00:00.000Z",
  specificationVersion: "user-mes-v1",
  sourceNote: "User verified broker costs for deterministic QA.",
  sourceUrl: "user://broker-configuration",
  roundTripCommissionMinor: 90,
  defaultSlippageTicks: 1,
  maximumSupportedContracts: 4,
});
const resolved = resolveInstrumentSpecification({ symbol: "MES", effectiveAt, userVersions: [userVersion] });
assert.equal(resolved.status, "safe_to_take");
assert.equal(resolved.values.version?.source, "user_configured");
assert.equal(resolved.values.calculationSpec?.roundTripCommissionMinor, 90);

const sized = calculatePositionSize({
  plan: { instrument: resolved.values.calculationSpec, stopDistance: 3, stopUnit: "points" },
  allowedRiskMinor: 100_000,
});
assert.equal(sized.status, "safe_to_take");
assert.equal(sized.values.recommendedContracts, 4, "the configured instrument cap must remain active");

const oldVersion = { ...userVersion, effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: "2026-06-01T00:00:00.000Z", specificationVersion: "user-mes-old", roundTripCommissionMinor: 80 } satisfies InstrumentSpecificationVersion;
const newVersion = { ...userVersion, effectiveFrom: "2026-06-01T00:00:00.000Z", specificationVersion: "user-mes-new", roundTripCommissionMinor: 95 } satisfies InstrumentSpecificationVersion;
assert.equal(resolveInstrumentSpecification({ symbol: "MES", effectiveAt: "2026-05-31T23:59:59.000Z", catalogue: [], userVersions: [oldVersion, newVersion] }).values.version?.specificationVersion, "user-mes-old");
assert.equal(resolveInstrumentSpecification({ symbol: "MES", effectiveAt: "2026-06-01T00:00:00.000Z", catalogue: [], userVersions: [oldVersion, newVersion] }).values.version?.specificationVersion, "user-mes-new");

const noHistory = resolveInstrumentSpecification({ symbol: "MES", effectiveAt: "2025-12-31T23:59:59.000Z", catalogue: [], userVersions: [oldVersion] });
assert.equal(noHistory.status, "needs_input");
assert.ok(noHistory.missingInputs.includes("instrument_specification_version"));

const overlap = resolveInstrumentSpecification({
  symbol: "MES",
  effectiveAt,
  catalogue: [],
  userVersions: [oldVersion, { ...oldVersion, effectiveFrom: "2026-05-01T00:00:00.000Z", effectiveTo: null, specificationVersion: "overlap" }],
});
assert.equal(overlap.status, "needs_input");
assert.ok(overlap.reasons.includes("instrument_version_overlap"));

const invalidTimestamp = resolveInstrumentSpecification({
  symbol: "MES",
  effectiveAt,
  catalogue: [],
  userVersions: [{ ...userVersion, verifiedAt: "not-a-date" }],
});
assert.equal(invalidTimestamp.status, "needs_input");
assert.ok(invalidTimestamp.missingInputs.includes("instrument_verification_timestamp"));

const missingCosts = calculatePositionSize({
  plan: { instrument: { ...resolved.values.calculationSpec!, roundTripCommissionMinor: null }, stopDistance: 3, stopUnit: "points" },
  allowedRiskMinor: 100_000,
});
assert.equal(missingCosts.status, "needs_input");
assert.ok(missingCosts.missingInputs.includes("instrument_round_trip_commission"));
assert.equal(missingCosts.values.recommendedContracts, null, "missing costs must never be treated as zero");

console.log("prop-pass-instrument-registry-qa: PASS");
