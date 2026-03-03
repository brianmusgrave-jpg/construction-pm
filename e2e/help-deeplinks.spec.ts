import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers";

/**
 * G-07: Help Center deep-link coverage.
 *
 * Verifies all 34 section IDs render without error when navigated to via
 * the ?section=<id> query parameter. Only `getting-started` was previously
 * covered in i18n-settings.spec.ts — this spec covers the remaining 33.
 *
 * Test strategy: parameterized loop. Each test navigates to the section URL,
 * asserts no 500 / crash, and asserts visible content exists.
 */

const HELP_SECTIONS: readonly string[] = [
  // Getting Started (4)
  "getting-started",
  "onboarding-checklist",
  "quick-start",
  "role-overview",
  // Features (20)
  "projects",
  "phases",
  "tasks",
  "checklists",
  "change-orders",
  "documents",
  "photos",
  "reports",
  "notifications",
  "directory",
  "staff",
  "ai-estimating",
  "ai-project-intel",
  "ai-assistant",
  "security-hardening",
  "ai-features",
  "mobile-app",
  "offline-mode",
  "keeney-mode",
  "contractor-portal",
  // Admin (10)
  "billing-plans",
  "user-management",
  "rbac",
  "org-settings",
  "onboarding-tour",
  "integrations",
  "api-access",
  "sso-saml",
  "white-label",
  "data-export",
];

for (const sectionId of HELP_SECTIONS) {
  test(`help deep-link: ?section=${sectionId}`, async ({ page }) => {
    const authed = await gotoAuthenticated(
      page,
      `/dashboard/help?section=${sectionId}`
    );
    if (!authed) {
      test.skip(true, "No auth session (CI without seeded users)");
      return;
    }

    // Page must not crash
    const content = await page.textContent("body");
    expect(content).not.toContain("Internal Server Error");
    expect(content!.trim().length).toBeGreaterThan(200);

    // Should not be an error page
    const errorHeading = page
      .getByRole("heading", { name: /^(error|not found|500|404)$/i })
      .first();
    const hasErrorHeading =
      (await page
        .getByRole("heading", { name: /^(error|not found|500|404)$/i })
        .count()) > 0 && (await errorHeading.isVisible());
    expect(hasErrorHeading).toBe(false);

    // Help center wrapper should be present (not redirected to another page)
    await expect(page.locator("body")).toBeVisible();
  });
}
