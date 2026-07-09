import { check, stepResult, tryRun, readText, exists, ROOT } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";

export function releaseNotes() {
  const checks = [];
  const appJson = JSON.parse(readText("app.json"));
  const version = appJson.expo?.version ?? "?";

  let changelog = "";
  const log = tryRun("git", ["log", "--oneline", "-30", "--no-decorate"]);
  const commits = log.ok ? log.out.trim().split("\n").filter(Boolean) : [];

  const migrationDir = path.join(ROOT, "supabase/migrations");
  const migrations = fs.existsSync(migrationDir)
    ? fs.readdirSync(migrationDir).filter((f) => f.endsWith(".sql")).slice(-5)
    : [];

  const knownIssues = [
    "ai_usage_events: service_role SELECT/INSERT may be missing (quota metadata WARNING)",
    "AI cost metadata in live validation may show n/a until ai_usage_events grants applied",
    "Market Intelligence still on legacy AI path (Phase 2)",
  ];

  const notes = {
    version,
    generatedAt: new Date().toISOString(),
    releaseNotes: [
      `YouTrader ${version} — TestFlight / Preview candidate`,
      "AI Platform V2 Phase 1 (ai-coach router) on preview staging",
      "Server-side Pro entitlement fix (user_subscriptions GRANT)",
    ],
    changelog: commits.slice(0, 15),
    knownIssues,
    migrationSummary: migrations,
  };

  fs.mkdirSync(path.join(ROOT, "scripts/release-command-center/reports"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "scripts/release-command-center/reports/release-notes.json"), JSON.stringify(notes, null, 2));

  checks.push(check("notes", "Release notes generated", "PASS", `v${version}`));
  checks.push(check("changelog", "Changelog (git log)", commits.length > 0 ? "PASS" : "WARNING", `${commits.length} commits`));
  checks.push(check("migrations_summary", "Migration summary", migrations.length > 0 ? "PASS" : "WARNING", migrations.join(", ") || "none"));

  return { step: stepResult("notes", "Step 6 — Release Notes", checks), notes };
}
