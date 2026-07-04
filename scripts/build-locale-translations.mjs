#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const localesDir = path.join(root, "src/i18n/locales");
const en = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8"));

function loadOverrides(name) {
  const p = path.join(root, "scripts/translations", `${name}.json`);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

for (const lang of ["es", "fr", "it", "uk", "de"]) {
  const overrides = loadOverrides(lang);
  const merged = { ...en, ...overrides };
  const sorted = Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
  fs.writeFileSync(path.join(localesDir, `${lang}.json`), `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`${lang}.json — ${Object.keys(overrides).length} overrides`);
}

if (fs.existsSync(path.join(root, "scripts/restore-ru-locale.mjs"))) {
  console.log("Run scripts/restore-ru-locale.mjs separately for ru.json");
}
