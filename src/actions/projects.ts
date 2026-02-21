"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { canCreateProject } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  planApproval: z.string().optional(),
  budget: z.coerce.number().positive().optional(),
});

export async function createProject(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canCreateProject(session.user.role)) throw new Error("Forbidden");

  const parsed = CreateProjectSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    address: formData.get("address") || undefined,
    planApproval: formData.get("planApproval") || undefined,
    budget: formData.get("budget") || undefined,
  });

  const project = await db.project.create({
    data: {
      name: parsed.name,
      description: parsed.description,
      address: parsed.address,
      planApproval: parsed.planApproval
        ? new Date(parsed.planApproval)
        : undefined,
      budget: parsed.budget,
      members: {
        create: {
          userId: session.user.id,
          role: "OWNER",
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

  const parsed = CreateProjectSchema.partial().parse({
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    address: formData.get("address") || undefined,
    planApproval: formData.get("planApproval") || undefined,
    budget: formData.get("budget") || undefined,
  });

  await db.project.update({
    where: { id: projectId },
    data: {
      ...parsed,
      planApproval: parsed.planApproval
        ? new Date(parsed.planApproval)
        : undefined,
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
