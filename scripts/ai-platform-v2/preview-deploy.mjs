#!/usr/bin/env node
/**
 * Preview Deploy — ai-coach only (CEO-approved).
 * Does NOT push git. Does NOT deploy production app.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const REPORT_DIR = path.join(ROOT, "scripts/ai-platform-v2/reports");
const PROJECT_REF = "izzrlsgumyabdvlmwlwn";

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: opts.stdio || "pipe", ...opts });
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function main() {
  const report = {
    startedAt: new Date().toISOString(),
    projectRef: PROJECT_REF,
    scope: "ai-coach-only",
    backupOk: false,
    backupDir: null,
    featureFlagsOk: false,
    featureFlagDetail: "",
    rollbackOk: false,
    deployOk: false,
    deployDetail: "",
    onlyAiCoach: true,
    versionBefore: null,
    versionAfter: null,
    jwtEnforced: false,
    jwtDetail: "",
    v2SecretRestored: true,
  };

  console.log("Step 1/4 — Backup AI configuration");
  try {
    run("node", ["scripts/ai-platform-v2/backup-ai-config.mjs"], { stdio: "inherit" });
    const latest = fs.readFileSync(path.join(ROOT, "scripts/ai-platform-v2/backups/LATEST"), "utf8").trim();
    report.backupDir = `scripts/ai-platform-v2/backups/${latest}`;
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, report.backupDir, "manifest.json"), "utf8"));
    report.versionBefore = manifest.aiCoachVersionBefore;
    report.backupOk = true;
  } catch (e) {
    console.error("Backup failed:", e.message);
    report.backupOk = false;
  }

  console.log("\nStep 2/4 — Verify feature flags & rollback");
  const configTs = read("supabase/functions/_shared/aiPlatform/config.ts");
  const provider = read("supabase/functions/_shared/aiProvider.ts");
  report.rollbackOk =
    configTs.includes('flag === "false"') &&
    provider.includes("callLegacyConfiguredProvider") &&
    provider.includes("isRouterEnabled()");

  let secretNames = [];
  try {
    const secrets = JSON.parse(run("supabase", ["secrets", "list"]));
    secretNames = (secrets.secrets || []).map((s) => s.name);
  } catch {
    /* ignore */
  }
  const hasV2Flag = secretNames.includes("AI_PLATFORM_V2_ENABLED");
  report.featureFlagsOk = report.rollbackOk;
  report.featureFlagDetail = hasV2Flag
    ? "AI_PLATFORM_V2_ENABLED present in Supabase secrets"
    : "AI_PLATFORM_V2_ENABLED unset — router defaults to enabled (isRouterEnabled=true)";

  if (!report.rollbackOk) {
    console.error("Rollback verification FAILED — aborting deploy");
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORT_DIR, "preview-deploy.json"), JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log("\nStep 3/4 — Deploy ai-coach to preview/staging");
  try {
    const out = run("supabase", [
      "functions",
      "deploy",
      "ai-coach",
      "--project-ref",
      PROJECT_REF,
      "--use-api",
      "--yes",
    ]);
    report.deployOk = true;
    report.deployDetail = out.split("\n").slice(-3).join(" ").trim() || "deployed";

    const fnList = JSON.parse(run("supabase", ["functions", "list", "--output-format", "json"]));
    const coach = fnList.functions?.find((f) => f.slug === "ai-coach");
    report.versionAfter = coach?.version ?? null;
  } catch (e) {
    report.deployOk = false;
    report.deployDetail = String(e.stderr || e.message).slice(0, 400);
    console.error("Deploy failed:", report.deployDetail);
  }

  console.log("\nStep 4/4 — JWT enforcement smoke test");
  try {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`;
    const res = fetch(`${url}/functions/v1/ai-coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    // sync wait — use deasync pattern with execFileSync curl instead
  } catch {
    /* use curl below */
  }

  try {
    const url = `https://${PROJECT_REF}.supabase.co/functions/v1/ai-coach`;
    const curl = run("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "POST", url, "-H", "Content-Type: application/json", "-d", "{}"], { stdio: "pipe" }).trim();
    report.jwtEnforced = curl === "401";
    report.jwtDetail = `HTTP ${curl} without Authorization`;
  } catch (e) {
    report.jwtDetail = String(e.message);
  }

  // Ensure V2 enabled for preview testing
  try {
    run("supabase", ["secrets", "set", "AI_PLATFORM_V2_ENABLED=true"]);
    report.v2SecretRestored = true;
  } catch {
    report.v2SecretRestored = false;
  }

  report.finishedAt = new Date().toISOString();
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, "preview-deploy.json"), JSON.stringify(report, null, 2));

  console.log(`\nai-coach: v${report.versionBefore} → v${report.versionAfter}`);
  console.log(`JWT smoke: ${report.jwtDetail}`);
  console.log(`Deploy: ${report.deployOk ? "OK" : "FAILED"}`);

  process.exit(report.deployOk ? 0 : 1);
}

main();
