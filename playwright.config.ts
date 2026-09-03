import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config.
 *
 * Replaces a config that imported `lovable-agent-playwright-config` — a package
 * present in no manifest and no node_modules, so `npx playwright test` failed at
 * config resolution. @playwright/test and all browsers were already installed.
 *
 * fullyParallel is OFF and workers is 1 on purpose: these specs write to and
 * count rows in a shared table, and there is only one Supabase project (the
 * production one). Parallel runs would make the row-count assertions meaningless
 * and could delete each other's fixtures during teardown.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Generation runs real astronomy math in an edge function; give it room.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    port: 8080,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
