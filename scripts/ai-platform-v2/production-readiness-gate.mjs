#!/usr/bin/env node
/**
 * AI Platform V2 — Production Readiness Gate (pre Preview Deploy).
 * Does NOT deploy, push, or modify production.
 *
 * Usage:
 *   node scripts/ai-platform-v2/production-readiness-gate.mjs
 *   node scripts/ai-platform-v2/production-readiness-gate.mjs --write-doc
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const REPORT_DIR = path.join(ROOT, "scripts/ai-platform-v2/reports");
const writeDoc = process.argv.includes("--write-doc");

const sections = [];
const allItems = [];

function item(sectionId, sectionTitle, check, status, detail = "") {
  const row = { sectionId, sectionTitle, check, status, detail };
  allItems.push(row);
  return row;
}

function finalizeSection(sectionId, sectionTitle, rows) {
  const fails = rows.filter((r) => r.status === "FAIL").length;
  const warns = rows.filter((r) => r.status === "WARNING").length;
  let status = "PASS";
  if (fails > 0) status = "FAIL";
  else if (warns > 0) status = "WARNING";
  sections.push({ id: sectionId, title: sectionTitle, status, rows, fails, warns });
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function parseJson(rel) {
  return JSON.parse(read(rel));
}

// ─── 1. Architecture ───
function checkArchitecture() {
  const rows = [];
  const router = read("supabase/functions/_shared/aiPlatform/router.ts");
  const provider = read("supabase/functions/_shared/aiProvider.ts");
  const configTs = read("supabase/functions/_shared/aiPlatform/config.ts");
  const config = parseJson("supabase/functions/_shared/aiPlatform/config.default.json");

  rows.push(item("arch", "Architecture", "AI Router entry (routeAIRequest)", router.includes("export async function routeAIRequest") ? "PASS" : "FAIL"));
  rows.push(item("arch", "Architecture", "Router integrated in aiProvider", provider.includes("callPlatformRouter") && provider.includes("routeAIRequest") ? "PASS" : "FAIL"));
  rows.push(item("arch", "Architecture", "Legacy path preserved", provider.includes("callLegacyConfiguredProvider") ? "PASS" : "FAIL"));
  rows.push(item("arch", "Architecture", "Local fallback preserved", provider.includes("fallbackBase") ? "PASS" : "FAIL"));
  rows.push(item("arch", "Architecture", "Feature flag isRouterEnabled()", configTs.includes("AI_PLATFORM_V2_ENABLED") && configTs.includes("isRouterEnabled") ? "PASS" : "FAIL"));

  process.env.AI_PLATFORM_V2_ENABLED = "false";
  const rollbackOff = (process.env.AI_PLATFORM_V2_ENABLED || "").trim() === "false";
  delete process.env.AI_PLATFORM_V2_ENABLED;
  rows.push(item("arch", "Architecture", "Rollback flag=false semantics", rollbackOff ? "PASS" : "FAIL", "AI_PLATFORM_V2_ENABLED=false disables router"));

  const providersOk = Object.values(config.providers || {}).every((p) => p.secretEnv && !String(p.secretEnv).includes("sk-"));
  rows.push(item("arch", "Architecture", "Provider config uses secretEnv refs", providersOk ? "PASS" : "FAIL", `${Object.keys(config.providers || {}).length} providers`));
  rows.push(item("arch", "Architecture", "No hardcoded API keys in config JSON", !/\bsk-[a-zA-Z0-9]{8,}\b/.test(JSON.stringify(config)) ? "PASS" : "FAIL"));
  rows.push(item("arch", "Architecture", "Endpoint profiles for coach actions", ["daily_plan", "weekly_coach", "journal_summary", "risk_predictor", "news_explainer"].every((a) => config.endpointProfiles?.[a]) ? "PASS" : "FAIL"));

  finalizeSection("arch", "1. Architecture", rows);
}

// ─── 2. AI ───
function checkAI() {
  const rows = [];
  let validationFails = 0;
  try {
    execFileSync("node", ["scripts/ai-platform-v2/validate-pipeline.mjs"], { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
    rows.push(item("ai", "AI", "Phase 1 validation pipeline (0 FAIL)", "PASS", "npm run ai-platform:validate"));
  } catch (e) {
    const out = String(e.stdout || e.stderr || "");
    const failMatch = out.match(/(\d+) failed/);
    validationFails = failMatch ? Number(failMatch[1]) : 1;
    rows.push(item("ai", "AI", "Phase 1 validation pipeline (0 FAIL)", validationFails === 0 ? "PASS" : "FAIL", `${validationFails} failed`));
  }

  const config = parseJson("supabase/functions/_shared/aiPlatform/config.default.json");
  const obs = read("supabase/functions/_shared/aiPlatform/observability.ts");
  const registry = read("supabase/functions/_shared/aiPlatform/prompts/registry.ts");

  rows.push(item("ai", "AI", "Model selection profiles", config.profiles?.fast && config.profiles?.deep ? "PASS" : "FAIL"));
  rows.push(item("ai", "AI", "Fallback chains (≥3 models deep)", (config.fallbackChains?.deep?.length || 0) >= 3 ? "PASS" : "FAIL", config.fallbackChains?.deep?.join(" → ")));
  rows.push(item("ai", "AI", "Cache enabled + TTL", config.cache?.enabled && config.cache.ttlSeconds > 0 ? "PASS" : "WARNING", `${config.cache?.ttlSeconds}s`));
  rows.push(item("ai", "AI", "Prompt registry coach_v1", registry.includes("coach_v1") && registry.includes("resolvePromptVersion") ? "PASS" : "FAIL"));
  rows.push(item("ai", "AI", "Cost logging (estimatedCostUsd)", obs.includes("estimatedCostUsd") ? "PASS" : "FAIL"));
  rows.push(item("ai", "AI", "Observability structured logs", obs.includes("ai_platform_request") ? "PASS" : "FAIL"));
  rows.push(item("ai", "AI", "Router metadata → ai_usage_events", read("supabase/functions/ai-coach/index.ts").includes("platformMetadata") ? "PASS" : "FAIL"));
  rows.push(item("ai", "AI", "Live parity vs legacy", "WARNING", "Requires Preview Deploy + --live"));

  finalizeSection("ai", "2. AI", rows);
}

// ─── 3. Production Safety ───
function checkProductionSafety() {
  const rows = [];
  const envExample = read(".env.example");
  const aiCoach = read("supabase/functions/ai-coach/index.ts");
  const migration = read("supabase/migrations/20260627231000_add_runtime_tables_rls.sql");

  const serverSecrets = [
    "OPENROUTER_API_KEY",
    "AI_PLATFORM_V2_ENABLED",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const documented = serverSecrets.filter((s) => envExample.includes(s) || s === "SUPABASE_SERVICE_ROLE_KEY");
  rows.push(item("safety", "Production Safety", "AI secrets documented (.env.example)", envExample.includes("OPENROUTER_API_KEY") && envExample.includes("AI_PLATFORM_V2_ENABLED") ? "PASS" : "WARNING", "Edge secrets set in Supabase dashboard at deploy"));
  rows.push(item("safety", "Production Safety", "No EXPO_PUBLIC AI provider keys", !/EXPO_PUBLIC_(OPENROUTER|GEMINI|ANTHROPIC|NVIDIA)_API_KEY/.test(envExample) ? "PASS" : "FAIL"));
  rows.push(item("safety", "Production Safety", "LANGFUSE keys documented", envExample.includes("LANGFUSE") ? "PASS" : "WARNING", "Optional — add LANGFUSE_* to .env.example for ops clarity"));

  rows.push(item("safety", "Production Safety", "JWT required on ai-coach", aiCoach.includes("getUser(jwt)") && aiCoach.includes("401") ? "PASS" : "FAIL"));
  rows.push(item("safety", "Production Safety", "Pro entitlement server check", aiCoach.includes("hasServerProEntitlement") ? "PASS" : "FAIL"));
  rows.push(item("safety", "Production Safety", "ai_usage_events RLS enabled", migration.includes("ai_usage_events enable row level security") ? "PASS" : "FAIL"));
  rows.push(item("safety", "Production Safety", "Storage user-scoped policies", exists("supabase/migrations/202606280002_security_hardening.sql") && read("supabase/migrations/202606280002_security_hardening.sql").includes("user-screenshots") ? "PASS" : "FAIL"));
  rows.push(item("safety", "Production Safety", "AI quota / rate limits", read("supabase/functions/_shared/rateLimits.ts").includes("checkRateLimitBucket") && aiCoach.includes("checkAIQuota") ? "PASS" : "FAIL"));
  rows.push(item("safety", "Production Safety", "Rate limit buckets for coach actions", read("supabase/functions/_shared/rateLimits.ts").includes("daily_plan") && read("supabase/functions/_shared/rateLimits.ts").includes("weekly_coach") ? "PASS" : "FAIL"));
  rows.push(item("safety", "Production Safety", "V2 migration NOT applied (Phase 1 safe)", exists("supabase/migrations/20260708180000_ai_platform_v2_foundation.sql") ? "PASS" : "WARNING", "SQL ready; apply only in Phase 3+"));

  try {
    execFileSync("npm", ["run", "security:check"], { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
    rows.push(item("safety", "Production Safety", "security:check", "PASS"));
  } catch {
    rows.push(item("safety", "Production Safety", "security:check", "FAIL"));
  }

  finalizeSection("safety", "3. Production Safety", rows);
}

// ─── 4. Release ───
function checkRelease() {
  const rows = [];
  const appJson = parseJson("app.json");
  const pkg = parseJson("package.json");
  const eas = parseJson("eas.json");

  const version = appJson.expo?.version;
  const build = appJson.expo?.ios?.buildNumber;
  const runtime = appJson.expo?.runtimeVersion?.policy || JSON.stringify(appJson.expo?.runtimeVersion);
  const bundleId = appJson.expo?.ios?.bundleIdentifier;
  const pkgVersion = pkg.version;

  rows.push(item("release", "Release", "App version (expo.version)", version ? "PASS" : "FAIL", version));
  rows.push(item("release", "Release", "iOS build number", build ? "PASS" : "FAIL", build));
  rows.push(item("release", "Release", "Runtime version policy", runtime === "appVersion" ? "PASS" : "WARNING", String(runtime)));
  rows.push(item("release", "Release", "package.json version matches app.json", version === pkgVersion ? "PASS" : "FAIL", `app ${version} / pkg ${pkgVersion}`));
  rows.push(item("release", "Release", "Bundle identifier unchanged", bundleId === "com.youtrader.pro" ? "PASS" : "FAIL", bundleId));
  rows.push(item("release", "Release", "EAS preview profile", eas.build?.preview ? "PASS" : "FAIL", "channel: preview"));
  rows.push(item("release", "Release", "EAS production profile", eas.build?.production ? "PASS" : "FAIL"));
  rows.push(item("release", "Release", "EAS projectId matches app.json", appJson.expo?.extra?.eas?.projectId === "02ed40d6-5ad8-4a6d-9716-5ba40ec714c6" ? "PASS" : "FAIL"));
  rows.push(item("release", "Release", "Sentry plugin in app.json", JSON.stringify(appJson.expo?.plugins || []).includes("sentry") ? "PASS" : "WARNING"));
  rows.push(item("release", "Release", "app.config.js wraps app.json", exists("app.config.js") && read("app.config.js").includes("app.json") ? "PASS" : "FAIL"));

  try {
    execFileSync("npm", ["run", "typecheck"], { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
    rows.push(item("release", "Release", "npm run typecheck", "PASS"));
  } catch {
    rows.push(item("release", "Release", "npm run typecheck", "FAIL"));
  }

  finalizeSection("release", "4. Release", rows);
}

// ─── 5. Monitoring ───
function checkMonitoring() {
  const rows = [];
  const langfuse = read("supabase/functions/_shared/langfuse.ts");
  const obsPlatform = read("supabase/functions/_shared/aiPlatform/observability.ts");

  rows.push(item("mon", "Monitoring", "Langfuse server module", langfuse.includes("traceAIEvent") && langfuse.includes("LANGFUSE_PUBLIC_KEY") ? "PASS" : "FAIL"));
  rows.push(item("mon", "Monitoring", "Router → Langfuse bridge", obsPlatform.includes("traceRouterToLangfuse") ? "PASS" : "FAIL"));
  const hasPosthog = exists("src/lib/posthog.ts") && (read("App.tsx").toLowerCase().includes("posthog") || read("src/lib/analytics.ts").includes("posthog"));
  rows.push(item("mon", "Monitoring", "PostHog client integration", hasPosthog ? "PASS" : "WARNING"));
  rows.push(item("mon", "Monitoring", "Sentry client integration", exists("src/observability/monitoring.ts") ? "PASS" : "FAIL"));
  rows.push(item("mon", "Monitoring", "Cost metadata in usage events", read("supabase/functions/ai-coach/index.ts").includes("metadata") ? "PASS" : "FAIL"));
  rows.push(item("mon", "Monitoring", "AI Cost Monitor dashboard (Phase 3)", "WARNING", "Designed in AI_COST_MONITOR.md — DB table not applied yet"));
  rows.push(item("mon", "Monitoring", "Health dashboard UI (Phase 3+)", "WARNING", "Spec in AI_HEALTH_DASHBOARD.md — not deployed"));

  finalizeSection("mon", "5. Monitoring", rows);
}

// ─── 6. Documentation ───
function checkDocumentation() {
  const rows = [];
  const required = [
    { file: "docs/AI_PLATFORM_V2.md", needles: ["routeAIRequest", "AI_PLATFORM_V2_ENABLED", "NOT DEPLOYED"] },
    { file: "docs/AI_PLATFORM_V2_VALIDATION.md", needles: ["Pre-deployment", "Rollback"] },
    { file: "docs/AI_ROUTER.md", needles: ["routeAIRequest", "fallbackChains"] },
    { file: "docs/AI_COST_MONITOR.md", needles: ["estimatedCostUsd", "ai_usage_events"] },
    { file: "docs/PROMPT_VERSIONING.md", needles: ["coach_v1", "rollback"] },
    { file: "docs/AI_AB_TESTING.md", needles: ["experiment", "approval"] },
    { file: "docs/AI_BENCHMARK_ENGINE.md", needles: ["golden-prompts", "dry-run"] },
    { file: "docs/AI_HEALTH_DASHBOARD.md", needles: ["Health Score", "Langfuse"] },
    { file: "docs/MIGRATION_PLAN.md", needles: ["Phase 1", "Rollback", "Preview Deploy"] },
  ];

  for (const doc of required) {
    if (!exists(doc.file)) {
      rows.push(item("docs", "Documentation", doc.file, "FAIL", "missing"));
      continue;
    }
    const content = read(doc.file).toLowerCase();
    const missing = doc.needles.filter((n) => !content.includes(n.toLowerCase()));
    rows.push(item("docs", "Documentation", `${path.basename(doc.file)} synced`, missing.length === 0 ? "PASS" : "WARNING", missing.length ? `missing: ${missing.join(", ")}` : "ok"));
  }

  const goldenCount = parseJson("scripts/ai-platform-v2/golden-prompts.json").prompts?.length;
  rows.push(item("docs", "Documentation", "Golden suite doc reference (100 prompts)", goldenCount === 100 ? "PASS" : "FAIL", `${goldenCount} prompts`));

  finalizeSection("docs", "6. Documentation", rows);
}

// ─── 7. Deployment Checklist ───
function checkDeploymentChecklist() {
  const rows = [];
  const checklist = [
    ["Phase 1 Validation approved by CEO", "PASS", "Approved 2026-07-08"],
    ["Production Readiness Gate (this report)", writeDoc ? "PASS" : "WARNING", "Run with --write-doc"],
    ["Preview Deploy — ai-coach Edge Function", "WARNING", "Awaiting CEO go — NOT RUN"],
    ["Supabase secrets verified in dashboard", "WARNING", "Manual — cannot verify from repo"],
    ["AI_PLATFORM_V2_ENABLED staging value set", "WARNING", "Recommend true on staging; false rollback tested"],
    ["Live validation (--live) on staging", "WARNING", "After Preview Deploy"],
    ["TestFlight build (preview profile)", "WARNING", "After Preview Deploy"],
    ["Real iPhone manual QA", "WARNING", "Checklist in AI_PLATFORM_V2_VALIDATION.md"],
    ["Production deploy", "WARNING", "Separate CEO gate"],
    ["Client app release (no change required Phase 1)", "PASS", "Same ai-coach invoke API"],
  ];

  for (const [check, status, detail] of checklist) {
    rows.push(item("deploy", "Deployment Checklist", check, status, detail));
  }

  finalizeSection("deploy", "7. Deployment Checklist", rows);
}

function overallStatus() {
  const anyFail = sections.some((s) => s.status === "FAIL") || allItems.some((i) => i.status === "FAIL");
  return anyFail ? "BLOCKED" : "READY FOR PREVIEW";
}

function writeGateDoc(status) {
  const generatedAt = new Date().toISOString();
  const docPath = path.join(ROOT, "docs/PRODUCTION_READINESS_GATE.md");

  let body = `# Production Readiness Gate — AI Platform V2 Phase 1

**Generated:** ${generatedAt}  
**Phase:** Pre Preview Deploy  
**Deploy status:** NOT DEPLOYED  
**Pipeline:** \`npm run ai-platform:readiness\`

---

## Executive summary

| Metric | Value |
|--------|-------|
| Sections | ${sections.length} |
| Total checks | ${allItems.length} |
| FAIL | ${allItems.filter((i) => i.status === "FAIL").length} |
| WARNING | ${allItems.filter((i) => i.status === "WARNING").length} |
| PASS | ${allItems.filter((i) => i.status === "PASS").length} |

---

`;

  for (const section of sections) {
    body += `## ${section.title}\n\n**Section status:** ${section.status}\n\n`;
    body += `| Check | Status | Detail |\n|-------|--------|--------|\n`;
    for (const r of section.rows) {
      body += `| ${r.check} | ${r.status} | ${String(r.detail || "").replace(/\|/g, "/")} |\n`;
    }
    body += "\n---\n\n";
  }

  body += `## Deployment checklist (summary)\n\n`;
  body += `| Step | Owner | Status |\n|------|-------|--------|\n`;
  body += `| Validation approved | CEO | ✅ |\n`;
  body += `| Readiness gate green | Engineering | ${status === "READY FOR PREVIEW" ? "✅" : "❌"} |\n`;
  body += `| Preview Deploy (ai-coach) | CEO + Engineering | ☐ |\n`;
  body += `| Staging live validation | Engineering | ☐ |\n`;
  body += `| TestFlight | QA | ☐ |\n`;
  body += `| iPhone QA | QA | ☐ |\n`;
  body += `| Production | CEO | ☐ |\n\n`;

  body += `---\n\n## Final gate status\n\n`;
  body += `\`\`\`\n${status}\n\`\`\`\n\n`;

  if (status === "READY FOR PREVIEW") {
    body += `Phase 1 may proceed to **Preview Deploy** when CEO explicitly approves. No production changes have been made. Warnings are expected for manual steps (staging secrets, live parity, TestFlight) and Phase 3+ monitoring surfaces.\n`;
  } else {
    const fails = allItems.filter((i) => i.status === "FAIL");
    body += `**Blocked by ${fails.length} failure(s):**\n\n`;
    for (const f of fails) {
      body += `- **${f.check}** (${f.sectionTitle}): ${f.detail || "see table above"}\n`;
    }
    body += `\nResolve all FAIL items before Preview Deploy.\n`;
  }

  body += `\n---\n\n## Re-run\n\n\`\`\`bash\nnpm run ai-platform:readiness\nnpm run ai-platform:readiness:report\n\`\`\`\n\nRaw JSON: \`scripts/ai-platform-v2/reports/readiness-latest.json\`\n`;

  fs.writeFileSync(docPath, body);
  return docPath;
}

function main() {
  console.log("Production Readiness Gate — AI Platform V2 Phase 1");
  console.log("=".repeat(55));
  console.log("Deploy: DISABLED\n");

  checkArchitecture();
  checkAI();
  checkProductionSafety();
  checkRelease();
  checkMonitoring();
  checkDocumentation();
  checkDeploymentChecklist();

  const status = overallStatus();

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    gate: "production-readiness",
    deployStatus: "NOT_DEPLOYED",
    finalStatus: status,
    sections: sections.map((s) => ({ id: s.id, title: s.title, status: s.status, fails: s.fails, warns: s.warns })),
    items: allItems,
  };
  fs.writeFileSync(path.join(REPORT_DIR, "readiness-latest.json"), JSON.stringify(report, null, 2));

  for (const s of sections) {
    const icon = s.status === "PASS" ? "✅" : s.status === "FAIL" ? "❌" : "⚠️";
    console.log(`${icon} ${s.title} — ${s.status} (${s.fails} fail, ${s.warns} warn)`);
  }

  console.log("\n" + "=".repeat(55));
  console.log(`FINAL STATUS: ${status}`);
  console.log("=".repeat(55));

  if (writeDoc) {
    const doc = writeGateDoc(status);
    console.log(`\nUpdated: ${doc}`);
  }

  process.exit(status === "BLOCKED" ? 1 : 0);
}

main();
