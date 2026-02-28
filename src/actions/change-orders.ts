"use server";

/**
 * @file actions/change-orders.ts
 * @description Server actions for change order lifecycle management.
 *
 * Change orders track scope or cost modifications to a phase. They follow a
 * three-state approval workflow: PENDING → APPROVED | REJECTED.
 *
 * Financial impact: approved change orders are included in the budget summary
 * (see budget.ts `getProjectBudgetSummary`) as `totalApprovedCOs`, which
 * adjusts the effective project budget.
 *
 * Notification events fired:
 *   - CHANGE_ORDER_SUBMITTED → all project members on creation
 *   - CHANGE_ORDER_APPROVED / CHANGE_ORDER_REJECTED → the requester on decision
 *
 * Auth pattern:
 *   - Read/create: any authenticated user
 *   - Approve/reject: ADMIN or PROJECT_MANAGER only
 *   - Delete: any authenticated user (typically the requester or a PM)
 */

import { db } from "@/lib/db-types";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notify, getProjectMemberIds } from "@/lib/notifications";

// ── Queries ──

/**
 * Fetch all change orders for a phase, newest first.
 * Includes requester and approver user details for the change order table.
 *
 * Requires: authenticated session.
 */
export async function getChangeOrders(phaseId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  return db.changeOrder.findMany({
    where: { phaseId },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── Mutations ──

/**
 * Submit a new change order for review.
 * Status defaults to PENDING. The requester is recorded as the current session user.
 * Notifies all project members via SSE.
 *
 * Requires: authenticated session.
 */
export async function createChangeOrder(data: {
  phaseId: string;
  number: string;    // Human-readable CO number, e.g. "CO-001"
  title: string;
  description?: string;
  amount?: number;   // Net cost impact (positive = cost increase)
  reason?: string;   // Justification text
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const phase = await db.phase.findUnique({
    where: { id: data.phaseId },
    select: { id: true, name: true, projectId: true },
  });
  if (!phase) throw new Error("Phase not found");

  const co = await db.changeOrder.create({
    data: {
      number: data.number,
      title: data.title,
      description: data.description ?? null,
      amount: data.amount ?? null,
      reason: data.reason ?? null,
      status: "PENDING",
      phaseId: data.phaseId,
      requestedById: session.user.id,
    },
  });

  // Notify all project members of the new submission
  const memberIds = await getProjectMemberIds(phase.projectId);
  notify({
    type: "CHANGE_ORDER_SUBMITTED",
    title: `Change Order ${data.number}: ${data.title}`,
    message: `New change order submitted for ${phase.name}`,
    recipientIds: memberIds,
    actorId: session.user.id,
    data: { projectId: phase.projectId, phaseId: phase.id, changeOrderId: co.id },
  });

  revalidatePath(`/dashboard/projects/${phase.projectId}`);
  return co;
}

/**
 * Approve or reject a pending change order.
 * Records the approver and timestamp. Notifies only the original requester
 * (not all members — they were already notified on submission).
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
export async function updateChangeOrderStatus(
  changeOrderId: string,
  status: "APPROVED" | "REJECTED"
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Only PM/Admin can approve or reject
  const userRole = session.user.role ?? "VIEWER";
  if (userRole !== "ADMIN" && userRole !== "PROJECT_MANAGER") {
    throw new Error("Only PMs and admins can approve change orders");
  }

  const co = await db.changeOrder.findUnique({
    where: { id: changeOrderId },
    include: { phase: { select: { projectId: true, name: true } }, requestedBy: true },
  });
  if (!co) throw new Error("Change order not found");

  const updated = await db.changeOrder.update({
    where: { id: changeOrderId },
    data: {
      status,
      approvedById: session.user.id,
      approvedAt: new Date(),
    },
  });

  // Notify only the requester of the decision
  const notifType = status === "APPROVED" ? "CHANGE_ORDER_APPROVED" : "CHANGE_ORDER_REJECTED";
  notify({
    type: notifType,
    title: `Change Order ${status === "APPROVED" ? "Approved" : "Rejected"}: ${co.title}`,
    message: `Your change order "${co.title}" in ${co.phase.name} was ${status.toLowerCase()}`,
    recipientIds: [co.requestedById],
    actorId: session.user.id,
    data: { projectId: co.phase.projectId, phaseId: co.phaseId, changeOrderId },
  });

  revalidatePath(`/dashboard/projects/${co.phase.projectId}`);
  return updated;
}

/**
 * Permanently delete a change order (typically used to cancel a pending submission).
 *
 * Requires: authenticated session.
 */
export async function deleteChangeOrder(changeOrderId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const co = await db.changeOrder.findUnique({
    where: { id: changeOrderId },
    include: { phase: { select: { projectId: true } } },
  });
  if (!co) throw new Error("Change order not found");

  await db.changeOrder.delete({ where: { id: changeOrderId } });
  revalidatePath(`/dashboard/projects/${co.phase.projectId}`);
  return { success: true };
}
