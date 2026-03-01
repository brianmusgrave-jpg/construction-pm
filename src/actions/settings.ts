"use server";

/**
 * @file actions/settings.ts
 * @description Server actions for organisation-level settings (theme, logo, company name).
 *
 * The OrgSettings model is a singleton — there is exactly ONE row in the table,
 * shared across all users. `getOrgSettings()` auto-creates this row on first access
 * so callers never need to handle a missing record.
 *
 * All mutations require the `manage phase` permission (currently ADMIN and
 * PROJECT_MANAGER roles) — i.e. organisation settings are not editable by
 * CONTRACTOR, STAKEHOLDER, or VIEWER roles.
 *
 * Vercel Blob is used for logo storage:
 *   - Logos are uploaded to the `logos/` prefix with a timestamp to bust CDN caches.
 *   - The previous logo is deleted from Blob on replacement/removal; failure is
 *     non-fatal (the blob may already be gone or the URL may have been stale).
 *
 * All mutations revalidate /dashboard, /contractor, and /dashboard/settings so
 * the new branding is reflected immediately across all user-facing routes.
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { THEME_PRESETS, passesWCAG } from "@/lib/themes";
import { put, del } from "@vercel/blob";
import { extractColorsFromUrl } from "@/lib/color-extract";

// ── Auth helper ──

/**
 * Assert the session user has the `manage phase` permission (ADMIN / PM).
 * All settings mutations use this guard — it's deliberately re-checked each
 * call rather than cached to prevent stale-role exploits after role changes.
 */
async function requireSettingsAccess() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");
  return session;
}

// ── Queries ──

/**
 * Fetch the single OrgSettings row, creating it with default values if absent.
 * Safe to call from any server component or action without checking for null.
 *
 * Default: `{ theme: "blue" }` — the Professional Blue preset.
 */
export async function getOrgSettings() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  let settings = await db.orgSettings.findFirst();
  if (!settings) {
    // Auto-seed on first access (e.g. fresh deployment or test environment)
    settings = await db.orgSettings.create({
      data: {
        orgId: session.user.orgId!, theme: "blue" },
    });
  }
  return settings;
}

// ── Mutations ──

/**
 * Switch the active colour theme for the entire application.
 * The theme ID is validated against THEME_PRESETS to reject unknown values
 * before writing — unknown IDs would cause `getThemeCSS()` to silently fall
 * back to blue, but we surface the error here for better DX.
 *
 * @param themeId - One of the IDs from `src/lib/themes.ts` (e.g. "orange", "teal").
 */
export async function updateTheme(themeId: string) {
  await requireSettingsAccess();

  // Reject IDs not present in the preset list — prevents storing garbage values
  const valid = THEME_PRESETS.some((t) => t.id === themeId);
  if (!valid) throw new Error("Invalid theme");

  const settings = await getOrgSettings();
  await db.orgSettings.update({
    where: { id: settings.id },
    data: {
      theme: themeId,
      // Selecting a preset theme clears any custom colours
      colorPrimary: null,
      colorSecondary: null,
      colorTertiary: null,
      colorMode: "preset",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/contractor");
  revalidatePath("/dashboard/settings");
}

/**
 * Upload a new company logo and replace the existing one.
 *
 * Constraints:
 *   - 2 MB maximum file size
 *   - Accepted types: PNG, JPEG, SVG, WebP
 *   - Uploaded to Vercel Blob under `logos/<timestamp>-<filename>`
 *
 * The old logo is deleted from Blob storage after the new URL is persisted.
 * Deletion failure is swallowed — stale blobs are acceptable; they won't
 * affect functionality and can be cleaned up in the Vercel dashboard.
 *
 * @returns `{ url }` — the public Vercel Blob URL of the newly uploaded logo.
 */
export async function uploadLogo(formData: FormData) {
  await requireSettingsAccess();

  const file = formData.get("logo") as File;
  if (!file || file.size === 0) throw new Error("No file provided");

  // Validate size (2MB max)
  if (file.size > 2 * 1024 * 1024) throw new Error("File too large (max 2MB)");

  // Validate MIME type — guards against disguised executables, etc.
  const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error("Invalid file type. Use PNG, JPG, SVG, or WebP.");

  // Upload to Vercel Blob with timestamp prefix to avoid CDN cache collisions
  const blob = await put(`logos/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  // Clean up the previous logo (non-fatal if already gone)
  const settings = await getOrgSettings();
  if (settings.logoUrl) {
    try { await del(settings.logoUrl); } catch { /* ok if old blob is gone */ }
  }

  await db.orgSettings.update({
    where: { id: settings.id },
    data: {
      logoUrl: blob.url,
      logoMimeType: file.type,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/contractor");
  revalidatePath("/dashboard/settings");

  return { url: blob.url };
}

/**
 * Remove the company logo entirely.
 * Deletes the blob from Vercel storage and clears both `logoUrl` and
 * `logoMimeType` from OrgSettings. Safe to call when no logo is set.
 */
export async function deleteLogo() {
  await requireSettingsAccess();

  const settings = await getOrgSettings();
  if (settings.logoUrl) {
    try { await del(settings.logoUrl); } catch { /* ok */ }
  }

  await db.orgSettings.update({
    where: { id: settings.id },
    data: { logoUrl: null, logoMimeType: null },
  });

  revalidatePath("/dashboard");
  revalidatePath("/contractor");
  revalidatePath("/dashboard/settings");
}

/**
 * Update the company display name shown in headers and reports.
 * An empty string is treated as "unset" — stored as NULL so the UI can
 * fall back to a default placeholder rather than showing a blank name.
 *
 * @param name - New company name. Pass "" to clear.
 */
export async function updateCompanyName(name: string) {
  await requireSettingsAccess();

  const settings = await getOrgSettings();
  await db.orgSettings.update({
    where: { id: settings.id },
    // Trim whitespace; empty string → null (show placeholder in UI)
    data: { companyName: name.trim() || null },
  });

  revalidatePath("/dashboard");
  revalidatePath("/contractor");
  revalidatePath("/dashboard/settings");
}

// ── Custom Color Scheme (Sprint 19) ──

/** Hex colour regex — validates #rrggbb format. */
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Save a custom colour scheme (1–3 user-picked colours).
 * Switches the colour mode to "custom" and stores the raw hex values.
 * Auto-generates dark/light/bg variants from the primary colour at render time.
 *
 * @param primary   - Required. The primary brand colour (hex).
 * @param secondary - Optional. Darker accent / hover state colour.
 * @param tertiary  - Optional. Light background tint colour.
 */
export async function saveCustomColors(
  primary: string,
  secondary?: string | null,
  tertiary?: string | null
) {
  await requireSettingsAccess();

  if (!HEX_RE.test(primary)) throw new Error("Invalid primary colour");
  if (secondary && !HEX_RE.test(secondary)) throw new Error("Invalid secondary colour");
  if (tertiary && !HEX_RE.test(tertiary)) throw new Error("Invalid tertiary colour");

  const settings = await getOrgSettings();
  await db.orgSettings.update({
    where: { id: settings.id },
    data: {
      colorPrimary: primary.toLowerCase(),
      colorSecondary: secondary?.toLowerCase() || null,
      colorTertiary: tertiary?.toLowerCase() || null,
      colorMode: "custom",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/contractor");
  revalidatePath("/dashboard/settings");
}

/**
 * Extract palette options from the currently uploaded logo.
 * Returns 2–3 palette suggestions the admin can choose from.
 * Does NOT save anything — just returns suggestions.
 */
export async function extractLogoColors() {
  await requireSettingsAccess();

  const settings = await getOrgSettings();
  if (!settings.logoUrl) throw new Error("No logo uploaded");

  return extractColorsFromUrl(settings.logoUrl);
}

/**
 * Apply one of the logo-extracted palettes.
 * Stores the chosen colours and sets colorMode to "logo".
 */
export async function applyLogoPalette(
  primary: string,
  secondary: string,
  tertiary: string
) {
  await requireSettingsAccess();

  if (!HEX_RE.test(primary)) throw new Error("Invalid primary colour");
  if (!HEX_RE.test(secondary)) throw new Error("Invalid secondary colour");
  if (!HEX_RE.test(tertiary)) throw new Error("Invalid tertiary colour");

  const settings = await getOrgSettings();
  await db.orgSettings.update({
    where: { id: settings.id },
    data: {
      colorPrimary: primary.toLowerCase(),
      colorSecondary: secondary.toLowerCase(),
      colorTertiary: tertiary.toLowerCase(),
      colorMode: "logo",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/contractor");
  revalidatePath("/dashboard/settings");
}

/**
 * Reset to preset theme mode — clears custom colours and sets mode back to "preset".
 * The active preset theme (blue, orange, etc.) is not changed.
 */
export async function resetToPresetColors() {
  await requireSettingsAccess();

  const settings = await getOrgSettings();
  await db.orgSettings.update({
    where: { id: settings.id },
    data: {
      colorPrimary: null,
      colorSecondary: null,
      colorTertiary: null,
      colorMode: "preset",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/contractor");
  revalidatePath("/dashboard/settings");
}
