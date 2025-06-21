module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"], // Consider if tsconfig.dev.json is needed/present
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Skip built files for old structure if any.
    "/dist/**/*", // Skip built files.
    "/node_modules/**/*", // Skip node_modules
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0, // Can be problematic with path aliases or monorepos if not configured well
    "indent": ["error", 2],
    "object-curly-spacing": ["error", "always"],
    "max-len": ["warn", { "code": 120 }],
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn" // Warn for 'any' types
  },
};
