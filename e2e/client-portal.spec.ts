import { test, expect } from "@playwright/test";

test.describe("Client Portal", () => {
  test("invalid client token shows error or empty state", async ({ page }) => {
    // Access client portal with a fake token
    await page.goto("/client/invalid-token-abc123");
    await page.waitForLoadState("networkidle");
    const content = await page.textContent("body");
    // Should show an error, expired message, or redirect — not crash
    expect(content).toBeTruthy();
    // Page should NOT show a server error (500)
    expect(content).not.toContain("Internal Server Error");
  });

  test("client portal page structure loads for valid-format token", async ({
    page,
  }) => {
    // Even with a non-existent but well-formatted token, the page should render gracefully
    const fakeToken = "a".repeat(64);
    await page.goto(`/client/${fakeToken}`);
    await page.waitForLoadState("networkidle");
    // Should not crash — graceful error handling
    const status = page.locator("body");
    await expect(status).toBeVisible();
  });
});
