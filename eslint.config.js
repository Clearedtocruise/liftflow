// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  {
    // Build and maintenance scripts run under Node, not React Native, so they get Node globals
    // such as Buffer and process rather than the app's browser-ish environment.
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: globals.node,
    },
    settings: {
      // Optional native dependencies, imported lazily so the script only needs them installed
      // when it is actually asked to render assets. They are deliberately absent from
      // package.json — installing them costs a native build nobody needs to run the app or CI.
      "import/core-modules": ["sharp", "@resvg/resvg-js"],
    },
  },
  {
    ignores: ["dist/*"],
  }
]);
