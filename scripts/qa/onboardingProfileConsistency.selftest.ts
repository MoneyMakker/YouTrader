/**
 * Onboarding profile consistency — preview must match selected market.
 * Run: npx tsx scripts/qa/onboardingProfileConsistency.selftest.ts
 */
import assert from "node:assert/strict";
import {
  applyMarketSelection,
  buildOnboardingProfilePreview,
  defaultOnboardingProfile,
  normalizeOnboardingProfile,
  parseOnboardingProfile,
  type OnboardingProfileV1,
} from "../../src/app/startup/onboardingProfile";

const futures = normalizeOnboardingProfile({
  market: "futures",
  instruments: ["MES", "MNQ"],
  session: "ny_am",
  style: "intraday",
  propChallenge: false,
});
const futuresPreview = buildOnboardingProfilePreview(futures);
assert.equal(futuresPreview.primarySymbol, "MES");
assert.equal(futuresPreview.market, "futures");
assert.match(futuresPreview.subtitle, /Intraday/);
assert.match(futuresPreview.subtitle, /New York AM/);

const stocks = applyMarketSelection(
  { ...futures, instruments: ["MES"] } as OnboardingProfileV1,
  "stocks",
);
assert.deepEqual(stocks.instruments, []);
const stocksPreview = buildOnboardingProfilePreview(stocks);
assert.equal(stocksPreview.market, "stocks");
assert.equal(stocksPreview.primarySymbol, "EQUITIES");
assert.ok(!stocksPreview.headline.includes("MES"));
assert.ok(!stocksPreview.subtitle.includes("MES"));

const crypto = applyMarketSelection(futures, "crypto");
assert.deepEqual(crypto.instruments, []);
const cryptoPreview = buildOnboardingProfilePreview(crypto);
assert.equal(cryptoPreview.primarySymbol, "BTC");
assert.ok(!/MES|MNQ/.test(cryptoPreview.headline));

const forex = applyMarketSelection(futures, "forex");
assert.equal(buildOnboardingProfilePreview(forex).primarySymbol, "EURUSD");

// Changing selection updates preview immediately
let live = normalizeOnboardingProfile({
  market: "futures",
  instruments: ["MNQ"],
  session: "london",
  style: "scalping",
  propChallenge: true,
  propFirms: ["topstep"],
});
assert.equal(buildOnboardingProfilePreview(live).primarySymbol, "MNQ");
live = applyMarketSelection(live, "stocks");
assert.equal(buildOnboardingProfilePreview(live).primarySymbol, "EQUITIES");
live = applyMarketSelection(live, "futures");
assert.deepEqual(live.instruments, []); // cleared on leave; empty until user picks
live = normalizeOnboardingProfile({ ...live, instruments: ["ES"] });
assert.equal(buildOnboardingProfilePreview(live).primarySymbol, "ES");

// Skipped fields → coherent defaults
const skipped = defaultOnboardingProfile({ skippedSteps: [0, 1] });
assert.equal(skipped.market, "futures");
assert.ok(skipped.instruments.includes("MES"));
assert.equal(buildOnboardingProfilePreview(skipped).primarySymbol, "MES");

// Persist / restore
const raw = JSON.stringify(stocks);
const restored = parseOnboardingProfile(JSON.parse(raw));
assert.ok(restored);
assert.equal(restored!.market, "stocks");
assert.deepEqual(restored!.instruments, []);
assert.equal(buildOnboardingProfilePreview(restored!).primarySymbol, "EQUITIES");

// Invalid: MES with stocks must never survive normalize
const invalid = normalizeOnboardingProfile({
  market: "stocks",
  instruments: ["MES", "MNQ"],
  session: "ny_pm",
  style: "intraday",
});
assert.deepEqual(invalid.instruments, []);
assert.equal(buildOnboardingProfilePreview(invalid).primarySymbol, "EQUITIES");

console.log("onboardingProfileConsistency selftest PASS");
