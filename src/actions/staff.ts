"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateStaffSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  company: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  contactType: z.enum(["TEAM", "SUBCONTRACTOR", "VENDOR", "INSPECTOR"]),
  email: z.string().email("Invalid email").max(200).optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateStaffSchema = CreateStaffSchema.partial().extend({
  id: z.string().min(1),
});

export async function createStaff(data: {
  name: string;
  company?: string;
  role?: string;
  contactType: "TEAM" | "SUBCONTRACTOR" | "VENDOR" | "INSPECTOR";
  email?: string;
  phone?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "create", "staff"))
    throw new Error("Forbidden");

  const parsed = CreateStaffSchema.parse(data);

  const staff = await db.staff.create({
    data: {
      name: parsed.name,
      company: parsed.company || null,
      role: parsed.role || null,
      contactType: parsed.contactType,
      email: parsed.email || null,
      phone: parsed.phone || null,
      notes: parsed.notes || null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/dashboard/directory");
  return staff;
}

export async function updateStaff(data: {
  id: string;
  name?: string;
  company?: string;
  role?: string;
  contactType?: "TEAM" | "SUBCONTRACTOR" | "VENDOR" | "INSPECTOR";
  email?: string;
  phone?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "update", "staff"))
    throw new Error("Forbidden");

  const parsed = UpdateStaffSchema.parse(data);
  const { id, ...updates } = parsed;

  // Clean empty strings to null
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    cleaned[key] = value === "" ? null : value;
  }

  const staff = await db.staff.update({
    where: { id },
    data: cleaned,
  });

  revalidatePath("/dashboard/directory");
  return staff;
}

export async function deleteStaff(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "delete", "staff"))
    throw new Error("Forbidden");

  await db.staff.delete({ where: { id } });
  revalidatePath("/dashboard/directory");
}
