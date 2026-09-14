// Minimal flat ESLint config — CI's lint step (CONTRACT.md §7.5) needs
// something to run, so this is intentionally lightweight: parse every file
// as TypeScript and catch real mistakes (unresolved references, unreachable
// code, accidental console debugging left behind) without imposing a full
// style guide across an existing codebase.
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "uploads/**", "uploads-test/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  }
);
