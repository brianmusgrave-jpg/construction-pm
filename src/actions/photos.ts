"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";

export async function createPhoto(data: {
  phaseId: string;
  url: string;
  caption?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const userRole = session.user.role || "VIEWER";
  if (!can(userRole, "create", "photo")) throw new Error("Forbidden");

  const phase = await db.phase.findUnique({
    where: { id: data.phaseId },
    select: { id: true, projectId: true, name: true },
  });
  if (!phase) throw new Error("Phase not found");

  const photo = await db.photo.create({
    data: {
      url: data.url,
      caption: data.caption || null,
      phaseId: data.phaseId,
      uploadedById: session.user.id,
    },
  });

  // Log activity
  db.activityLog.create({
    data: {
      action: "PHOTO_UPLOADED",
      message: `Added photo to ${phase.name}`,
      projectId: phase.projectId,
      userId: session.user.id,
      data: { photoId: photo.id, phaseId: phase.id },
    },
  }).catch(() => {});

  revalidatePath(`/dashboard/projects/${phase.projectId}`);
  return photo;
}

export async function deletePhoto(photoId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const userRole = session.user.role || "VIEWER";
  if (!can(userRole, "delete", "photo")) throw new Error("Forbidden");

  const photo = await db.photo.findUnique({
    where: { id: photoId },
    include: {
      phase: { select: { projectId: true } },
    },
  });
  if (!photo) throw new Error("Photo not found");

  // Delete from Vercel Blob storage
  try {
    await del(photo.url);
  } catch (e) {
    console.error("Failed to delete blob:", e);
  }

  await db.photo.delete({ where: { id: photoId } });

  revalidatePath(`/dashboard/projects/${photo.phase.projectId}`);
  return { success: true };
}

export async function updatePhotoCaption(photoId: string, caption: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const photo = await db.photo.findUnique({
    where: { id: photoId },
    include: { phase: { select: { projectId: true } } },
  });
  if (!photo) throw new Error("Photo not found");

  const updated = await db.photo.update({
    where: { id: photoId },
    data: { caption },
  });

  revalidatePath(`/dashboard/projects/${photo.phase.projectId}`);
  return updated;
}
