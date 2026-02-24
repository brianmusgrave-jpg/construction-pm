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
 * (page did NOT redirect to /login).
 *
 * Uses "domcontentloaded" instead of "networkidle" because the production
 * login page has persistent connections (SSE, analytics) that prevent
 * networkidle from ever resolving, causing 30s timeouts per test in CI.
 */
export async function gotoAuthenticated(
  page: Page,
  path: string
): Promise<boolean> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // Brief wait for any client-side redirects to settle
  await page.waitForTimeout(2000);
  return !isAuthRedirectedSync(page.url());
}

function isAuthRedirectedSync(url: string): boolean {
  return url.includes("/login");
}
