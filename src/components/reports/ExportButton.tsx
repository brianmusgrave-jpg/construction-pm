"use client";

/**
 * @file components/reports/ExportButton.tsx
 * @description CSV export dropdown for the reports page.
 *
 * Export options (shown in a popover menu):
 *   - "Full Report"        — concatenated CSV with sections for Project Health,
 *     Phase Status Breakdown, Document Stats, Overdue Phases, and Team Performance
 *     (when data is present); saved as `full-report.csv`.
 *   - "Project Health"     — per-project status, phase counts, progress %, overdue;
 *     saved as `project-health-report.csv`.
 *   - "Overdue Report"     — phase name, project name, days overdue, owner;
 *     saved as `overdue-report.csv`.
 *   - "Team Performance"   — only shown when `data.teamPerformance` is non-empty;
 *     saved as `team-performance.csv`.
 *
 * `toCSV(headers, rows)` produces RFC-4180-compliant CSV: values containing commas,
 * double-quotes, or newlines are quoted and internal double-quotes are doubled.
 *
 * `downloadCSV(filename, content)` creates a `Blob`, generates an object URL, and
 * simulates a click on a transient `<a>` element, then revokes the URL.
 *
 * The dropdown is closed by clicking any menu item or the fixed-position backdrop.
 *
 * i18n namespace: `reports`.
 */

import { useState } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

interface ExportData {
  projectHealth: Array<{
    project: string;
    status: string;
    phases: number;
    completedPhases: number;
    progress: number;
    overdue: number;
  }>;
  phaseBreakdown: Array<{ status: string; count: number }>;
  documentStats: { total: number; byStatus: Record<string, number> };
  overdueReport: Array<{
    phaseName: string;
    projectName: string;
    daysOverdue: number;
    owner: string | null;
  }>;
  teamPerformance?: Array<{
    name: string;
    assigned: number;
    completed: number;
    active: number;
    overdue: number;
  }>;
}

interface Props {
  data: ExportData;
}

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return lines.join("\n");
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ data }: Props) {
  const t = useTranslations("reports");
  const [showMenu, setShowMenu] = useState(false);

  function exportProjectHealth() {
    const csv = toCSV(
      [t("project"), t("status"), t("totalPhases"), t("completed"), t("progressPct"), t("overdue")],
      data.projectHealth.map((p) => [
        p.project, p.status, String(p.phases), String(p.completedPhases),
        String(p.progress), String(p.overdue),
      ])
    );
    downloadCSV("project-health-report.csv", csv);
    setShowMenu(false);
  }

  function exportOverdue() {
    const csv = toCSV(
      [t("phase"), t("project"), t("daysOverdue"), t("owner")],
      data.overdueReport.map((o) => [
        o.phaseName, o.projectName, String(o.daysOverdue), o.owner || t("unassigned"),
      ])
    );
    downloadCSV("overdue-report.csv", csv);
    setShowMenu(false);
  }

  function exportTeamPerformance() {
    if (!data.teamPerformance) return;
    const csv = toCSV(
      [t("name"), t("assignedPhases"), t("completed"), t("active"), t("overdue")],
      data.teamPerformance.map((tm) => [
        tm.name, String(tm.assigned), String(tm.completed), String(tm.active), String(tm.overdue),
      ])
    );
    downloadCSV("team-performance.csv", csv);
    setShowMenu(false);
  }

  function exportAll() {
    let content = "=== PROJECT HEALTH ===\n";
    content += toCSV(
      [t("project"), t("status"), t("totalPhases"), t("completed"), t("progressPct"), t("overdue")],
      data.projectHealth.map((p) => [
        p.project, p.status, String(p.phases), String(p.completedPhases), String(p.progress), String(p.overdue),
      ])
    );

    content += "\n\n=== PHASE STATUS BREAKDOWN ===\n";
    content += toCSV(
      [t("status"), "Count"],
      data.phaseBreakdown.map((p) => [p.status, String(p.count)])
    );

    content += "\n\n=== DOCUMENT STATS ===\n";
    content += `Total: ${data.documentStats.total}\n`;
    content += toCSV(
      [t("status"), "Count"],
      Object.entries(data.documentStats.byStatus).map(([k, v]) => [k, String(v)])
    );

    if (data.overdueReport.length > 0) {
      content += "\n\n=== OVERDUE PHASES ===\n";
      content += toCSV(
        [t("phase"), t("project"), t("daysOverdue"), t("owner")],
        data.overdueReport.map((o) => [o.phaseName, o.projectName, String(o.daysOverdue), o.owner || t("unassigned")])
      );
    }

    if (data.teamPerformance && data.teamPerformance.length > 0) {
      content += "\n\n=== TEAM PERFORMANCE ===\n";
      content += toCSV(
        [t("name"), t("assignedPhases"), t("completed"), t("active"), t("overdue")],
        data.teamPerformance.map((tm) => [tm.name, String(tm.assigned), String(tm.completed), String(tm.active), String(tm.overdue)])
      );
    }

    downloadCSV("full-report.csv", content);
    setShowMenu(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        {t("export")}
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg border border-gray-200 shadow-lg py-1 w-48">
            <button onClick={exportAll} className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
              {t("fullReport")}
            </button>
            <button onClick={exportProjectHealth} className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
              {t("projectHealth")}
            </button>
            <button onClick={exportOverdue} className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
              {t("overdueReport")}
            </button>
            {data.teamPerformance && data.teamPerformance.length > 0 && (
              <button onClick={exportTeamPerformance} className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                {t("teamPerformance")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
