import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Unit tests: pure logic only — no DOM, no network, no Supabase.
 *
 * Everything under `tests/unit` imports real modules from `src/`, so a change
 * that breaks a helper breaks the test rather than a copy of it. The parts that
 * genuinely cannot be tested without a live backend (RLS policies, RPC
 * authorization) are covered by `npm run db:check` instead, and the parts that
 * need a browser are covered by `npm run test:e2e`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Display helpers go through `toLocaleDateString`. The assertions are
    // written to be timezone-independent, and this pins the clock anyway so a
    // developer's machine and CI agree.
    env: { TZ: "UTC" },
  },
});
