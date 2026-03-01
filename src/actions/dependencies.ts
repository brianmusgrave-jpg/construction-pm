"use server";

/**
 * @file actions/dependencies.ts
 * @description Server actions for phase dependency (finish-to-start) relationships.
 *
 * Phase dependencies model the Gantt chart constraint "Phase B cannot start until
 * Phase A is complete." They are stored as a PhaseDependency join table with an
 * optional `lagDays` buffer (e.g. "B starts 3 days after A finishes").
 *
 * Circular dependency detection:
 *   The current implementation performs a single-hop cycle check — it verifies
 *   that the proposed dependency does not immediately reverse an existing edge.
 *   Transitive cycles (A→B→C→A) are NOT caught and must be handled at the UI
 *   layer (e.g. by disabling already-reachable predecessors in the picker).
 *
 * Cross-project guard:
 *   Both phases are fetched before creation and their `projectId` is compared —
 *   dependencies across different projects are rejected.
 *
 * Gantt chart consumers:
 *   - `getProjectDependencies` — returns all edges for a project (used to draw
 *     dependency arrows on the Gantt).
 *   - `getPhaseDepenencies`    — predecessors of a given phase (note: typo in
 *     function name is preserved for backward compatibility with existing call sites).
 *   - `getPhaseDependents`     — successors of a given phase (used to show
 *     "phases that will be affected if this phase slips").
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Zod Schemas ──

const AddDependencySchema = z.object({
  phaseId: z.string().min(1),      // The dependent phase (the one that must wait)
  dependsOnId: z.string().min(1),  // The prerequisite phase (must be complete first)
  lagDays: z.number().int().min(0).optional(), // Optional buffer days after predecessor end
});

const RemoveDependencySchema = z.object({
  dependencyId: z.string().min(1),
});

type AddDependencyInput = z.infer<typeof AddDependencySchema>;
type RemoveDependencyInput = z.infer<typeof RemoveDependencySchema>;

// ── Mutations ──

/**
 * Create a finish-to-start dependency between two phases in the same project.
 *
 * Semantics: "phaseId cannot start until dependsOnId is complete, plus lagDays."
 *
 * Guards:
 *   - A phase cannot depend on itself.
 *   - Both phases must exist and belong to the same project.
 *   - A direct (single-hop) cycle is rejected — `dependsOnId` must not already
 *     depend on `phaseId`.
 *
 * @param data.phaseId      - The waiting phase (dependent).
 * @param data.dependsOnId  - The prerequisite phase.
 * @param data.lagDays      - Days to wait after dependsOnId ends before phaseId starts
 *                            (default 0 — immediate start).
 * @returns The created PhaseDependency record.
 */
export async function addPhaseDependency(data: AddDependencyInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = AddDependencySchema.parse(data);

  if (parsed.phaseId === parsed.dependsOnId) {
    throw new Error("A phase cannot depend on itself");
  }

  // Fetch both phases to validate existence and project membership
  const [phase, dependsOn] = await Promise.all([
    db.phase.findUnique({
      where: { id: parsed.phaseId },
      select: { id: true, name: true, projectId: true },
    }),
    db.phase.findUnique({
      where: { id: parsed.dependsOnId },
      select: { id: true, name: true, projectId: true },
    }),
  ]);

  if (!phase || !dependsOn) throw new Error("Phase not found");
  if (phase.projectId !== dependsOn.projectId) {
    throw new Error("Phases must belong to the same project");
  }

  // Single-hop cycle detection: does dependsOn already depend on phase?
  // Note: transitive cycles are the UI's responsibility to prevent
  const circular = await db.phaseDependency.findFirst({
    where: { phaseId: parsed.dependsOnId, dependsOnId: parsed.phaseId },
  });
  if (circular) throw new Error("Circular dependency detected");

  const dep = await db.phaseDependency.create({
    data: {
      phaseId: parsed.phaseId,
      dependsOnId: parsed.dependsOnId,
      lagDays: parsed.lagDays ?? 0,
    },
  });

  // Activity log — fire-and-forget
  db.activityLog
    .create({
      data: {
        orgId: session.user.orgId!,
        action: "DEPENDENCY_ADDED",
        message: `${phase.name} now depends on ${dependsOn.name}`,
        projectId: phase.projectId,
        userId: session.user.id,
        data: { phaseId: parsed.phaseId, dependsOnId: parsed.dependsOnId },
      },
    })
    .catch(() => {});

  revalidatePath(`/dashboard/projects/${phase.projectId}`);
  return dep;
}

/**
 * Remove a phase dependency edge.
 *
 * Looks up the dependency to retrieve the `projectId` for cache revalidation,
 * then hard-deletes the row.
 *
 * @param data.dependencyId - ID of the PhaseDependency row to remove.
 * @returns `{ success: true }` on deletion.
 */
export async function removePhaseDependency(data: RemoveDependencyInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = RemoveDependencySchema.parse(data);

  const dep = await db.phaseDependency.findUnique({
    where: { id: parsed.dependencyId },
    include: { phase: { select: { projectId: true, name: true } } },
  });

  if (!dep) throw new Error("Dependency not found");

  await db.phaseDependency.delete({ where: { id: parsed.dependencyId } });

  // Activity log — fire-and-forget
  db.activityLog
    .create({
      data: {
        orgId: session.user.orgId!,
        action: "DEPENDENCY_REMOVED",
        message: `Removed dependency for ${dep.phase.name}`,
        projectId: dep.phase.projectId,
        userId: session.user.id,
        data: { dependencyId: parsed.dependencyId },
      },
    })
    .catch(() => {});

  revalidatePath(`/dashboard/projects/${dep.phase.projectId}`);
  return { success: true };
}

// ── Queries ──

/**
 * Fetch all dependency edges for a project.
 * Used by the Gantt chart to render arrow connectors between phases.
 * Includes abbreviated phase names for the arrow tooltip labels.
 *
 * @param projectId - Project to fetch dependencies for.
 */
export async function getProjectDependencies(projectId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return db.phaseDependency.findMany({
    where: { phase: { projectId } },
    include: {
      phase: { select: { id: true, name: true } },
      dependsOn: { select: { id: true, name: true } },
    },
  });
}

/**
 * Fetch the prerequisite phases for a given phase (its "blockers").
 * Used in the phase detail panel to show "This phase is blocked until:"
 *
 * Note: the function name contains a typo ("Depenencies" vs "Dependencies").
 * It is preserved as-is for backward compatibility with existing call sites.
 *
 * @param phaseId - Phase to fetch predecessors for.
 */
export async function getPhaseDepenencies(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return db.phaseDependency.findMany({
    where: { phaseId },
    include: {
      dependsOn: { select: { id: true, name: true, estEnd: true } },
    },
  });
}

/**
 * Fetch the phases that depend on a given phase (its "successors").
 * Used in the phase detail panel to show "Slipping this phase would affect:"
 *
 * @param phaseId - Phase to fetch dependents for.
 */
export async function getPhaseDependents(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return db.phaseDependency.findMany({
    where: { dependsOnId: phaseId },
    include: {
      phase: { select: { id: true, name: true, estStart: true } },
    },
  });
}
