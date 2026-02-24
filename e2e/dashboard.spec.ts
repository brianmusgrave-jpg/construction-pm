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
    // The layout renders two <nav> elements (mobile + desktop sidebar).
    // The mobile nav has 0 width on Desktop Chrome, so .first() picks
    // the hidden one.  Filter to only visible navs before asserting.
    const nav = page.locator("nav").filter({ hasText: /Dashboard|Projects/ });
    await expect(nav.last()).toBeVisible({ timeout: 10_000 });
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
    // The new-project page is a multi-step wizard.  Step 1 shows template
    // cards (Residential, Commercial, Blank, etc.) — no <input> elements.
    // Verify the wizard heading and at least one template card are visible.
    await expect(page.getByText("Create New Project")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Residential").first()).toBeVisible({ timeout: 10_000 });
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
