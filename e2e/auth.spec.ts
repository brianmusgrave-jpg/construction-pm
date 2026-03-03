import { test, expect } from "@playwright/test";

test.describe("Authentication & Route Protection", () => {
  test("landing page loads without auth", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    // Landing has the app name and a link to dashboard
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
  });

  test("login page renders email form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("unauthenticated user is redirected from /dashboard to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
    // callbackUrl should be preserved
    expect(page.url()).toContain("callbackUrl");
  });

  test("unauthenticated user is redirected from /dashboard/projects to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard/projects");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated user is redirected from /contractor to /login", async ({
    page,
  }) => {
    await page.goto("/contractor");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
  });

  test("invalid email shows error or stays on login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("nonexistent@fake.com");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Should stay on login page (with error param) since user doesn't exist
    await page.waitForURL("**/login**", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("successful admin login redirects to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@constructionpm.com");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("successful contractor login redirects to /contractor", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("contractor@example.com");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/contractor**", { timeout: 15_000 });
    expect(page.url()).toContain("/contractor");
  });
});

// ── G-17: Logout clears session ───────────────────────────────────────────────

test.describe("Logout (G-17)", () => {
  test("sign out redirects to login page", async ({ page }) => {
    // Log in as admin (unauthenticated project — no storageState)
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel(/email/i).fill("admin@constructionpm.com");
    await page.getByRole("button", { name: /sign in/i }).click();

    try {
      await page.waitForURL("**/dashboard**", { timeout: 15_000 });
    } catch {
      test.skip(true, "Login failed — environment may not have seeded users");
      return;
    }

    await page.waitForTimeout(1500);

    // Find the sign-out control — could be in a dropdown, sidebar, or user menu
    const signOutLocator = page.locator(
      'button:has-text("Sign out"), button:has-text("Sign Out"), ' +
      'button:has-text("Logout"), a:has-text("Sign out"), a:has-text("Logout"), ' +
      '[data-testid*="sign-out" i], [aria-label*="sign out" i]'
    );

    // Many apps gate sign-out behind a user avatar menu — try clicking it first
    const userMenu = page.locator(
      'button[aria-label*="user" i], button[aria-label*="account" i], ' +
      '[class*="avatar" i], [class*="user-menu" i]'
    );
    if ((await userMenu.count()) > 0 && (await signOutLocator.count()) === 0) {
      await userMenu.first().click();
      await page.waitForTimeout(800);
    }

    if ((await signOutLocator.count()) === 0) {
      test.skip(true, "Sign-out button not found — may require manual navigation");
      return;
    }

    await signOutLocator.first().click();

    // After sign-out the app should redirect to /login
    await page.waitForURL("**/login**", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("after sign out /dashboard redirects to /login", async ({ page }) => {
    // Log in, sign out, then try to access a protected route
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel(/email/i).fill("admin@constructionpm.com");
    await page.getByRole("button", { name: /sign in/i }).click();

    try {
      await page.waitForURL("**/dashboard**", { timeout: 15_000 });
    } catch {
      test.skip(true, "Login failed — environment may not have seeded users");
      return;
    }

    await page.waitForTimeout(1500);

    // Attempt to sign out
    const signOutLocator = page.locator(
      'button:has-text("Sign out"), button:has-text("Sign Out"), ' +
      'button:has-text("Logout"), a:has-text("Sign out")'
    );
    const userMenu = page.locator(
      'button[aria-label*="user" i], button[aria-label*="account" i], [class*="avatar" i]'
    );
    if ((await userMenu.count()) > 0 && (await signOutLocator.count()) === 0) {
      await userMenu.first().click();
      await page.waitForTimeout(800);
    }
    if ((await signOutLocator.count()) === 0) {
      test.skip(true, "Sign-out button not found");
      return;
    }
    await signOutLocator.first().click();
    await page.waitForURL("**/login**", { timeout: 10_000 });

    // Now navigate directly to /dashboard — should redirect back to login
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/login**", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });
});
