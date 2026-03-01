"use server";

/**
 * @file actions/projects.ts
 * @description Server actions for project lifecycle management.
 *
 * Covers: create, update, delete, archive/restore, and list.
 * All mutations require an authenticated session. Create/delete are
 * further gated by role (ADMIN or PROJECT_MANAGER only).
 *
 * Pattern used throughout:
 *   1. Verify session (throw "Unauthorized" if missing)
 *   2. Check role/membership (throw "Forbidden" if insufficient)
 *   3. Validate input with Zod
 *   4. Write to DB via Prisma
 *   5. Revalidate Next.js cache paths
 *   6. Redirect or return data
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { canCreateProject } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// ── Zod Schemas ──

/** Validates a single phase in the project creation wizard. */
const PhaseInputSchema = z.object({
  name: z.string().min(1).max(200),
  detail: z.string().max(1000).optional(),
  isMilestone: z.boolean().optional(),
  estStart: z.string().min(1),
  estEnd: z.string().min(1),
  worstStart: z.string().optional(), // Pessimistic scenario start date
  worstEnd: z.string().optional(),   // Pessimistic scenario end date
});

/** Validates the full project creation payload from the multi-step wizard. */
const CreateProjectWithPhasesSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  planApproval: z.string().optional(), // ISO date string for plan approval
  budget: z.coerce.number().positive().optional(),
  phases: z.array(PhaseInputSchema).optional(),
});

// ── Mutations ──

/**
 * Create a new project with optional pre-built phases (from the wizard).
 * The creator is automatically added as an OWNER member.
 * Sets estCompletion to the latest phase end date if phases are provided.
 * Redirects to the new project's timeline on success.
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
export async function createProjectWithPhases(data: {
  name: string;
  description?: string;
  address?: string;
  planApproval?: string;
  budget?: number;
  phases?: {
    name: string;
    detail?: string;
    isMilestone?: boolean;
    estStart: string;
    estEnd: string;
    worstStart?: string;
    worstEnd?: string;
  }[];
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canCreateProject(session.user.role)) throw new Error("Forbidden");

  const parsed = CreateProjectWithPhasesSchema.parse(data);

  const project = await db.project.create({
    data: {
      orgId: session.user.orgId!,
      name: parsed.name,
      description: parsed.description,
      address: parsed.address,
      planApproval: parsed.planApproval
        ? new Date(parsed.planApproval)
        : undefined,
      budget: parsed.budget,
      status: "ACTIVE",
      members: {
        // Creator becomes OWNER automatically
        create: {
          userId: session.user.id,
          role: "OWNER",
        },
      },
      phases: parsed.phases
        ? {
            create: parsed.phases.map((phase, i) => ({
              name: phase.name,
              detail: phase.detail,
              isMilestone: phase.isMilestone || false,
              sortOrder: i, // Preserve wizard order on the Gantt
              estStart: new Date(phase.estStart),
              estEnd: new Date(phase.estEnd),
              worstStart: phase.worstStart
                ? new Date(phase.worstStart)
                : undefined,
              worstEnd: phase.worstEnd
                ? new Date(phase.worstEnd)
                : undefined,
            })),
          }
        : undefined,
      activityLogs: {
        create: {
          orgId: session.user.orgId!,
          userId: session.user.id,
          action: "PROJECT_CREATED",
          message: `Created project ${parsed.name}`,
        },
      },
    },
  });

  // Derive estCompletion from the furthest phase end date
  if (parsed.phases && parsed.phases.length > 0) {
    const lastDate = parsed.phases.reduce((latest, p) => {
      const end = new Date(p.estEnd);
      return end > latest ? end : latest;
    }, new Date(0));

    await db.project.update({
      where: { id: project.id },
      data: { estCompletion: lastDate },
    });
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${project.id}/timeline`);
}

/**
 * Legacy FormData-based project creator. Kept for backward compatibility
 * with older form submissions that don't go through the wizard.
 * Does not create phases; those are added separately.
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
export async function createProject(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canCreateProject(session.user.role)) throw new Error("Forbidden");

  const name = formData.get("name") as string;

  const project = await db.project.create({
    data: {
      orgId: session.user.orgId!,
      name,
      description: (formData.get("description") as string) || undefined,
      address: (formData.get("address") as string) || undefined,
      planApproval: formData.get("planApproval")
        ? new Date(formData.get("planApproval") as string)
        : undefined,
      budget: formData.get("budget")
        ? Number(formData.get("budget"))
        : undefined,
      members: {
        create: {
          userId: session.user.id,
          role: "OWNER",
        },
      },
      activityLogs: {
        create: {
          orgId: session.user.orgId!,
          userId: session.user.id,
          action: "PROJECT_CREATED",
          message: `Created project ${name}`,
        },
      },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${project.id}/timeline`);
}

/**
 * Update mutable project metadata. Only updates fields that are present
 * in the FormData (empty strings are ignored to preserve existing values).
 *
 * Requires: authenticated session (no role check — member-level update).
 */
export async function updateProject(projectId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const address = formData.get("address") as string;
  const planApproval = formData.get("planApproval") as string;
  const budget = formData.get("budget") as string;

  await db.project.update({
    where: { id: projectId },
    data: {
      ...(name ? { name } : {}),
      ...(description ? { description } : {}),
      ...(address ? { address } : {}),
      ...(planApproval ? { planApproval: new Date(planApproval) } : {}),
      ...(budget ? { budget: Number(budget) } : {}),
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
}

/**
 * Permanently delete a project and all cascaded data (phases, documents, etc.).
 * This is irreversible — prefer archiveProject for soft removal.
 *
 * Requires: ADMIN role only.
 */
export async function deleteProject(projectId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role !== "ADMIN") throw new Error("Forbidden");

  await db.project.delete({ where: { id: projectId } });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/**
 * Soft-archive a project by setting its status to ARCHIVED.
 * Archived projects are hidden from the main list but not deleted.
 * Logs the status change to the activity log.
 *
 * Requires: OWNER or MANAGER membership on the project.
 */
export async function archiveProject(projectId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Verify the user has an OWNER or MANAGER role on this project
  const member = await db.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  });
  if (!member || !["OWNER", "MANAGER"].includes(member.role)) {
    throw new Error("Forbidden");
  }

  await db.project.update({
    where: { id: projectId },
    data: { status: "ARCHIVED" as never },
  });

  await db.activityLog.create({
    data: {
      orgId: session.user.orgId!,
      action: "PROJECT_STATUS_CHANGED" as never,
      message: `Project archived`,
      data: { oldStatus: "ACTIVE", newStatus: "ARCHIVED" },
      projectId,
      userId: session.user.id,
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
}

/**
 * Restore an ARCHIVED project back to ACTIVE status.
 * Logs the status change to the activity log.
 *
 * Requires: OWNER or MANAGER membership on the project.
 */
export async function restoreProject(projectId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const member = await db.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  });
  if (!member || !["OWNER", "MANAGER"].includes(member.role)) {
    throw new Error("Forbidden");
  }

  await db.project.update({
    where: { id: projectId },
    data: { status: "ACTIVE" as never },
  });

  await db.activityLog.create({
    data: {
      orgId: session.user.orgId!,
      action: "PROJECT_STATUS_CHANGED" as never,
      message: `Project restored from archive`,
      data: { oldStatus: "ARCHIVED", newStatus: "ACTIVE" },
      projectId,
      userId: session.user.id,
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
}

// ── Queries ──

/**
 * Fetch all projects the current user is a member of.
 * Includes phase status counts (for dashboard KPI cards) and member counts.
 * Returns [] for unauthenticated users (safe for server component use).
 * Ordered by most recently updated.
 */
export async function getProjects() {
  const session = await auth();
  if (!session?.user) return [];

  return db.project.findMany({
    where: {
      orgId: session.user.orgId!,
      members: { some: { userId: session.user.id } },
    },
    include: {
      _count: { select: { phases: true, members: true } },
      phases: {
        select: { status: true }, // Used for status breakdown on dashboard cards
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}
