"use client";

/**
 * @file components/project/ProjectActions.tsx
 * @description Archive / Restore action button for a project.
 *
 * Render logic:
 *   - Returns `null` if `!canManage`.
 *   - Returns a Restore button (green, RotateCcw icon) when `status === "ARCHIVED"`.
 *   - Returns an Archive button (gray, Archive icon) when status is one of:
 *     `"ACTIVE"`, `"COMPLETED"`, or `"ON_HOLD"`.
 *   - Returns `null` for any other status (e.g. DRAFT before first activation).
 *
 * Both actions use `useTransition` for non-blocking async execution and show a
 * Loader2 spinner while pending. Errors are surfaced via `toast.error`.
 * Archive requires a `confirm()` dialog before proceeding.
 *
 * Server actions: `archiveProject`, `restoreProject`.
 * i18n namespace: `project`.
 */

import { useState, useTransition } from "react";
import { Archive, RotateCcw, Loader2 } from "lucide-react";
import { archiveProject, restoreProject } from "@/actions/projects";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface ProjectActionsProps {
  projectId: string;
  status: string;
  canManage: boolean;
}

export function ProjectActions({ projectId, status, canManage }: ProjectActionsProps) {
  const t = useTranslations("project");
  const [isPending, startTransition] = useTransition();

  if (!canManage) return null;

  function handleArchive() {
    if (!confirm(t("confirmArchive"))) return;
    startTransition(async () => {
      try {
        await archiveProject(projectId);
        toast.success(t("projectArchived"));
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to archive");
      }
    });
  }

  function handleRestore() {
    startTransition(async () => {
      try {
        await restoreProject(projectId);
        toast.success(t("projectRestored"));
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to restore");
      }
    });
  }

  if (status === "ARCHIVED") {
    return (
      <button
        onClick={handleRestore}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
        {t("restore")}
      </button>
    );
  }

  if (status === "COMPLETED" || status === "ACTIVE" || status === "ON_HOLD") {
    return (
      <button
        onClick={handleArchive}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
        {t("archive")}
      </button>
    );
  }

  return null;
}
