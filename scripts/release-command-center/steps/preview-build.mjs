import { check, stepResult, tryRun } from "../lib.mjs";
import { analyzeEasBuildOutput, isEasBuildFailure, mergeEasOutput } from "../eas-build-output.mjs";

const STEP_ID = "build";
const STEP_TITLE = "Step 9 — Preview Build";

function attachEasOutput(buildResult, combined, analysis) {
  buildResult.rawOutput = combined;
  buildResult.stdout = buildResult.stdout || "";
  buildResult.stderr = buildResult.stderr || "";
  if (analysis.summary) buildResult.blockReason = analysis.summary;
  if (analysis.resetDate) buildResult.quotaResetDate = analysis.resetDate;
  if (analysis.resetInDays != null) buildResult.quotaResetInDays = analysis.resetInDays;
}

function failStep({ checks, blockers, buildResult, analysis, stepStatus = "FAIL" }) {
  const detail = analysis.summary || "EAS build failed";
  buildResult.errors.push(detail);

  if (analysis.quotaExhausted) {
    checks.push(check("quota", "EAS iOS build quota", "BLOCKED", detail));
    checks.push(check("build", "EAS build completed", "BLOCKED", detail));
    blockers.push("EAS iOS build quota exhausted.");
    if (analysis.resetDate) {
      blockers.push(`Quota resets on ${analysis.resetDate}`);
    }
    buildResult.status = "blocked";
    return {
      step: stepResult(STEP_ID, STEP_TITLE, checks, blockers, { status: "BLOCKED" }),
      buildResult,
    };
  }

  checks.push(check("build", "EAS build completed", "FAIL", detail));
  blockers.push(`EAS build failed (${buildResult.profile})`);
  buildResult.status = "failed";
  return {
    step: stepResult(STEP_ID, STEP_TITLE, checks, blockers, { status: stepStatus }),
    buildResult,
  };
}

export async function previewBuild({ profile = "preview", dryRun = false, skipBuild = false }) {
  const checks = [];
  const blockers = [];
  let buildResult = {
    status: "skipped",
    profile,
    url: null,
    durationMs: 0,
    warnings: [],
    errors: [],
    stdout: "",
    stderr: "",
    rawOutput: "",
  };

  if (skipBuild || dryRun) {
    checks.push(check("build", "EAS build", "WARNING", dryRun ? "dry-run" : "skip-build flag"));
    return { step: stepResult(STEP_ID, STEP_TITLE, checks, blockers), buildResult };
  }

  const started = Date.now();
  const args = ["build", "--profile", profile, "--platform", "ios", "--non-interactive", "--wait", "--json"];
  const r = tryRun("eas", args, { timeout: 3_600_000 });

  buildResult.durationMs = Date.now() - started;
  buildResult.stdout = r.out || "";
  buildResult.stderr = r.err || "";

  const combined = mergeEasOutput(r.out, r.err);
  const analysis = analyzeEasBuildOutput(combined);
  attachEasOutput(buildResult, combined, analysis);

  if (!r.ok || isEasBuildFailure(combined, r.ok)) {
    return failStep({ checks, blockers, buildResult, analysis });
  }

  try {
    const parsed = JSON.parse(r.out.trim().split("\n").pop() || "{}");
    buildResult.status = parsed.status === "FINISHED" ? "success" : parsed.status?.toLowerCase() || "unknown";
    buildResult.url = parsed.buildDetailsPageUrl || parsed.artifacts?.buildUrl || null;
    buildResult.id = parsed.id;
  } catch {
    if (isEasBuildFailure(combined, true)) {
      return failStep({ checks, blockers, buildResult, analysis });
    }
    buildResult.status = "unknown";
    buildResult.warnings.push("Could not parse EAS JSON output");
  }

  if (buildResult.status !== "success") {
    const failureAnalysis = analyzeEasBuildOutput(combined);
    attachEasOutput(buildResult, combined, failureAnalysis);
    return failStep({ checks, blockers, buildResult, analysis: failureAnalysis });
  }

  checks.push(
    check(
      "build",
      "EAS build completed",
      "PASS",
      `${profile} · ${Math.round(buildResult.durationMs / 1000)}s`,
    ),
  );
  checks.push(
    check("build_url", "Build URL captured", buildResult.url ? "PASS" : "WARNING", buildResult.url || "see EAS dashboard"),
  );

  return { step: stepResult(STEP_ID, STEP_TITLE, checks, blockers), buildResult };
}
