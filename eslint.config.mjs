// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import globals from "globals";

export default defineConfig([
    // Global ignores
    {
        ignores: ["out/**", "node_modules/**", "**/*.js", "**/*.mjs"],
    },
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
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
            "@typescript-eslint/no-deprecated": "warn",
            "@typescript-eslint/no-non-null-assertion": "warn",
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
            "no-trailing-spaces": "warn"
        },
    },
    // src/ and tests/ - use src/tsconfig.json
    {
        files: ["src/**/*.ts", "tests/**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: "./src/tsconfig.json",
            },
            globals: globals.node,
        },
    },
    // webviews/ - browser environment, use webviews/tsconfig.json
    {
        files: ["webviews/**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: "./webviews/tsconfig.json",
            },
            globals: globals.browser,
        },
    },
    // Test-specific rule relaxations
    {
        files: ["tests/**/*.ts"],
        rules: {
            // We can allow some type trickery in tests, we will notice if they crash
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
]);
