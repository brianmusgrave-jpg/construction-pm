import { notFound } from "next/navigation";
import { db } from "@/lib/db-types";
import {
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HardHat,
  FileText,
  Camera,
} from "lucide-react";

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    PLANNING: { label: "Planning", color: "bg-gray-100 text-gray-600" },
    IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
    ON_HOLD: { label: "On Hold", color: "bg-amber-100 text-amber-700" },
    COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700" },
    CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-600" },
  };
  const cfg = map[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const ct = await db.clientToken.findUnique({ where: { token } });
  if (!ct || !ct.active) notFound();
  if (ct.expiresAt && new Date(ct.expiresAt) < new Date()) notFound();
  if (!ct.projectId) notFound();

  const project = await (db as any).project.findUnique({
    where: { id: ct.projectId },
    include: {
      phases: {
        include: {
          assignments: {
            include: {
              staff: { select: { id: true, name: true, company: true, role: true } },
            },
          },
          checklist: {
            include: { items: { select: { id: true, completed: true } } },
          },
          _count: { select: { documents: true, photos: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!project) notFound();

  const phases = project.phases ?? [];
  const totalPhases = phases.length;
  const completedPhases = phases.filter((p: any) => p.status === "COMPLETED").length;
  const overallProgress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

  const budget = project.budget ? Number(project.budget) : null;
  const spent = project.amountSpent ? Number(project.amountSpent) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Building2 className="w-6 h-6 text-[var(--color-primary)]" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Project Status Report</p>
            <h1 className="text-lg font-bold text-gray-900">{project.name}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {statusBadge(project.status)}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Project overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {project.location && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Location</p>
                  <p className="text-sm font-medium text-gray-800">{project.location}</p>
                </div>
              </div>
            )}
            {project.startDate && (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Start Date</p>
                  <p className="text-sm font-medium text-gray-800">{fmtDate(project.startDate)}</p>
                </div>
              </div>
            )}
            {project.endDate && (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Target Completion</p>
                  <p className="text-sm font-medium text-gray-800">{fmtDate(project.endDate)}</p>
                </div>
              </div>
            )}
            {budget != null && (
              <div className="flex items-start gap-2">
                <DollarSign className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Budget</p>
                  <p className="text-sm font-medium text-gray-800">{fmt(budget)}</p>
                  {spent != null && (
                    <p className={`text-xs ${spent > budget ? "text-red-500" : "text-gray-400"}`}>
                      {fmt(spent)} spent
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 mt-4 leading-relaxed">{project.description}</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Overall Progress</h2>
            <span className="text-2xl font-bold text-[var(--color-primary)]">{overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full bg-[var(--color-primary)] transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {completedPhases} of {totalPhases} phases completed
          </p>
        </div>

        {/* Phases */}
        {phases.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Phase Status</h2>
            <div className="space-y-3">
              {phases.map((phase: any) => {
                const items = phase.checklist?.items ?? [];
                const checked = items.filter((i: any) => i.completed).length;
                const pct = items.length > 0 ? Math.round((checked / items.length) * 100) : 0;
                return (
                  <div key={phase.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{phase.name}</span>
                        {statusBadge(phase.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {phase._count.documents > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />{phase._count.documents}
                          </span>
                        )}
                        {phase._count.photos > 0 && (
                          <span className="flex items-center gap-1">
                            <Camera className="w-3 h-3" />{phase._count.photos}
                          </span>
                        )}
                      </div>
                    </div>
                    {items.length > 0 && (
                      <div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mb-1">
                          <div
                            className="h-1.5 rounded-full bg-[var(--color-primary)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400">{checked}/{items.length} checklist items</p>
                      </div>
                    )}
                    {phase.startDate && (
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
                        <span>{fmtDate(phase.startDate)} → {fmtDate(phase.endDate)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-center text-gray-400 pb-4">
          This is a read-only view shared with you by the project team. Last updated: {fmtDate(new Date())}.
        </p>
      </main>
    </div>
  );
}
