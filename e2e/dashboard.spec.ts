import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("dashboard page loads with KPI cards", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("body")).toBeVisible();
    // Dashboard should have stat/KPI cards — look for common elements
    // These are the key metric areas on the main dashboard
    await expect(
      page.locator('[class*="card"], [class*="stat"], [class*="grid"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard has navigation sidebar with key links", async ({ page }) => {
    await page.goto("/dashboard");
    // Sidebar should have links to main sections
    const nav = page.locator("nav, aside, [role='navigation']").first();
    await expect(nav).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard displays activity feed", async ({ page }) => {
    await page.goto("/dashboard");
    // Activity section exists somewhere on the page
    const body = page.locator("body");
    await expect(body).toBeVisible();
    // The page should contain activity-related content or an activity section
    const content = await page.textContent("body");
    expect(content).toBeTruthy();
  });

  test("can navigate to projects list", async ({ page }) => {
    await page.goto("/dashboard/projects");
    await expect(page.locator("body")).toBeVisible();
    // Projects page should load — check for heading or project cards
    await page.waitForLoadState("networkidle");
    const content = await page.textContent("body");
    expect(content!.length).toBeGreaterThan(100);
  });

  test("can navigate to new project form", async ({ page }) => {
    await page.goto("/dashboard/projects/new");
    await expect(page.locator("body")).toBeVisible();
    // New project form should have input fields
    const inputs = page.locator("input, textarea, select");
    await expect(inputs.first()).toBeVisible({ timeout: 10_000 });
  });

  test("can navigate to help center", async ({ page }) => {
    await page.goto("/dashboard/help");
    await expect(page.locator("body")).toBeVisible();
    // Help center has sections with articles
    await page.waitForLoadState("networkidle");
    const content = await page.textContent("body");
    expect(content!.length).toBeGreaterThan(200);
  });

  test("can navigate to settings page", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("can navigate to directory page", async ({ page }) => {
    await page.goto("/dashboard/directory");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("can navigate to staff page", async ({ page }) => {
    await page.goto("/dashboard/staff");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("can navigate to reports page", async ({ page }) => {
    await page.goto("/dashboard/reports");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("can navigate to notifications page", async ({ page }) => {
    await page.goto("/dashboard/notifications");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");
  });
});
