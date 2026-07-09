import fs from "node:fs";
import path from "node:path";
import { ROOT, check, stepResult, tryRun, run } from "../lib.mjs";

export function gitValidation() {
  const checks = [];
  const blockers = [];

  const branch = tryRun("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  checks.push(check("branch", "Current branch", branch.ok ? "PASS" : "FAIL", branch.out?.trim()));

  const status = tryRun("git", ["status", "--porcelain"]);
  const dirty = status.ok ? status.out.trim().split("\n").filter(Boolean) : [];
  checks.push(
    check(
      "clean_tree",
      "Clean working tree",
      dirty.length === 0 ? "PASS" : "FAIL",
      dirty.length ? `${dirty.length} uncommitted change(s)` : "clean",
    ),
  );

  const untracked = dirty.filter((l) => l.startsWith("??"));
  if (untracked.length) blockers.push(`Untracked files: ${untracked.slice(0, 5).join(", ")}${untracked.length > 5 ? "…" : ""}`);

  const diffCheck = tryRun("git", ["diff", "--check"]);
  checks.push(check("diff_check", "No merge conflict markers", diffCheck.ok ? "PASS" : "FAIL", diffCheck.ok ? "" : "conflict markers in diff"));

  const worktreeDir = path.join(ROOT, ".worktrees");
  let worktrees = [];
  if (fs.existsSync(worktreeDir)) {
    worktrees = fs.readdirSync(worktreeDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  }
  checks.push(
    check(
      "worktrees",
      "Agent worktrees reviewed",
      worktrees.length === 0 ? "PASS" : "WARNING",
      worktrees.length ? `${worktrees.length} worktree(s): ${worktrees.slice(0, 3).join(", ")}` : "none",
    ),
  );

  const migrationDir = path.join(ROOT, "supabase/migrations");
  const localMigrations = fs.existsSync(migrationDir)
    ? fs.readdirSync(migrationDir).filter((f) => f.endsWith(".sql")).sort()
    : [];

  let pendingMigrations = [];
  try {
    const listOut = run("supabase", ["migration", "list", "--linked"]);
    const applied = new Set();
    for (const line of listOut.split("\n")) {
      const m = line.match(/(\d{14,}[^\s|]*)/);
      if (m) applied.add(m[1].slice(0, 14));
    }
    pendingMigrations = localMigrations.filter((f) => {
      const ts = f.slice(0, 14);
      return !applied.has(ts);
    });
  } catch {
    pendingMigrations = localMigrations;
  }

  checks.push(
    check(
      "migrations",
      "Pending migrations (local vs linked DB)",
      pendingMigrations.length === 0 ? "PASS" : "WARNING",
      pendingMigrations.length ? pendingMigrations.join(", ") : "all applied or in sync",
    ),
  );

  if (dirty.length > 0) blockers.push("Commit or stash uncommitted changes before release prep");

  return stepResult("git", "Step 1 — Git Validation", checks, blockers);
}
