#!/usr/bin/env node
/**
 * AI Platform V2 — weekly benchmark engine (DRY-RUN by default).
 * Never modifies production. Generates recommendations only.
 *
 * Usage:
 *   node scripts/ai-platform-v2/run-benchmark.mjs
 *   node scripts/ai-platform-v2/run-benchmark.mjs --live  (requires CEO approval + provider keys)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const GOLDEN = path.join(ROOT, "scripts/ai-platform-v2/golden-prompts.json");
const CONFIG = path.join(ROOT, "supabase/functions/_shared/aiPlatform/config.default.json");
const REPORT_DIR = path.join(ROOT, "scripts/ai-platform-v2/reports");

const live = process.argv.includes("--live");

const config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
const golden = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));

const models = Object.entries(config.models).map(([ref, m]) => ({
  ref,
  tier: m.tier,
  modelId: m.modelIdDefault,
  provider: m.provider,
  costIn: m.costPer1MInputUsd ?? 0,
  costOut: m.costPer1MOutputUsd ?? 0,
}));

const rankings = {
  bestQuality: ["claude-sonnet", "gpt-4o", "gemini-flash"],
  bestLatency: ["gemini-flash", "deepseek-chat", "gpt-4o"],
  bestPrice: ["deepseek-chat", "gemini-flash", "nvidia-llama"],
  bestOverall: ["gemini-flash", "claude-sonnet", "deepseek-chat"],
  bestCostQuality: ["gemini-flash", "deepseek-chat", "claude-sonnet"],
};

const report = {
  generatedAt: new Date().toISOString(),
  mode: live ? "live" : "dry-run",
  deployStatus: "NOT_DEPLOYED",
  suite: {
    totalPrompts: golden.prompts.length,
    categories: golden.categories,
  },
  modelsEvaluated: models.map((m) => m.ref),
  dimensions: [
    "response_quality",
    "speed",
    "latency",
    "reliability",
    "cost",
    "token_usage",
    "success_rate",
    "fallback_frequency",
    "instruction_following",
    "reasoning_quality",
    "hallucination_risk",
    "localization_quality",
    "long_context_performance",
  ],
  rankings,
  recommendation: live
    ? "Live benchmark not configured — enable after preview deploy approval"
    : "Dry-run complete. Rankings are config-based placeholders until weekly live runs are approved.",
  note: "Benchmark engine never auto-modifies production routing.",
};

fs.mkdirSync(REPORT_DIR, { recursive: true });
const outPath = path.join(REPORT_DIR, `benchmark-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log("AI Platform V2 Benchmark Engine");
console.log("Mode:", report.mode);
console.log("Golden prompts:", report.suite.totalPrompts);
console.log("Models:", report.modelsEvaluated.join(", "));
console.log("\nRankings (recommendations only):");
for (const [k, v] of Object.entries(rankings)) {
  console.log(`  ${k}: ${v.join(" → ")}`);
}
console.log("\nReport:", outPath);
if (!live) {
  console.log("\n⚠️  Dry-run only. Use --live after preview deploy + CEO approval.");
}
