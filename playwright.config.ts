import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for Construction PM.
 *
 * In CI, tests run against the live Vercel deployment (no local dev server).
 * Locally, set PLAYWRIGHT_TEST_BASE_URL or let it spin up `npm run dev`.
 *
 * Test accounts (seeded via prisma/seed.ts):
 *   admin@constructionpm.com  — ADMIN role
 *   contractor@example.com    — CONTRACTOR role
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 15_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL:
      process.env.PLAYWRIGHT_TEST_BASE_URL ||
      "https://construction-pm-theta.vercel.app",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    // ── Auth setup (shared across all projects) ──
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
    },
    // ── Desktop Chrome ──
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["auth-setup"],
    },
    // ── Mobile Safari ──
    {
      name: "mobile",
      use: {
        ...devices["iPhone 14"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["auth-setup"],
    },
    // ── Contractor-scoped tests ──
    {
      name: "contractor",
      testMatch: /contractor\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/contractor.json",
      },
      dependencies: ["auth-setup"],
    },
    // ── Unauthenticated tests (no storageState) ──
    {
      name: "unauthenticated",
      testMatch: /auth\.spec\.ts|client-portal\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
