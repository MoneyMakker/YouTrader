import { execFileSync } from "node:child_process";
import fs from "node:fs";

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((file) => !file.endsWith(".env.example"));

const allowListedReferences = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "NVIDIA_API_KEY",
  "service_role",
];

const secretPatterns = [
  { name: "Supabase secret key", pattern: /sb_secret_[A-Za-z0-9_\-.]{20,}/g },
  { name: "OpenAI-style secret", pattern: /sk-[A-Za-z0-9_-]{32,}/g },
  { name: "Private key block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "Hard-coded service role JWT", pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]*service_role[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]+/g },
  { name: "Assigned private API key", pattern: /(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|NVIDIA_API_KEY|SUPABASE_SERVICE_ROLE_KEY|REVENUECAT_SECRET_KEY)\s*[:=]\s*["'][^"']{12,}["']/g },
];

const problems = [];
for (const file of files) {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const { name, pattern } of secretPatterns) {
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      if (allowListedReferences.includes(match)) continue;
      problems.push(`${file}: ${name}`);
    }
  }
}

if (problems.length) {
  console.error("security:check failed. Potential secrets found:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log("security:check passed: no tracked secret patterns found.");
