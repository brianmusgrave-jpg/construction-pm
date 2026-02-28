"use server";

/**
 * @file actions/budget.ts
 * @description Server actions for project and phase cost/budget management.
 *
 * Budget data flows through three layers:
 *   1. Project-level budget: a single dollar figure set on the project record.
 *   2. Phase-level costs: estimatedCost and actualCost per phase.
 *   3. Approved change orders: added on top of estimated costs to produce
 *      the "adjusted estimate" shown in the budget breakdown table.
 *
 * The summary query (`getProjectBudgetSummary`) aggregates all three layers
 * into a single response object consumed by the BudgetView component.
 *
 * Key computed fields in the summary:
 *   - adjustedBudget   = projectBudget + totalApprovedCOs
 *   - variance         = totalActual - totalEstimated (positive = over budget)
 *   - adjustedEstimate (per phase) = estimatedCost + phase-level approved COs
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// ── Mutations ──

/**
 * Set or clear the top-level budget for a project.
 * Passing null removes the budget figure entirely (shown as "—" in the UI).
 *
 * Requires: ADMIN or PROJECT_MANAGER role (canManagePhase permission check).
 */
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

/**
 * Update estimated and/or actual cost figures for a single phase.
 * Either field can be set independently — passing `undefined` leaves the
 * existing value unchanged (Prisma ignores undefined in update data).
 * Passing `null` explicitly clears the field.
 *
 * Requires: authenticated session with phase update permission
 *   (ADMIN, PROJECT_MANAGER, or CONTRACTOR).
 */
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

// ── Queries ──

/**
 * Fetch a full budget breakdown for a project, including phase-level costs
 * and approved change order amounts.
 *
 * Returns:
 *   - projectBudget:    raw budget figure (null if unset)
 *   - totalEstimated:   sum of all phase estimatedCost values
 *   - totalActual:      sum of all phase actualCost values
 *   - totalApprovedCOs: sum of all APPROVED change order amounts across phases
 *   - adjustedBudget:   projectBudget + totalApprovedCOs (null if no budget set)
 *   - variance:         totalActual - totalEstimated (0 if no estimates exist)
 *   - phases:           per-phase breakdown with adjustedEstimate per phase
 *
 * Note: Prisma returns Decimal fields as opaque objects — all cost values are
 * explicitly coerced to Number before being returned to avoid serialization
 * issues when passing through the server→client boundary.
 *
 * Requires: authenticated session.
 */
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
            where: { status: "APPROVED" }, // Only approved COs affect budget
            select: { id: true, amount: true, title: true, number: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!project) throw new Error("Project not found");

  // Cast to typed rows — Prisma Decimal fields require explicit Number() coercion
  type PhaseRow = {
    id: string; name: string; status: string;
    estimatedCost: unknown; actualCost: unknown;
    changeOrders: { id: string; amount: unknown; title: string; number: string }[];
  };
  const phases = (project as unknown as { phases: PhaseRow[] }).phases;

  // Aggregate totals across all phases
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
        // Adjusted estimate = base estimate + approved change orders for this phase
        adjustedEstimate: (p.estimatedCost ? Number(p.estimatedCost) : 0) + phaseApprovedCOs,
      };
    }),
  };
}
