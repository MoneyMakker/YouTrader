/**
 * Phase 3 focused QA — static contracts for symbols, a11y, primitives, import boundaries.
 * Run: npm run test:ui-infra-phase3
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

/** Minimal mirror of resolveYdlSymbol unknown-path (keeps QA free of RN imports). */
function resolveUnknownSemantic(name: string, knownKeys: string[]): { semantic: string; known: boolean } {
  if (knownKeys.includes(name)) return { semantic: name, known: true };
  return { semantic: "info", known: false };
}

function importPattern(pkg: string): RegExp {
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`from\\s+['"]${escaped}['"]|require\\(\\s*['"]${escaped}['"]\\s*\\)`);
}

function main() {
  const mapSrc = read("src/ydl/symbols/symbol.map.ts");
  assert.match(mapSrc, /close:\s*\{\s*ios:\s*"xmark"/);
  assert.match(mapSrc, /FALLBACK_SEMANTIC:\s*YdlSemanticSymbol\s*=\s*"info"/);
  assert.match(mapSrc, /known:\s*false/);

  const semanticKeys = [
    "back",
    "close",
    "add",
    "edit",
    "delete",
    "search",
    "settings",
    "calendar",
    "chart",
    "journal",
    "trade",
    "profit",
    "loss",
    "warning",
    "success",
    "lock",
    "unlock",
    "share",
    "info",
    "notification",
    "chevronRight",
  ];
  for (const key of semanticKeys) {
    assert.match(mapSrc, new RegExp(`${key}:\\s*\\{`));
  }

  const unknown = resolveUnknownSemantic("totally-unknown-symbol-xyz", semanticKeys);
  assert.equal(unknown.known, false);
  assert.equal(unknown.semantic, "info");

  const symbolView = read("src/ydl/symbols/YdlSymbol.tsx");
  assert.match(symbolView, /decorative/);
  assert.match(symbolView, /accessibilityElementsHidden:\s*true/);
  assert.match(symbolView, /AndroidSymbolFallback/);
  assert.doesNotMatch(symbolView, /emoji|😀|✅/);

  const labels = read("src/ydl/accessibility/labels.ts");
  assert.match(labels, /accessibilityElementsHidden:\s*true/);
  assert.match(labels, /decorative/);

  const constants = read("src/ydl/accessibility/constants.ts");
  assert.match(constants, /YDL_MIN_TOUCH_TARGET\s*=\s*44/);

  const iconBtn = read("src/ydl/components/YdlIconButton.tsx");
  assert.match(iconBtn, /accessibilityRole=\"button\"/);
  assert.match(iconBtn, /ydlMinTouchTargetStyle/);
  assert.match(iconBtn, /if \(isDisabled\) return/);
  assert.doesNotMatch(iconBtn, /from [\"']expo-symbols[\"']/);
  assert.doesNotMatch(iconBtn, /from [\"']expo-haptics[\"']/);

  const actionRow = read("src/ydl/components/YdlActionRow.tsx");
  assert.doesNotMatch(actionRow, /height:\s*\d+/);
  assert.match(actionRow, /allowFontScaling/);
  assert.match(actionRow, /ydlCombinedAccessibilityLabel/);
  assert.match(actionRow, /if \(disabled\) return/);

  const metricSheet = read("src/components/stats/MetricExplanationSheet.tsx");
  assert.match(metricSheet, /useYdlReduceMotion/);
  assert.doesNotMatch(metricSheet, /from [\"']@gorhom\/bottom-sheet[\"']/);
  assert.doesNotMatch(metricSheet, /from [\"']lottie-react-native[\"']/);
  assert.doesNotMatch(metricSheet, /from [\"']expo-symbols[\"']/);
  assert.doesNotMatch(metricSheet, /from [\"']expo-haptics[\"']/);
  assert.match(metricSheet, /from [\"'].*ydl\/sheets/);
  assert.match(metricSheet, /from [\"'].*ydl\/components/);
  assert.match(metricSheet, /from [\"'].*ydl\/symbols/);

  const lottie = read("src/ydl/lottie/YdlLottie.tsx");
  assert.match(lottie, /reduceMotion|ReduceMotion|progress/);

  const banned = [
    { pkg: "expo-symbols", allow: ["src/ydl/symbols/"] },
    { pkg: "@gorhom/bottom-sheet", allow: ["src/ydl/sheets/"] },
    { pkg: "lottie-react-native", allow: ["src/ydl/lottie/"] },
    { pkg: "expo-haptics", allow: ["src/ydl/haptics.ts"] },
  ];

  const scanRoots = [
    path.join(root, "src"),
    path.join(root, "App.tsx"),
    path.join(root, "index.js"),
  ].filter((p) => fs.existsSync(p));

  const files: string[] = [];
  for (const r of scanRoots) {
    if (fs.statSync(r).isDirectory()) walkTsFiles(r, files);
    else files.push(r);
  }

  const violations: string[] = [];
  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const src = fs.readFileSync(file, "utf8");
    for (const rule of banned) {
      if (!importPattern(rule.pkg).test(src)) continue;
      const allowed = rule.allow.some((prefix) => rel === prefix || rel.startsWith(prefix));
      if (!allowed) violations.push(`${rel} imports ${rule.pkg}`);
    }
  }

  assert.equal(
    violations.length,
    0,
    `Direct-import boundary violations:\n${violations.join("\n")}`,
  );

  assert.equal(fs.existsSync(path.join(root, "src/ydl/stories")), false);
  assert.ok(fs.existsSync(path.join(root, ".rnstorybook/stories/Phase3SymbolsDemo.stories.tsx")));

  console.log("ui-infra-phase3-qa: PASS");
  console.log(
    JSON.stringify(
      {
        symbols: semanticKeys.length,
        unknownFallback: unknown.semantic,
        touchTarget: 44,
        violations: violations.length,
        expoSymbols: require("../package.json").dependencies["expo-symbols"],
      },
      null,
      2,
    ),
  );
}

main();
