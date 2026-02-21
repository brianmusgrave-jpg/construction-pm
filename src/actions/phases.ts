"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { canManagePhase } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreatePhaseSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(200),
  detail: z.string().max(1000).optional(),
  isMilestone: z.boolean().optional(),
  estStart: z.string(),
  estEnd: z.string(),
  worstStart: z.string().optional(),
  worstEnd: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

const UpdateDatesSchema = z.object({
  phaseId: z.string().min(1),
  estStart: z.string(),
  estEnd: z.string(),
  worstStart: z.string().optional().nullable(),
  worstEnd: z.string().optional().nullable(),
});

export async function createPhase(data: z.infer<typeof CreatePhaseSchema>) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManagePhase(session.user.role)) throw new Error("Forbidden");

  const parsed = CreatePhaseSchema.parse(data);

  // Get next sort order
  const maxOrder = await db.phase.aggregate({
    where: { projectId: parsed.projectId },
    _max: { sortOrder: true },
  });

  const phase = await db.phase.create({
    data: {
      projectId: parsed.projectId,
      name: parsed.name,
      detail: parsed.detail,
      isMilestone: parsed.isMilestone || false,
      estStart: new Date(parsed.estStart),
      estEnd: new Date(parsed.estEnd),
      worstStart: parsed.worstStart ? new Date(parsed.worstStart) : null,
      worstEnd: parsed.worstEnd ? new Date(parsed.worstEnd) : null,
      sortOrder: parsed.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath(`/dashboard/projects/${parsed.projectId}`);
  return phase;
}

export async function updatePhaseDates(
  data: z.infer<typeof UpdateDatesSchema>
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = UpdateDatesSchema.parse(data);

  await db.phase.update({
    where: { id: parsed.phaseId },
    data: {
      estStart: new Date(parsed.estStart),
      estEnd: new Date(parsed.estEnd),
      worstStart: parsed.worstStart ? new Date(parsed.worstStart) : undefined,
      worstEnd: parsed.worstEnd ? new Date(parsed.worstEnd) : undefined,
    },
  });

  // Don't revalidate on every drag — caller should debounce
}

export async function updatePhaseStatus(
  phaseId: string,
  status: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const validStatuses = [
    "PENDING",
    "IN_PROGRESS",
    "REVIEW_REQUESTED",
    "UNDER_REVIEW",
    "COMPLETE",
  ];
  if (!validStatuses.includes(status)) throw new Error("Invalid status");

  // Only PM/Admin can approve reviews
  if (
    (status === "UNDER_REVIEW" || status === "COMPLETE") &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "PROJECT_MANAGER"
  ) {
    throw new Error("Forbidden");
  }

  const phase = await db.phase.update({
    where: { id: phaseId },
    data: {
      status: status as "PENDING" | "IN_PROGRESS" | "REVIEW_REQUESTED" | "UNDER_REVIEW" | "COMPLETE",
      ...(status === "COMPLETE" ? { progress: 100, actualEnd: new Date() } : {}),
      ...(status === "IN_PROGRESS" && { actualStart: new Date() }),
    },
    include: { project: true },
  });

  revalidatePath(`/dashboard/projects/${phase.projectId}`);
  return phase;
}

export async function deletePhase(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManagePhase(session.user.role)) throw new Error("Forbidden");

  const phase = await db.phase.delete({ where: { id: phaseId } });
  revalidatePath(`/dashboard/projects/${phase.projectId}`);
}

export async function getProjectPhases(projectId: string) {
  return db.phase.findMany({
    where: { projectId },
    include: {
      assignments: {
        include: {
          staff: { select: { id: true, name: true, company: true } },
        },
      },
      _count: { select: { documents: true, photos: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}
