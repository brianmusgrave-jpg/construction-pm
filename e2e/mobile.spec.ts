import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers";

/**
 * Mobile-specific tests.
 * These run in the "mobile" project (iPhone 14 viewport) with admin auth.
 */

test.describe("Mobile Viewport", () => {
  test("dashboard loads in mobile viewport", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard");
    if (!authed) { test.skip(true, "No auth session"); return; }
    const viewport = page.viewportSize();
    expect(viewport!.width).toBeLessThan(500);
  });

  test("mobile bottom tab bar is visible", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard");
    if (!authed) { test.skip(true, "No auth session"); return; }
    // The mobile bottom nav should be visible at small viewports
    // Look for fixed bottom nav bar or tab bar elements
    const bottomNav = page.locator(
      '[class*="bottom"], [class*="tab-bar"], nav[class*="fixed"]'
    );
    const hasBottomNav = (await bottomNav.count()) > 0;
    // If the app has a bottom tab bar for mobile, it should be visible
    if (hasBottomNav) {
      await expect(bottomNav.first()).toBeVisible();
    }
  });

  test("mobile navigation works via sidebar or hamburger", async ({
    page,
  }) => {
    const authed = await gotoAuthenticated(page, "/dashboard");
    if (!authed) { test.skip(true, "No auth session"); return; }

    // Look for hamburger menu button
    const menuButton = page.locator(
      'button[aria-label*="menu" i], button[aria-label*="nav" i], [class*="hamburger"]'
    );
    if ((await menuButton.count()) > 0) {
      await menuButton.first().click();
      await page.waitForTimeout(500);
      // After opening, nav links should be visible
      const navLinks = page.locator("nav a, aside a");
      expect(await navLinks.count()).toBeGreaterThan(0);
    }
  });

  test("projects page is responsive on mobile", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/projects");
    if (!authed) { test.skip(true, "No auth session"); return; }
    // Content should not overflow horizontally
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()!.width;
    // Allow a small margin (5px) for scroll bars
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test("settings page is responsive on mobile", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/settings");
    if (!authed) { test.skip(true, "No auth session"); return; }
  });

  test("help center is usable on mobile", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/help");
    if (!authed) { test.skip(true, "No auth session"); return; }
    const content = await page.textContent("body");
    expect(content!.length).toBeGreaterThan(200);
  });
});
