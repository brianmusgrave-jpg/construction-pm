"use server";

/**
 * @file actions/drawing.ts
 * @description Server actions for construction drawing log management.
 *
 * The drawing log tracks design drawings (architectural, structural, MEP, etc.)
 * associated with a phase. Each drawing record stores metadata — number,
 * discipline, revision, sheet size, scale — alongside an optional file URL.
 *
 * Module-level `dbc = db as any`: the Drawing model was added after the last
 * Prisma client generation. See GLOBAL_PROJECT_STANDARDS.md §3.
 *
 * GOTCHA — `getDrawings` has no auth check: it returns [] on any error
 * (including unauthenticated access) via `.catch(() => [])`. This mirrors the
 * pattern in estimate.ts and is intentional for server-component empty-state
 * rendering.
 *
 * Ordered by discipline (ASC) then drawingNumber (ASC) for a discipline-grouped
 * log view.
 *
 * Requires: "document" permission via `can()` from @/lib/permissions.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// Module-level cast — Drawing model is not in the generated Prisma client types.
const dbc = db as any;

// ── Queries ──

/**
 * Fetch all drawings for a phase, including uploader details.
 *
 * Ordered by discipline then drawingNumber for a grouped log view.
 *
 * NOTE: No auth check — returns `[]` on any error via `.catch(() => [])`.
 * This is intentional for server components rendering empty state for guests.
 *
 * @param phaseId - The phase to fetch drawings for.
 * @returns Array of drawing records, or [] on error.
 */
export async function getDrawings(phaseId: string) {
  return dbc.drawing
    .findMany({
      where: { phaseId },
      include: { uploadedBy: { select: { id: true, name: true } } },
      orderBy: [{ discipline: "asc" }, { drawingNumber: "asc" }],
    })
    .catch(() => []);
}

// ── Mutations ──

/**
 * Add a drawing record to a phase.
 *
 * `revision` defaults to "0" if not provided — the initial issue.
 * `fileUrl` is optional (metadata-only record is valid before upload).
 *
 * @param data.phaseId       - Phase to attach the drawing to.
 * @param data.title         - Drawing title.
 * @param data.drawingNumber - Drawing number (e.g. "A-101", "S-201").
 * @param data.discipline    - Discipline code (e.g. "Architectural", "Structural").
 * @param data.revision      - Revision identifier (defaults to "0").
 * @param data.description   - Optional description.
 * @param data.fileUrl       - Optional URL to the drawing file.
 * @param data.sheetSize     - Optional sheet size (e.g. "ARCH D", "ISO A1").
 * @param data.scale         - Optional scale (e.g. "1:100", "1/4\"=1'").
 * @returns The newly created drawing record with uploader details.
 * @throws "Forbidden" if the caller lacks create:document permission.
 */
export async function createDrawing(data: {
  phaseId: string;
  title: string;
  drawingNumber: string;
  discipline: string;
  revision?: string;
  description?: string;
  fileUrl?: string;
  sheetSize?: string;
  scale?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "create", "document")) throw new Error("Forbidden");

  const drawing = await dbc.drawing.create({
    data: {
      title: data.title,
      drawingNumber: data.drawingNumber,
      discipline: data.discipline,
      revision: data.revision || "0",   // Default to initial issue
      description: data.description,
      fileUrl: data.fileUrl,
      sheetSize: data.sheetSize,
      scale: data.scale,
      phaseId: data.phaseId,
      uploadedById: session.user.id,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  revalidatePath(`/dashboard/projects`);
  return drawing;
}

/**
 * Update the status of a drawing (e.g. ISSUED, SUPERSEDED, VOID).
 *
 * @param id     - Drawing ID.
 * @param status - New status string.
 * @throws "Forbidden" if the caller lacks update:document permission.
 */
export async function updateDrawingStatus(id: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "document")) throw new Error("Forbidden");

  await dbc.drawing.update({ where: { id }, data: { status } });
  revalidatePath(`/dashboard/projects`);
}

/**
 * Permanently delete a drawing record.
 *
 * @param id - Drawing ID.
 * @throws "Forbidden" if the caller lacks delete:document permission.
 */
export async function deleteDrawing(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "document")) throw new Error("Forbidden");

  await dbc.drawing.delete({ where: { id } });
  revalidatePath(`/dashboard/projects`);
}
