import tseslint from "typescript-eslint";

/**
 * Direct-import boundaries only (no recommended rules — scoped production scan).
 * Adapter directories are ignored so they may import their packages.
 */
export default tseslint.config({
  files: ["src/**/*.{ts,tsx}", "App.tsx", "index.js"],
  ignores: [
    "src/ydl/symbols/**",
    "src/ydl/sheets/**",
    "src/ydl/lottie/**",
    "src/ydl/haptics.ts",
    "**/node_modules/**",
    "**/dist/**",
  ],
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "expo-symbols",
            message:
              "Import symbols only via src/ydl/symbols (YdlSymbol / semantic names).",
          },
          {
            name: "@gorhom/bottom-sheet",
            message: "Import sheets only via src/ydl/sheets.",
          },
          {
            name: "lottie-react-native",
            message: "Import Lottie only via src/ydl/lottie.",
          },
          {
            name: "expo-haptics",
            message:
              "Import haptics only via src/ydl/haptics (or src/components/ui/haptics re-export).",
          },
        ],
      },
    ],
  },
});
