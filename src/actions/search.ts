"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export type SearchResult = {
  type: "project" | "phase" | "document" | "staff";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!query.trim() || query.trim().length < 2) return [];

  const q = query.trim();
  const contains = { contains: q, mode: "insensitive" as const };

  const [projects, phases, documents, staff] = await Promise.all([
    // Projects
    db.project.findMany({
      where: {
        OR: [{ name: contains }, { description: contains }, { address: contains }],
      },
      select: { id: true, name: true, status: true, address: true },
      take: 5,
    }),

    // Phases
    db.phase.findMany({
      where: {
        OR: [{ name: contains }, { detail: contains }],
      },
      select: {
        id: true,
        name: true,
        status: true,
        project: { select: { id: true, name: true } },
      },
      take: 5,
    }),

    // Documents
    db.document.findMany({
      where: {
        OR: [{ name: contains }, { notes: contains }],
      },
      select: {
        id: true,
        name: true,
        category: true,
        phase: {
          select: {
            id: true,
            name: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      take: 5,
    }),

    // Staff
    db.staff.findMany({
      where: {
        OR: [
          { name: contains },
          { company: contains },
          { role: contains },
          { email: contains },
        ],
      },
      select: { id: true, name: true, role: true, company: true },
      take: 5,
    }),
  ]);

  const results: SearchResult[] = [];

  for (const p of projects) {
    results.push({
      type: "project",
      id: p.id,
      title: p.name,
      subtitle: p.address || p.status.replace("_", " "),
      href: `/dashboard/projects/${p.id}`,
    });
  }

  for (const ph of phases) {
    results.push({
      type: "phase",
      id: ph.id,
      title: ph.name,
      subtitle: ph.project.name,
      href: `/dashboard/projects/${ph.project.id}/phases/${ph.id}`,
    });
  }

  for (const d of documents) {
    results.push({
      type: "document",
      id: d.id,
      title: d.name,
      subtitle: `${d.phase.project.name} → ${d.phase.name}`,
      href: `/dashboard/projects/${d.phase.project.id}/phases/${d.phase.id}`,
    });
  }

  for (const s of staff) {
    results.push({
      type: "staff",
      id: s.id,
      title: s.name,
      subtitle: [s.role, s.company].filter(Boolean).join(" · "),
      href: `/dashboard/directory`,
    });
  }

  return results;
}
