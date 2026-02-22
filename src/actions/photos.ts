"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { notify, getProjectMemberIds } from "@/lib/notifications";

type PhotoFlagType =
  | "REPLACEMENT_NEEDED"
  | "ADDITIONAL_ANGLES"
  | "ADDITIONAL_PHOTOS"
  | "CLARIFICATION_NEEDED";

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

export async function createPhotoBatch(data: {
  phaseId: string;
  photos: { url: string; caption?: string }[];
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

  const created = await db.photo.createMany({
    data: data.photos.map((p) => ({
      url: p.url,
      caption: p.caption || null,
      phaseId: data.phaseId,
      uploadedById: session.user.id,
    })),
  });

  // Log activity
  db.activityLog.create({
    data: {
      action: "PHOTO_UPLOADED",
      message: `Added ${data.photos.length} photo${data.photos.length > 1 ? "s" : ""} to ${phase.name}`,
      projectId: phase.projectId,
      userId: session.user.id,
      data: { phaseId: phase.id, count: data.photos.length },
    },
  }).catch(() => {});

  // Notify project members
  const memberIds = await getProjectMemberIds(phase.projectId);
  notify({
    type: "PHOTO_UPLOADED",
    title: `${data.photos.length} photo${data.photos.length > 1 ? "s" : ""} added to ${phase.name}`,
    message: `${session.user.name || session.user.email} uploaded ${data.photos.length} photo${data.photos.length > 1 ? "s" : ""} to ${phase.name}`,
    recipientIds: memberIds,
    actorId: session.user.id,
    data: { projectId: phase.projectId, phaseId: phase.id },
  });

  revalidatePath(`/dashboard/projects/${phase.projectId}`);
  return { count: created.count };
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

export async function flagPhoto(
  photoId: string,
  flagType: PhotoFlagType,
  flagNote?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Only PM+ can flag photos
  const userRole = session.user.role || "VIEWER";
  if (userRole !== "ADMIN" && userRole !== "PROJECT_MANAGER") {
    throw new Error("Only PMs and admins can flag photos");
  }

  const photo = await db.photo.findUnique({
    where: { id: photoId },
    include: {
      phase: { select: { projectId: true, name: true } },
    },
  });
  if (!photo) throw new Error("Photo not found");

  const updated = await db.photo.update({
    where: { id: photoId },
    data: {
      flagType: flagType as never,
      flagNote: flagNote || null,
      flaggedById: session.user.id,
      flaggedAt: new Date(),
    },
  });

  // Notify the photo uploader
  const flagLabels: Record<string, string> = {
    REPLACEMENT_NEEDED: "Replacement needed",
    ADDITIONAL_ANGLES: "Additional angles requested",
    ADDITIONAL_PHOTOS: "Additional photos requested",
    CLARIFICATION_NEEDED: "Clarification needed",
  };

  if (photo.uploadedById !== session.user.id) {
    notify({
      type: "PHOTO_UPLOADED", // reuse existing type
      title: `Photo flagged: ${flagLabels[flagType]}`,
      message: `A photo in ${photo.phase.name} was flagged${flagNote ? `: "${flagNote}"` : ""}`,
      recipientIds: [photo.uploadedById],
      actorId: session.user.id,
      data: {
        projectId: photo.phase.projectId,
        phaseId: photo.phaseId,
        photoId,
      },
    });
  }

  revalidatePath(`/dashboard/projects/${photo.phase.projectId}`);
  return updated;
}

export async function clearPhotoFlag(photoId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const userRole = session.user.role || "VIEWER";
  if (userRole !== "ADMIN" && userRole !== "PROJECT_MANAGER") {
    throw new Error("Only PMs and admins can clear flags");
  }

  const photo = await db.photo.findUnique({
    where: { id: photoId },
    include: { phase: { select: { projectId: true } } },
  });
  if (!photo) throw new Error("Photo not found");

  const updated = await db.photo.update({
    where: { id: photoId },
    data: {
      flagType: null,
      flagNote: null,
      flaggedById: null,
      flaggedAt: null,
    },
  });

  revalidatePath(`/dashboard/projects/${photo.phase.projectId}`);
  return updated;
}
