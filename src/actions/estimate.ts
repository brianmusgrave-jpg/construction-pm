"use server";

/**
 * @file actions/estimate.ts
 * @description Server actions for construction estimate and takeoff management.
 *
 * Estimates contain line-item takeoffs used to cost out a construction phase
 * before work begins. Structure:
 *   Estimate (header: name, description, status, totalCost)
 *   └─ TakeoffItem[] (description, quantity, unit, unitCost, totalCost, category)
 *
 * The estimate's `totalCost` is kept in sync automatically: every call to
 * `addTakeoffItem` or `deleteTakeoffItem` recalculates the sum across all
 * remaining items and writes it back to the estimate header.
 *
 * Module-level `dbc = db as any`: both the Estimate and TakeoffItem models
 * were added after the last Prisma client generation. Unlike other action
 * files that declare `dbc` inside each function, this file uses a module-level
 * constant — equivalent pattern, different style. See GLOBAL_PROJECT_STANDARDS.md §3.
 *
 * GOTCHA — `getEstimates` has no auth check: it returns [] on any error
 * (including auth failure) rather than throwing. This is intentional for
 * server components that should render empty state on unauthenticated access.
 *
 * All Decimal fields coerced to Number before returning — Prisma Decimal objects
 * cannot be serialised across the server→client boundary.
 *
 * Requires: "document" permission via `can()` from @/lib/permissions.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// Module-level cast — both Estimate and TakeoffItem are not in the generated
// Prisma client types. See GLOBAL_PROJECT_STANDARDS.md §3.
const dbc = db as any;

// ── Queries ──

/**
 * Fetch all estimates for a phase, including all takeoff line items.
 *
 * NOTE: This function has no explicit auth check — it returns `[]` on any
 * error (including unauthenticated access) via `.catch(() => [])`. This makes
 * it safe to call from server components that render empty state for guests.
 *
 * All Decimal fields (totalCost, quantity, unitCost) are coerced to Number
 * for safe client serialisation.
 *
 * @param phaseId - The phase to fetch estimates for.
 * @returns Array of estimates with coerced numeric fields, or [] on error.
 */
export async function getEstimates(phaseId: string) {
  return dbc.estimate
    .findMany({
      where: { phaseId },
      include: {
        createdBy: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    })
    .then((ests: any[]) =>
      ests.map((e: any) => ({
        ...e,
        totalCost: Number(e.totalCost),        // Coerce Prisma Decimal → number
        items: e.items.map((i: any) => ({
          ...i,
          quantity: Number(i.quantity),        // Coerce Prisma Decimal → number
          unitCost: Number(i.unitCost),        // Coerce Prisma Decimal → number
          totalCost: Number(i.totalCost),      // Coerce Prisma Decimal → number
        })),
      }))
    )
    .catch(() => []);                          // Silent fallback — no auth = empty array
}

// ── Mutations ──

/**
 * Create a new estimate header (items are added with `addTakeoffItem`).
 *
 * New estimates start with `totalCost: 0` (no items yet).
 * Status defaults are set by the DB schema (typically "DRAFT").
 *
 * @param data.phaseId     - Phase to attach the estimate to.
 * @param data.name        - Display name for the estimate.
 * @param data.description - Optional longer description.
 * @returns The newly created estimate with coerced totalCost: 0.
 * @throws "Forbidden" if the caller lacks create:document permission.
 */
export async function createEstimate(data: {
  phaseId: string;
  name: string;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "create", "document")) throw new Error("Forbidden");

  const estimate = await dbc.estimate.create({
    data: {
      name: data.name,
      description: data.description,
      phaseId: data.phaseId,
      createdById: session.user.id,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      items: true,
    },
  });

  revalidatePath(`/dashboard/projects`);
  return { ...estimate, totalCost: Number(estimate.totalCost), items: [] };
}

/**
 * Add a takeoff line item to an estimate and recalculate the estimate total.
 *
 * `totalCost` for the item is computed as `quantity × unitCost` before storage.
 * After creating the item, all items for the estimate are re-summed and written
 * back to the estimate header — keeping `estimate.totalCost` always in sync.
 *
 * @param data.estimateId  - Parent estimate ID.
 * @param data.description - Line item description.
 * @param data.quantity    - Number of units.
 * @param data.unit        - Unit of measure (e.g. "SF", "LF", "EA").
 * @param data.unitCost    - Cost per unit.
 * @param data.category    - Optional category (e.g. "Labour", "Materials").
 * @param data.notes       - Optional notes.
 * @returns The newly created TakeoffItem with coerced Decimal fields.
 * @throws "Forbidden" if the caller lacks create:document permission.
 */
export async function addTakeoffItem(data: {
  estimateId: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  category?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "create", "document")) throw new Error("Forbidden");

  const totalCost = data.quantity * data.unitCost;  // Computed before DB write

  const item = await dbc.takeoffItem.create({
    data: {
      description: data.description,
      quantity: data.quantity,
      unit: data.unit,
      unitCost: data.unitCost,
      totalCost,
      category: data.category,
      notes: data.notes,
      estimateId: data.estimateId,
    },
  });

  // Recalculate the estimate header total from all remaining items.
  // This ensures estimate.totalCost stays in sync after every item mutation.
  const allItems = await dbc.takeoffItem.findMany({ where: { estimateId: data.estimateId } });
  const newTotal = allItems.reduce((sum: number, i: any) => sum + Number(i.totalCost), 0);
  await dbc.estimate.update({ where: { id: data.estimateId }, data: { totalCost: newTotal } });

  revalidatePath(`/dashboard/projects`);
  return {
    ...item,
    quantity: Number(item.quantity),
    unitCost: Number(item.unitCost),
    totalCost: Number(item.totalCost),
  };
}

/**
 * Delete a takeoff line item and recalculate the parent estimate's total.
 *
 * After deleting the item, all remaining items are re-summed and written
 * back to the estimate header. If this was the last item, totalCost becomes 0.
 *
 * @param id         - ID of the TakeoffItem to delete.
 * @param estimateId - Parent estimate ID (needed to recalculate total).
 * @throws "Forbidden" if the caller lacks delete:document permission.
 */
export async function deleteTakeoffItem(id: string, estimateId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "document")) throw new Error("Forbidden");

  await dbc.takeoffItem.delete({ where: { id } });

  // Recalculate after deletion — if this was the last item, total becomes 0.
  const allItems = await dbc.takeoffItem.findMany({ where: { estimateId } });
  const newTotal = allItems.reduce((sum: number, i: any) => sum + Number(i.totalCost), 0);
  await dbc.estimate.update({ where: { id: estimateId }, data: { totalCost: newTotal } });

  revalidatePath(`/dashboard/projects`);
}

/**
 * Update the lifecycle status of an estimate (e.g. DRAFT → SUBMITTED → APPROVED).
 *
 * @param id     - Estimate ID.
 * @param status - New status string.
 * @throws "Forbidden" if the caller lacks update:document permission.
 */
export async function updateEstimateStatus(id: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "document")) throw new Error("Forbidden");

  await dbc.estimate.update({ where: { id }, data: { status } });
  revalidatePath(`/dashboard/projects`);
}

/**
 * Permanently delete an estimate and all its takeoff items (cascaded by DB).
 *
 * @param id - ID of the estimate to delete.
 * @throws "Forbidden" if the caller lacks delete:document permission.
 */
export async function deleteEstimate(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "document")) throw new Error("Forbidden");

  await dbc.estimate.delete({ where: { id } });
  revalidatePath(`/dashboard/projects`);
}
