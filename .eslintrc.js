const config = {
  root: true,
  parser: "@typescript-eslint/parser",
  overrides: [
    {
      files: ["*.ts"],
      parserOptions: {
        project: ["./src/tsconfig.json"],
        tsconfigRootDir: __dirname,
      }
    }
  ],
  plugins: [
    "@typescript-eslint",
    "deprecation"
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  env: {
    node: true
  },
  ignorePatterns: [".eslintrc.js"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_"}], // Same as in tsconfig. Allow such vars if they start with an underscore.
    "require-await": "error",                                   // Helps catch missing awaits
    "strict": "error",                                          // Disallows use of e.g. reserved keywords
    "prefer-promise-reject-errors": "error",                    // Throwing real Errors helps traceability
    "@typescript-eslint/no-namespace": "off",
    "@typescript-eslint/prefer-readonly": "error",
    "@typescript-eslint/consistent-type-definitions": "error",  // Prefer 'interface' over 'type'
    "no-empty": "off",                                          // Empty catch blocks can be useful
    "no-inner-declarations": "off",                             // Seems to break when using TS namespaces
    "eqeqeq": "error",                                          // == can be obscure/unintuitive, so use ===
    "deprecation/deprecation": "warn",
    // CODE FORMATTING =================
    "semi": "warn",
    "camelcase": "warn",
    "indent": ["warn", 4, { SwitchCase: 1 }],
    "space-before-blocks": "warn",
    "keyword-spacing": "warn",
    "space-before-function-paren": ["warn", "never"],
    "dot-location": "warn",
    "quotes": ["warn", "double", {"allowTemplateLiterals": true}],   // Disallows single quote strings
    "comma-spacing": "warn",
    "brace-style": "warn",
    "@typescript-eslint/type-annotation-spacing": "warn",
    "no-trailing-spaces": "warn"
  }
}
module.exports = config;