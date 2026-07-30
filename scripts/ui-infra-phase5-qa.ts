/**
 * Phase 5 focused QA — tokens, theme, primitives contracts, import boundaries.
 * Run: npm run test:ui-infra-phase5
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

function main() {
  const darkTheme = read("src/ydl/tokens/theme.dark.ts");
  const lightTheme = read("src/ydl/tokens/theme.light.ts");
  assert.match(darkTheme, /appearance: \"dark\"/);
  assert.match(lightTheme, /appearance: \"light\"/);
  assert.match(read("src/ydl/tokens/color.semantic.ts"), /text\.primary/);
  assert.match(read("src/ydl/tokens/color.semantic.ts"), /known: false/);
  assert.match(read("src/ydl/tokens/color.semantic.ts"), /falling back to text\.primary/);

  const typo = read("src/ydl/tokens/typography.tokens.ts");
  for (const role of [
    "display",
    "titleLarge",
    "title",
    "heading",
    "body",
    "bodyEmphasized",
    "callout",
    "label",
    "labelEmphasized",
    "caption",
    "numericLarge",
    "numeric",
    "numericCompact",
  ]) {
    assert.match(typo, new RegExp(`${role}:`));
  }
  assert.match(typo, /tabular-nums/);
  assert.match(typo, /Unknown typography role/);

  const space = read("src/ydl/tokens/spacing.tokens.ts");
  assert.match(space, /16:\s*16/);
  assert.match(space, /screenHorizontal/);

  const radius = read("src/ydl/tokens/radius.tokens.ts");
  assert.match(radius, /card:\s*24/);
  assert.match(radius, /pill:\s*9999/);

  const button = read("src/ydl/components/YdlButton.tsx");
  assert.match(button, /isDisabled = disabled \|\| loading/);
  assert.match(button, /if \(isDisabled/);
  assert.match(button, /iconOnly requires a non-empty label/);
  assert.match(button, /YdlAnimatedPressable/);
  assert.doesNotMatch(button, /from [\"']react-native-reanimated[\"']/);
  assert.doesNotMatch(button, /from [\"']expo-haptics[\"']/);
  assert.match(button, /minTouchTarget/);
  assert.match(button, /Destructive action/);

  const badge = read("src/ydl/components/YdlBadge.tsx");
  assert.match(badge, /accessibilityLabel=\{a11y\}/);
  assert.match(badge, /\$\{tone\}: \$\{label\}/);

  const chip = read("src/ydl/components/YdlChip.tsx");
  assert.match(chip, /accessibilityState=\{\{ disabled, selected \}\}/);

  const list = read("src/ydl/components/YdlListItem.tsx");
  assert.match(list, /subtitle/);
  assert.doesNotMatch(list, /height:\s*\d+/);

  const empty = read("src/ydl/components/YdlEmptyState.tsx");
  assert.match(empty, /accessibilityRole=\"summary\"/);

  const skeleton = read("src/ydl/components/YdlSkeleton.tsx");
  assert.match(skeleton, /useYdlReduceMotion/);
  assert.match(skeleton, /allowAnim = animated && !reduceMotion/);
  assert.doesNotMatch(skeleton, /from [\"']react-native-reanimated[\"']/);
  assert.match(skeleton, /accessibilityElementsHidden/);

  const banner = read("src/ydl/components/YdlBanner.tsx");
  assert.match(banner, /dismissAccessibilityLabel/);
  assert.match(banner, /onDismiss requires dismissAccessibilityLabel/);

  const actionRow = read("src/ydl/components/YdlActionRow.tsx");
  assert.match(actionRow, /YdlListItem/);
  assert.match(actionRow, /Compatibility wrapper/);

  const sheet = read("src/components/stats/MetricExplanationSheet.tsx");
  assert.match(sheet, /YdlCard/);
  assert.match(sheet, /YdlBadge/);
  assert.match(sheet, /from [\"'].*ydl\/tokens/);
  assert.match(sheet, /from [\"'].*ydl\/components/);
  assert.doesNotMatch(sheet, /from [\"']react-native-reanimated[\"']/);
  assert.doesNotMatch(sheet, /from [\"']expo-haptics[\"']/);
  assert.doesNotMatch(sheet, /from [\"']expo-symbols[\"']/);
  assert.doesNotMatch(sheet, /from [\"']@gorhom\/bottom-sheet[\"']/);
  assert.doesNotMatch(sheet, /from [\"']lottie-react-native[\"']/);
  assert.match(sheet, /content\.value/);
  assert.match(sheet, /content\.explanation/);
  assert.match(sheet, /content\.target/);

  const banned = [
    { pkg: "expo-symbols", allow: ["src/ydl/symbols/"] },
    { pkg: "@gorhom/bottom-sheet", allow: ["src/ydl/sheets/"] },
    { pkg: "lottie-react-native", allow: ["src/ydl/lottie/"] },
    { pkg: "expo-haptics", allow: ["src/ydl/haptics.ts"] },
    { pkg: "react-native-reanimated", allow: ["src/ydl/motion/"] },
  ];

  const files: string[] = [];
  walkTsFiles(path.join(root, "src"), files);
  for (const extra of ["App.tsx", "index.js"]) {
    const p = path.join(root, extra);
    if (fs.existsSync(p)) files.push(p);
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
  assert.equal(violations.length, 0, `Boundary violations:\n${violations.join("\n")}`);

  assert.ok(fs.existsSync(path.join(root, ".rnstorybook/stories/Phase5Text.stories.tsx")));
  assert.ok(fs.existsSync(path.join(root, ".rnstorybook/stories/Phase5Button.stories.tsx")));

  // Provider decision documented in theme.ts
  assert.match(read("src/ydl/tokens/theme.ts"), /not required/i);

  const pkg = require("../package.json");
  console.log("ui-infra-phase5-qa: PASS");
  console.log(
    JSON.stringify(
      {
        typographyRoles: 13,
        violations: violations.length,
        reanimated: pkg.dependencies["react-native-reanimated"],
      },
      null,
      2,
    ),
  );
}

main();
