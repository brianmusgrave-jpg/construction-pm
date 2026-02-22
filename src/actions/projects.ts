"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { canCreateProject } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const PhaseInputSchema = z.object({
  name: z.string().min(1).max(200),
  detail: z.string().max(1000).optional(),
  isMilestone: z.boolean().optional(),
  estStart: z.string().min(1),
  estEnd: z.string().min(1),
  worstStart: z.string().optional(),
  worstEnd: z.string().optional(),
});

const CreateProjectWithPhasesSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  planApproval: z.string().optional(),
  budget: z.coerce.number().positive().optional(),
  phases: z.array(PhaseInputSchema).optional(),
});

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
      name: parsed.name,
      description: parsed.description,
      address: parsed.address,
      planApproval: parsed.planApproval
        ? new Date(parsed.planApproval)
        : undefined,
      budget: parsed.budget,
      status: "ACTIVE",
      members: {
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
              sortOrder: i,
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
          userId: session.user.id,
          action: "PROJECT_CREATED",
          message: `Created project ${parsed.name}`,
        },
      },
    },
  });

  // Compute estimated completion from last phase
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

// Keep the old FormData-based action for backward compat
export async function createProject(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canCreateProject(session.user.role)) throw new Error("Forbidden");

  const name = formData.get("name") as string;

  const project = await db.project.create({
    data: {
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

export async function deleteProject(projectId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role !== "ADMIN") throw new Error("Forbidden");

  await db.project.delete({ where: { id: projectId } });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function getProjects() {
  const session = await auth();
  if (!session?.user) return [];

  return db.project.findMany({
    where: {
      members: { some: { userId: session.user.id } },
    },
    include: {
      _count: { select: { phases: true, members: true } },
      phases: {
        select: { status: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}
