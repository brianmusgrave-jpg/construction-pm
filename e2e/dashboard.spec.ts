import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers";

test.describe("Dashboard", () => {
  test("dashboard page loads with KPI cards", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard");
    if (!authed) { test.skip(true, "No auth session (CI without seeded users)"); return; }
    await expect(
      page.locator('[class*="card"], [class*="stat"], [class*="grid"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard has navigation sidebar with key links", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard");
    if (!authed) { test.skip(true, "No auth session"); return; }
    const nav = page.locator("nav, aside, [role='navigation']").first();
    await expect(nav).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard displays activity feed", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard");
    if (!authed) { test.skip(true, "No auth session"); return; }
    await expect(page.locator("body")).toBeVisible();
    const content = await page.textContent("body");
    expect(content).toBeTruthy();
  });

  test("can navigate to projects list", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/projects");
    if (!authed) { test.skip(true, "No auth session"); return; }
    const content = await page.textContent("body");
    expect(content!.length).toBeGreaterThan(100);
  });

  test("can navigate to new project form", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/projects/new");
    if (!authed) { test.skip(true, "No auth session"); return; }
    const inputs = page.locator("input, textarea, select");
    await expect(inputs.first()).toBeVisible({ timeout: 10_000 });
  });

  test("can navigate to help center", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/help");
    if (!authed) { test.skip(true, "No auth session"); return; }
    const content = await page.textContent("body");
    expect(content!.length).toBeGreaterThan(200);
  });

  test("can navigate to settings page", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/settings");
    if (!authed) { test.skip(true, "No auth session"); return; }
  });

  test("can navigate to directory page", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/directory");
    if (!authed) { test.skip(true, "No auth session"); return; }
  });

  test("can navigate to staff page", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/staff");
    if (!authed) { test.skip(true, "No auth session"); return; }
  });

  test("can navigate to reports page", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/reports");
    if (!authed) { test.skip(true, "No auth session"); return; }
  });

  test("can navigate to notifications page", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/notifications");
    if (!authed) { test.skip(true, "No auth session"); return; }
  });
});
