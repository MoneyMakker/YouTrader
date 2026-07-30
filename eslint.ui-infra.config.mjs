import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Minimal ESLint foundation for UI infrastructure adapters + demos.
 * Production-wide third-party UI import bans live in eslint.ui-infra-imports.config.mjs.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      ".rnstorybook/**/*.{js,ts,tsx}",
      "src/ydl/haptics.ts",
      "src/ydl/sheets/**/*.{ts,tsx}",
      "src/ydl/lottie/**/*.{ts,tsx}",
      "src/ydl/symbols/**/*.{ts,tsx}",
      "src/ydl/accessibility/**/*.{ts,tsx}",
      "src/ydl/components/**/*.{ts,tsx}",
      "src/ydl/motion/**/*.{ts,tsx}",
      "src/ydl/tokens/**/*.{ts,tsx}",
      "src/components/ui/haptics.ts",
      "src/components/stats/MetricExplanationSheet.tsx",
      "src/components/stats/StatsPerformanceRadar.tsx",
      "index.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: [
      "**/.rnstorybook/storybook.requires.ts",
      "**/node_modules/**",
      "**/dist/**",
    ],
  },
);
