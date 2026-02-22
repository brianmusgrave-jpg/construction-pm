import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canCreateProject } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, FolderKanban, Calendar, Users } from "lucide-react";
import { cn, statusColor, statusLabel, fmtShort } from "@/lib/utils";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const projects = await db.project.findMany({
    where: {
      members: { some: { userId: session.user.id } },
    },
    include: {
      _count: { select: { phases: true, members: true } },
      phases: {
        select: { status: true, estEnd: true, worstEnd: true, name: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const showCreate = canCreateProject(session.user.role);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        {showCreate && (
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No projects yet
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Create your first project to get started.
          </p>
          {showCreate && (
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)]"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project: typeof projects[0]) => {
            const completed = project.phases.filter(
              (p: { status: string }) => p.status === "COMPLETE"
            ).length;
            const total = project._count.phases;
            const progress =
              total > 0 ? Math.round((completed / total) * 100) : 0;
            const lastPhase = project.phases[project.phases.length - 1];

            return (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}/timeline`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-[var(--color-primary-light)] hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900 truncate pr-2">
                    {project.name}
                  </h3>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap",
                      statusColor(project.status)
                    )}
                  >
                    {statusLabel(project.status)}
                  </span>
                </div>

                {project.address && (
                  <p className="text-sm text-gray-500 mb-3 truncate">
                    {project.address}
                  </p>
                )}

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>
                      {completed}/{total} phases
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-[var(--color-primary)] h-1.5 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {project._count.members}
                  </span>
                  {lastPhase?.estEnd && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Est. {fmtShort(lastPhase.estEnd)}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
