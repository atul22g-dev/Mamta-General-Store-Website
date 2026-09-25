/**
 * Rollup WASM shim for restricted Windows environments.
 *
 * Some machines (Application Control policy) block loading rollup's native
 * .node binary, which breaks vite/vitest startup with
 * "Cannot find module @rollup/rollup-win32-x64-msvc". Requiring this module
 * BEFORE vite/rollup makes any `require` of a rollup native binding fall back
 * to the pure-JS `@rollup/wasm-node` build — slower, but identical behaviour.
 *
 * Used by the `npm test` script; harmless when the native binding loads.
 */
const Module = require("node:module");
const path = require("node:path");

const wasmNative = path.join(__dirname, "..", "node_modules", "@rollup", "wasm-node", "dist", "native.js");

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.startsWith("@rollup/rollup-") && request.includes("x64-msvc")) {
    try {
      return originalLoad.call(this, request, parent, isMain);
    } catch {
      return originalLoad.call(this, wasmNative, parent, isMain);
    }
  }
  return originalLoad.call(this, request, parent, isMain);
};
