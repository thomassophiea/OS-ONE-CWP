import { defineConfig, devices } from "@playwright/test";

/**
 * Accessibility E2E suite, kept separate from `vitest` (the unit-test
 * runner, `environment: "node"`, no DOM). This is the one thing static
 * lint can't tell you: whether the page actually rendered accessibly —
 * contrast, real ARIA state, an announced live region.
 *
 * Points at a server already running at PORTAL_BASE_URL (CI starts one
 * against a seeded database — see .github/workflows/accessibility.yml)
 * rather than trying to boot `next start` itself, because the guest pages
 * this suite exercises need a real Postgres-backed session row.
 */
export default defineConfig({
  testDir: "./tests/a11y",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PORTAL_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
