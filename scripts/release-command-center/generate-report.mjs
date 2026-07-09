import fs from "node:fs";
import path from "node:path";
import { ROOT, REPORT_DIR } from "./lib.mjs";

export function generateTestFlightDoc({ mode, steps, notes, checklistSections, buildResult, finalStatus, blockers }) {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, "app.json"), "utf8"));
  const version = appJson.expo?.version;
  const build = appJson.expo?.ios?.buildNumber;

  let md = `# TestFlight Preparation — YouTrader ${version} (${build})

**Generated:** ${new Date().toISOString()}  
**Pipeline:** Release Command Center · \`${mode}\`  
**Final status:** \`${finalStatus}\`  
**Production / App Store:** NOT APPROVED · NOT SUBMITTED  
**Git push / merge:** NOT PERFORMED

---

## Executive summary

| Gate | Status |
|------|--------|
`;

  for (const s of steps) {
    md += `| ${s.title} | **${s.status}** |\n`;
  }

  md += `\n---\n\n## Git Status\n\n`;
  const gitStep = steps.find((s) => s.id === "git");
  if (gitStep) {
    md += `| Check | Status | Detail |\n|-------|--------|--------|\n`;
    for (const c of gitStep.checks) md += `| ${c.name} | ${c.status} | ${c.detail || ""} |\n`;
  }

  md += `\n---\n\n## Architecture & Production Readiness\n\n`;
  const readiness = steps.find((s) => s.id === "readiness");
  if (readiness) {
    md += `**Section:** ${readiness.status}\n\n`;
    for (const c of readiness.checks) md += `- ${c.status} ${c.name}${c.detail ? ` — ${c.detail}` : ""}\n`;
  }

  md += `\n---\n\n## AI Platform Validation\n\n`;
  const ai = steps.find((s) => s.id === "ai");
  if (ai) {
    md += `**Section:** ${ai.status}\n\n`;
    for (const c of ai.checks) md += `- ${c.status} ${c.name}${c.detail ? ` — ${c.detail}` : ""}\n`;
  }

  md += `\n---\n\n## Preview Deploy & AI Status\n\n`;
  const preview = steps.find((s) => s.id === "preview");
  if (preview) {
    md += `| Check | Status | Detail |\n|-------|--------|--------|\n`;
    for (const c of preview.checks) md += `| ${c.name} | ${c.status} | ${c.detail || ""} |\n`;
  }

  md += `\n---\n\n## Database Permission Audit\n\n`;
  const db = steps.find((s) => s.id === "db");
  if (db) {
    md += `| Check | Status | Detail |\n|-------|--------|--------|\n`;
    for (const c of db.checks) md += `| ${c.name} | ${c.status} | ${c.detail || ""} |\n`;
  }

  md += `\n---\n\n## Release Notes\n\n`;
  if (notes) {
    md += `### Summary\n\n`;
    for (const n of notes.releaseNotes || []) md += `- ${n}\n`;
    md += `\n### Changelog (recent commits)\n\n`;
    for (const c of notes.changelog || []) md += `- ${c}\n`;
    md += `\n### Known Issues\n\n`;
    for (const k of notes.knownIssues || []) md += `- ${k}\n`;
    md += `\n### Migration Summary\n\n`;
    for (const m of notes.migrationSummary || []) md += `- \`${m}\`\n`;
  }

  md += `\n---\n\n## Manual iPhone QA Checklist\n\n`;
  for (const section of checklistSections || []) {
    md += `### ${section.title}\n\n`;
    for (const item of section.items) md += `- [ ] ${item}\n`;
    md += `\n`;
  }

  md += `---\n\n## Version & Build Configuration\n\n`;
  const ver = steps.find((s) => s.id === "version");
  if (ver) {
    md += `| Check | Status | Detail |\n|-------|--------|--------|\n`;
    for (const c of ver.checks) md += `| ${c.name} | ${c.status} | ${c.detail || ""} |\n`;
  }

  md += `\n---\n\n## Build Result\n\n`;
  md += `| Field | Value |\n|-------|-------|\n`;
  md += `| Profile | ${buildResult?.profile || "preview"} |\n`;
  md += `| Status | ${buildResult?.status || "n/a"} |\n`;
  md += `| Duration | ${buildResult?.durationMs ? Math.round(buildResult.durationMs / 1000) + "s" : "n/a"} |\n`;
  md += `| URL | ${buildResult?.url || "see EAS dashboard"} |\n`;
  if (buildResult?.blockReason) {
    md += `| Block reason | ${buildResult.blockReason} |\n`;
  }
  if (buildResult?.quotaResetDate) {
    md += `| Quota reset | ${buildResult.quotaResetDate} |\n`;
  }

  md += `\n---\n\n## Final gate status\n\n\`\`\`\n${finalStatus}\n\`\`\`\n\n`;

  if (finalStatus === "READY FOR TESTFLIGHT") {
    md += `### Next Steps\n\n`;
    md += `1. Install Preview Build from EAS / TestFlight\n`;
    md += `2. Complete iPhone QA checklist above\n`;
    md += `3. Review AI Health Dashboard (docs/AI_HEALTH_DASHBOARD.md)\n`;
    md += `4. Review Cost Dashboard (docs/AI_COST_MONITOR.md)\n`;
    md += `5. Approve Production (CEO gate) — \`npm run prepare:production\`\n`;
  } else {
    md += `### Blocking issues\n\n`;
    for (const b of blockers) md += `- ${b}\n`;
  }

  md += `\n---\n\nRaw report: \`scripts/release-command-center/reports/latest-run.json\`\n`;

  const docPath = path.join(ROOT, "docs/TESTFLIGHT_PREPARATION.md");
  fs.writeFileSync(docPath, md);
  return docPath;
}
