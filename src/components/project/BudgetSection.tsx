"use client";

import { useState, useTransition } from "react";
import { updateProjectBudget, updatePhaseCosts } from "@/actions/budget";
import { DollarSign, TrendingUp, TrendingDown, Minus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface PhaseBudget {
  id: string;
  name: string;
  status: string;
  estimatedCost: number | null;
  actualCost: number | null;
}

interface Props {
  projectId: string;
  projectBudget: number | null;
  phases: PhaseBudget[];
  canManage: boolean;
}

function fmt(n: number | null): string {
  if (n === null || n === 0) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(actual: number, estimated: number): number {
  if (estimated === 0) return 0;
  return Math.round((actual / estimated) * 100);
}

export function BudgetSection({
  projectId,
  projectBudget: initialBudget,
  phases: initialPhases,
  canManage,
}: Props) {
  const t = useTranslations("budget");
  const [projectBudget, setProjectBudget] = useState(initialBudget);
  const [phases, setPhases] = useState(initialPhases);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(initialBudget || ""));
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [phaseEstInput, setPhaseEstInput] = useState("");
  const [phaseActInput, setPhaseActInput] = useState("");
  const [isPending, startTransition] = useTransition();

  const totalEstimated = phases.reduce((s, p) => s + (p.estimatedCost || 0), 0);
  const totalActual = phases.reduce((s, p) => s + (p.actualCost || 0), 0);
  const variance = totalEstimated > 0 ? totalActual - totalEstimated : 0;
  const budgetUsed = projectBudget && projectBudget > 0 ? pct(totalActual, projectBudget) : null;

  function saveBudget() {
    const val = budgetInput.replace(/[^0-9.]/g, "");
    const num = parseFloat(val) || null;
    startTransition(async () => {
      try {
        await updateProjectBudget(projectId, num);
        setProjectBudget(num);
        setEditingBudget(false);
        toast.success(t("updated"));
      } catch {
        toast.error(t("failedToUpdate"));
      }
    });
  }

  function startEditPhase(phase: PhaseBudget) {
    setEditingPhaseId(phase.id);
    setPhaseEstInput(phase.estimatedCost ? String(phase.estimatedCost) : "");
    setPhaseActInput(phase.actualCost ? String(phase.actualCost) : "");
  }

  function savePhase(phaseId: string) {
    const est = parseFloat(phaseEstInput.replace(/[^0-9.]/g, "")) || null;
    const act = parseFloat(phaseActInput.replace(/[^0-9.]/g, "")) || null;
    startTransition(async () => {
      try {
        await updatePhaseCosts(phaseId, { estimatedCost: est, actualCost: act });
        setPhases((prev) =>
          prev.map((p) =>
            p.id === phaseId ? { ...p, estimatedCost: est, actualCost: act } : p
          )
        );
        setEditingPhaseId(null);
        toast.success(t("costsUpdated"));
      } catch {
        toast.error(t("failedToUpdateCosts"));
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            {t("title")}
          </h2>
          {canManage && !editingBudget && (
            <button
              onClick={() => {
                setBudgetInput(String(projectBudget || ""));
                setEditingBudget(true);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              {t("editTotal")}
            </button>
          )}
        </div>

        {/* Project budget inline edit */}
        {editingBudget ? (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-gray-500">{t("totalBudget")}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400">$</span>
              <input
                type="text"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-32 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                placeholder="0"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveBudget();
                  if (e.key === "Escape") setEditingBudget(false);
                }}
              />
            </div>
            <button
              onClick={saveBudget}
              disabled={isPending}
              className="p-1 text-green-600 hover:text-green-700"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditingBudget(false)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          projectBudget && (
            <p className="text-sm text-gray-500 mt-1">
              {t("totalBudget")} <span className="font-semibold text-gray-900">{fmt(projectBudget)}</span>
            </p>
          )
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-0 border-b border-gray-100">
        <div className="px-4 py-3 text-center border-r border-gray-100">
          <p className="text-xs text-gray-500 mb-0.5">{t("estimated")}</p>
          <p className="text-base font-bold text-gray-900">{fmt(totalEstimated)}</p>
        </div>
        <div className="px-4 py-3 text-center border-r border-gray-100">
          <p className="text-xs text-gray-500 mb-0.5">{t("actual")}</p>
          <p className="text-base font-bold text-gray-900">{fmt(totalActual)}</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-gray-500 mb-0.5">{t("variance")}</p>
          <p
            className={`text-base font-bold flex items-center justify-center gap-1 ${
              variance > 0 ? "text-red-600" : variance < 0 ? "text-green-600" : "text-gray-900"
            }`}
          >
            {variance > 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : variance < 0 ? (
              <TrendingDown className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
            {variance === 0 ? "—" : `${variance > 0 ? "+" : ""}${fmt(variance)}`}
          </p>
        </div>
      </div>

      {/* Budget bar */}
      {budgetUsed !== null && (
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{t("budgetUsed")}</span>
            <span className={budgetUsed > 100 ? "text-red-600 font-semibold" : ""}>
              {budgetUsed}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                budgetUsed > 100
                  ? "bg-red-500"
                  : budgetUsed > 80
                  ? "bg-amber-500"
                  : "bg-green-500"
              }`}
              style={{ width: `${Math.min(budgetUsed, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Phase breakdown */}
      <div className="divide-y divide-gray-100">
        {phases.map((phase) => {
          const isEditing = editingPhaseId === phase.id;
          const phaseVariance =
            phase.estimatedCost && phase.actualCost
              ? phase.actualCost - phase.estimatedCost
              : null;

          return (
            <div key={phase.id} className="px-4 sm:px-5 py-3">
              {isEditing ? (
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-2">{phase.name}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 w-16">{t("estimated")}:</span>
                      <span className="text-xs text-gray-400">$</span>
                      <input
                        type="text"
                        value={phaseEstInput}
                        onChange={(e) => setPhaseEstInput(e.target.value)}
                        className="w-24 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                        placeholder="0"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 w-16">{t("actual")}:</span>
                      <span className="text-xs text-gray-400">$</span>
                      <input
                        type="text"
                        value={phaseActInput}
                        onChange={(e) => setPhaseActInput(e.target.value)}
                        className="w-24 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                        placeholder="0"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") savePhase(phase.id);
                          if (e.key === "Escape") setEditingPhaseId(null);
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => savePhase(phase.id)}
                        disabled={isPending}
                        className="p-1 text-green-600 hover:text-green-700"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingPhaseId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-3 ${canManage ? "cursor-pointer hover:bg-gray-50 -mx-4 -my-3 px-4 py-3 sm:-mx-5 sm:px-5 rounded" : ""}`}
                  onClick={() => canManage && startEditPhase(phase)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{phase.name}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <div className="text-right">
                      <p className="text-gray-400">{t("estShort")}</p>
                      <p className="text-gray-700 font-medium">{fmt(phase.estimatedCost)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400">{t("actual")}</p>
                      <p className="text-gray-700 font-medium">{fmt(phase.actualCost)}</p>
                    </div>
                    {phaseVariance !== null && (
                      <div className="text-right w-16">
                        <p className="text-gray-400">{t("varShort")}</p>
                        <p
                          className={`font-medium ${
                            phaseVariance > 0 ? "text-red-600" : phaseVariance < 0 ? "text-green-600" : "text-gray-500"
                          }`}
                        >
                          {phaseVariance > 0 ? "+" : ""}
                          {fmt(phaseVariance)}
                        </p>
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <Pencil className="w-3 h-3 text-gray-300 shrink-0" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
