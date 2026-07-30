import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Minimal ESLint foundation for Phase 1 UI infrastructure only.
 * Does not lint the rest of the repository.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      ".rnstorybook/**/*.{js,ts,tsx}",
      "src/ydl/haptics.ts",
      "src/components/ui/haptics.ts",
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
