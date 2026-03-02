"use client";

/**
 * @file components/dashboard/widgets/ProjectsWidget.tsx
 * @description Active projects widget with progress bars and current phase.
 */

import Link from "next/link";
import {
  HardHat,
  Clock,
  Users,
  FolderKanban,
  Plus,
} from "lucide-react";
import { cn, statusColor, statusLabel, fmtShort } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface Phase {
  id: string;
  name: string;
  status: string;
  estStart: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  address?: string;
  phaseCount: number;
  completedCount: number;
  memberCount: number;
  currentPhase?: Phase;
  nextPhase?: Phase;
}

interface Props {
  projects: Project[];
  showCreate: boolean;
}

export function ProjectsWidget({ projects, showCreate }: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");

  const activeProjects = projects.filter((p) => p.status !== "ARCHIVED");

  if (activeProjects.length === 0 && projects.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-gray-900 mb-1">{t("noProjectsYet")}</h3>
        <p className="text-xs text-gray-500 mb-3">{t("createFirstProject")}</p>
        {showCreate && (
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-xs font-medium hover:bg-[var(--color-primary-dark)]"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("newProject")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      <div className="px-4 py-2 flex items-center justify-between bg-gray-50/50">
        <span className="text-xs text-gray-500">
          {activeProjects.length} {tc("active").toLowerCase()} · {projects.length} {tc("total")}
        </span>
        {showCreate && (
          <Link
            href="/dashboard/projects/new"
            className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            {t("new")}
          </Link>
        )}
      </div>
      {activeProjects.map((project) => {
        const progress =
          project.phaseCount > 0
            ? Math.round((project.completedCount / project.phaseCount) * 100)
            : 0;

        return (
          <Link
            key={project.id}
            href={`/dashboard/projects/${project.id}`}
            className="block px-4 py-3 hover:bg-blue-50/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-1.5">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 truncate">
                  {project.name}
                </h4>
                {project.address && (
                  <p className="text-xs text-gray-500 truncate">{project.address}</p>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ml-2 shrink-0",
                  statusColor(project.status)
                )}
              >
                {statusLabel(project.status)}
              </span>
            </div>

            {project.currentPhase && (
              <div className="flex items-center gap-1.5 mb-2 p-1.5 bg-[var(--color-primary-bg)] rounded-md">
                <HardHat className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                <span className="text-xs text-[var(--color-primary-dark)] font-medium truncate">
                  {project.currentPhase.name}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-medium px-1 py-0.5 rounded ml-auto shrink-0",
                    statusColor(project.currentPhase.status)
                  )}
                >
                  {statusLabel(project.currentPhase.status)}
                </span>
              </div>
            )}
            {!project.currentPhase && project.nextPhase && (
              <div className="flex items-center gap-1.5 mb-2 p-1.5 bg-gray-50 rounded-md">
                <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span className="text-xs text-gray-700 truncate">
                  {t("nextPhase", { name: project.nextPhase.name })}
                </span>
                <span className="text-[10px] text-gray-500 ml-auto shrink-0">
                  {fmtShort(project.nextPhase.estStart)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${progress}%`,
                      backgroundColor:
                        progress === 100 ? "#16a34a" : "var(--color-primary)",
                    }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-gray-500 whitespace-nowrap">
                {project.completedCount}/{project.phaseCount} {tc("phases")}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                <Users className="w-3 h-3" />
                {project.memberCount}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
