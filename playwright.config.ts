import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke tests.
 *
 * These deliberately cover only what can be verified **without credentials**:
 * the public pages, the mobile layout contract (no horizontal overflow at
 * 320–430 px, 44 px touch targets) and the route guard. Anything that needs a
 * session would need a live Supabase project, and this repository does not
 * pretend otherwise — see README.md § Known limitations.
 *
 * The dev server is started with *placeholder* Supabase values pointed at a
 * closed local port. `getUser()` therefore fails fast, every request is treated
 * as signed-out, and the app behaves exactly as it does for a real visitor who
 * has not signed in.
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/** Not a real key: a syntactically valid, unsigned placeholder. */
const PLACEHOLDER_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImUyZS1wbGFjZWhvbGRlciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjIwMDAwMDAwMDB9." +
  "ZTJlLXBsYWNlaG9sZGVyLXNpZ25hdHVyZS1ub3QtdmVyaWZpZWQ";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "mobile-320",
      use: { ...devices["Pixel 7"], viewport: { width: 320, height: 720 } },
    },
    {
      name: "mobile-390",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile-430",
      use: {
        ...devices["iPhone 14 Pro Max"],
        viewport: { width: 430, height: 932 },
      },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],

  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npx next dev --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: "ignore",
        stderr: "pipe",
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: PLACEHOLDER_ANON_KEY,
          NEXT_PUBLIC_SITE_URL: baseURL,
        },
      },
});
