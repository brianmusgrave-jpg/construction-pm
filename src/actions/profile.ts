"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getProfile() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, company: true, image: true },
  });
  if (!user) throw new Error("User not found");
  return user;
}

export async function updateProfile(data: {
  name?: string;
  phone?: string;
  company?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const current = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, phone: true, company: true },
  });
  if (!current) throw new Error("User not found");

  // Build change log
  const changes: Record<string, { from: string | null; to: string | null }> = {};
  if (data.name !== undefined && data.name !== current.name) {
    changes.name = { from: current.name, to: data.name };
  }
  if (data.phone !== undefined && data.phone !== current.phone) {
    changes.phone = { from: current.phone, to: data.phone };
  }
  if (data.company !== undefined && data.company !== current.company) {
    changes.company = { from: current.company, to: data.company };
  }

  if (Object.keys(changes).length === 0) {
    return { changed: false };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name ?? current.name,
      phone: data.phone ?? current.phone,
      company: data.company ?? current.company,
    },
  });

  // Log the change to all projects the user is a member of
  const memberships = await db.projectMember.findMany({
    where: { userId: session.user.id },
    select: { projectId: true },
  });

  if (memberships.length > 0) {
    await db.activityLog.createMany({
      data: memberships.map((m) => ({
        action: "MEMBER_UPDATED" as never,
        message: `Profile updated: ${Object.keys(changes).join(", ")}`,
        data: { userId: session.user.id, changes },
        projectId: m.projectId,
        userId: session.user.id,
      })),
    });
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { changed: true, changes };
}
