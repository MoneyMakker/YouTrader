import { check, stepResult, readJson, readText, exists } from "../lib.mjs";

export function previewDeployReport() {
  const checks = [];
  const blockers = [];

  const previewReport = readJson("scripts/ai-platform-v2/reports/preview-deploy.json", {});
  const live = readJson("scripts/ai-platform-v2/reports/live-comparison.json", {});

  checks.push(check("preview_deployed", "Preview ai-coach deployed", previewReport.deployOk ? "PASS" : "WARNING", previewReport.deployDetail || "run ai-platform:preview-deploy if needed"));
  checks.push(check("rollback", "Rollback path (AI_PLATFORM_V2_ENABLED=false)", exists("supabase/functions/_shared/aiProvider.ts") && readText("supabase/functions/_shared/aiProvider.ts").includes("callLegacyConfiguredProvider") ? "PASS" : "FAIL"));
  checks.push(check("feature_flags", "Feature flag wiring", readText("supabase/functions/_shared/aiPlatform/config.ts").includes("isRouterEnabled") ? "PASS" : "FAIL"));
  checks.push(check("legacy_compat", "Legacy compatibility preserved", readText("supabase/functions/_shared/aiProvider.ts").includes("callLegacyConfiguredProvider") ? "PASS" : "FAIL"));
  checks.push(check("router", "AI Router module", exists("supabase/functions/_shared/aiPlatform/router.ts") ? "PASS" : "FAIL"));
  checks.push(check("fallback", "Fallback chains configured", exists("supabase/functions/_shared/aiPlatform/config.default.json") ? "PASS" : "FAIL"));
  checks.push(check("cache", "Cache module", exists("supabase/functions/_shared/aiPlatform/cache.ts") ? "PASS" : "FAIL"));
  checks.push(check("prompts", "Prompt versioning registry", exists("supabase/functions/_shared/aiPlatform/prompts/registry.ts") ? "PASS" : "FAIL"));
  checks.push(check("observability", "Observability module", exists("supabase/functions/_shared/aiPlatform/observability.ts") ? "PASS" : "FAIL"));
  checks.push(check("cost_logging", "Cost logging fields", readText("supabase/functions/_shared/aiPlatform/observability.ts").includes("estimatedCostUsd") ? "PASS" : "FAIL"));

  const docStatus = exists("docs/PREVIEW_DEPLOY_REPORT.md") && readText("docs/PREVIEW_DEPLOY_REPORT.md").includes("READY FOR PREVIEW") ? "PASS" : "WARNING";
  checks.push(check("preview_doc", "PREVIEW_DEPLOY_REPORT.md", docStatus));

  const v2Rate = live.summary?.v2SuccessRate ?? 0;
  checks.push(check("v2_live", "V2 live success rate", v2Rate >= 1 ? "PASS" : v2Rate >= 0.83 ? "WARNING" : "FAIL", `${Math.round(v2Rate * 100)}%`));

  if (checks.some((c) => c.status === "FAIL")) {
    blockers.push("Preview deploy verification has FAIL items");
  }

  return stepResult("preview", "Step 4 — Preview Deploy Report", checks, blockers);
}
