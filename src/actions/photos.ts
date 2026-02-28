"use server";

/**
 * @file actions/photos.ts
 * @description Server actions for photo upload, management, flagging, and deletion.
 *
 * Photos are images attached to a phase, stored in Vercel Blob. The DB record
 * holds the URL, optional caption, optional GPS coordinates, and flag state.
 *
 * Two upload modes:
 *   - createPhoto:      single photo, used for drag-drop or camera capture.
 *   - createPhotoBatch: multiple photos at once (e.g. bulk upload from device).
 *     Uses `createMany` for efficiency and fires a single batch notification.
 *
 * Flag workflow (PM+ only):
 *   PM flags a photo (REPLACEMENT_NEEDED, ADDITIONAL_ANGLES, etc.) →
 *   the original uploader is notified → uploader uploads replacement →
 *   PM clears flag via clearPhotoFlag.
 *
 * GPS: coordinates may be captured by the browser/device at upload time
 * and stored on the record. They can also be set/corrected after upload
 * via updatePhotoGps.
 *
 * Blob cleanup: same pattern as documents.ts — blob deletion failure is
 * non-fatal, DB record is removed regardless.
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { notify, getProjectMemberIds } from "@/lib/notifications";

/** Valid photo flag reasons a PM can apply. */
type PhotoFlagType =
  | "REPLACEMENT_NEEDED"
  | "ADDITIONAL_ANGLES"
  | "ADDITIONAL_PHOTOS"
  | "CLARIFICATION_NEEDED";

// ── Mutations ──

/**
 * Record a single newly uploaded photo.
 * GPS coordinates are optional — captured from browser geolocation if available.
 * Logs PHOTO_UPLOADED activity (fire-and-forget).
 *
 * Requires: "create photo" permission.
 */
export async function createPhoto(data: {
  phaseId: string;
  url: string;       // Vercel Blob URL
  caption?: string;
  latitude?: number;
  longitude?: number;
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
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    },
  });

  // Fire-and-forget activity log
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

/**
 * Upload multiple photos to a phase in a single action call.
 * Uses `createMany` (single INSERT) rather than N individual creates.
 * Fires one PHOTO_UPLOADED notification mentioning the count.
 * GPS coordinates are shared across all photos in the batch.
 *
 * Requires: "create photo" permission.
 */
export async function createPhotoBatch(data: {
  phaseId: string;
  photos: { url: string; caption?: string }[];
  latitude?: number;  // Shared GPS for the batch
  longitude?: number;
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
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    })),
  });

  // Fire-and-forget activity log for the whole batch
  db.activityLog.create({
    data: {
      action: "PHOTO_UPLOADED",
      message: `Added ${data.photos.length} photo${data.photos.length > 1 ? "s" : ""} to ${phase.name}`,
      projectId: phase.projectId,
      userId: session.user.id,
      data: { phaseId: phase.id, count: data.photos.length },
    },
  }).catch(() => {});

  // Single notification for the batch
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

/**
 * Delete a photo: removes the Vercel Blob object, then the DB record.
 * Blob deletion failure is non-fatal — DB deletion continues regardless.
 *
 * Requires: "delete photo" permission.
 */
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

  // Remove from Vercel Blob (failure is non-fatal)
  try {
    await del(photo.url);
  } catch (e) {
    console.error("Failed to delete blob:", e);
  }

  await db.photo.delete({ where: { id: photoId } });

  revalidatePath(`/dashboard/projects/${photo.phase.projectId}`);
  return { success: true };
}

/**
 * Update the caption text on an existing photo.
 *
 * Requires: authenticated session (no role check — any member can edit captions).
 */
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

/**
 * Flag a photo for follow-up action by a PM.
 * Records the flag type, optional note, who flagged it, and when.
 * Notifies the original uploader (unless the flagger is the uploader).
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
export async function flagPhoto(
  photoId: string,
  flagType: PhotoFlagType,
  flagNote?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

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

  // Human-readable flag labels for the notification copy
  const flagLabels: Record<string, string> = {
    REPLACEMENT_NEEDED:   "Replacement needed",
    ADDITIONAL_ANGLES:    "Additional angles requested",
    ADDITIONAL_PHOTOS:    "Additional photos requested",
    CLARIFICATION_NEEDED: "Clarification needed",
  };

  // Only notify if someone else's photo was flagged (don't self-notify)
  if (photo.uploadedById !== session.user.id) {
    notify({
      type: "PHOTO_UPLOADED", // Reuses existing notification type
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

/**
 * Clear all flag fields from a photo (resolves a previous flag).
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
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
      flagType:    null,
      flagNote:    null,
      flaggedById: null,
      flaggedAt:   null,
    },
  });

  revalidatePath(`/dashboard/projects/${photo.phase.projectId}`);
  return updated;
}

/**
 * Set or update GPS coordinates on a photo after upload.
 * Used when coordinates weren't captured at upload time or need correction.
 *
 * Requires: authenticated session (no role check).
 */
export async function updatePhotoGps(
  photoId: string,
  latitude: number,
  longitude: number
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const photo = await db.photo.findUnique({
    where: { id: photoId },
    include: { phase: { select: { projectId: true } } },
  });
  if (!photo) throw new Error("Photo not found");

  const updated = await db.photo.update({
    where: { id: photoId },
    data: { latitude, longitude },
  });

  revalidatePath(`/dashboard/projects/${photo.phase.projectId}`);
  return updated;
}
