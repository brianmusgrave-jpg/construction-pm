"use client";

import { useState, useTransition } from "react";
import {
  Undo2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Clock,
  User,
  FolderKanban,
} from "lucide-react";
import { undoActivity, getActivityLogs } from "@/actions/activity";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface ActivityEntry {
  id: string;
  action: string;
  message: string;
  data: Record<string, unknown> | null;
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  userImage: string | null;
  createdAt: string;
}

interface Props {
  initialLogs: ActivityEntry[];
  totalPages: number;
  totalCount: number;
  projects: { id: string; name: string }[];
  actionTypes: string[];
  isAdmin: boolean;
}

const UNDOABLE_ACTIONS = [
  "PROJECT_STATUS_CHANGED",
  "PHASE_STATUS_CHANGED",
  "MEMBER_REMOVED",
  "MEMBER_UPDATED",
  "CHECKLIST_ITEM_TOGGLED",
];

function formatAction(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function actionColor(action: string): string {
  if (action.includes("CREATED") || action.includes("JOINED") || action.includes("ADDED")) return "bg-green-100 text-green-700";
  if (action.includes("REMOVED") || action.includes("DELETED")) return "bg-red-100 text-red-700";
  if (action.includes("CHANGED") || action.includes("UPDATED") || action.includes("TOGGLED")) return "bg-blue-100 text-blue-700";
  if (action.includes("UPLOADED")) return "bg-purple-100 text-purple-700";
  if (action.includes("INVITED")) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
}

export function ActivityLogClient({
  initialLogs,
  totalPages,
  totalCount,
  projects,
  actionTypes,
  isAdmin,
}: Props) {
  const t = useTranslations("activity");
  const [logs, setLogs] = useState(initialLogs);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(totalPages);
  const [total, setTotal] = useState(totalCount);
  const [filterProject, setFilterProject] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [undoingId, setUndoingId] = useState<string | null>(null);

  function fetchPage(p: number, projId?: string, actType?: string) {
    startTransition(async () => {
      const result = await getActivityLogs({
        page: p,
        projectId: projId || undefined,
        actionType: actType || undefined,
      });
      setLogs(result.logs);
      setPages(result.pages);
      setTotal(result.total);
      setPage(p);
    });
  }

  function handleFilter() {
    fetchPage(1, filterProject, filterAction);
  }

  function handleUndo(logId: string) {
    setUndoingId(logId);
    startTransition(async () => {
      try {
        await undoActivity(logId);
        toast.success(t("undoSuccess"));
        // Refresh current page
        fetchPage(page, filterProject, filterAction);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setUndoingId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {t("totalEntries", { count: total })}
        </p>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Filter className="w-4 h-4" />
          {t("filter")}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg border">
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="">{t("allProjects")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="">{t("allActions")}</option>
            {actionTypes.map((a) => (
              <option key={a} value={a}>
                {formatAction(a)}
              </option>
            ))}
          </select>
          <button
            onClick={handleFilter}
            disabled={isPending}
            className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {t("apply")}
          </button>
        </div>
      )}

      {/* Log entries */}
      {logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">{t("noEntries")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="group flex items-start gap-3 p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0 mt-0.5">
                {log.userImage ? (
                  <img
                    src={log.userImage}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {log.userName}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColor(log.action)}`}
                  >
                    {formatAction(log.action)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{log.message}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <FolderKanban className="w-3 h-3" />
                    {log.projectName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(log.createdAt)}
                  </span>
                </div>
              </div>

              {/* Undo button */}
              {isAdmin && UNDOABLE_ACTIONS.includes(log.action) && !log.message.startsWith("Undo:") && (
                <button
                  onClick={() => handleUndo(log.id)}
                  disabled={undoingId === log.id}
                  className="sm:opacity-0 sm:group-hover:opacity-100 p-2 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all shrink-0"
                  title={t("undo")}
                >
                  {undoingId === log.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Undo2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => fetchPage(page - 1, filterProject, filterAction)}
            disabled={page <= 1 || isPending}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">
            {t("pageOf", { current: page, total: pages })}
          </span>
          <button
            onClick={() => fetchPage(page + 1, filterProject, filterAction)}
            disabled={page >= pages || isPending}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
