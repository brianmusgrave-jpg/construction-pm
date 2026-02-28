"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role || "VIEWER";
  if (role !== "ADMIN" && role !== "PROJECT_MANAGER") {
    throw new Error("Only admins and PMs can manage templates");
  }
  return session;
}

export async function getChecklistTemplates() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return db.checklistTemplate.findMany({
    include: {
      items: { orderBy: { order: "asc" } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createChecklistTemplate(data: {
  name: string;
  items: string[];
}) {
  await requireAdmin();

  if (!data.name.trim()) throw new Error("Template name is required");
  if (data.items.length === 0) throw new Error("At least one item is required");

  const template = await db.checklistTemplate.create({
    data: {
      name: data.name.trim(),
      items: {
        create: data.items
          .filter((t) => t.trim())
          .map((title, i) => ({ title: title.trim(), order: i })),
      },
    },
    include: { items: { orderBy: { order: "asc" } } },
  });

  revalidatePath("/dashboard/settings");
  return template;
}

export async function updateChecklistTemplate(
  templateId: string,
  data: { name: string; items: string[] }
) {
  await requireAdmin();

  if (!data.name.trim()) throw new Error("Template name is required");
  if (data.items.length === 0) throw new Error("At least one item is required");

  // Delete existing items and recreate
  await db.checklistTemplateItem.deleteMany({
    where: { templateId },
  });

  const template = await db.checklistTemplate.update({
    where: { id: templateId },
    data: {
      name: data.name.trim(),
      items: {
        create: data.items
          .filter((t) => t.trim())
          .map((title, i) => ({ title: title.trim(), order: i })),
      },
    },
    include: { items: { orderBy: { order: "asc" } } },
  });

  revalidatePath("/dashboard/settings");
  return template;
}

export async function deleteChecklistTemplate(templateId: string) {
  await requireAdmin();

  await db.checklistTemplate.delete({
    where: { id: templateId },
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}
