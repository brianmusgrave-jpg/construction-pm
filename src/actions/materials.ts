"use server";

/**
 * @file actions/materials.ts
 * @description Server actions for phase material tracking (procurement status).
 *
 * Materials represent physical items that need to be ordered, delivered, and
 * installed for a phase to complete. Each material has a 5-stage status workflow:
 *
 *   ORDERED → SHIPPED → DELIVERED → INSTALLED
 *                 ↓
 *            BACKORDERED  (can exit back to ORDERED or go direct to SHIPPED)
 *
 * Timestamps:
 *   `deliveredAt` and `installedAt` are auto-set when status transitions to
 *   DELIVERED or INSTALLED respectively. They are NOT cleared if the status
 *   is changed away — timestamps record when the event first occurred.
 *
 * Authorization:
 *   All mutations verify project membership via `requireMember()`.
 *   `deleteMaterial` additionally requires PM or ADMIN role on the project
 *   (checked via the ProjectMember.role, not the global user role).
 *
 * Decimal coercion:
 *   The `cost` field is a Prisma Decimal. It is coerced to `Number` in
 *   `getMaterials` before returning — Decimal objects are not serialisable
 *   across the server→client boundary.
 *
 * Note: `db` is imported from `@/lib/db-types` here rather than `@/lib/db` due
 * to type-only Material/MaterialStatus imports co-located in that module.
 * The `requireMember` helper uses `db as any` to access `phase` — this is
 * intentional: the phase model may not be present in the db-types Prisma client.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { Material, MaterialStatus } from "@/lib/db-types";
import { z } from "zod";

// ── Zod Schemas ──

const CreateMaterialSchema = z.object({
  phaseId: z.string().min(1),
  name: z.string().min(1).max(300),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(50),         // e.g. "sq ft", "units", "gallons"
  cost: z.number().nonnegative().optional(), // Unit cost (not total)
  supplier: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});

/** Valid material status values — validated before any status update. */
const MaterialStatusSchema = z.enum([
  "ORDERED", "SHIPPED", "DELIVERED", "INSTALLED", "BACKORDERED",
]);

// ── Auth helper ──

/**
 * Assert the current user is a member of the project that owns `phaseId`.
 * Returns the userId, member record, and projectId for use by the calling action.
 *
 * Note: uses `db as any` to access `phase` because this action file imports
 * db from `@/lib/db-types` which may have a narrower Prisma client type.
 */
async function requireMember(phaseId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phase = await (db as any).phase.findUnique({
    where: { id: phaseId },
    include: { project: { include: { members: { where: { userId: session.user.id } } } } },
  });
  if (!phase) throw new Error("Phase not found");
  const member = phase.project.members[0];
  if (!member) throw new Error("Not a project member");
  return { userId: session.user.id, member, projectId: phase.projectId };
}

// ── Queries ──

/**
 * Fetch all materials for a phase, ordered by creation date (oldest first).
 * Returns empty array for unauthenticated callers (safe for server components).
 *
 * `cost` is coerced from Prisma Decimal to Number before return — Decimal is
 * not serialisable across the server→client boundary.
 *
 * @param phaseId - Phase to fetch materials for.
 */
export async function getMaterials(phaseId: string): Promise<Material[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const mats = await db.material.findMany({
    where: { phaseId },
    orderBy: { createdAt: "asc" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mats.map((m: any) => ({ ...m, cost: m.cost ? Number(m.cost) : null }));
}

// ── Mutations ──

/**
 * Create a new material entry for a phase.
 * New materials start with status "ORDERED" automatically.
 *
 * Requires: project membership (any role).
 *
 * @param data.phaseId   - Phase the material belongs to.
 * @param data.name      - Material description (e.g. "Portland Cement Type I").
 * @param data.quantity  - Amount needed (positive number).
 * @param data.unit      - Unit of measure (e.g. "bags", "sq ft", "lf").
 * @param data.cost      - Unit cost in project currency (optional).
 * @param data.supplier  - Supplier name (optional).
 * @param data.notes     - Free-text notes (optional, max 2000 chars).
 */
export async function createMaterial(data: {
  phaseId: string;
  name: string;
  quantity: number;
  unit: string;
  cost?: number;
  supplier?: string;
  notes?: string;
}): Promise<void> {
  const validated = CreateMaterialSchema.parse(data);
  const { projectId } = await requireMember(validated.phaseId);
  await db.material.create({
    data: {
      phaseId: data.phaseId,
      name: data.name,
      quantity: data.quantity,
      unit: data.unit,
      cost: data.cost ?? null,
      supplier: data.supplier ?? null,
      notes: data.notes ?? null,
      status: "ORDERED", // All materials start in the ordered state
    },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

/**
 * Advance or change a material's procurement status.
 * Automatically sets `deliveredAt` / `installedAt` on first transition to
 * those states. Existing timestamps are NOT overwritten if the status is
 * updated again (preserves the "first delivered" timestamp).
 *
 * Requires: project membership (any role).
 *
 * @param materialId - Material to update.
 * @param status     - New status (validated against MaterialStatusSchema).
 */
export async function updateMaterialStatus(
  materialId: string,
  status: MaterialStatus
): Promise<void> {
  MaterialStatusSchema.parse(status); // Throws ZodError on invalid status string

  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");

  const mat = await db.material.findUnique({
    where: { id: materialId },
    include: { phase: { include: { project: { include: { members: { where: { userId: session.user.id } } } } } } },
  });
  if (!mat) throw new Error("Material not found");
  if (!mat.phase.project.members[0]) throw new Error("Not a project member");

  const now = new Date();
  await db.material.update({
    where: { id: materialId },
    data: {
      status,
      // Auto-timestamp on first transition — don't overwrite if already set
      deliveredAt: status === "DELIVERED" ? now : mat.deliveredAt,
      installedAt: status === "INSTALLED" ? now : mat.installedAt,
    },
  });
  revalidatePath(`/dashboard/projects/${mat.phase.projectId}`);
}

/**
 * Delete a material entry.
 * Requires PM or ADMIN role on the project (checked via ProjectMember.role,
 * not the global user.role). Regular contractors cannot delete materials —
 * only the project manager or admin can remove them.
 *
 * @param materialId - Material to delete.
 */
export async function deleteMaterial(materialId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");

  const mat = await db.material.findUnique({
    where: { id: materialId },
    include: { phase: { include: { project: { include: { members: { where: { userId: session.user.id } } } } } } },
  });
  if (!mat) throw new Error("Material not found");

  // Delete requires PM or ADMIN project-level role — not just any member
  const member = mat.phase.project.members[0];
  if (!member || !["PM", "ADMIN"].includes(member.role)) throw new Error("Insufficient permissions");

  await db.material.delete({ where: { id: materialId } });
  revalidatePath(`/dashboard/projects/${mat.phase.projectId}`);
}
