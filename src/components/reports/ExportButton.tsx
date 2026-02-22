"use client";

import { useState } from "react";
import { Download } from "lucide-react";

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
  const [showMenu, setShowMenu] = useState(false);

  function exportProjectHealth() {
    const csv = toCSV(
      ["Project", "Status", "Total Phases", "Completed", "Progress %", "Overdue"],
      data.projectHealth.map((p) => [
        p.project,
        p.status,
        String(p.phases),
        String(p.completedPhases),
        String(p.progress),
        String(p.overdue),
      ])
    );
    downloadCSV("project-health-report.csv", csv);
    setShowMenu(false);
  }

  function exportOverdue() {
    const csv = toCSV(
      ["Phase", "Project", "Days Overdue", "Owner"],
      data.overdueReport.map((o) => [
        o.phaseName,
        o.projectName,
        String(o.daysOverdue),
        o.owner || "Unassigned",
      ])
    );
    downloadCSV("overdue-report.csv", csv);
    setShowMenu(false);
  }

  function exportTeamPerformance() {
    if (!data.teamPerformance) return;
    const csv = toCSV(
      ["Name", "Assigned Phases", "Completed", "Active", "Overdue"],
      data.teamPerformance.map((t) => [
        t.name,
        String(t.assigned),
        String(t.completed),
        String(t.active),
        String(t.overdue),
      ])
    );
    downloadCSV("team-performance.csv", csv);
    setShowMenu(false);
  }

  function exportAll() {
    // Build combined summary
    let content = "=== PROJECT HEALTH ===\n";
    content += toCSV(
      ["Project", "Status", "Phases", "Completed", "Progress %", "Overdue"],
      data.projectHealth.map((p) => [
        p.project, p.status, String(p.phases), String(p.completedPhases), String(p.progress), String(p.overdue),
      ])
    );

    content += "\n\n=== PHASE STATUS BREAKDOWN ===\n";
    content += toCSV(
      ["Status", "Count"],
      data.phaseBreakdown.map((p) => [p.status, String(p.count)])
    );

    content += "\n\n=== DOCUMENT STATS ===\n";
    content += `Total: ${data.documentStats.total}\n`;
    content += toCSV(
      ["Status", "Count"],
      Object.entries(data.documentStats.byStatus).map(([k, v]) => [k, String(v)])
    );

    if (data.overdueReport.length > 0) {
      content += "\n\n=== OVERDUE PHASES ===\n";
      content += toCSV(
        ["Phase", "Project", "Days Overdue", "Owner"],
        data.overdueReport.map((o) => [o.phaseName, o.projectName, String(o.daysOverdue), o.owner || "Unassigned"])
      );
    }

    if (data.teamPerformance && data.teamPerformance.length > 0) {
      content += "\n\n=== TEAM PERFORMANCE ===\n";
      content += toCSV(
        ["Name", "Assigned", "Completed", "Active", "Overdue"],
        data.teamPerformance.map((t) => [t.name, String(t.assigned), String(t.completed), String(t.active), String(t.overdue)])
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
        Export
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg border border-gray-200 shadow-lg py-1 w-48">
            <button
              onClick={exportAll}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Full Report (CSV)
            </button>
            <button
              onClick={exportProjectHealth}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Project Health
            </button>
            <button
              onClick={exportOverdue}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Overdue Report
            </button>
            {data.teamPerformance && data.teamPerformance.length > 0 && (
              <button
                onClick={exportTeamPerformance}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Team Performance
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
