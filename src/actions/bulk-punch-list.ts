"use server";

/**
 * @file actions/bulk-punch-list.ts
 * @description Bulk operations for punch list items — Sprint 28.
 *
 * Enables project managers to perform mass operations on punch list items:
 *   - Bulk status change (e.g. close all READY_FOR_REVIEW items)
 *   - Bulk assign (assign multiple items to one staff member)
 *   - Bulk priority change
 *   - Punch list summary export data (formatted for PDF/CSV generation)
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

const dbc = db as any;

// ── Bulk Status Change ──

interface BulkStatusInput {
  itemIds: string[];
  newStatus: "OPEN" | "IN_PROGRESS" | "READY_FOR_REVIEW" | "CLOSED";
  projectId: string;
}

/**
 * Change the status of multiple punch list items at once.
 * Sets closedAt when transitioning to CLOSED.
 * Requires PM+ role on the project.
 */
export async function bulkUpdatePunchListStatus(
  data: BulkStatusInput
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, updatedCount: 0, error: "Unauthorized" };
  }

  try {
    // Check permission — need PM+ for bulk ops
    const membership = await dbc.projectMember.findFirst({
      where: { projectId: data.projectId, userId: session.user.id },
      select: { role: true },
    });

    if (!membership || !can(membership.role, "manage", "phase")) {
      return { success: false, updatedCount: 0, error: "Insufficient permissions" };
    }

    const updateData: any = { status: data.newStatus };
    if (data.newStatus === "CLOSED") {
      updateData.closedAt = new Date();
    } else {
      updateData.closedAt = null;
    }

    const result = await dbc.punchListItem.updateMany({
      where: { id: { in: data.itemIds } },
      data: updateData,
    });

    // Activity log — fire-and-forget
    dbc.activityLog
      .create({
        data: {
          orgId: (session.user as any).orgId!,
          action: "BULK_PUNCH_STATUS",
          message: `Bulk changed ${result.count} punch list items to ${data.newStatus}`,
          projectId: data.projectId,
          userId: session.user.id,
          data: { itemIds: data.itemIds, newStatus: data.newStatus },
        },
      })
      .catch(() => {});

    revalidatePath(`/dashboard/projects/${data.projectId}`);
    return { success: true, updatedCount: result.count };
  } catch (err) {
    console.error("bulkUpdatePunchListStatus error:", err);
    return {
      success: false,
      updatedCount: 0,
      error: err instanceof Error ? err.message : "Bulk status update failed",
    };
  }
}

// ── Bulk Assign ──

interface BulkAssignInput {
  itemIds: string[];
  assignToId: string; // Staff ID
  projectId: string;
}

/**
 * Assign multiple punch list items to one staff member.
 * Requires PM+ role on the project.
 */
export async function bulkAssignPunchListItems(
  data: BulkAssignInput
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, updatedCount: 0, error: "Unauthorized" };
  }

  try {
    const membership = await dbc.projectMember.findFirst({
      where: { projectId: data.projectId, userId: session.user.id },
      select: { role: true },
    });

    if (!membership || !can(membership.role, "manage", "phase")) {
      return { success: false, updatedCount: 0, error: "Insufficient permissions" };
    }

    const result = await dbc.punchListItem.updateMany({
      where: { id: { in: data.itemIds } },
      data: { assignedToId: data.assignToId },
    });

    // Look up staff name for the log
    const staff = await dbc.staff.findUnique({
      where: { id: data.assignToId },
      select: { name: true },
    });

    dbc.activityLog
      .create({
        data: {
          orgId: (session.user as any).orgId!,
          action: "BULK_PUNCH_ASSIGN",
          message: `Bulk assigned ${result.count} punch list items to ${staff?.name || "staff"}`,
          projectId: data.projectId,
          userId: session.user.id,
          data: { itemIds: data.itemIds, assignToId: data.assignToId },
        },
      })
      .catch(() => {});

    revalidatePath(`/dashboard/projects/${data.projectId}`);
    return { success: true, updatedCount: result.count };
  } catch (err) {
    console.error("bulkAssignPunchListItems error:", err);
    return {
      success: false,
      updatedCount: 0,
      error: err instanceof Error ? err.message : "Bulk assign failed",
    };
  }
}

// ── Bulk Priority Change ──

interface BulkPriorityInput {
  itemIds: string[];
  newPriority: "CRITICAL" | "MAJOR" | "MINOR" | "COSMETIC";
  projectId: string;
}

/**
 * Change the priority of multiple punch list items at once.
 */
export async function bulkUpdatePunchListPriority(
  data: BulkPriorityInput
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, updatedCount: 0, error: "Unauthorized" };
  }

  try {
    const membership = await dbc.projectMember.findFirst({
      where: { projectId: data.projectId, userId: session.user.id },
      select: { role: true },
    });

    if (!membership || !can(membership.role, "manage", "phase")) {
      return { success: false, updatedCount: 0, error: "Insufficient permissions" };
    }

    const result = await dbc.punchListItem.updateMany({
      where: { id: { in: data.itemIds } },
      data: { priority: data.newPriority },
    });

    dbc.activityLog
      .create({
        data: {
          orgId: (session.user as any).orgId!,
          action: "BULK_PUNCH_PRIORITY",
          message: `Bulk changed ${result.count} punch list items to ${data.newPriority}`,
          projectId: data.projectId,
          userId: session.user.id,
          data: { itemIds: data.itemIds, newPriority: data.newPriority },
        },
      })
      .catch(() => {});

    revalidatePath(`/dashboard/projects/${data.projectId}`);
    return { success: true, updatedCount: result.count };
  } catch (err) {
    console.error("bulkUpdatePunchListPriority error:", err);
    return {
      success: false,
      updatedCount: 0,
      error: err instanceof Error ? err.message : "Bulk priority update failed",
    };
  }
}

// ── Export Data ──

/**
 * Generate punch list export data for a project.
 * Returns formatted data suitable for CSV/PDF generation by the client.
 */
export async function getPunchListExportData(projectId: string): Promise<{
  success: boolean;
  data?: {
    projectName: string;
    generatedAt: string;
    items: Array<{
      itemNumber: number;
      title: string;
      description: string;
      status: string;
      priority: string;
      location: string;
      assignedTo: string;
      dueDate: string;
      createdAt: string;
      closedAt: string;
      phaseName: string;
    }>;
    summary: {
      total: number;
      open: number;
      inProgress: number;
      readyForReview: number;
      closed: number;
      critical: number;
    };
  };
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const project = await dbc.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    const items = await dbc.punchListItem.findMany({
      where: { phase: { projectId } },
      include: {
        phase: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: [{ phase: { name: "asc" } }, { itemNumber: "asc" }],
    });

    const formatted = items.map((item: any) => ({
      itemNumber: item.itemNumber,
      title: item.title,
      description: item.description || "",
      status: item.status,
      priority: item.priority,
      location: item.location || "",
      assignedTo: item.assignedTo?.name || "Unassigned",
      dueDate: item.dueDate
        ? new Date(item.dueDate).toISOString().split("T")[0]
        : "",
      createdAt: new Date(item.createdAt).toISOString().split("T")[0],
      closedAt: item.closedAt
        ? new Date(item.closedAt).toISOString().split("T")[0]
        : "",
      phaseName: item.phase?.name || "",
    }));

    return {
      success: true,
      data: {
        projectName: project.name,
        generatedAt: new Date().toISOString(),
        items: formatted,
        summary: {
          total: items.length,
          open: items.filter((i: any) => i.status === "OPEN").length,
          inProgress: items.filter((i: any) => i.status === "IN_PROGRESS").length,
          readyForReview: items.filter((i: any) => i.status === "READY_FOR_REVIEW").length,
          closed: items.filter((i: any) => i.status === "CLOSED").length,
          critical: items.filter(
            (i: any) => i.priority === "CRITICAL" && i.status !== "CLOSED"
          ).length,
        },
      },
    };
  } catch (err) {
    console.error("getPunchListExportData error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Export failed",
    };
  }
}
