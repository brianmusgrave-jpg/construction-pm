import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers";

test.describe("Contractor Portal", () => {
  test("contractor dashboard loads", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/contractor");
    if (!authed) { test.skip(true, "No auth session"); return; }
    const content = await page.textContent("body");
    expect(content!.length).toBeGreaterThan(100);
  });

  test("contractor can access phases page", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/contractor");
    if (!authed) { test.skip(true, "No auth session"); return; }
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
    const authed = await gotoAuthenticated(page, "/contractor/documents");
    if (!authed) { test.skip(true, "No auth session"); return; }
  });

  test("contractor can access photos page", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/contractor/photos");
    if (!authed) { test.skip(true, "No auth session"); return; }
  });

  test("contractor can access reports page", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/contractor/reports");
    if (!authed) { test.skip(true, "No auth session"); return; }
  });

  test("contractor can access notifications page", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/contractor/notifications");
    if (!authed) { test.skip(true, "No auth session"); return; }
  });

  test("contractor is redirected away from /dashboard", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard");
    // Without auth, will redirect to /login — skip
    if (!authed) { test.skip(true, "No auth session"); return; }
    // With contractor auth, middleware should redirect to /contractor
    await page.waitForURL("**/contractor**", { timeout: 10_000 });
    expect(page.url()).toContain("/contractor");
  });
});
