import { check, stepResult, tryRun, readJson } from "../lib.mjs";

export function aiPlatformValidation() {
  const checks = [];
  const blockers = [];

  const staticRun = tryRun("node", ["scripts/ai-platform-v2/validate-pipeline.mjs"], { timeout: 180_000 });
  const staticReport = readJson("scripts/ai-platform-v2/reports/latest.json");
  const staticFails = staticReport?.summary?.failed ?? (staticRun.ok ? 0 : 1);

  checks.push(check("ai_static", "Static validation (npm run ai-platform:validate)", staticFails === 0 ? "PASS" : "FAIL", `${staticReport?.summary?.passed ?? 0} pass / ${staticFails} fail`));

  const liveRun = tryRun("node", ["scripts/ai-platform-v2/validate-pipeline.mjs", "--live"], { timeout: 600_000 });
  const liveReport = readJson("scripts/ai-platform-v2/reports/latest.json");
  const liveFails = liveReport?.summary?.failed ?? (liveRun.ok ? 0 : 1);

  checks.push(check("ai_live", "Live validation (--live)", liveFails === 0 ? "PASS" : "FAIL", `${liveReport?.summary?.passed ?? 0} pass / ${liveFails} fail`));

  if (staticFails > 0) blockers.push(`AI static validation: ${staticFails} FAIL`);
  if (liveFails > 0) blockers.push(`AI live validation: ${liveFails} FAIL`);

  const liveItems = liveReport?.results?.filter((r) => r.id?.startsWith("live_")) ?? [];
  for (const item of liveItems) {
    checks.push(check(`ai_${item.id}`, item.name, item.status === "PASS" ? "PASS" : item.status === "FAIL" ? "FAIL" : "WARNING", item.detail || ""));
  }

  return stepResult("ai", "Step 3 — AI Platform Validation", checks, blockers);
}
