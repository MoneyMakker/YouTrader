#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredLocales = ["en", "ru", "es", "fr", "de", "it", "uk"];

function run(name, command, args) {
  console.log(`\n[release:stability] ${name}`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: false });
  if (result.status !== 0) {
    throw new Error(`${name} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkVersionFiles() {
  const pkg = JSON.parse(read("package.json"));
  assert(typeof pkg.version === "string" && pkg.version.length > 0, "package.json version is missing");

  const appJson = JSON.parse(read("app.json"));
  const expo = appJson.expo || {};
  assert(expo.version, "app.json expo.version is missing");
  assert(expo.ios?.buildNumber, "app.json expo.ios.buildNumber is missing");
  const expectedVersion = pkg.version;
  const expectedBuild = String(expo.ios.buildNumber);
  assert(expo.version === expectedVersion, `app.json expo.version must match package.json (${expectedVersion}), found ${expo.version}`);

  const plist = read("ios/YouTrader/Info.plist");
  assert(new RegExp(`<key>CFBundleShortVersionString</key>\\s*<string>${expectedVersion}</string>`).test(plist), `Info.plist CFBundleShortVersionString must be ${expectedVersion}`);
  assert(new RegExp(`<key>CFBundleVersion</key>\\s*<string>${expectedBuild}</string>`).test(plist), `Info.plist CFBundleVersion must be ${expectedBuild}`);

  const pbxproj = read("ios/YouTrader.xcodeproj/project.pbxproj");
  assert(new RegExp(`MARKETING_VERSION = ${expectedVersion};`).test(pbxproj), `Xcode MARKETING_VERSION must be ${expectedVersion}`);
  assert(new RegExp(`CURRENT_PROJECT_VERSION = ${expectedBuild};`).test(pbxproj), `Xcode CURRENT_PROJECT_VERSION must be ${expectedBuild}`);

  console.log(`[release:stability] version ${expo.version} (${expo.ios.buildNumber})`);
}

function checkLocales() {
  for (const locale of requiredLocales) {
    const file = `src/i18n/locales/${locale}.json`;
    assert(fs.existsSync(path.join(root, file)), `Missing locale file: ${file}`);
  }
  console.log(`[release:stability] locale files present: ${requiredLocales.join(", ")}`);
}

function gitFiles(patterns) {
  const result = spawnSync("git", ["ls-files", ...patterns], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error("git ls-files failed");
  return result.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
}

function checkNoCommittedEnvSecrets() {
  const files = gitFiles([".env", ".env.*", "scripts/**/.env", "scripts/**/.env.*", "review-fix-backups/**/.env", "review-fix-backups/**/.env.*"]);
  const forbidden = files.filter((file) => !file.endsWith(".example"));
  assert(forbidden.length === 0, `Committed env secret files found: ${forbidden.join(", ")}`);
  console.log("[release:stability] no committed .env secret files");
}

function checkConsoleSecretPatterns() {
  const files = gitFiles(["App.tsx", "src/**/*", "scripts/**/*"]).filter((file) => /\.(ts|tsx|js|mjs)$/.test(file));
  const secretPattern = /console\.(log|warn|error|info)\([^)]*(secret|token|password|api[_-]?key|service[_-]?role)/i;
  const hits = [];
  for (const file of files) {
    const text = read(file);
    if (secretPattern.test(text)) hits.push(file);
  }
  assert(hits.length === 0, `Potential console secret logging patterns found: ${hits.join(", ")}`);
  console.log("[release:stability] no obvious console secret logging patterns");
}

function checkExpoCompatibilityStatic() {
  const pkg = JSON.parse(read("package.json"));
  assert(pkg.dependencies?.expo, "expo dependency is missing");
  assert(pkg.dependencies?.["react-native"], "react-native dependency is missing");
  console.log(`[release:stability] Expo dependency ${pkg.dependencies.expo}, React Native ${pkg.dependencies["react-native"]}`);
}

try {
  checkVersionFiles();
  checkLocales();
  checkNoCommittedEnvSecrets();
  checkConsoleSecretPatterns();
  checkExpoCompatibilityStatic();
  run("typecheck", "npm", ["run", "typecheck"]);
  run("translations", "npm", ["run", "translations:check"]);
  run("expo ios export", "npx", ["expo", "export", "--platform", "ios"]);
  console.log("\n[release:stability] passed");
} catch (error) {
  console.error(`\n[release:stability] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
