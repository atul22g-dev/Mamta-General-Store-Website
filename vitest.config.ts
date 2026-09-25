import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Unit-test configuration for the shop's business logic.
 *
 * Scope: pure modules (catalog math, validation schemas, cart behaviour,
 * formatting). External services (Supabase, Storage) are never contacted —
 * tests use fixtures and an in-memory localStorage stub, so no credentials
 * are needed and nothing touches production.
 */
export default defineConfig({
  test: {
    // jsdom: the cart tests render the real CartProvider (React 19).
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Allow importing server modules ("server-only" guard) in tests.
      "server-only": path.resolve(__dirname, "tests/server-only-stub.js"),
    },
  },
});
