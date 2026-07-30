/**
 * Phase 6 QA — API hardening, a11y contracts, drift, visual-regression plumbing.
 * Run: npm run test:ui-infra-phase6
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
      if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
      walkTsFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function importPattern(pkg: string): RegExp {
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`from\\s+['"]${escaped}['"]|require\\(\\s*['"]${escaped}['"]\\s*\\)`);
}

const HEX = /#[0-9A-Fa-f]{3,8}\b/;

function main() {
  const contracts = read("src/ydl/components/contracts.ts");
  assert.match(contracts, /YDL_TOUCH_TARGET_MIN/);
  assert.match(contracts, /YDL_REDUCE_MOTION_MATRIX/);
  assert.match(contracts, /YdlSkeleton: \"static placeholder only\"/);

  const button = read("src/ydl/components/YdlButton.tsx");
  assert.match(button, /isDisabled = disabled \|\| loading/);
  assert.match(button, /haptic=\{isDisabled \? false : haptic\}/);
  assert.match(button, /iconOnly requires a non-empty label/);
  assert.match(button, /busy: loading/);
  assert.match(button, /Destructive action/);
  assert.match(button, /ydlMinTouchTargetStyle/);
  assert.match(button, /warning/); // destructive leading semantics
  assert.doesNotMatch(button, /from [\"']react-native-reanimated[\"']/);

  const card = read("src/ydl/components/YdlCard.tsx");
  assert.match(card, /interactive cards require accessibilityLabel/);
  assert.match(card, /wantsPress/);
  assert.match(card, /Selected/); // non-color selected cue
  assert.match(card, /accessibilityRole=\"button\"/);

  const chip = read("src/ydl/components/YdlChip.tsx");
  assert.match(chip, /accessibilityRole=\"text\"/); // static
  assert.match(chip, /accessibilityRole=\"button\"/);
  assert.match(chip, /success/); // selected glyph

  const list = read("src/ydl/components/YdlListItem.tsx");
  assert.match(list, /accessibilityHint/);
  assert.match(list, /accessibilityRole=\"summary\"/);
  assert.match(list, /decorative/);

  const action = read("src/ydl/components/YdlActionRow.tsx");
  assert.match(action, /Compatibility wrapper/);
  assert.match(action, /YdlListItem/);

  const empty = read("src/ydl/components/YdlEmptyState.tsx");
  assert.match(empty, /primaryActionLabel && onPrimaryAction/);
  assert.match(empty, /decorative/);

  const skeleton = read("src/ydl/components/YdlSkeleton.tsx");
  assert.match(skeleton, /AppState/);
  assert.match(skeleton, /allowAnim = animated && !reduceMotion/);
  assert.match(skeleton, /accessibilityElementsHidden/);
  assert.doesNotMatch(skeleton, /shimmer|LinearGradient/i);
  assert.doesNotMatch(skeleton, /from [\"']react-native-reanimated[\"']/);

  const banner = read("src/ydl/components/YdlBanner.tsx");
  assert.match(banner, /dismissAccessibilityLabel/);
  assert.match(banner, /YdlIconButton/);
  assert.match(banner, /YdlButton/);

  const sheet = read("src/components/stats/MetricExplanationSheet.tsx");
  assert.match(sheet, /metric-explanation-close/);
  assert.match(sheet, /YdlCard/);
  assert.match(sheet, /content\.value/);
  assert.doesNotMatch(sheet, /from [\"']react-native-reanimated[\"']/);
  assert.doesNotMatch(sheet, /from [\"']expo-haptics[\"']/);

  // Drift: no raw hex in YDL primitive implementation files
  const primitiveFiles = [
    "YdlText.tsx",
    "YdlButton.tsx",
    "YdlCard.tsx",
    "YdlBadge.tsx",
    "YdlChip.tsx",
    "YdlListItem.tsx",
    "YdlEmptyState.tsx",
    "YdlSkeleton.tsx",
    "YdlBanner.tsx",
    "YdlActionRow.tsx",
    "YdlSectionHeader.tsx",
    "contracts.ts",
  ];
  const hexHits: string[] = [];
  for (const name of primitiveFiles) {
    const rel = `src/ydl/components/${name}`;
    const src = read(rel);
    if (HEX.test(src)) hexHits.push(rel);
  }
  assert.equal(hexHits.length, 0, `Raw hex in YDL primitives:\n${hexHits.join("\n")}`);

  // Import boundaries
  const banned = [
    { pkg: "expo-symbols", allow: ["src/ydl/symbols/"] },
    { pkg: "@gorhom/bottom-sheet", allow: ["src/ydl/sheets/"] },
    { pkg: "lottie-react-native", allow: ["src/ydl/lottie/"] },
    { pkg: "expo-haptics", allow: ["src/ydl/haptics.ts"] },
    { pkg: "react-native-reanimated", allow: ["src/ydl/motion/"] },
  ];
  const files = walkTsFiles(path.join(root, "src"));
  const violations: string[] = [];
  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const src = fs.readFileSync(file, "utf8");
    for (const rule of banned) {
      if (!importPattern(rule.pkg).test(src)) continue;
      const allowed = rule.allow.some((p) => rel === p || rel.startsWith(p));
      if (!allowed) violations.push(`${rel} → ${rule.pkg}`);
    }
  }
  assert.equal(violations.length, 0, violations.join("\n"));

  // No duplicate generic Button/Card in migrated area
  assert.doesNotMatch(sheet, /function Button|export function Card/);

  // Visual regression plumbing
  const expectedShots = [
    "ydl_vr_dark_gallery",
    "ydl_vr_dark_buttons",
    "ydl_vr_dark_cards",
    "ydl_vr_dark_badges_chips",
    "ydl_vr_dark_list",
    "ydl_vr_dark_empty",
    "ydl_vr_dark_skeleton_static",
    "ydl_vr_dark_banners",
    "ydl_vr_dark_radar_fixture",
    "ydl_vr_light_gallery",
    "ydl_vr_light_buttons",
    "ydl_vr_light_radar_fixture",
    "ydl_vr_large_text_gallery",
    "ydl_vr_reduce_motion_skeleton",
  ];
  assert.equal(expectedShots.length, 14);
  const darkFlow = read(".maestro/ydl/visual_regression_dark.yaml");
  for (const id of expectedShots.filter((s) => s.includes("dark"))) {
    assert.match(darkFlow, new RegExp(id));
  }
  assert.ok(fs.existsSync(path.join(root, ".maestro/ydl/baselines/README.md")));
  assert.ok(fs.existsSync(path.join(root, ".rnstorybook/stories/Phase6VisualRegressionGallery.tsx")));
  assert.ok(fs.existsSync(path.join(root, "docs/YDL_ADOPTION_POLICY.md")));
  assert.match(read("index.js"), /Storybook swaps/);

  // Baseline PNGs optional until first capture — instruct clearly
  const baselineDir = path.join(root, ".maestro/ydl/baselines");
  const pngs = fs.existsSync(baselineDir)
    ? fs.readdirSync(baselineDir).filter((f) => f.endsWith(".png"))
    : [];
  const baselinesReady = pngs.length >= expectedShots.length;

  const pkg = require("../package.json");
  console.log("ui-infra-phase6-qa: PASS");
  console.log(
    JSON.stringify(
      {
        hexHits: hexHits.length,
        violations: violations.length,
        expectedScreenshots: expectedShots.length,
        committedBaselinePngs: pngs.length,
        baselinesReady,
        baselineNote: baselinesReady
          ? "PNG baselines present"
          : "PNG baselines not yet committed — run Storybook + Maestro capture (see scripts/ui-infra-phase6-visual-capture.md)",
        reanimated: pkg.dependencies["react-native-reanimated"],
      },
      null,
      2,
    ),
  );
}

main();
