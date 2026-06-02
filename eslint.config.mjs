// ESLint flat config for the Express + Drizzle backend.
// Frontend has its own config at client/eslint.config.mjs because the React
// rules and the JSX/DOM globals only make sense there.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "public/**",
      "client/**",
      "drizzle/**",
      "node_modules/**",
      "artifacts/**",
      "build.mjs",
      "*.config.{js,mjs,cjs,ts}",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        NodeJS: "readonly",
      },
    },
    rules: {
      // Unused vars: allow `_`-prefixed (common pattern for ignored args).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // The codebase uses `any` deliberately in a few places (e.g. drizzle row
      // shapes); keep this as a warning rather than a hard error so CI doesn't
      // block on cleanup work that's unrelated to a given PR.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
];
