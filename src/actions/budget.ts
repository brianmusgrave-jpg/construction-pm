"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function updateProjectBudget(
  projectId: string,
  budget: number | null
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "manage", "phase"))
    throw new Error("Forbidden");

  await db.project.update({
    where: { id: projectId },
    data: { budget: budget },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function updatePhaseCosts(
  phaseId: string,
  data: { estimatedCost?: number | null; actualCost?: number | null }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "update", "phase"))
    throw new Error("Forbidden");

  const phase = await db.phase.update({
    where: { id: phaseId },
    data: {
      estimatedCost: data.estimatedCost !== undefined ? data.estimatedCost : undefined,
      actualCost: data.actualCost !== undefined ? data.actualCost : undefined,
    },
    select: { projectId: true },
  });

  revalidatePath(`/dashboard/projects/${phase.projectId}`);
  return { success: true };
}

export async function getProjectBudgetSummary(projectId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      budget: true,
      phases: {
        select: {
          id: true,
          name: true,
          status: true,
          estimatedCost: true,
          actualCost: true,
          changeOrders: {
            where: { status: "APPROVED" },
            select: { id: true, amount: true, title: true, number: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!project) throw new Error("Project not found");

  type PhaseRow = {
    id: string; name: string; status: string;
    estimatedCost: unknown; actualCost: unknown;
    changeOrders: { id: string; amount: unknown; title: string; number: string }[];
  };
  const phases = (project as unknown as { phases: PhaseRow[] }).phases;

  const totalEstimated = phases.reduce(
    (sum: number, p: PhaseRow) => sum + (p.estimatedCost ? Number(p.estimatedCost) : 0),
    0
  );
  const totalActual = phases.reduce(
    (sum: number, p: PhaseRow) => sum + (p.actualCost ? Number(p.actualCost) : 0),
    0
  );
  const totalApprovedCOs = phases.reduce(
    (sum: number, p: PhaseRow) =>
      sum +
      p.changeOrders.reduce(
        (s: number, co) => s + (co.amount ? Number(co.amount) : 0),
        0
      ),
    0
  );
  const projectBudget = project.budget ? Number(project.budget) : null;

  return {
    projectBudget,
    totalEstimated,
    totalActual,
    totalApprovedCOs,
    adjustedBudget: projectBudget !== null ? projectBudget + totalApprovedCOs : null,
    variance: totalEstimated > 0 ? totalActual - totalEstimated : 0,
    phases: phases.map((p: PhaseRow) => {
      const phaseApprovedCOs = p.changeOrders.reduce(
        (s: number, co) => s + (co.amount ? Number(co.amount) : 0),
        0
      );
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        estimatedCost: p.estimatedCost ? Number(p.estimatedCost) : null,
        actualCost: p.actualCost ? Number(p.actualCost) : null,
        approvedCOs: phaseApprovedCOs,
        adjustedEstimate: (p.estimatedCost ? Number(p.estimatedCost) : 0) + phaseApprovedCOs,
      };
    }),
  };
}
