"use server";

/**
 * @file actions/photo-annotations.ts
 * @description Server actions for photo markup annotations — Sprint 28.
 *
 * Annotations allow PMs and field workers to draw circles, arrows, rectangles,
 * and text labels on construction photos to highlight defects, areas of concern,
 * or work that needs attention. Annotations are stored as normalised coordinates
 * (0-1 range) so they scale correctly at any display size.
 *
 * Each annotation references a photoId and stores the shape type, position,
 * dimensions, colour, and optional text label.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const dbc = db as any;

// ── Types ──

interface AnnotationInput {
  photoId: string;
  type: "arrow" | "circle" | "rectangle" | "text";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  color?: string;
  label?: string;
}

// ── Queries ──

/**
 * Get all annotations for a photo.
 */
export async function getPhotoAnnotations(photoId: string): Promise<{
  success: boolean;
  annotations: any[];
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, annotations: [], error: "Unauthorized" };
  }

  try {
    const annotations = await dbc.photoAnnotation.findMany({
      where: { photoId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      success: true,
      annotations: annotations.map((a: any) => ({
        ...a,
        createdAt: a.createdAt?.toISOString?.() ?? a.createdAt,
      })),
    };
  } catch (err) {
    console.error("getPhotoAnnotations error:", err);
    return { success: false, annotations: [], error: "Failed to load annotations" };
  }
}

// ── Mutations ──

/**
 * Add an annotation to a photo.
 */
export async function addPhotoAnnotation(data: AnnotationInput): Promise<{
  success: boolean;
  annotationId?: string;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const annotation = await dbc.photoAnnotation.create({
      data: {
        photoId: data.photoId,
        type: data.type,
        x: data.x,
        y: data.y,
        width: data.width || null,
        height: data.height || null,
        radius: data.radius || null,
        color: data.color || "#FF0000",
        label: data.label || null,
        createdById: session.user.id,
      },
    });

    return { success: true, annotationId: annotation.id };
  } catch (err) {
    console.error("addPhotoAnnotation error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add annotation",
    };
  }
}

/**
 * Delete an annotation. Only the creator or ADMIN can delete.
 */
export async function deletePhotoAnnotation(annotationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const annotation = await dbc.photoAnnotation.findUnique({
      where: { id: annotationId },
    });

    if (!annotation) {
      return { success: false, error: "Annotation not found" };
    }

    const userRole = (session.user as { role?: string }).role;
    if (annotation.createdById !== session.user.id && userRole !== "ADMIN") {
      return { success: false, error: "Not authorized to delete this annotation" };
    }

    await dbc.photoAnnotation.delete({ where: { id: annotationId } });
    return { success: true };
  } catch (err) {
    console.error("deletePhotoAnnotation error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete annotation",
    };
  }
}

/**
 * Bulk save annotations for a photo (replace all existing).
 * Used by the annotation editor to save the complete annotation set at once.
 */
export async function savePhotoAnnotations(
  photoId: string,
  annotations: AnnotationInput[]
): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, count: 0, error: "Unauthorized" };
  }

  try {
    // Delete existing annotations for this photo by this user
    await dbc.photoAnnotation.deleteMany({
      where: { photoId, createdById: session.user.id },
    });

    // Create all new annotations
    if (annotations.length > 0) {
      await dbc.photoAnnotation.createMany({
        data: annotations.map((a) => ({
          photoId,
          type: a.type,
          x: a.x,
          y: a.y,
          width: a.width || null,
          height: a.height || null,
          radius: a.radius || null,
          color: a.color || "#FF0000",
          label: a.label || null,
          createdById: session.user.id,
        })),
      });
    }

    return { success: true, count: annotations.length };
  } catch (err) {
    console.error("savePhotoAnnotations error:", err);
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : "Failed to save annotations",
    };
  }
}
