import { notFound } from "next/navigation";
import { db } from "@/lib/db-types";
import {
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  HardHat,
  FileText,
  Camera,
  Receipt,
  TrendingUp,
  Eye,
  Shield,
} from "lucide-react";

/* ─── helpers ─── */

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string; dot: string }> = {
    PLANNING: { label: "Planning", color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
    IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
    ON_HOLD: { label: "On Hold", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
    COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700", dot: "bg-green-500" },
    CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-600", dot: "bg-red-500" },
    PENDING: { label: "Pending", color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
    APPROVED: { label: "Approved", color: "bg-green-100 text-green-700", dot: "bg-green-500" },
    REJECTED: { label: "Rejected", color: "bg-red-100 text-red-600", dot: "bg-red-500" },
  };
  const cfg = map[status] ?? { label: status, color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
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

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_ORDER: Record<string, number> = {
  IN_PROGRESS: 0,
  PLANNING: 1,
  ON_HOLD: 2,
  COMPLETED: 3,
  CANCELLED: 4,
};

function timelineColor(status: string) {
  const map: Record<string, string> = {
    PLANNING: "bg-gray-300",
    IN_PROGRESS: "bg-blue-500",
    ON_HOLD: "bg-amber-400",
    COMPLETED: "bg-green-500",
    CANCELLED: "bg-red-400",
  };
  return map[status] ?? "bg-gray-300";
}

/* ─── page component ─── */

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
          documents: {
            where: { status: "APPROVED" },
            select: { id: true, name: true, url: true, size: true, mimeType: true, category: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          photos: {
            select: { id: true, url: true, caption: true, takenAt: true },
            orderBy: { takenAt: "desc" },
            take: 20,
          },
          changeOrders: {
            select: { id: true, number: true, title: true, status: true, amount: true, createdAt: true },
            orderBy: { createdAt: "desc" },
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
  const inProgressPhases = phases.filter((p: any) => p.status === "IN_PROGRESS").length;
  const overallProgress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

  const budget = project.budget ? Number(project.budget) : null;
  const spent = project.amountSpent ? Number(project.amountSpent) : null;
  const budgetPct = budget && budget > 0 ? Math.min(Math.round((spent ?? 0) / budget * 100), 100) : 0;

  // Aggregate change orders across all phases
  const allChangeOrders = phases.flatMap((p: any) => (p.changeOrders ?? []).map((co: any) => ({ ...co, phaseName: p.name })));
  const approvedCOs = allChangeOrders.filter((co: any) => co.status === "APPROVED");
  const totalCOAmount = approvedCOs.reduce((sum: number, co: any) => sum + Number(co.amount ?? 0), 0);

  // Aggregate recent photos across all phases
  const allPhotos = phases
    .flatMap((p: any) => (p.photos ?? []).map((ph: any) => ({ ...ph, phaseName: p.name })))
    .sort((a: any, b: any) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())
    .slice(0, 12);

  // Aggregate documents across all phases
  const allDocuments = phases
    .flatMap((p: any) => (p.documents ?? []).map((d: any) => ({ ...d, phaseName: p.name })))
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 15);

  // Compute timeline range for visualization
  const phasesWithDates = phases.filter((p: any) => p.startDate);
  const timelineStart = phasesWithDates.length > 0
    ? new Date(Math.min(...phasesWithDates.map((p: any) => new Date(p.startDate).getTime())))
    : null;
  const timelineEnd = phasesWithDates.length > 0
    ? new Date(Math.max(...phasesWithDates.map((p: any) => new Date(p.endDate ?? p.startDate).getTime())))
    : null;
  const timelineRange = timelineStart && timelineEnd ? timelineEnd.getTime() - timelineStart.getTime() : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-bg)] flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[var(--color-primary)]" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Client Portal</p>
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {statusBadge(project.status)}
              <span className="text-xs text-gray-400 hidden sm:block">
                Updated {fmtDate(new Date())}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ─── Overview Cards ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-2">
              <HardHat className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalPhases}</p>
            <p className="text-xs text-gray-500">Total Phases</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{completedPhases}</p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-2">
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{inProgressPhases}</p>
            <p className="text-xs text-gray-500">In Progress</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-600">{overallProgress}%</p>
            <p className="text-xs text-gray-500">Complete</p>
          </div>
        </div>

        {/* ─── Project Info ─── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Project Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                </div>
              </div>
            )}
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 mt-4 leading-relaxed border-t border-gray-100 pt-4">{project.description}</p>
          )}
        </div>

        {/* ─── Overall Progress ─── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Overall Progress</h2>
            <span className="text-2xl font-bold text-[var(--color-primary)]">{overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-4 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-blue-400 transition-all duration-700 relative"
              style={{ width: `${overallProgress}%` }}
            >
              {overallProgress > 15 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                  {overallProgress}%
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {completedPhases} of {totalPhases} phases completed
            {inProgressPhases > 0 && ` · ${inProgressPhases} in progress`}
          </p>
        </div>

        {/* ─── Visual Phase Timeline ─── */}
        {phasesWithDates.length > 0 && timelineRange > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Project Timeline</h2>
            <div className="space-y-2">
              {phasesWithDates.map((phase: any) => {
                const start = new Date(phase.startDate).getTime();
                const end = new Date(phase.endDate ?? phase.startDate).getTime();
                const left = ((start - timelineStart!.getTime()) / timelineRange) * 100;
                const width = Math.max(((end - start) / timelineRange) * 100, 2);
                return (
                  <div key={phase.id} className="flex items-center gap-3">
                    <div className="w-28 sm:w-36 shrink-0 text-right">
                      <p className="text-xs font-medium text-gray-700 truncate">{phase.name}</p>
                    </div>
                    <div className="flex-1 relative h-6 bg-gray-50 rounded overflow-hidden">
                      <div
                        className={`absolute top-0.5 bottom-0.5 rounded ${timelineColor(phase.status)} opacity-90`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    </div>
                    <div className="w-16 shrink-0">
                      {statusBadge(phase.status)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-3 text-[10px] text-gray-400">
              <span>{fmtDate(timelineStart)}</span>
              <span>{fmtDate(timelineEnd)}</span>
            </div>
          </div>
        )}

        {/* ─── Budget Overview ─── */}
        {budget != null && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Budget Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Original Budget</p>
                <p className="text-lg font-bold text-gray-900">{fmt(budget)}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Amount Spent</p>
                <p className={`text-lg font-bold ${spent && budget && spent > budget ? "text-red-600" : "text-gray-900"}`}>
                  {fmt(spent)}
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Remaining</p>
                <p className={`text-lg font-bold ${budget - (spent ?? 0) < 0 ? "text-red-600" : "text-green-600"}`}>
                  {fmt(budget - (spent ?? 0))}
                </p>
              </div>
            </div>

            {/* Budget bar */}
            <div className="relative">
              <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className={`h-5 rounded-full transition-all duration-500 ${
                    budgetPct > 90 ? "bg-red-500" : budgetPct > 75 ? "bg-amber-500" : "bg-green-500"
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1 text-right">{budgetPct}% of budget used</p>
            </div>

            {/* Change order impact */}
            {approvedCOs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="w-4 h-4 text-amber-500" />
                  <p className="text-xs font-medium text-gray-600">
                    Approved Change Orders: {approvedCOs.length} ({fmt(totalCOAmount)})
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  Adjusted budget: {fmt(budget + totalCOAmount)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Phase Details ─── */}
        {phases.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Phase Details</h2>
            <div className="space-y-3">
              {phases.map((phase: any) => {
                const items = phase.checklist?.items ?? [];
                const checked = items.filter((i: any) => i.completed).length;
                const pct = items.length > 0 ? Math.round((checked / items.length) * 100) : 0;
                const phaseCost = Number(phase.estimatedCost ?? 0);
                const phaseActual = Number(phase.actualCost ?? 0);
                return (
                  <div key={phase.id} className="border border-gray-100 rounded-lg p-4 hover:border-gray-200 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{phase.name}</span>
                        {statusBadge(phase.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {phase._count.photos > 0 && (
                          <span className="flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5" />{phase._count.photos}
                          </span>
                        )}
                        {phase._count.documents > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />{phase._count.documents}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Checklist progress */}
                    {items.length > 0 && (
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-500">Checklist</p>
                          <p className="text-xs font-medium text-gray-600">{checked}/{items.length}</p>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full bg-[var(--color-primary)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Phase cost + dates */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mt-2">
                      {phase.startDate && (
                        <span>{fmtDate(phase.startDate)} → {fmtDate(phase.endDate)}</span>
                      )}
                      {phaseCost > 0 && (
                        <span>Budget: {fmt(phaseCost)}{phaseActual > 0 ? ` · Spent: ${fmt(phaseActual)}` : ""}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Recent Photos ─── */}
        {allPhotos.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="w-4 h-4 text-[var(--color-primary)]" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recent Photos</h2>
              <span className="text-xs text-gray-400 ml-auto">{allPhotos.length} photos</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {allPhotos.map((photo: any) => (
                <div key={photo.id} className="group relative rounded-lg overflow-hidden bg-gray-100 aspect-square">
                  <img
                    src={photo.url}
                    alt={photo.caption || "Progress photo"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-[10px] text-white/80 font-medium">{photo.phaseName}</p>
                      {photo.caption && (
                        <p className="text-[10px] text-white/60 truncate">{photo.caption}</p>
                      )}
                      <p className="text-[10px] text-white/50">{fmtDate(photo.takenAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Documents ─── */}
        {allDocuments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-[var(--color-primary)]" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Documents</h2>
              <span className="text-xs text-gray-400 ml-auto">{allDocuments.length} files</span>
            </div>
            <div className="divide-y divide-gray-100">
              {allDocuments.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-400">
                      {doc.phaseName} · {fmtBytes(doc.size)} · {fmtDate(doc.createdAt)}
                    </p>
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-2 text-gray-400 hover:text-[var(--color-primary)] rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span title="View document"><Eye className="w-4 h-4" /></span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Change Orders ─── */}
        {allChangeOrders.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Change Orders</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">#</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Title</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Phase</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Amount</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allChangeOrders.map((co: any) => (
                    <tr key={co.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-4 text-xs font-mono text-gray-500">{co.number}</td>
                      <td className="py-2.5 pr-4 font-medium text-gray-800">{co.title}</td>
                      <td className="py-2.5 pr-4 text-xs text-gray-500">{co.phaseName}</td>
                      <td className="py-2.5 pr-4 font-medium text-gray-800">{fmt(Number(co.amount ?? 0))}</td>
                      <td className="py-2.5">{statusBadge(co.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 pb-6 pt-2">
          <Shield className="w-3.5 h-3.5" />
          <p>
            Secure read-only portal · Shared by the project team · Last updated {fmtDate(new Date())}
          </p>
        </div>
      </main>
    </div>
  );
}
