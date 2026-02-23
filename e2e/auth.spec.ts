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
