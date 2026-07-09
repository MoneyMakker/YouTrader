import { check, stepResult, tryRun } from "../lib.mjs";

export async function previewBuild({ profile = "preview", dryRun = false, skipBuild = false }) {
  const checks = [];
  const blockers = [];
  let buildResult = { status: "skipped", profile, url: null, durationMs: 0, warnings: [], errors: [] };

  if (skipBuild || dryRun) {
    checks.push(check("build", "EAS build", "WARNING", dryRun ? "dry-run" : "skip-build flag"));
    return { step: stepResult("build", "Step 9 — Preview Build", checks, blockers), buildResult };
  }

  const started = Date.now();
  const args = ["build", "--profile", profile, "--platform", "ios", "--non-interactive", "--wait", "--json"];
  const r = tryRun("eas", args, { timeout: 3_600_000 });

  buildResult.durationMs = Date.now() - started;

  if (!r.ok) {
    buildResult.status = "failed";
    buildResult.errors.push(r.err?.slice(0, 500) || "EAS build failed");
    checks.push(check("build", "EAS build completed", "FAIL", buildResult.errors[0]));
    blockers.push(`EAS build failed (${profile})`);
    return { step: stepResult("build", "Step 9 — Preview Build", checks, blockers), buildResult };
  }

  try {
    const parsed = JSON.parse(r.out.trim().split("\n").pop() || "{}");
    buildResult.status = parsed.status === "FINISHED" ? "success" : parsed.status?.toLowerCase() || "unknown";
    buildResult.url = parsed.buildDetailsPageUrl || parsed.artifacts?.buildUrl || null;
    buildResult.id = parsed.id;
  } catch {
    buildResult.status = r.ok ? "success" : "unknown";
    buildResult.warnings.push("Could not parse EAS JSON output");
  }

  checks.push(check("build", "EAS build completed", buildResult.status === "success" ? "PASS" : "FAIL", `${profile} · ${Math.round(buildResult.durationMs / 1000)}s`));
  checks.push(check("build_url", "Build URL captured", buildResult.url ? "PASS" : "WARNING", buildResult.url || "see EAS dashboard"));

  if (buildResult.status !== "success") blockers.push("EAS build did not finish successfully");

  return { step: stepResult("build", "Step 9 — Preview Build", checks, blockers), buildResult };
}
