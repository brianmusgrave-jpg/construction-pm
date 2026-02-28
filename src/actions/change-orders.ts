"use server";

import { db } from "@/lib/db-types";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notify, getProjectMemberIds } from "@/lib/notifications";

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

export async function createChangeOrder(data: {
  phaseId: string;
  number: string;
  title: string;
  description?: string;
  amount?: number;
  reason?: string;
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

  // Notify project members
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

export async function updateChangeOrderStatus(
  changeOrderId: string,
  status: "APPROVED" | "REJECTED"
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Only PM/Admin can approve/reject
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

  // Notify the requester
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
