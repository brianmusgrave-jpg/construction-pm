import { test as setup, expect } from "@playwright/test";

/**
 * Authenticates as admin and contractor, saving session state so
 * subsequent test files can reuse the logged-in session.
 */

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("admin@constructionpm.com");
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });
  await expect(page.locator("body")).toBeVisible();

  // Save signed-in state
  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});

setup("authenticate as contractor", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("contractor@example.com");
  await page.getByRole("button", { name: /sign in/i }).click();

  // Contractors redirect to /contractor
  await page.waitForURL("**/contractor**", { timeout: 15_000 });
  await expect(page.locator("body")).toBeVisible();

  await page.context().storageState({ path: "e2e/.auth/contractor.json" });
});
