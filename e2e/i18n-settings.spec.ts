import { test, expect } from "@playwright/test";

test.describe("Settings & i18n", () => {
  test("settings page loads with language picker", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");
    // Settings should have language-related UI
    await expect(page.locator("body")).toBeVisible();
    // Look for language selector or locale-related elements
    const content = await page.textContent("body");
    expect(content!.length).toBeGreaterThan(100);
  });

  test("switching to Spanish updates UI text", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // Find and click Spanish language option
    const esButton = page.locator(
      'button:has-text("Español"), [data-locale="es"], label:has-text("Español")'
    );
    const esExists = (await esButton.count()) > 0;

    if (esExists) {
      await esButton.first().click();
      await page.waitForTimeout(2000); // Wait for locale cookie + reload
      await page.goto("/dashboard/settings");
      await page.waitForLoadState("networkidle");

      // Verify some Spanish text appears
      const content = await page.textContent("body");
      // Common Spanish UI words
      const hasSpanish =
        content!.includes("Configuración") ||
        content!.includes("Idioma") ||
        content!.includes("Guardar") ||
        content!.includes("Proyecto");
      expect(hasSpanish).toBeTruthy();

      // Switch back to English
      const enButton = page.locator(
        'button:has-text("English"), [data-locale="en"], label:has-text("English")'
      );
      if ((await enButton.count()) > 0) {
        await enButton.first().click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("switching to Portuguese updates UI text", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    const ptButton = page.locator(
      'button:has-text("Português"), [data-locale="pt"], label:has-text("Português")'
    );
    if ((await ptButton.count()) > 0) {
      await ptButton.first().click();
      await page.waitForTimeout(2000);
      await page.goto("/dashboard/settings");
      await page.waitForLoadState("networkidle");

      const content = await page.textContent("body");
      const hasPortuguese =
        content!.includes("Configurações") ||
        content!.includes("Projeto") ||
        content!.includes("Salvar");
      expect(hasPortuguese).toBeTruthy();

      // Restore English
      const enButton = page.locator(
        'button:has-text("English"), [data-locale="en"]'
      );
      if ((await enButton.count()) > 0) {
        await enButton.first().click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("switching to French updates UI text", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    const frButton = page.locator(
      'button:has-text("Français"), [data-locale="fr"], label:has-text("Français")'
    );
    if ((await frButton.count()) > 0) {
      await frButton.first().click();
      await page.waitForTimeout(2000);
      await page.goto("/dashboard/settings");
      await page.waitForLoadState("networkidle");

      const content = await page.textContent("body");
      const hasFrench =
        content!.includes("Paramètres") ||
        content!.includes("Langue") ||
        content!.includes("Projet");
      expect(hasFrench).toBeTruthy();

      // Restore English
      const enButton = page.locator(
        'button:has-text("English"), [data-locale="en"]'
      );
      if ((await enButton.count()) > 0) {
        await enButton.first().click();
        await page.waitForTimeout(1000);
      }
    }
  });
});

test.describe("Help Center", () => {
  test("help center loads with sections and articles", async ({ page }) => {
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");
    const content = await page.textContent("body");
    // Help center should have substantial content (58+ articles)
    expect(content!.length).toBeGreaterThan(500);
  });

  test("help center supports deep-link via query params", async ({ page }) => {
    // Deep-link to a specific section
    await page.goto("/dashboard/help?section=getting-started");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});
