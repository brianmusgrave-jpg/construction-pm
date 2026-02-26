"use server";

/**
 * @file actions/lienWaiver.ts
 * @description Server actions for lien waiver management on construction phases.
 *
 * Lien waivers are legal documents in which a subcontractor or supplier
 * relinquishes their right to file a mechanic's lien against the property
 * in exchange for payment. This module tracks waiver records (conditional
 * and unconditional, partial and final) per phase.
 *
 * Status workflow: PENDING → APPROVED | REJECTED
 * When a waiver is APPROVED, `notarized` is automatically set to true.
 *
 * Permission note — deliberately uses update:phase (not create:phase) for
 * creating and deleting waivers, and manage:phase for status updates. This
 * restricts lien waiver management to PM-level users only.
 *
 * Module-level `dbc = db as any` — LienWaiver model is not in the generated
 * Prisma client types. See GLOBAL_PROJECT_STANDARDS.md §3.
 *
 * Uses try/catch (rather than .catch()) in getLienWaivers — functionally
 * equivalent silent fallback to [].
 *
 * Revalidates `/dashboard` (not `/dashboard/projects`) — waivers surface on
 * the top-level dashboard finance panel, not only the project detail view.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// Module-level cast — LienWaiver model is not in the generated Prisma client.
const dbc = db as any;

// ── Queries ──

/**
 * Fetch all lien waivers for a phase, with creator details.
 *
 * Returns [] on any error (including auth failure) — silent fallback for
 * server components rendering empty state. Uses try/catch rather than
 * .catch() but is functionally equivalent.
 *
 * @param phaseId - The phase to fetch waivers for.
 * @returns Array of lien waiver records, or [] on error.
 */
export async function getLienWaivers(phaseId: string) {
  try {
    return await dbc.lienWaiver.findMany({
      where: { phaseId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

// ── Mutations ──

/**
 * Create a new lien waiver record on a phase.
 *
 * @param data.phaseId      - Phase to attach the waiver to.
 * @param data.waiverType   - Type (e.g. "CONDITIONAL_PARTIAL", "UNCONDITIONAL_FINAL").
 * @param data.vendorName   - Name of the subcontractor or supplier.
 * @param data.amount       - Payment amount covered by the waiver (optional).
 * @param data.throughDate  - ISO date string: the "through date" of the waiver (optional).
 * @param data.description  - Optional notes.
 * @returns The newly created lien waiver record.
 * @throws "Forbidden" if the caller lacks update:phase permission (PM+).
 */
export async function createLienWaiver(data: {
  phaseId: string;
  waiverType: string;
  vendorName: string;
  amount?: number;
  throughDate?: string;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("Forbidden");

  const waiver = await dbc.lienWaiver.create({
    data: {
      phaseId: data.phaseId,
      waiverType: data.waiverType,
      vendorName: data.vendorName,
      amount: data.amount || null,
      throughDate: data.throughDate ? new Date(data.throughDate) : null,
      description: data.description || null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/dashboard");
  return waiver;
}

/**
 * Update the status of a lien waiver (PENDING → APPROVED | REJECTED).
 *
 * When status is set to APPROVED, `notarized` is automatically set to true —
 * approval implies the waiver has been notarized and is legally effective.
 *
 * @param id     - Lien waiver ID.
 * @param status - New status string ("APPROVED" | "REJECTED").
 * @throws "Forbidden" if the caller lacks manage:phase permission (higher than update).
 */
export async function updateLienWaiverStatus(id: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

  await dbc.lienWaiver.update({
    where: { id },
    data: { status, ...(status === "APPROVED" ? { notarized: true } : {}) },
  });

  revalidatePath("/dashboard");
}

/**
 * Permanently delete a lien waiver record.
 *
 * @param id - Lien waiver ID.
 * @throws "Forbidden" if the caller lacks update:phase permission (PM+).
 */
export async function deleteLienWaiver(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("Forbidden");

  await dbc.lienWaiver.delete({ where: { id } });
  revalidatePath("/dashboard");
}
