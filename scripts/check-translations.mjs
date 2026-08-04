import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const enPath = path.join(root, "src/i18n/locales/en.json");
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const enKeys = new Set(Object.keys(en));

function collectSourceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const sourceFiles = [
  path.join(root, "App.tsx"),
  ...collectSourceFiles(path.join(root, "src/app")),
  ...collectSourceFiles(path.join(root, "src/propPass")),
].filter((file) => fs.existsSync(file));

const usedKeys = new Set();
const usageRegex = /\bt\s*\(\s*["']([A-Za-z][A-Za-z0-9_.]*)["']/g;
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  let match;
  while ((match = usageRegex.exec(source))) usedKeys.add(match[1]);
}

const missingUsed = [...usedKeys].filter((key) => !enKeys.has(key));
if (missingUsed.length) {
  console.error("Keys used in code but missing from en.json:");
  for (const key of missingUsed.sort()) console.error(`- ${key}`);
  process.exit(1);
}

const langs = ["en", "ru", "es", "fr", "it", "uk", "de"];
for (const lang of langs) {
  const loc = JSON.parse(fs.readFileSync(path.join(root, "src/i18n/locales", `${lang}.json`), "utf8"));
  const missing = Object.keys(en).filter((k) => !loc[k]);
  if (missing.length) {
    console.error(`${lang}.json missing ${missing.length} keys from en.json`);
    process.exit(1);
  }
}

// i18next requires {{var}}; single {var} renders literally (physical Build 117 defect).
const singleBrace = /(?<!\{)\{([A-Za-z_][A-Za-z0-9_]*)\}(?!\})/g;
const badInterpolation = [];
for (const lang of langs) {
  const loc = JSON.parse(fs.readFileSync(path.join(root, "src/i18n/locales", `${lang}.json`), "utf8"));
  for (const [key, value] of Object.entries(loc)) {
    if (typeof value !== "string") continue;
    singleBrace.lastIndex = 0;
    if (singleBrace.test(value)) {
      badInterpolation.push(`${lang}:${key}`);
    }
  }
}
if (badInterpolation.length) {
  console.error("Locale strings with single-brace placeholders (must use {{var}}):");
  for (const entry of badInterpolation.sort()) console.error(`- ${entry}`);
  process.exit(1);
}

console.log(
  `Translation check passed: ${enKeys.size} en keys, ${usedKeys.size} used in App.tsx + src/app + src/propPass (${sourceFiles.length} files)`,
);
