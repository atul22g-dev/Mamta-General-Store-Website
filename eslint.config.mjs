import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // The Rollup WASM shim must use CommonJS require hooks (it runs before
    // any ESM loader) — CJS is the point, not an accident.
    ignores: ["scripts/rollup-wasm-shim.js"],
  },
]);

export default eslintConfig;
