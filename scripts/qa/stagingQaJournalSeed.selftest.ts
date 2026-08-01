/**
 * Run: npx tsx scripts/qa/stagingQaJournalSeed.selftest.ts
 */
import assert from "node:assert/strict";
import {
  buildStagingQaSeedTrade,
  parseStagingQaApplyTradeEditUrl,
  parseStagingQaJournalSeedUrl,
  parseStagingQaTradeOverrides,
} from "../../src/qa/stagingQaJournalSeed";

assert.equal(parseStagingQaJournalSeedUrl("youtrader://qa/seed-trade?marker=S8"), true);
assert.equal(parseStagingQaJournalSeedUrl("youtrader://qa/other"), false);
assert.equal(
  parseStagingQaApplyTradeEditUrl("youtrader://qa/apply-trade-edit?marker=S8&pnl=125"),
  true,
);
assert.equal(parseStagingQaApplyTradeEditUrl("youtrader://qa/seed-trade"), false);

const o = parseStagingQaTradeOverrides(
  "youtrader://qa/apply-trade-edit?marker=S8-LIFE&notes=QA-S8-LIFE-EDITED&pnl=125&exit=5225&entry=5200&contracts=2",
);
assert.equal(o.marker, "S8-LIFE");
assert.equal(o.notes, "QA-S8-LIFE-EDITED");
assert.equal(o.pnl, 125);
assert.equal(o.exit, 5225);
assert.equal(o.entry, 5200);
assert.equal(o.contracts, 2);

const trade = buildStagingQaSeedTrade(1_700_000_000_000, {
  marker: "S8-LIFE",
  notes: "QA-S8-LIFE",
  pnl: 50,
  exit: 5210,
});
assert.equal(trade.symbol, "MES");
assert.equal(trade.pnl, 50);
assert.equal(trade.notes, "QA-S8-LIFE");
assert.ok(String(trade.id).includes("S8-LIFE"));

console.log("stagingQaJournalSeed.selftest PASS");
