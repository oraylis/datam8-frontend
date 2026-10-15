import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/release/**",
      "**/test-results/**",
      "**/artifacts/**",
      "**/.git/**",
      "**/*.d.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
      // DataM8 edits schema-flexible solution JSON. Enforcing this globally creates
      // low-signal noise in editor payload code; boundary code should still prefer
      // unknown plus local guards where practical.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
