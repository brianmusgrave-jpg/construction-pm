import { Page } from "@playwright/test";

/**
 * Check if the current page landed on the login page (auth redirect).
 * In CI without seeded test users, auth.setup.ts writes empty storageState,
 * so authenticated routes redirect to /login.  Tests should skip gracefully.
 */
export async function isAuthRedirected(page: Page): Promise<boolean> {
  const url = page.url();
  return url.includes("/login");
}

/**
 * Navigate to a route and return true if the user is authenticated
 * (page did NOT redirect to /login).  Waits for network idle.
 */
export async function gotoAuthenticated(
  page: Page,
  path: string
): Promise<boolean> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return !isAuthRedirectedSync(page.url());
}

function isAuthRedirectedSync(url: string): boolean {
  return url.includes("/login");
}
