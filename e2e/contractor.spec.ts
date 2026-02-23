import { test, expect } from "@playwright/test";

test.describe("Contractor Portal", () => {
  test("contractor dashboard loads", async ({ page }) => {
    await page.goto("/contractor");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const content = await page.textContent("body");
    expect(content!.length).toBeGreaterThan(100);
  });

  test("contractor can access phases page", async ({ page }) => {
    await page.goto("/contractor");
    await page.waitForLoadState("networkidle");
    // Navigate to a phase if link exists, otherwise just verify the page loads
    const phaseLinks = page.locator('a[href*="/contractor/phases"]');
    const count = await phaseLinks.count();
    if (count > 0) {
      await phaseLinks.first().click();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("contractor can access documents page", async ({ page }) => {
    await page.goto("/contractor/documents");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("contractor can access photos page", async ({ page }) => {
    await page.goto("/contractor/photos");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("contractor can access reports page", async ({ page }) => {
    await page.goto("/contractor/reports");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("contractor can access notifications page", async ({ page }) => {
    await page.goto("/contractor/notifications");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("contractor is redirected away from /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    // Middleware should redirect contractor to /contractor
    await page.waitForURL("**/contractor**", { timeout: 10_000 });
    expect(page.url()).toContain("/contractor");
  });
});
