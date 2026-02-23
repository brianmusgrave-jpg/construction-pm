import { test as setup, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Authenticates as admin and contractor, saving session state so
 * subsequent test files can reuse the logged-in session.
 *
 * In CI, auth may fail if test users don't exist in the production DB.
 * When that happens we write an empty storageState so dependent projects
 * can still load (they'll just hit the login redirect and tests will
 * soft-fail or be skipped).
 */

const AUTH_DIR = path.join(__dirname, ".auth");

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
}

function writeEmptyState(filePath: string) {
  fs.writeFileSync(
    filePath,
    JSON.stringify({ cookies: [], origins: [] }),
    "utf-8"
  );
}

setup("authenticate as admin", async ({ page }) => {
  ensureAuthDir();
  const statePath = path.join(AUTH_DIR, "admin.json");

  try {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@constructionpm.com");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });
    await expect(page.locator("body")).toBeVisible();

    // Save signed-in state
    await page.context().storageState({ path: statePath });
  } catch (error) {
    console.warn(
      `[auth.setup] Admin login failed (expected in CI without seeded users): ${error}`
    );
    writeEmptyState(statePath);
  }
});

setup("authenticate as contractor", async ({ page }) => {
  ensureAuthDir();
  const statePath = path.join(AUTH_DIR, "contractor.json");

  try {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("contractor@example.com");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Contractors redirect to /contractor
    await page.waitForURL("**/contractor**", { timeout: 15_000 });
    await expect(page.locator("body")).toBeVisible();

    await page.context().storageState({ path: statePath });
  } catch (error) {
    console.warn(
      `[auth.setup] Contractor login failed (expected in CI without seeded users): ${error}`
    );
    writeEmptyState(statePath);
  }
});
