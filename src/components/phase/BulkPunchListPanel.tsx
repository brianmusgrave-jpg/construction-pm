"use client";

/**
 * @file BulkPunchListPanel.tsx
 * @description Bulk operations panel for punch list items — Sprint 28.
 * Enables mass status change, mass assign, priority change, and export.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ListChecks,
  UserPlus,
  ArrowUpDown,
  Download,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  bulkUpdatePunchListStatus,
  bulkAssignPunchListItems,
  bulkUpdatePunchListPriority,
  getPunchListExportData,
} from "@/actions/bulk-punch-list";

interface BulkPunchListPanelProps {
  projectId: string;
  selectedIds: string[];
  staffList: Array<{ id: string; name: string }>;
  onComplete: () => void;
}

export default function BulkPunchListPanel({
  projectId,
  selectedIds,
  staffList,
  onComplete,
}: BulkPunchListPanelProps) {
  const t = useTranslations("bulkPunchList");
  const [loading, setLoading] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState("CLOSED");
  const [targetPriority, setTargetPriority] = useState("MAJOR");
  const [targetStaff, setTargetStaff] = useState("");

  const handleBulkStatus = async () => {
    if (selectedIds.length === 0) {
      toast.error(t("noItemsSelected"));
      return;
    }
    setLoading("status");
    try {
      const result = await bulkUpdatePunchListStatus({
        itemIds: selectedIds,
        newStatus: targetStatus as any,
        projectId,
      });
      if (result.success) {
        toast.success(t("statusUpdated", { count: result.updatedCount }));
        onComplete();
      } else {
        toast.error(result.error || t("updateFailed"));
      }
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setLoading(null);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedIds.length === 0 || !targetStaff) {
      toast.error(!targetStaff ? t("selectStaff") : t("noItemsSelected"));
      return;
    }
    setLoading("assign");
    try {
      const result = await bulkAssignPunchListItems({
        itemIds: selectedIds,
        assignToId: targetStaff,
        projectId,
      });
      if (result.success) {
        toast.success(t("assigned", { count: result.updatedCount }));
        onComplete();
      } else {
        toast.error(result.error || t("assignFailed"));
      }
    } catch {
      toast.error(t("assignFailed"));
    } finally {
      setLoading(null);
    }
  };

  const handleBulkPriority = async () => {
    if (selectedIds.length === 0) {
      toast.error(t("noItemsSelected"));
      return;
    }
    setLoading("priority");
    try {
      const result = await bulkUpdatePunchListPriority({
        itemIds: selectedIds,
        newPriority: targetPriority as any,
        projectId,
      });
      if (result.success) {
        toast.success(t("priorityUpdated", { count: result.updatedCount }));
        onComplete();
      } else {
        toast.error(result.error || t("updateFailed"));
      }
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setLoading(null);
    }
  };

  const handleExport = async () => {
    setLoading("export");
    try {
      const result = await getPunchListExportData(projectId);
      if (result.success && result.data) {
        // Generate CSV client-side
        const headers = [
          "Phase",
          "#",
          "Title",
          "Status",
          "Priority",
          "Location",
          "Assigned To",
          "Due Date",
          "Created",
          "Closed",
        ];
        const rows = result.data.items.map((item) => [
          item.phaseName,
          item.itemNumber,
          `"${item.title.replace(/"/g, '""')}"`,
          item.status,
          item.priority,
          `"${item.location.replace(/"/g, '""')}"`,
          item.assignedTo,
          item.dueDate,
          item.createdAt,
          item.closedAt,
        ]);

        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
          "\n"
        );
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `punch-list-${result.data.projectName.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t("exported"));
      } else {
        toast.error(result.error || t("exportFailed"));
      }
    } catch {
      toast.error(t("exportFailed"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="border border-orange-200 rounded-lg bg-orange-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="w-5 h-5 text-orange-600" />
        <h3 className="font-semibold text-orange-900">{t("title")}</h3>
        {selectedIds.length > 0 && (
          <span className="ml-auto text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
            {t("selected", { count: selectedIds.length })}
          </span>
        )}
      </div>

      {/* Bulk Status Change */}
      <div className="flex items-center gap-2">
        <select
          value={targetStatus}
          onChange={(e) => setTargetStatus(e.target.value)}
          className="text-sm border border-orange-300 rounded px-2 py-1.5 bg-white flex-1"
        >
          <option value="OPEN">{t("statusOpen")}</option>
          <option value="IN_PROGRESS">{t("statusInProgress")}</option>
          <option value="READY_FOR_REVIEW">{t("statusReady")}</option>
          <option value="CLOSED">{t("statusClosed")}</option>
        </select>
        <button
          onClick={handleBulkStatus}
          disabled={loading === "status" || selectedIds.length === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
        >
          {loading === "status" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          {t("setStatus")}
        </button>
      </div>

      {/* Bulk Assign */}
      <div className="flex items-center gap-2">
        <select
          value={targetStaff}
          onChange={(e) => setTargetStaff(e.target.value)}
          className="text-sm border border-orange-300 rounded px-2 py-1.5 bg-white flex-1"
        >
          <option value="">{t("selectStaffPlaceholder")}</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleBulkAssign}
          disabled={loading === "assign" || selectedIds.length === 0 || !targetStaff}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading === "assign" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <UserPlus className="w-3.5 h-3.5" />
          )}
          {t("assign")}
        </button>
      </div>

      {/* Bulk Priority */}
      <div className="flex items-center gap-2">
        <select
          value={targetPriority}
          onChange={(e) => setTargetPriority(e.target.value)}
          className="text-sm border border-orange-300 rounded px-2 py-1.5 bg-white flex-1"
        >
          <option value="CRITICAL">{t("priorityCritical")}</option>
          <option value="MAJOR">{t("priorityMajor")}</option>
          <option value="MINOR">{t("priorityMinor")}</option>
          <option value="COSMETIC">{t("priorityCosmetic")}</option>
        </select>
        <button
          onClick={handleBulkPriority}
          disabled={loading === "priority" || selectedIds.length === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loading === "priority" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5" />
          )}
          {t("setPriority")}
        </button>
      </div>

      {/* Export */}
      <button
        onClick={handleExport}
        disabled={loading === "export"}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors w-full justify-center"
      >
        {loading === "export" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        {t("exportCsv")}
      </button>
    </div>
  );
}
