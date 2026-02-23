"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { THEME_PRESETS } from "@/lib/themes";
import { put, del } from "@vercel/blob";

// Fetch or create the single OrgSettings row
export async function getOrgSettings() {
  let settings = await db.orgSettings.findFirst();
  if (!settings) {
    settings = await db.orgSettings.create({
      data: { theme: "blue" },
    });
  }
  return settings;
}

export async function updateTheme(themeId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const role = session.user.role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

  // Validate preset exists
  const valid = THEME_PRESETS.some((t) => t.id === themeId);
  if (!valid) throw new Error("Invalid theme");

  const settings = await getOrgSettings();
  await db.orgSettings.update({
    where: { id: settings.id },
    data: { theme: themeId },
  });

  revalidatePath("/dashboard");
  revalidatePath("/contractor");
  revalidatePath("/dashboard/settings");
}

export async function uploadLogo(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const role = session.user.role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

  const file = formData.get("logo") as File;
  if (!file || file.size === 0) throw new Error("No file provided");

  // Validate size (2MB max)
  if (file.size > 2 * 1024 * 1024) throw new Error("File too large (max 2MB)");

  // Validate type
  const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error("Invalid file type. Use PNG, JPG, SVG, or WebP.");

  // Upload to Vercel Blob
  const blob = await put(`logos/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  // Delete old logo if exists
  const settings = await getOrgSettings();
  if (settings.logoUrl) {
    try { await del(settings.logoUrl); } catch { /* ok if old one is gone */ }
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

export async function deleteLogo() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const role = session.user.role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

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

export async function updateCompanyName(name: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const role = session.user.role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

  const settings = await getOrgSettings();
  await db.orgSettings.update({
    where: { id: settings.id },
    data: { companyName: name.trim() || null },
  });

  revalidatePath("/dashboard");
  revalidatePath("/contractor");
  revalidatePath("/dashboard/settings");
}
