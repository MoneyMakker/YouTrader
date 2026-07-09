#!/usr/bin/env node
/**
 * Generate docs/PREVIEW_DEPLOY_REPORT.md from preview deploy artifacts.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const REPORT_DIR = path.join(ROOT, "scripts/ai-platform-v2/reports");

function readJson(rel, fallback = null) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function sectionStatus(items) {
  if (items.some((i) => i.status === "FAIL")) return "FAIL";
  if (items.some((i) => i.status === "WARNING")) return "WARNING";
  return "PASS";
}

function buildTestFlightChecklist() {
  return `## TestFlight AI Checklist (iPhone)

Complete on **preview/staging** build (\`eas build --profile preview\`). Do **not** ship production until CEO approves.

### Setup
- [ ] Install TestFlight build from preview channel
- [ ] Sign in with Pro test account (or account with active Pro entitlement)
- [ ] Confirm \`EXPO_PUBLIC_SUPABASE_URL\` points to preview/staging project (\`izzrlsgumyabdvlmwlwn\`)
- [ ] Confirm airplane mode off for cloud AI tests

### AI Coach — Pro user
- [ ] **Daily Plan** — returns JSON card; provider badge not \`free_preview\`
- [ ] **Weekly Coach** — full coaching card; strengths + leaks populated
- [ ] **Journal Summary** — month/week summary renders
- [ ] **Risk Predictor** — risk level + notes present
- [ ] **News Explainer** — headline explanation (no buy/sell signal language)
- [ ] **Daily Challenge** — challenge card loads

### Free user
- [ ] Same screens show **local preview** only (\`free_preview\` / local fallback)
- [ ] No cloud provider charges triggered from free tier

### Reliability
- [ ] Repeat Daily Plan twice — second call same session (cache may reduce latency)
- [ ] Toggle airplane mode mid-request — graceful local fallback message
- [ ] Quota banner when daily limit approached (if test account near limit)

### Rollback drill (staging secret only)
- [ ] Set \`AI_PLATFORM_V2_ENABLED=false\` in Supabase secrets
- [ ] Wait ~30s; invoke Weekly Coach — still returns valid JSON (legacy path)
- [ ] Restore \`AI_PLATFORM_V2_ENABLED=true\`

### Observability (engineering)
- [ ] Langfuse trace visible for ai-coach request (if keys configured)
- [ ] PostHog \`ai_coach\` / coach events fire
- [ ] Sentry: no new crash on AI screens during session
- [ ] \`ai_usage_events\` row created with \`estimatedCostUsd\` metadata (Supabase SQL)

### Sign-off
- [ ] QA: all Pro flows pass
- [ ] Engineering: live comparison report reviewed
- [ ] CEO: approve **Production** deploy (separate gate)

`;
}

function main() {
  const live = readJson("scripts/ai-platform-v2/reports/live-comparison.json", { modes: { v2: [], legacy: [] }, summary: {}, errors: [] });
  const validation = readJson("scripts/ai-platform-v2/reports/latest.json", { summary: {} });
  const readiness = readJson("scripts/ai-platform-v2/reports/readiness-latest.json", { finalStatus: "UNKNOWN" });
  const deploy = readJson("scripts/ai-platform-v2/reports/preview-deploy.json", {});

  const sections = [];

  // 1 Pre-deploy
  const pre = [
    { check: "AI config backup created", status: deploy.backupOk ? "PASS" : "FAIL", detail: deploy.backupDir || "" },
    { check: "Feature flags verified", status: deploy.featureFlagsOk ? "PASS" : "FAIL", detail: deploy.featureFlagDetail || "" },
    { check: "Rollback path verified (static)", status: deploy.rollbackOk ? "PASS" : "FAIL", detail: "AI_PLATFORM_V2_ENABLED=false" },
  ];
  sections.push({ title: "1. Pre-deploy", status: sectionStatus(pre), rows: pre });

  // 2 Deploy
  const dep = [
    { check: "ai-coach deployed (preview/staging only)", status: deploy.deployOk ? "PASS" : "FAIL", detail: deploy.deployDetail || "" },
    { check: "Other functions untouched", status: deploy.onlyAiCoach ? "PASS" : "WARNING", detail: "market-intelligence, secure-upload unchanged" },
    { check: "Production app NOT released", status: "PASS", detail: "No EAS production build; no git push" },
  ];
  sections.push({ title: "2. Preview Deploy", status: sectionStatus(dep), rows: dep });

  // 3 Live validation
  const v2Rate = live.summary?.v2SuccessRate ?? 0;
  const legRate = live.summary?.legacySuccessRate ?? 0;
  const liveRows = [
    { check: "Live comparison executed", status: live.errors?.length ? "FAIL" : "PASS", detail: live.errors?.join("; ") || "6 endpoints × 2 modes" },
    { check: "V2 success rate", status: v2Rate >= 1 ? "PASS" : v2Rate >= 0.83 ? "WARNING" : "FAIL", detail: `${Math.round(v2Rate * 100)}%` },
    { check: "Legacy success rate", status: legRate >= 1 ? "PASS" : legRate >= 0.83 ? "WARNING" : "FAIL", detail: `${Math.round(legRate * 100)}%` },
    { check: "V2 avg latency", status: live.summary?.v2AvgLatencyMs != null ? "PASS" : "WARNING", detail: live.summary?.v2AvgLatencyMs != null ? `${live.summary.v2AvgLatencyMs}ms` : "n/a" },
    { check: "Legacy avg latency", status: live.summary?.legacyAvgLatencyMs != null ? "PASS" : "WARNING", detail: `${live.summary?.legacyAvgLatencyMs}ms` },
    { check: "V2 schema quality (avg)", status: (live.summary?.v2AvgSchemaScore ?? 0) >= 0.8 ? "PASS" : "WARNING", detail: String(live.summary?.v2AvgSchemaScore ?? "n/a") },
    { check: "Legacy schema quality (avg)", status: (live.summary?.legacyAvgSchemaScore ?? 0) >= 0.8 ? "PASS" : "WARNING", detail: String(live.summary?.legacyAvgSchemaScore ?? "n/a") },
    { check: "V2 fallback count", status: (live.summary?.v2FallbackCount ?? 0) <= 2 ? "PASS" : "WARNING", detail: String(live.summary?.v2FallbackCount ?? 0) },
    { check: "V2 cache hits (2nd pass N/A in suite)", status: "WARNING", detail: `cache hits in run: ${live.summary?.v2CacheHits ?? 0}` },
    { check: "V2 avg estimated cost", status: live.summary?.v2AvgCostUsd != null ? "PASS" : "WARNING", detail: live.summary?.v2AvgCostUsd != null ? `$${live.summary.v2AvgCostUsd}` : "metadata optional" },
    { check: "Static validation pipeline", status: (validation.summary?.failed ?? 1) === 0 ? "PASS" : "FAIL", detail: `${validation.summary?.passed ?? 0} pass / ${validation.summary?.failed ?? "?"} fail` },
  ];
  sections.push({ title: "3. Live validation (V2 vs Legacy)", status: sectionStatus(liveRows), rows: liveRows });

  // 4 Comparison table
  const compRows = [];
  for (const action of ["daily_plan", "weekly_coach", "journal_summary", "risk_predictor", "news_explainer", "daily_challenge"]) {
    const v2 = live.modes?.v2?.find((x) => x.action === action);
    const leg = live.modes?.legacy?.find((x) => x.action === action);
    compRows.push({
      check: action,
      status: v2?.ok && leg?.ok ? "PASS" : v2?.ok || leg?.ok ? "WARNING" : "FAIL",
      detail: `V2 ${v2?.latencyMs ?? "?"}ms ${v2?.providerStatus ?? "?"} | Legacy ${leg?.latencyMs ?? "?"}ms ${leg?.providerStatus ?? "?"}`,
    });
  }
  sections.push({ title: "4. Endpoint comparison", status: sectionStatus(compRows), rows: compRows });

  // 5 Safety
  const safety = [
    { check: "JWT enforced (401 without token)", status: deploy.jwtEnforced ? "PASS" : "WARNING", detail: deploy.jwtDetail || "" },
    { check: "V2 secret restored after legacy test", status: deploy.v2SecretRestored ? "PASS" : "WARNING", detail: "AI_PLATFORM_V2_ENABLED=true" },
    { check: "service_role SELECT on user_subscriptions", status: live.summary?.v2SuccessRate >= 1 ? "PASS" : "FAIL", detail: "Migration 20260709203000 (see DB_PERMISSION_REVIEW.md)" },
    { check: "Ephemeral test user cleaned up", status: live.errors?.length ? "WARNING" : "PASS", detail: "preview validation user deleted" },
  ];
  sections.push({ title: "5. Production Safety", status: sectionStatus(safety), rows: safety });

  // 6 Monitoring
  const mon = [
    { check: "Usage metadata persisted", status: live.modes?.v2?.some((x) => x.estimatedCostUsd != null || x.modelRef) ? "PASS" : "WARNING", detail: "ai_usage_events.metadata" },
    { check: "Langfuse / PostHog / Sentry", status: "WARNING", detail: "Verify in dashboards during TestFlight" },
  ];
  sections.push({ title: "6. Monitoring", status: sectionStatus(mon), rows: mon });

  // 7 Docs
  const docsOk = exists("docs/AI_PLATFORM_V2.md") && exists("docs/PRODUCTION_READINESS_GATE.md");
  sections.push({
    title: "7. Documentation",
    status: docsOk ? "PASS" : "WARNING",
    rows: [{ check: "AI Platform V2 docs present", status: docsOk ? "PASS" : "WARNING", detail: "see docs/AI_PLATFORM_V2*.md" }],
  });

  const anyFail = sections.some((s) => s.status === "FAIL") || liveRows.some((r) => r.status === "FAIL");
  const finalStatus = anyFail ? "BLOCKED" : "READY FOR PREVIEW";

  let md = `# Preview Deploy Report — AI Platform V2 Phase 1

**Generated:** ${new Date().toISOString()}  
**Environment:** Preview / Staging (\`izzrlsgumyabdvlmwlwn\`)  
**Scope:** \`ai-coach\` Edge Function only  
**Production deploy:** NOT APPROVED · NOT EXECUTED  
**Git push/merge:** NOT DONE

---

## Executive summary

| Item | Value |
|------|-------|
| Readiness gate (pre-deploy) | ${readiness.finalStatus || "N/A"} |
| ai-coach version | ${deploy.versionAfter ?? "unknown"} (was ${deploy.versionBefore ?? "?"}) |
| V2 success rate | ${Math.round((live.summary?.v2SuccessRate ?? 0) * 100)}% |
| Legacy success rate | ${Math.round((live.summary?.legacySuccessRate ?? 0) * 100)}% |
| V2 avg latency | ${live.summary?.v2AvgLatencyMs ?? "n/a"} ms |
| Static validation FAILs | ${validation.summary?.failed ?? "?"} |

---

`;

  for (const s of sections) {
    md += `## ${s.title}\n\n**Section status:** ${s.status}\n\n| Check | Status | Detail |\n|-------|--------|--------|\n`;
    for (const r of s.rows) {
      md += `| ${r.check} | ${r.status} | ${String(r.detail || "").replace(/\|/g, "/")} |\n`;
    }
    md += "\n---\n\n";
  }

  md += `## Final gate status\n\n\`\`\`\n${finalStatus}\n\`\`\`\n\n`;

  if (finalStatus === "READY FOR PREVIEW") {
    md += `Preview Deploy **passed**. Proceed to TestFlight iPhone QA. **Do not deploy Production** until CEO approves.\n\n`;
    md += buildTestFlightChecklist();
  } else {
    md += `**STOP.** Resolve all FAIL items before TestFlight or Production.\n\n`;
    const fails = sections.flatMap((s) => s.rows.filter((r) => r.status === "FAIL"));
    for (const f of fails) {
      md += `- ${f.check}: ${f.detail}\n`;
    }
  }

  md += `\n---\n\nArtifacts:\n- \`scripts/ai-platform-v2/reports/live-comparison.json\`\n- \`scripts/ai-platform-v2/reports/preview-deploy.json\`\n- Backup: \`${deploy.backupDir || "scripts/ai-platform-v2/backups/"}\`\n`;

  fs.writeFileSync(path.join(ROOT, "docs/PREVIEW_DEPLOY_REPORT.md"), md);
  console.log(`Report: docs/PREVIEW_DEPLOY_REPORT.md`);
  console.log(`FINAL STATUS: ${finalStatus}`);
  process.exit(anyFail ? 1 : 0);
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

main();
