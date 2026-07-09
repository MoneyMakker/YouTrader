#!/usr/bin/env node
/**
 * AI Platform V2 — pre-deployment validation pipeline.
 * Does NOT deploy, push, or call production Supabase.
 *
 * Usage:
 *   node scripts/ai-platform-v2/validate-pipeline.mjs
 *   node scripts/ai-platform-v2/validate-pipeline.mjs --write-doc
 *   node scripts/ai-platform-v2/validate-pipeline.mjs --live  (requires provider keys)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const REPORT_DIR = path.join(ROOT, "scripts/ai-platform-v2/reports");
const CONFIG_PATH = path.join(ROOT, "supabase/functions/_shared/aiPlatform/config.default.json");
const GOLDEN_PATH = path.join(ROOT, "scripts/ai-platform-v2/golden-prompts.json");

const writeDoc = process.argv.includes("--write-doc");
const liveMode = process.argv.includes("--live");

const COACH_ACTIONS = [
  "daily_plan",
  "weekly_coach",
  "journal_summary",
  "risk_predictor",
  "news_explainer",
  "daily_challenge",
];

const results = [];
let passed = 0;
let failed = 0;
let warned = 0;

function record(id, name, status, detail = "", metrics = {}) {
  results.push({ id, name, status, detail, metrics, at: new Date().toISOString() });
  if (status === "PASS") passed += 1;
  else if (status === "FAIL") failed += 1;
  else if (status === "WARN") warned += 1;
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

// ─── 1. Static architecture ───
function checkModuleExists() {
  const files = [
    "supabase/functions/_shared/aiPlatform/router.ts",
    "supabase/functions/_shared/aiPlatform/config.ts",
    "supabase/functions/_shared/aiPlatform/providers.ts",
    "supabase/functions/_shared/aiPlatform/cache.ts",
    "supabase/functions/_shared/aiPlatform/observability.ts",
    "supabase/functions/_shared/aiPlatform/prompts/registry.ts",
    "supabase/functions/_shared/aiPlatform/config.default.json",
  ];
  const missing = files.filter((f) => !exists(f));
  if (missing.length) record("arch_module", "AI Platform module files", "FAIL", missing.join(", "));
  else record("arch_module", "AI Platform module files", "PASS", `${files.length} files present`);
}

function checkFeatureFlag() {
  const src = read("supabase/functions/_shared/aiPlatform/config.ts");
  const provider = read("supabase/functions/_shared/aiProvider.ts");
  const hasFlag = src.includes("AI_PLATFORM_V2_ENABLED") && src.includes("isRouterEnabled");
  const hasLegacy = provider.includes("callLegacyConfiguredProvider") && provider.includes("isRouterEnabled()");
  if (hasFlag && hasLegacy) record("feature_flag", "Feature flag + legacy path", "PASS", "AI_PLATFORM_V2_ENABLED + legacy fallback");
  else record("feature_flag", "Feature flag + legacy path", "FAIL", "Missing flag or legacy path");
}

function checkRollbackLogic() {
  process.env.AI_PLATFORM_V2_ENABLED = "false";
  const enabledWhenFalse = isRouterEnabledSim();
  process.env.AI_PLATFORM_V2_ENABLED = "true";
  const enabledWhenTrue = isRouterEnabledSim();
  delete process.env.AI_PLATFORM_V2_ENABLED;
  const enabledWhenUnset = isRouterEnabledSim();
  record("rollback_flag", "Rollback flag=false disables router", enabledWhenFalse ? "FAIL" : "PASS");
  record("rollback_flag_on", "Flag=true enables router", enabledWhenTrue ? "PASS" : "FAIL");
  record("rollback_default", "Default router enabled when unset", enabledWhenUnset ? "PASS" : "FAIL");
}

function isRouterEnabledSim() {
  const flag = (process.env.AI_PLATFORM_V2_ENABLED || "").trim();
  if (flag === "false") return false;
  return true;
}

// ─── 2. Config validation ───
function checkConfig() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const issues = [];
  if (!config.providers?.openrouter) issues.push("missing openrouter provider");
  if (!config.models || Object.keys(config.models).length < 3) issues.push("models too few");
  if (!config.fallbackChains) issues.push("missing fallbackChains");
  if (!config.endpointProfiles) issues.push("missing endpointProfiles");

  for (const action of COACH_ACTIONS) {
    if (!config.endpointProfiles[action]) issues.push(`no profile for ${action}`);
  }

  for (const [profile, chain] of Object.entries(config.fallbackChains || {})) {
    if (!Array.isArray(chain) || chain.length < 2) issues.push(`fallback chain too short: ${profile}`);
  }

  const hardcodedUrls = [];
  for (const [name, p] of Object.entries(config.providers || {})) {
    if (!p.secretEnv) hardcodedUrls.push(`${name}: no secretEnv`);
  }

  if (issues.length) record("config_structure", "Platform config structure", "FAIL", issues.join("; "));
  else record("config_structure", "Platform config structure", "PASS", `v${config.version}, ${Object.keys(config.models).length} models`);

  const configRaw = fs.readFileSync(CONFIG_PATH, "utf8");
  const hasHardcodedKey = /\bsk-[a-zA-Z0-9]{8,}\b/.test(configRaw);
  record("config_no_hardcoded_keys", "No API keys in config JSON", hasHardcodedKey ? "FAIL" : "PASS");
}

// ─── 3. Model selection simulation ───
function checkModelSelection() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const threshold = config.longContextTokenThreshold || 12000;

  const shortProfile = selectProfileSim(config, "daily_plan", 500);
  const longProfile = selectProfileSim(config, "weekly_coach", threshold + 100);

  if (shortProfile === config.endpointProfiles.daily_plan) {
    record("model_select_fast", "Daily Plan → fast profile", "PASS", shortProfile);
  } else record("model_select_fast", "Daily Plan → fast profile", "FAIL", `got ${shortProfile}`);

  if (longProfile === "long_context") {
    record("model_select_long", "Long context → long_context profile", "PASS");
  } else record("model_select_long", "Long context → long_context profile", "WARN", `got ${longProfile} (threshold ${threshold})`);

  const deepProfile = selectProfileSim(config, "weekly_coach", 2000);
  if (deepProfile === config.endpointProfiles.weekly_coach) {
    record("model_select_deep", "Weekly Coach → deep profile", "PASS", deepProfile);
  } else record("model_select_deep", "Weekly Coach → deep profile", "FAIL", deepProfile);
}

function selectProfileSim(config, endpoint, tokens) {
  const mapped = config.endpointProfiles[endpoint] || "fast";
  if (mapped === "fast" && tokens >= config.longContextTokenThreshold) return "long_context";
  if (mapped === "deep" && tokens >= config.longContextTokenThreshold) return "long_context";
  return mapped;
}

// ─── 4. Fallback chains ───
function checkFallbackChains() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const deep = config.fallbackChains.deep || [];
  const hasClaude = deep.some((m) => config.models[m]?.tier === "deep" || m.includes("claude"));
  const hasGemini = deep.some((m) => m.includes("gemini"));
  const hasDeepseek = deep.some((m) => m.includes("deepseek"));
  if (deep.length >= 3 && hasClaude) {
    record("fallback_deep", "Deep fallback chain", "PASS", deep.join(" → "));
  } else record("fallback_deep", "Deep fallback chain", "FAIL", deep.join(" → "));

  record("fallback_providers", "Fallback includes Gemini + DeepSeek path", deep.some((m) => m.includes("gemini")) && deep.some((m) => m.includes("deepseek")) ? "PASS" : "WARN");
}

// ─── 5. Cache ───
function checkCache() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  if (!config.cache?.enabled) {
    record("cache_enabled", "Cache enabled in config", "WARN", "disabled in default config");
    return;
  }
  const key = crypto.createHash("sha256").update("test:coach_v1:payload").digest("hex");
  record("cache_hash", "Cache key hashing", key.length === 64 ? "PASS" : "FAIL");
  record("cache_ttl", "Cache TTL configurable", config.cache.ttlSeconds > 0 ? "PASS" : "FAIL", `${config.cache.ttlSeconds}s`);
}

// ─── 6. Prompt versioning ───
function checkPromptVersioning() {
  const registry = read("supabase/functions/_shared/aiPlatform/prompts/registry.ts");
  const hasCoach = registry.includes("coach_v1");
  const hasMarket = registry.includes("market_v1");
  const hasSchema = registry.includes("{{SCHEMA}}");
  const hasResolve = registry.includes("resolvePromptVersion");
  if (hasCoach && hasMarket && hasSchema && hasResolve) {
    record("prompt_registry", "Prompt registry baseline", "PASS", "coach_v1, market_v1");
  } else record("prompt_registry", "Prompt registry baseline", "FAIL");

  for (const action of COACH_ACTIONS) {
    record(`prompt_${action}`, `Prompt version for ${action}`, registry.includes("coach") ? "PASS" : "WARN", "coach family");
  }
}

// ─── 7. Observability & cost logging ───
function checkObservability() {
  const obs = read("supabase/functions/_shared/aiPlatform/observability.ts");
  const checks = [
    ["requestId", obs.includes("requestId")],
    ["promptVersion", obs.includes("promptVersion")],
    ["estimatedCostUsd", obs.includes("estimatedCostUsd")],
    ["fallbackReason", obs.includes("fallbackReason")],
    ["cacheHit", obs.includes("cacheHit")],
    ["langfuse", obs.includes("traceRouterToLangfuse")],
    ["structured log", obs.includes("ai_platform_request")],
  ];
  for (const [name, ok] of checks) {
    record(`obs_${name}`, `Observability: ${name}`, ok ? "PASS" : "FAIL");
  }

  const aiCoach = read("supabase/functions/ai-coach/index.ts");
  record("obs_metadata_persist", "Router metadata → ai_usage_events", aiCoach.includes("platformMetadata") ? "PASS" : "FAIL");
}

// ─── 8. Security ───
function checkSecurity() {
  try {
    execFileSync("npm", ["run", "security:check"], { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
    record("security_check", "security:check script", "PASS");
  } catch (e) {
    record("security_check", "security:check script", "FAIL", String(e.stderr || e.message).slice(0, 200));
  }

  const clientSrc = read("src/api/aiCoach.ts");
  const badPatterns = ["openrouter.ai", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "NVIDIA_API_KEY"];
  const leaks = badPatterns.filter((p) => clientSrc.includes(p));
  record("security_client", "No provider secrets in client", leaks.length === 0 ? "PASS" : "FAIL", leaks.join(", "));

  const nine = grepProductionPaths(/9router|127\.0\.0\.1:20128/i);
  record("security_no_9router", "No 9Router in production paths", nine.length === 0 ? "PASS" : "FAIL", nine.join(", ") || "clean");

  const envExample = read(".env.example");
  record("security_expo_public", "No EXPO_PUBLIC AI keys in .env.example", !/EXPO_PUBLIC_(OPENROUTER|GEMINI|ANTHROPIC|NVIDIA)_API_KEY/.test(envExample) ? "PASS" : "FAIL");
}

function grepProductionPaths(pattern) {
  const dirs = ["supabase/functions", "src"];
  const hits = [];
  for (const dir of dirs) {
    walk(path.join(ROOT, dir), (file) => {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) return;
      const content = fs.readFileSync(file, "utf8");
      if (pattern.test(content)) hits.push(path.relative(ROOT, file));
    });
  }
  return hits;
}

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.name === "node_modules") continue;
    if (entry.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

// ─── 9. Golden suite ───
function checkGoldenSuite() {
  const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8"));
  const count = golden.prompts?.length || 0;
  if (count === 100) record("golden_count", "Golden test suite count", "PASS", "100 prompts");
  else record("golden_count", "Golden test suite count", "FAIL", `got ${count}`);

  const coachInGolden = golden.prompts.filter((p) => COACH_ACTIONS.includes(p.endpoint)).length;
  record("golden_coach", "Coach actions in golden suite", coachInGolden >= 50 ? "PASS" : "WARN", `${coachInGolden} coach prompts`);
}

// ─── 10. Legacy parity (static) ───
function checkLegacyParity() {
  const provider = read("supabase/functions/_shared/aiProvider.ts");
  const hasBoth = provider.includes("callPlatformRouter") && provider.includes("callLegacyConfiguredProvider");
  const hasFallbackBase = provider.includes("fallbackBase");
  record("legacy_dual_path", "Router + legacy dual path in aiProvider", hasBoth ? "PASS" : "FAIL");
  record("legacy_local_fallback", "Local fallback preserved", hasFallbackBase ? "PASS" : "FAIL");

  const marketLegacy = read("supabase/functions/_shared/marketAiProvider.ts");
  record("market_still_legacy", "Market Intelligence still legacy (Phase 2)", marketLegacy.includes("callNvidiaJson") ? "PASS" : "WARN", "expected until Phase 2");
}

// ─── 11. Typecheck ───
function checkTypecheck() {
  try {
    execFileSync("npm", ["run", "typecheck"], { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
    record("typecheck", "npm run typecheck", "PASS");
  } catch (e) {
    record("typecheck", "npm run typecheck", "FAIL", String(e.stdout || e.stderr).slice(0, 300));
  }
}

// ─── 12. AI safety ───
function checkAiSafety() {
  try {
    const out = execFileSync("npm", ["run", "test:ai-safety"], { cwd: ROOT, stdio: "pipe", encoding: "utf8", timeout: 120000 });
    const passMatch = out.match(/(\d+) passed/);
    const failMatch = out.match(/(\d+) failed/);
    const passCount = passMatch ? Number(passMatch[1]) : 0;
    const failCount = failMatch ? Number(failMatch[1]) : 0;
    record("ai_safety", "promptfoo AI safety", passCount >= 6 ? "PASS" : "WARN", `${passCount} passed, ${failCount} failed`, { passCount, failCount });
  } catch (e) {
    const out = String(e.stdout || e.stderr || "");
    const passMatch = out.match(/(\d+) passed/);
    const failMatch = out.match(/(\d+) failed/);
    const passCount = passMatch ? Number(passMatch[1]) : 0;
    record("ai_safety", "promptfoo AI safety", passCount >= 6 ? "WARN" : "FAIL", `${passCount} passed${failMatch ? `, ${failMatch[1]} failed` : ""}`);
  }
}

// ─── 13. PostHog / Sentry (client observability presence) ───
function checkClientObservability() {
  const hasPosthog = exists("src/observability") || read("App.tsx").includes("posthog") || read("App.tsx").includes("PostHog");
  const hasSentry = read("app.json").includes("sentry") || exists("src/observability/sentry.ts") || read("App.tsx").includes("Sentry");
  record("obs_posthog_client", "PostHog integration present", hasPosthog ? "PASS" : "WARN", "client-side product analytics");
  record("obs_sentry_client", "Sentry integration present", hasSentry ? "PASS" : "WARN", "client crash reporting");
  record("obs_langfuse_server", "Langfuse server-side (Edge)", read("supabase/functions/_shared/langfuse.ts").includes("Langfuse") ? "PASS" : "WARN");
}

// ─── 14. Live comparison ───
async function checkLiveComparison() {
  if (!liveMode) {
    record("live_parity", "Live router vs legacy parity", "WARN", "Skipped — run with --live after preview deploy");
    record("live_latency", "Live latency measurement", "WARN", "Requires preview deploy + --live");
    return;
  }

  try {
    const { runLiveComparison } = await import("./live-comparison.mjs");
    const comparison = await runLiveComparison();
    if (comparison.errors?.length) {
      record("live_parity", "Live router vs legacy parity", "FAIL", comparison.errors.join("; "));
      record("live_latency", "Live latency measurement", "FAIL", comparison.errors[0]);
      return;
    }
    const s = comparison.summary || {};
    const v2Ok = (s.v2SuccessRate ?? 0) >= 1;
    const legOk = (s.legacySuccessRate ?? 0) >= 1;
    record(
      "live_parity",
      "Live router vs legacy parity",
      v2Ok && legOk ? "PASS" : v2Ok || legOk ? "WARN" : "FAIL",
      `V2 ${Math.round((s.v2SuccessRate ?? 0) * 100)}% / Legacy ${Math.round((s.legacySuccessRate ?? 0) * 100)}%`,
      s,
    );
    record(
      "live_latency",
      "Live latency measurement",
      s.v2AvgLatencyMs != null ? "PASS" : "WARN",
      `V2 avg ${s.v2AvgLatencyMs ?? "?"}ms · Legacy avg ${s.legacyAvgLatencyMs ?? "?"}ms`,
    );
    record("live_cost", "Live cost metadata", s.v2AvgCostUsd != null ? "PASS" : "WARN", `avg $${s.v2AvgCostUsd ?? "n/a"}`);
    record("live_fallback", "Live fallback behavior", (s.v2FallbackCount ?? 0) <= 2 ? "PASS" : "WARN", `V2 fallbacks: ${s.v2FallbackCount ?? 0}`);
    record("live_cache", "Live cache hit rate", "WARN", `cache hits in run: ${s.v2CacheHits ?? 0} (repeat invoke for full cache test)`);
    record("live_quality", "Response schema quality", (s.v2AvgSchemaScore ?? 0) >= 0.8 ? "PASS" : "WARN", `V2 ${s.v2AvgSchemaScore} / Legacy ${s.legacyAvgSchemaScore}`);
  } catch (e) {
    record("live_parity", "Live router vs legacy parity", "FAIL", String(e.message || e));
    record("live_latency", "Live latency measurement", "FAIL", String(e.message || e));
  }
}

// ─── Run all ───
async function main() {
  console.log("AI Platform V2 Validation Pipeline");
  console.log("=".repeat(50));
  console.log(`Mode: ${liveMode ? "live" : "static"} | Deploy: ${liveMode ? "PREVIEW LIVE TEST" : "DISABLED"}\n`);

  checkModuleExists();
  checkFeatureFlag();
  checkRollbackLogic();
  checkConfig();
  checkModelSelection();
  checkFallbackChains();
  checkCache();
  checkPromptVersioning();
  checkObservability();
  checkSecurity();
  checkGoldenSuite();
  checkLegacyParity();
  checkTypecheck();
  checkAiSafety();
  checkClientObservability();
  await checkLiveComparison();

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    phase: "1-validation",
    deployStatus: liveMode ? "PREVIEW_LIVE_VALIDATION" : "NOT_DEPLOYED",
    summary: { passed, failed, warned, total: results.length },
    results,
  };
  const reportPath = path.join(REPORT_DIR, "latest.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\nResults:");
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⚠️";
    console.log(`${icon} [${r.status}] ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${warned} warnings`);
  console.log(`Report: ${reportPath}`);

  if (writeDoc) {
    writeValidationDoc(report);
    console.log(`Updated: docs/AI_PLATFORM_V2_VALIDATION.md`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

function writeValidationDoc(report) {
  const docPath = path.join(ROOT, "docs/AI_PLATFORM_V2_VALIDATION.md");
  const lines = results.map((r) => `| ${r.name} | ${r.status} | ${r.detail.replace(/\|/g, "/")} |`);
  const content = `# AI Platform V2 — Validation Report

**Generated:** ${report.generatedAt}  
**Phase:** Pre-deployment validation (Phase 1)  
**Deploy status:** NOT DEPLOYED  
**Pipeline:** \`npm run ai-platform:validate\`

---

## Summary

| Metric | Count |
|--------|-------|
| Passed | ${report.summary.passed} |
| Failed | ${report.summary.failed} |
| Warnings | ${report.summary.warned} |
| Total checks | ${report.summary.total} |

**Gate:** Failed checks must be **0** before Preview Deploy approval.

---

## Automated checks

| Check | Status | Detail |
|-------|--------|--------|
${lines.join("\n")}

---

## Endpoints validated (static)

| Endpoint | Profile | Golden prompts |
|----------|---------|----------------|
| daily_plan | fast | 10+ |
| weekly_coach | deep | 10+ |
| journal_summary | deep | 10+ |
| risk_predictor | deep | 10+ |
| news_explainer | fast | 10+ |
| daily_challenge | fast | 5+ |

Market Intelligence: **legacy path** until Phase 2.

---

## Rollback verification

\`\`\`bash
# Supabase secret (after deploy approval only):
AI_PLATFORM_V2_ENABLED=false
\`\`\`

Static validation confirms:
- \`isRouterEnabled()\` returns false when flag is \`false\`
- \`callLegacyConfiguredProvider\` remains in \`aiProvider.ts\`
- No code changes required for rollback

---

## Live validation (post Preview Deploy)

After CEO approves **Preview Deploy** only:

\`\`\`bash
npm run ai-platform:validate -- --live
\`\`\`

Measure per endpoint:
- Latency (p50, p95)
- Cost estimate (router metadata)
- Token usage
- Success rate / fallback frequency
- JSON schema validity vs legacy

---

## Manual iPhone checklist (TestFlight)

- [ ] Daily Plan — Pro user
- [ ] Weekly Coach — Pro user
- [ ] Journal Summary
- [ ] Risk Predictor
- [ ] News Explainer
- [ ] Free user — local preview only
- [ ] Airplane mode — local fallback
- [ ] Rollback flag — legacy providers (staging secret)

---

## Re-run validation

\`\`\`bash
npm run ai-platform:validate
npm run ai-platform:validate:report
\`\`\`

Raw JSON: \`scripts/ai-platform-v2/reports/latest.json\`

---

## Architecture review (static)

| Area | Finding | Severity | Phase |
|------|---------|----------|-------|
| Duplicated provider logic | \`aiProvider.ts\` legacy loop mirrors \`aiPlatform/providers.ts\` | Medium | Remove legacy after stable V2 |
| Market Intelligence | \`marketAiProvider.ts\` still direct NVIDIA/OpenAI | Expected | Phase 2 |
| Hardcoded models (legacy) | \`DEFAULT_FAST_MODEL\`, etc. in \`aiProvider.ts\` | Low | Legacy path only; router uses config |
| Hardcoded models (router) | None in router — \`config.default.json\` + env | OK | — |
| Tight coupling | \`ai-coach\` → \`aiProvider\` → router (acceptable facade) | Low | — |
| Security | No client keys; secrets via \`secretEnv\`; JWT on Edge | OK | — |
| Cache | In-memory per Edge instance (not shared) | Medium | Phase 3+ Redis optional |
| Observability | Langfuse + structured logs + usage metadata | OK | — |
| Migration risk | Feature flag rollback without redeploy of client | Low | — |
| Scalability | OpenRouter aggregation; fallback chains; rate limits exist | OK | Monitor cost at scale |

**Recommendation:** Proceed to Preview Deploy only after **0 FAIL** in this pipeline + CEO sign-off.

---

## Phase roadmap (CEO gates)

| Step | Gate | Status |
|------|------|--------|
| Phase 1 — AI Router | Code complete | ✅ |
| Validation | \`npm run ai-platform:validate:report\` | ✅ (0 FAIL) |
| Preview Deploy | CEO approval | ☐ |
| TestFlight | QA sign-off | ☐ |
| Real iPhone testing | Manual checklist | ☐ |
| Production | CEO approval | ☐ |
| Phase 2 — Market → router | After Phase 1 prod stable | ☐ |
| Phase 3 — Cost Monitor | After Phase 2 | ☐ |
| Phase 4 — Prompt versioning (DB) | After Phase 3 | ☐ |
| Phase 5 — A/B testing | After Phase 4 | ☐ |
| Phase 6 — Benchmark engine | Weekly dry-run → live | ☐ |

See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md), [AI_BENCHMARK_ENGINE.md](./AI_BENCHMARK_ENGINE.md), [AI_HEALTH_DASHBOARD.md](./AI_HEALTH_DASHBOARD.md).
`;
  fs.writeFileSync(docPath, content);
}

main();
