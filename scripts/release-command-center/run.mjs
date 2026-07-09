#!/usr/bin/env node
/**
 * YouTrader Release Command Center
 *
 * Commands:
 *   node scripts/release-command-center/run.mjs testflight
 *   node scripts/release-command-center/run.mjs production
 *   node scripts/release-command-center/run.mjs release 1.6.0
 *
 * Flags:
 *   --dry-run     Skip EAS build
 *   --skip-build  Skip EAS build (validation only)
 *
 * Never: push, merge, Production deploy, App Store submit.
 */
import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  REPORT_DIR,
  ensureReportDir,
  parseArgs,
  printStep,
  collectBlockers,
  sectionBlocked,
  loadSignoff,
} from "./lib.mjs";
import { gitValidation } from "./steps/git-validation.mjs";
import { productionReadinessGate } from "./steps/production-readiness.mjs";
import { aiPlatformValidation } from "./steps/ai-validation.mjs";
import { previewDeployReport } from "./steps/preview-deploy.mjs";
import { sqlPermissionAudit } from "./steps/sql-permissions.mjs";
import { releaseNotes } from "./steps/release-notes.mjs";
import { testFlightChecklist } from "./steps/testflight-checklist.mjs";
import { versionValidation } from "./steps/version-validation.mjs";
import { previewBuild } from "./steps/preview-build.mjs";
import { generateTestFlightDoc } from "./generate-report.mjs";

function requireProductionSignoffs() {
  const blockers = [];
  const testflight = loadSignoff("testflight-qa");
  const iphone = loadSignoff("iphone-qa");
  const aiQa = loadSignoff("ai-qa");

  if (!testflight?.passed) blockers.push("Missing docs/release-signoffs/testflight-qa.json with passed: true");
  if (!iphone?.passed) blockers.push("Missing docs/release-signoffs/iphone-qa.json with passed: true");
  if (!aiQa?.passed) blockers.push("Missing docs/release-signoffs/ai-qa.json with passed: true");

  const prepDoc = path.join(ROOT, "docs/TESTFLIGHT_PREPARATION.md");
  if (!fs.existsSync(prepDoc) || !fs.readFileSync(prepDoc, "utf8").includes("READY FOR TESTFLIGHT")) {
    blockers.push("TESTFLIGHT_PREPARATION.md must show READY FOR TESTFLIGHT");
  }

  return blockers;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  ensureReportDir();

  console.log("=".repeat(60));
  console.log("YouTrader Release Command Center");
  console.log("=".repeat(60));
  console.log(`Mode: ${args.mode}${args.version ? ` · target ${args.version}` : ""}`);
  console.log(`Dry run: ${args.dryRun} · Skip build: ${args.skipBuild}`);
  console.log("Never: Production deploy · App Store submit · git push · auto-merge\n");

  const steps = [];
  let blockers = [];

  if (args.mode === "production") {
    const signoffBlockers = requireProductionSignoffs();
    if (signoffBlockers.length) {
      console.log("\n❌ Prepare Production blocked — sign-offs required:\n");
      for (const b of signoffBlockers) console.log(`  - ${b}`);
      console.log("\nCreate JSON files in docs/release-signoffs/ after QA passes.");
      process.exit(1);
    }
  }

  // STEP 1
  const git = gitValidation();
  steps.push(git);
  printStep(git);
  if (sectionBlocked(git)) {
    blockers = collectBlockers(steps);
    return finish(args, steps, null, null, null, blockers);
  }

  // STEP 2
  const readiness = productionReadinessGate();
  steps.push(readiness);
  printStep(readiness);
  if (sectionBlocked(readiness)) {
    blockers = collectBlockers(steps);
    return finish(args, steps, null, null, null, blockers);
  }

  // STEP 3
  const ai = aiPlatformValidation();
  steps.push(ai);
  printStep(ai);
  if (sectionBlocked(ai)) {
    blockers = collectBlockers(steps);
    return finish(args, steps, null, null, null, blockers);
  }

  // STEP 4
  const preview = previewDeployReport();
  steps.push(preview);
  printStep(preview);
  if (sectionBlocked(preview)) {
    blockers = collectBlockers(steps);
    return finish(args, steps, null, null, null, blockers);
  }

  // STEP 5
  const db = sqlPermissionAudit();
  steps.push(db);
  printStep(db);
  if (sectionBlocked(db)) {
    blockers = collectBlockers(steps);
    return finish(args, steps, null, null, null, blockers);
  }

  // STEP 6
  const { step: notesStep, notes } = releaseNotes();
  steps.push(notesStep);
  printStep(notesStep);

  // STEP 7
  const { step: checklistStep, sections: checklistSections } = testFlightChecklist();
  steps.push(checklistStep);
  printStep(checklistStep);

  // STEP 8
  const version = versionValidation(args.version);
  steps.push(version);
  printStep(version);
  if (sectionBlocked(version)) {
    blockers = collectBlockers(steps);
    return finish(args, steps, notes, checklistSections, null, blockers);
  }

  // STEP 9
  const buildProfile = args.mode === "production" ? "production" : "preview";
  const { step: buildStep, buildResult } = await previewBuild({
    profile: buildProfile,
    dryRun: args.dryRun,
    skipBuild: args.skipBuild || args.mode === "production", // production prep: validate only unless explicit build
  });
  steps.push(buildStep);
  printStep(buildStep);
  if (sectionBlocked(buildStep)) {
    blockers = collectBlockers(steps);
    return finish(args, steps, notes, checklistSections, buildResult, blockers);
  }

  blockers = collectBlockers(steps);
  return finish(args, steps, notes, checklistSections, buildResult, blockers);
}

function finish(args, steps, notes, checklistSections, buildResult, blockers) {
  const criticalFails = blockers.length > 0;
  let finalStatus = "READY FOR TESTFLIGHT";
  if (args.mode === "production") finalStatus = criticalFails ? "BLOCKED" : "READY FOR PRODUCTION PREP";
  else if (criticalFails) finalStatus = "BLOCKED";

  const runReport = {
    generatedAt: new Date().toISOString(),
    mode: args.mode,
    targetVersion: args.version,
    finalStatus,
    blockers,
    steps: steps.map((s) => ({ id: s.id, title: s.title, status: s.status, fails: s.fails, warns: s.warns })),
    buildResult,
  };

  fs.writeFileSync(path.join(REPORT_DIR, "latest-run.json"), JSON.stringify(runReport, null, 2));

  const docPath = generateTestFlightDoc({
    mode: args.mode,
    steps,
    notes,
    checklistSections,
    buildResult,
    finalStatus,
    blockers,
  });

  console.log("\n" + "=".repeat(60));
  console.log(`FINAL STATUS: ${finalStatus}`);
  console.log("=".repeat(60));
  console.log(`Report: ${docPath}`);

  if (finalStatus.startsWith("READY")) {
    console.log("\nNext Steps:");
    if (args.mode === "production") {
      console.log("  1. CEO approve Production deploy");
      console.log("  2. Apply pending migrations (if any)");
      console.log("  3. eas build --profile production (explicit CEO GO)");
      console.log("  4. App Store submit (separate gate)");
    } else {
      console.log("  1. Install Preview Build");
      console.log("  2. Complete iPhone QA");
      console.log("  3. Review AI Health Dashboard");
      console.log("  4. Review Cost Dashboard");
      console.log("  5. Approve Production (CEO gate)");
    }
  } else {
    console.log("\nBlocking issues:");
    for (const b of blockers) console.log(`  - ${b}`);
  }

  process.exit(criticalFails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
