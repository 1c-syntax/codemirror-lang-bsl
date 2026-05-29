// ESLint flat config. Targets TypeScript sources (src/, examples/, test/);
// generated outputs (dist/, docs/) and node_modules are out of scope.
//
// No Prettier — formatting decisions stay with the author.

import js from "@eslint/js"
import tseslint from "typescript-eslint"
import globals from "globals"

export default tseslint.config(
  // Files / directories ESLint should never look at.
  {
    ignores: [
      "dist/",
      "docs/",
      "node_modules/",
      "src/bsl.grammar.js",
      "src/sdbl.grammar.js"
    ]
  },

  // Base JS recommendations.
  js.configs.recommended,

  // Type-checked TS recommendations for src/ — gives us full type information
  // at lint time (e.g. catches no-floating-promises against the SDBL parser
  // wrapper). examples/ and test/ run untyped because the demo bundle's tree
  // walker uses Lezer types that look awkward in fully-strict mode without
  // assertions, and tests are plain JS.
  ...tseslint.configs.recommended,

  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // Term constants imported from generated .terms files are used in the
      // grammar source, not the TS source — squelch unused-import warnings
      // for capitalised names.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^[A-Z]"
        }
      ]
    }
  },

  {
    files: ["examples/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },

  {
    files: ["test/**/*.js", "**/*.config.js", "**/*.config.demo.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha
      }
    },
    rules: {
      // Tests legitimately compare to undefined / use loose equality with
      // null inherited Lezer node properties; relax these for fixtures.
      "@typescript-eslint/no-unused-expressions": "off"
    }
  }
)
