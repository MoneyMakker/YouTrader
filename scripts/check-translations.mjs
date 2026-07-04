import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "App.tsx");
const enPath = path.join(root, "src/i18n/locales/en.json");
const source = fs.readFileSync(appPath, "utf8");
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const enKeys = new Set(Object.keys(en));

const usedKeys = new Set();
const usageRegex = /\bt\s*\(\s*["']([A-Za-z][A-Za-z0-9_.]*)["']/g;
let match;
while ((match = usageRegex.exec(source))) usedKeys.add(match[1]);

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

console.log(`Translation check passed: ${enKeys.size} en keys, ${usedKeys.size} used in App.tsx`);
