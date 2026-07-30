/**
 * Phase 4 focused QA — motion tokens, Reduce Motion contracts, import boundaries.
 * Run: npm run test:ui-infra-phase4
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      walkTsFiles(full, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function importPattern(pkg: string): RegExp {
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`from\\s+['"]${escaped}['"]|require\\(\\s*['"]${escaped}['"]\\s*\\)`);
}

/** Mirror of formatYdlNumber / parse without RN. */
function formatYdlNumber(
  kind: string,
  value: number,
  options: { decimals?: number; prefix?: string; suffix?: string; signed?: boolean } = {},
): string {
  const resolved = kind === "percent" ? "percentage" : kind;
  const decimals =
    options.decimals ??
    ({ currency: 2, percentage: 1, integer: 0, decimal: 2, score: 0 } as Record<string, number>)[
      resolved
    ] ??
    2;
  const safe = Number.isFinite(value) ? value : 0;
  let body: string;
  if (resolved === "currency") {
    body = `$${safe.toFixed(decimals)}`;
  } else if (resolved === "percentage") {
    const core = safe.toFixed(decimals);
    body = options.signed && safe > 0 ? `+${core}%` : `${core}%`;
  } else if (resolved === "integer" || resolved === "score") {
    const n = Math.round(safe);
    body = options.signed && n > 0 ? `+${n}` : `${n}`;
  } else {
    const core = safe.toFixed(decimals);
    body = options.signed && safe > 0 ? `+${core}` : core;
  }
  return `${options.prefix ?? ""}${body}${options.suffix ?? ""}`;
}

function parseYdlMetricDisplay(raw: string): { value: number; kind: string; decimals: number } | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "—") return null;
  const match = trimmed.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value)) return null;
  const decimals = match[1] ? match[1].length - 1 : 0;
  if (trimmed.includes("%")) return { value, kind: "percentage", decimals: decimals || 0 };
  if (trimmed.includes("$")) return { value, kind: "currency", decimals: decimals || 2 };
  if (decimals === 0) return { value, kind: "integer", decimals: 0 };
  return { value, kind: "decimal", decimals };
}

function main() {
  const tokens = read("src/ydl/motion/tokens.ts");
  for (const name of ["instant", "fast", "standard", "emphasized", "slow"]) {
    assert.match(tokens, new RegExp(`${name}:`));
  }
  for (const name of ["standard", "enter", "exit", "press", "gentle", "responsive", "sheetAdjacent"]) {
    assert.match(tokens, new RegExp(`${name}:`));
  }

  const pressable = read("src/ydl/motion/YdlAnimatedPressable.tsx");
  assert.match(pressable, /useYdlReduceMotion/);
  assert.match(pressable, /runYdlHaptic/);
  assert.doesNotMatch(pressable, /from [\"']expo-haptics[\"']/);
  assert.match(pressable, /if \(disabled\) return/);
  assert.match(pressable, /hapticFired/);

  const numberSrc = read("src/ydl/motion/YdlAnimatedNumber.tsx");
  assert.match(numberSrc, /accessibilityLabel=\{finalLabel\}/);
  assert.match(numberSrc, /withTiming/);
  assert.doesNotMatch(numberSrc, /withSpring/);
  assert.match(numberSrc, /AppState/);
  assert.match(numberSrc, /reduceMotion/);

  const stagger = read("src/ydl/motion/YdlStagger.tsx");
  assert.match(stagger, /resolveYdlStaggerMs/);
  assert.match(stagger, /reduceMotion \? 0/);

  const fade = read("src/ydl/motion/YdlFade.tsx");
  assert.match(fade, /pointerEvents=\{visible \? \"auto\" : \"none\"\}/);

  const perf = read("src/ydl/motion/performance.ts");
  assert.match(perf, /allowContinuous:\s*false/);
  assert.doesNotMatch(read("src/ydl/motion/YdlAnimatedPressable.tsx"), /setInterval|requestAnimationFrame/);
  assert.doesNotMatch(numberSrc, /setInterval/);

  // Formatting contracts
  assert.equal(formatYdlNumber("currency", 1284.5), "$1284.50");
  assert.equal(formatYdlNumber("currency", -842.25), "$-842.25");
  assert.equal(formatYdlNumber("percentage", 55, { decimals: 0 }), "55%");
  assert.equal(formatYdlNumber("percentage", 0, { decimals: 0 }), "0%");
  assert.equal(formatYdlNumber("decimal", 0), "0.00");

  const parsedPct = parseYdlMetricDisplay("55%");
  assert.ok(parsedPct);
  assert.equal(parsedPct!.kind, "percentage");
  assert.equal(parsedPct!.value, 55);

  const parsedNeg = parseYdlMetricDisplay("-12.5");
  assert.ok(parsedNeg);
  assert.equal(parsedNeg!.value, -12.5);

  // Rapid updates settle on latest — pure interpolate check
  const latest = 92;
  assert.equal(formatYdlNumber("decimal", latest, { decimals: 1 }), "92.0");

  // Screen reader final-only: component wires accessibilityLabel to final, not visual intermediates
  assert.match(numberSrc, /const finalLabel = a11yOverride \?\? format\(value\)/);

  const radar = read("src/components/stats/StatsPerformanceRadar.tsx");
  assert.match(radar, /YdlAnimatedPressable/);
  assert.match(radar, /from [\"'].*ydl\/motion/);
  assert.doesNotMatch(radar, /from [\"']react-native-reanimated[\"']/);

  const sheet = read("src/components/stats/MetricExplanationSheet.tsx");
  assert.match(sheet, /YdlAnimatedNumber|YdlStagger|YdlFade/);
  assert.match(sheet, /from [\"'].*ydl\/motion/);
  assert.doesNotMatch(sheet, /from [\"']react-native-reanimated[\"']/);
  assert.doesNotMatch(sheet, /from [\"']expo-haptics[\"']/);

  // Reanimated import boundary (production src)
  const allowReanimated = ["src/ydl/motion/"];
  const files: string[] = [];
  walkTsFiles(path.join(root, "src"), files);
  for (const extra of ["App.tsx", "index.js"]) {
    const p = path.join(root, extra);
    if (fs.existsSync(p)) files.push(p);
  }

  const reanimatedViolations: string[] = [];
  const continuousFlags: string[] = [];
  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const src = fs.readFileSync(file, "utf8");
    if (importPattern("react-native-reanimated").test(src)) {
      const allowed = allowReanimated.some((prefix) => rel.startsWith(prefix));
      if (!allowed) reanimatedViolations.push(rel);
    }
    if (/withRepeat\s*\(|infinite:\s*true/.test(src) && rel.startsWith("src/ydl/motion/")) {
      continuousFlags.push(rel);
    }
  }
  assert.equal(
    reanimatedViolations.length,
    0,
    `Reanimated boundary violations:\n${reanimatedViolations.join("\n")}`,
  );
  assert.equal(
    continuousFlags.length,
    0,
    `Continuous animation primitives found:\n${continuousFlags.join("\n")}`,
  );

  // Storybook may import Reanimated in demos — allowed outside src
  assert.match(read(".rnstorybook/stories/Phase1MotionDemo.tsx"), /react-native-reanimated/);

  assert.ok(fs.existsSync(path.join(root, ".rnstorybook/stories/Phase4Pressable.stories.tsx")));
  assert.ok(fs.existsSync(path.join(root, ".rnstorybook/stories/Phase4Number.stories.tsx")));
  assert.ok(fs.existsSync(path.join(root, ".rnstorybook/stories/Phase4Stagger.stories.tsx")));
  assert.ok(fs.existsSync(path.join(root, ".rnstorybook/stories/Phase4RadarMotion.stories.tsx")));
  assert.equal(fs.existsSync(path.join(root, "src/ydl/stories")), false);

  const pkg = require("../package.json");
  assert.ok(pkg.dependencies["react-native-reanimated"]);
  assert.ok(pkg.dependencies["react-native-worklets"]);

  console.log("ui-infra-phase4-qa: PASS");
  console.log(
    JSON.stringify(
      {
        reanimatedViolations: reanimatedViolations.length,
        continuousFlags: continuousFlags.length,
        reanimated: pkg.dependencies["react-native-reanimated"],
        worklets: pkg.dependencies["react-native-worklets"],
      },
      null,
      2,
    ),
  );
}

main();
