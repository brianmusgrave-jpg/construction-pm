"use server";

/**
 * @file actions/paymentApp.ts
 * @description Server actions for AIA-style payment application management.
 *
 * Payment applications (G702/G703 style) are formal billing documents submitted
 * by the contractor to request progress payment for a period. Each application
 * tracks:
 *   - Scheduled value (contract amount)
 *   - Work completed this period + materials stored on site
 *   - Retainage withheld
 *   - Previous payments made
 *   - Current amount due (auto-calculated)
 *
 * Auto-numbering: `number` is assigned as the previous maximum + 1.
 * Uses `findFirst` with `orderBy: { number: "desc" }` rather than count + 1
 * to handle gaps correctly. Falls back to 1 if no prior applications exist.
 *
 * `currentDue` is calculated server-side before DB write:
 *   currentDue = workCompleted + materialsStored − retainage − previousPayments
 *
 * Module-level `dbc = db as any` — PaymentApplication model is not in the
 * generated Prisma client types. See GLOBAL_PROJECT_STANDARDS.md §3.
 *
 * Status workflow: DRAFT → SUBMITTED → APPROVED | REJECTED
 * Status changes and deletes require manage:phase permission (higher than update).
 *
 * Revalidates `/dashboard` (not `/dashboard/projects`) — payment apps surface
 * on the top-level finance dashboard panel.
 *
 * All Decimal fields coerced to Number before returning for client serialisation.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// Module-level cast — PaymentApplication is not in generated Prisma client types.
const dbc = db as any;

// ── Queries ──

/**
 * Fetch all payment applications for a phase.
 *
 * Returns [] on any error via try/catch — safe for server-component empty state.
 * All six Decimal financial fields are coerced to Number for client serialisation.
 * Ordered by `number` descending (most recent first).
 *
 * @param phaseId - The phase to fetch payment applications for.
 * @returns Array of payment applications with coerced numeric fields, or [].
 */
export async function getPaymentApplications(phaseId: string) {
  try {
    const apps = await dbc.paymentApplication.findMany({
      where: { phaseId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { number: "desc" },
    });
    return apps.map((a: any) => ({
      ...a,
      scheduledValue: a.scheduledValue ? Number(a.scheduledValue) : 0,
      workCompleted: a.workCompleted ? Number(a.workCompleted) : 0,
      materialsStored: a.materialsStored ? Number(a.materialsStored) : 0,
      retainage: a.retainage ? Number(a.retainage) : 0,
      previousPayments: a.previousPayments ? Number(a.previousPayments) : 0,
      currentDue: a.currentDue ? Number(a.currentDue) : 0,
    }));
  } catch {
    return [];
  }
}

// ── Mutations ──

/**
 * Create a new payment application for a phase.
 *
 * `number` is assigned as max(existing numbers) + 1. Uses `findFirst` with
 * `orderBy: { number: "desc" }` rather than count + 1 to correctly handle
 * any gaps from deleted applications.
 *
 * `currentDue` is auto-calculated before the DB write:
 *   currentDue = workCompleted + materialsStored − retainage − previousPayments
 *
 * @param data.phaseId          - Phase to attach the application to.
 * @param data.periodStart      - ISO date string for billing period start.
 * @param data.periodEnd        - ISO date string for billing period end.
 * @param data.scheduledValue   - Total contract/schedule of values amount.
 * @param data.workCompleted    - Work completed this period.
 * @param data.materialsStored  - Materials stored on site (default 0).
 * @param data.retainage        - Retainage withheld (default 0).
 * @param data.previousPayments - Amount paid in prior applications (default 0).
 * @param data.notes            - Optional notes.
 * @returns The created payment application with coerced numeric fields.
 * @throws "Forbidden" if the caller lacks update:phase permission.
 */
export async function createPaymentApplication(data: {
  phaseId: string;
  periodStart: string;
  periodEnd: string;
  scheduledValue: number;
  workCompleted: number;
  materialsStored?: number;
  retainage?: number;
  previousPayments?: number;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("Forbidden");

  // Use max number + 1 (not count + 1) to handle gaps from deleted applications.
  const last = await dbc.paymentApplication.findFirst({
    where: { phaseId: data.phaseId },
    orderBy: { number: "desc" },
    select: { number: true },
  }).catch(() => null);
  const nextNumber = (last?.number || 0) + 1;

  // Calculate amount due server-side.
  const currentDue =
    data.workCompleted +
    (data.materialsStored || 0) -
    (data.retainage || 0) -
    (data.previousPayments || 0);

  const app = await dbc.paymentApplication.create({
    data: {
      phaseId: data.phaseId,
      number: nextNumber,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      scheduledValue: data.scheduledValue,
      workCompleted: data.workCompleted,
      materialsStored: data.materialsStored || 0,
      retainage: data.retainage || 0,
      previousPayments: data.previousPayments || 0,
      currentDue,
      notes: data.notes || null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/dashboard");
  return {
    ...app,
    scheduledValue: Number(app.scheduledValue),
    workCompleted: Number(app.workCompleted),
    materialsStored: Number(app.materialsStored),
    retainage: Number(app.retainage),
    previousPayments: Number(app.previousPayments),
    currentDue: Number(app.currentDue),
  };
}

/**
 * Update the status of a payment application (DRAFT → SUBMITTED → APPROVED | REJECTED).
 *
 * @param id     - Payment application ID.
 * @param status - New status string.
 * @throws "Forbidden" if the caller lacks manage:phase permission (PM+).
 */
export async function updatePaymentAppStatus(id: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

  await dbc.paymentApplication.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/dashboard");
}

/**
 * Permanently delete a payment application.
 *
 * @param id - Payment application ID.
 * @throws "Forbidden" if the caller lacks manage:phase permission (PM+).
 */
export async function deletePaymentApplication(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

  await dbc.paymentApplication.delete({ where: { id } });
  revalidatePath("/dashboard");
}
