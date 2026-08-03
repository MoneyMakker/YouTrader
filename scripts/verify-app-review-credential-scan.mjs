import { execFileSync } from "node:child_process";
import fs from "node:fs";

const unsafeTrackedPath = "docs/app-review-auth.md";
const templatePath = "docs/app-review-auth.template.md";
const localPath = "docs/app-review-auth.local.md";
const placeholders = new Set([
  "[Stored in approved secure credential manager]",
  "[Authorized release owner or team role]",
  "[YYYY-MM-DD]",
  "[Approved credential manager record name; no secret value]",
]);
const credentialLabels = [
  "Account email",
  "Email",
  "Username",
  "Login",
  "Password",
  "Passcode",
  "Token",
  "API key",
  "Recovery code",
];
const fieldValue = (text, label) =>
  text.match(new RegExp(`^${label}:\\s*([^\\n]+)$`, "m"))?.[1]?.trim();

const tracked = new Set(
  execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean),
);

const failures = [];
if (tracked.has(unsafeTrackedPath)) failures.push(`${unsafeTrackedPath}: unsafe operational document is tracked`);
if (!tracked.has(templatePath) && !fs.existsSync(templatePath)) failures.push(`${templatePath}: required safe template is missing`);
if (tracked.has(localPath)) failures.push(`${localPath}: local operational document must never be tracked`);

if (fs.existsSync(templatePath)) {
  const text = fs.readFileSync(templatePath, "utf8");
  for (const label of ["Account email", "Password", "Credential owner", "Last rotation", "Secure location"]) {
    const value = fieldValue(text, label);
    if (!value || !placeholders.has(value)) {
      failures.push(`${templatePath}: ${label} must contain an approved placeholder only`);
    }
  }
}

try {
  execFileSync("git", ["check-ignore", "-q", localPath]);
} catch {
  failures.push(`${localPath}: narrow ignore rule is required`);
}

for (const file of tracked) {
  if (!/^docs\/.*app-review-auth.*\.md$/i.test(file)) continue;
  if (file !== templatePath) {
    failures.push(`${file}: only the approved App Review authentication template may be tracked`);
    continue;
  }
  const text = fs.readFileSync(file, "utf8");
  for (const label of credentialLabels) {
    const value = fieldValue(text, label);
    if (value && !placeholders.has(value)) {
      failures.push(`${file}: non-placeholder ${label} field is prohibited`);
    }
  }
}

if (failures.length) {
  console.error("app-review credential guard: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("app-review credential guard: PASS");
