"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const AddDependencySchema = z.object({
  phaseId: z.string().min(1),
  dependsOnId: z.string().min(1),
  lagDays: z.number().int().min(0).optional(),
});

const RemoveDependencySchema = z.object({
  dependencyId: z.string().min(1),
});

type AddDependencyInput = z.infer<typeof AddDependencySchema>;
type RemoveDependencyInput = z.infer<typeof RemoveDependencySchema>;

// Add a dependency between phases
export async function addPhaseDependency(data: AddDependencyInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = AddDependencySchema.parse(data);

  if (parsed.phaseId === parsed.dependsOnId) {
    throw new Error("A phase cannot depend on itself");
  }

  // Verify both phases exist and belong to the same project
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

  // Check for circular dependency (simple check: dependsOn already depends on phase)
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

  // Log activity
  db.activityLog
    .create({
      data: {
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

// Remove a dependency
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

  // Log activity
  db.activityLog
    .create({
      data: {
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

// Get all dependencies for a project (for Gantt chart visualization)
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

// Get dependencies for a specific phase
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

// Get phases that depend on a specific phase
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
