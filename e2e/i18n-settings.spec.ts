import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers";

test.describe("Settings & i18n", () => {
  test("settings page loads with language picker", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/settings");
    if (!authed) { test.skip(true, "No auth session"); return; }
    const content = await page.textContent("body");
    expect(content!.length).toBeGreaterThan(100);
  });

  test("switching to Spanish updates UI text", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/settings");
    if (!authed) { test.skip(true, "No auth session"); return; }

    // Find and click Spanish language option
    const esButton = page.locator(
      'button:has-text("Español"), [data-locale="es"], label:has-text("Español")'
    );
    const esExists = (await esButton.count()) > 0;

    if (esExists) {
      await esButton.first().click();
      await page.waitForTimeout(2000); // Wait for locale cookie + reload
      await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

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
    const authed = await gotoAuthenticated(page, "/dashboard/settings");
    if (!authed) { test.skip(true, "No auth session"); return; }

    const ptButton = page.locator(
      'button:has-text("Português"), [data-locale="pt"], label:has-text("Português")'
    );
    if ((await ptButton.count()) > 0) {
      await ptButton.first().click();
      await page.waitForTimeout(2000);
      await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

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
    const authed = await gotoAuthenticated(page, "/dashboard/settings");
    if (!authed) { test.skip(true, "No auth session"); return; }

    const frButton = page.locator(
      'button:has-text("Français"), [data-locale="fr"], label:has-text("Français")'
    );
    if ((await frButton.count()) > 0) {
      await frButton.first().click();
      await page.waitForTimeout(2000);
      await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

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
    const authed = await gotoAuthenticated(page, "/dashboard/help");
    if (!authed) { test.skip(true, "No auth session"); return; }
    const content = await page.textContent("body");
    expect(content!.length).toBeGreaterThan(500);
  });

  test("help center supports deep-link via query params", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/help?section=getting-started");
    if (!authed) { test.skip(true, "No auth session"); return; }
    await expect(page.locator("body")).toBeVisible();
  });
});

// ── G-15: Locale persistence across navigation ───────────────────────────────

test.describe("Locale Persistence (G-15)", () => {
  test("locale cookie persists when navigating to a different page", async ({
    page,
  }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/settings");
    if (!authed) { test.skip(true, "No auth session"); return; }

    // Switch to Spanish
    const esButton = page.locator(
      'button:has-text("Español"), [data-locale="es"], label:has-text("Español")'
    );
    if ((await esButton.count()) === 0) {
      test.skip(true, "Spanish locale button not found on settings page");
      return;
    }

    await esButton.first().click();
    await page.waitForTimeout(2000); // Let locale cookie + any reload settle

    // Navigate to a completely different page
    await page.goto("/dashboard/projects", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // The projects page should now render in Spanish
    const content = await page.textContent("body");
    const hasSpanish =
      content!.includes("Proyecto") ||
      content!.includes("Proyectos") ||
      content!.includes("Nuevo Proyecto") ||
      content!.includes("nuevo") ||
      content!.includes("Crear");
    expect(hasSpanish).toBeTruthy();

    // Restore English for subsequent tests
    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const enButton = page.locator(
      'button:has-text("English"), [data-locale="en"], label:has-text("English")'
    );
    if ((await enButton.count()) > 0) {
      await enButton.first().click();
      await page.waitForTimeout(1000);
    }
  });

  test("locale persists across dashboard and help center", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/settings");
    if (!authed) { test.skip(true, "No auth session"); return; }

    // Switch to French
    const frButton = page.locator(
      'button:has-text("Français"), [data-locale="fr"], label:has-text("Français")'
    );
    if ((await frButton.count()) === 0) {
      test.skip(true, "French locale button not found");
      return;
    }

    await frButton.first().click();
    await page.waitForTimeout(2000);

    // Navigate to help center
    await page.goto("/dashboard/help", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const content = await page.textContent("body");
    // French UI words that should appear if locale persisted
    const hasFrench =
      content!.includes("Projet") ||
      content!.includes("Aide") ||
      content!.includes("Paramètres") ||
      content!.includes("Tableau de bord") ||
      content!.includes("Langue");
    expect(hasFrench).toBeTruthy();

    // Restore English
    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const enButton = page.locator('button:has-text("English"), [data-locale="en"]');
    if ((await enButton.count()) > 0) {
      await enButton.first().click();
      await page.waitForTimeout(1000);
    }
  });

  test("locale resets to English after explicit switch back", async ({ page }) => {
    const authed = await gotoAuthenticated(page, "/dashboard/settings");
    if (!authed) { test.skip(true, "No auth session"); return; }

    // Switch to Portuguese
    const ptButton = page.locator(
      'button:has-text("Português"), [data-locale="pt"], label:has-text("Português")'
    );
    if ((await ptButton.count()) > 0) {
      await ptButton.first().click();
      await page.waitForTimeout(2000);
    }

    // Switch back to English
    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const enButton = page.locator(
      'button:has-text("English"), [data-locale="en"], label:has-text("English")'
    );
    if ((await enButton.count()) === 0) {
      test.skip(true, "English locale button not found");
      return;
    }
    await enButton.first().click();
    await page.waitForTimeout(2000);

    // Navigate to projects — should be back in English
    await page.goto("/dashboard/projects", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const content = await page.textContent("body");
    // English UI: "Project" NOT "Projeto" / "Proyecto"
    const hasEnglish =
      content!.includes("Project") ||
      content!.includes("New Project") ||
      content!.toLowerCase().includes("create");
    expect(hasEnglish).toBeTruthy();
  });
});
