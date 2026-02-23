"use server";

import { db } from "@/lib/db-types";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notify, getProjectMemberIds } from "@/lib/notifications";
import { z } from "zod";

const CreateInspectionSchema = z.object({
  phaseId: z.string().min(1),
  title: z.string().min(1).max(500),
  inspectorName: z.string().max(200).optional(),
  scheduledAt: z.string().min(1),
  notifyOnResult: z.boolean().optional(),
});

const InspectionResultSchema = z.enum(["PASS", "FAIL", "CONDITIONAL"]);

export async function getInspections(phaseId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return db.inspection.findMany({
    where: { phaseId },
    orderBy: { scheduledAt: "desc" },
  });
}

export async function createInspection(data: {
  phaseId: string;
  title: string;
  inspectorName?: string;
  scheduledAt: string;
  notifyOnResult?: boolean;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const validated = CreateInspectionSchema.parse(data);

  const phase = await db.phase.findUnique({
    where: { id: data.phaseId },
    select: { id: true, name: true, projectId: true },
  });
  if (!phase) throw new Error("Phase not found");

  const inspection = await db.inspection.create({
    data: {
      title: data.title,
      inspectorName: data.inspectorName ?? null,
      scheduledAt: new Date(data.scheduledAt),
      notifyOnResult: data.notifyOnResult ?? true,
      phaseId: data.phaseId,
    },
  });

  // Notify members
  const memberIds = await getProjectMemberIds(phase.projectId);
  notify({
    type: "INSPECTION_SCHEDULED",
    title: `Inspection Scheduled: ${data.title}`,
    message: `Inspection scheduled for ${phase.name} on ${new Date(data.scheduledAt).toLocaleDateString()}`,
    recipientIds: memberIds,
    actorId: session.user.id,
    data: { projectId: phase.projectId, phaseId: phase.id, inspectionId: inspection.id },
  });

  revalidatePath(`/dashboard/projects/${phase.projectId}`);
  return inspection;
}

export async function recordInspectionResult(
  inspectionId: string,
  result: "PASS" | "FAIL" | "CONDITIONAL",
  notes?: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  InspectionResultSchema.parse(result);

  const inspection = await db.inspection.findUnique({
    where: { id: inspectionId },
    include: { phase: { select: { projectId: true, name: true } } },
  });
  if (!inspection) throw new Error("Inspection not found");

  const updated = await db.inspection.update({
    where: { id: inspectionId },
    data: { result, completedAt: new Date(), notes: notes ?? null },
  });

  if (inspection.notifyOnResult) {
    const memberIds = await getProjectMemberIds(inspection.phase.projectId);
    const resultLabel = result === "PASS" ? "Passed ✓" : result === "FAIL" ? "Failed ✗" : "Conditional";
    notify({
      type: "INSPECTION_RESULT",
      title: `Inspection ${resultLabel}: ${inspection.title}`,
      message: `${inspection.title} in ${inspection.phase.name}: ${resultLabel}`,
      recipientIds: memberIds,
      actorId: session.user.id,
      data: { projectId: inspection.phase.projectId, phaseId: inspection.phaseId, inspectionId },
    });
  }

  revalidatePath(`/dashboard/projects/${inspection.phase.projectId}`);
  return updated;
}

export async function deleteInspection(inspectionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const inspection = await db.inspection.findUnique({
    where: { id: inspectionId },
    include: { phase: { select: { projectId: true } } },
  });
  if (!inspection) throw new Error("Inspection not found");

  await db.inspection.delete({ where: { id: inspectionId } });
  revalidatePath(`/dashboard/projects/${inspection.phase.projectId}`);
  return { success: true };
}
