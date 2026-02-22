"use client";

import { useState } from "react";
import { createProjectWithPhases } from "@/actions/projects";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Diamond,
  HardHat,
  Building2,
  Wrench,
  Zap,
  Droplets,
  Wind,
  Columns3,
  Frame,
  Home,
  Paintbrush,
  ArrowLeft,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RESIDENTIAL_TEMPLATE,
  COMMERCIAL_TEMPLATE,
  TRADE_TEMPLATES,
} from "@/lib/phase-templates";
import type { TradeTemplate } from "@/lib/phase-templates";

interface PhaseInput {
  id: string;
  name: string;
  detail: string;
  isMilestone: boolean;
  estStart: string;
  estEnd: string;
  worstStart: string;
  worstEnd: string;
  expanded: boolean;
}

function newPhase(): PhaseInput {
  return {
    id: crypto.randomUUID(),
    name: "",
    detail: "",
    isMilestone: false,
    estStart: "",
    estEnd: "",
    worstStart: "",
    worstEnd: "",
    expanded: true,
  };
}

// Icon lookup for trade templates
const tradeIcons: Record<string, typeof Zap> = {
  Zap,
  Droplets,
  Wind,
  Columns3,
  Frame,
  Home,
  Paintbrush,
};

function getTradeIcon(iconName: string) {
  return tradeIcons[iconName] || Wrench;
}

type TemplateChoice =
  | { type: "residential" }
  | { type: "commercial" }
  | { type: "trade"; tradeId: string }
  | { type: "blank" }
  | null;

export function NewProjectForm() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [templateChoice, setTemplateChoice] = useState<TemplateChoice>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [planApproval, setPlanApproval] = useState("");
  const [budget, setBudget] = useState("");

  // Phase builder
  const [phases, setPhases] = useState<PhaseInput[]>([]);

  function addPhase() {
    setPhases((prev) => [...prev, newPhase()]);
  }

  function removePhase(id: string) {
    setPhases((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePhase(id: string, updates: Partial<PhaseInput>) {
    setPhases((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }

  function movePhase(index: number, direction: "up" | "down") {
    const newPhases = [...phases];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPhases.length) return;
    [newPhases[index], newPhases[targetIndex]] = [
      newPhases[targetIndex],
      newPhases[index],
    ];
    setPhases(newPhases);
  }

  function applyTemplatePhases(
    templatePhases: { name: string; detail: string; isMilestone: boolean }[]
  ) {
    setPhases(
      templatePhases.map((t) => ({
        ...t,
        id: crypto.randomUUID(),
        estStart: "",
        estEnd: "",
        worstStart: "",
        worstEnd: "",
        expanded: false,
      }))
    );
  }

  function selectTemplate(choice: TemplateChoice) {
    setTemplateChoice(choice);
    if (choice?.type === "residential") {
      applyTemplatePhases(RESIDENTIAL_TEMPLATE.phases);
    } else if (choice?.type === "commercial") {
      applyTemplatePhases(COMMERCIAL_TEMPLATE.phases);
    } else if (choice?.type === "trade") {
      const trade = TRADE_TEMPLATES.find((t) => t.id === choice.tradeId);
      if (trade) applyTemplatePhases(trade.phases);
    } else {
      setPhases([]);
    }
    setStep(1);
  }

  function toggleAllExpand(expanded: boolean) {
    setPhases((prev) => prev.map((p) => ({ ...p, expanded })));
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    for (const phase of phases) {
      if (!phase.name.trim()) {
        setError(`Phase ${phases.indexOf(phase) + 1} needs a name`);
        return;
      }
      if (!phase.estStart || !phase.estEnd) {
        setError(`"${phase.name}" needs estimated start and end dates`);
        return;
      }
    }

    setError(null);
    setSubmitting(true);

    try {
      await createProjectWithPhases({
        name: name.trim(),
        description: description.trim() || undefined,
        address: address.trim() || undefined,
        planApproval: planApproval || undefined,
        budget: budget ? Number(budget) : undefined,
        phases: phases.map((p) => ({
          name: p.name.trim(),
          detail: p.detail.trim() || undefined,
          isMilestone: p.isMilestone,
          estStart: p.estStart,
          estEnd: p.isMilestone ? p.estStart : p.estEnd,
          worstStart: p.worstStart || undefined,
          worstEnd: p.worstEnd || undefined,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => setStep(0)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            step === 0
              ? "bg-[var(--color-primary)] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
            1
          </span>
          Template
        </button>
        <div className="w-8 h-px bg-gray-300" />
        <button
          onClick={() => templateChoice && setStep(1)}
          disabled={!templateChoice}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            step === 1
              ? "bg-[var(--color-primary)] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
            2
          </span>
          Details
        </button>
        <div className="w-8 h-px bg-gray-300" />
        <button
          onClick={() => templateChoice && name.trim() && setStep(2)}
          disabled={!templateChoice || !name.trim()}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            step === 2
              ? "bg-[var(--color-primary)] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
            3
          </span>
          Phases
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 0: Template Picker */}
      {step === 0 && (
        <div className="space-y-6">
          {/* Main project types */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Project Type
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => selectTemplate({ type: "residential" })}
                className={cn(
                  "flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all text-center hover:border-[var(--color-primary-light)] hover:bg-[var(--color-primary-bg)]",
                  templateChoice?.type === "residential"
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-bg)]"
                    : "border-gray-200 bg-white"
                )}
              >
                <HardHat className="w-8 h-8 text-[var(--color-primary)]" />
                <span className="text-sm font-semibold text-gray-900">
                  Residential
                </span>
                <span className="text-xs text-gray-500">
                  9 phases · permitting to CO
                </span>
              </button>

              <button
                onClick={() => selectTemplate({ type: "commercial" })}
                className={cn(
                  "flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all text-center hover:border-[var(--color-primary-light)] hover:bg-[var(--color-primary-bg)]",
                  templateChoice?.type === "commercial"
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-bg)]"
                    : "border-gray-200 bg-white"
                )}
              >
                <Building2 className="w-8 h-8 text-indigo-600" />
                <span className="text-sm font-semibold text-gray-900">
                  Commercial
                </span>
                <span className="text-xs text-gray-500">
                  12 phases · steel to commissioning
                </span>
              </button>

              <button
                onClick={() => selectTemplate({ type: "blank" })}
                className={cn(
                  "flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all text-center hover:border-[var(--color-primary-light)] hover:bg-[var(--color-primary-bg)]",
                  templateChoice?.type === "blank"
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-bg)]"
                    : "border-gray-200 bg-white"
                )}
              >
                <Plus className="w-8 h-8 text-gray-400" />
                <span className="text-sm font-semibold text-gray-900">
                  Blank
                </span>
                <span className="text-xs text-gray-500">
                  Start from scratch
                </span>
              </button>
            </div>
          </div>

          {/* Trade templates */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Trade-Specific
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TRADE_TEMPLATES.map((trade) => {
                const Icon = getTradeIcon(trade.icon);
                const isSelected =
                  templateChoice?.type === "trade" &&
                  (templateChoice as { type: "trade"; tradeId: string })
                    .tradeId === trade.id;
                return (
                  <button
                    key={trade.id}
                    onClick={() =>
                      selectTemplate({ type: "trade", tradeId: trade.id })
                    }
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center hover:border-orange-400 hover:bg-orange-50/50",
                      isSelected
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-200 bg-white"
                    )}
                  >
                    <Icon className="w-6 h-6 text-orange-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {trade.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {trade.phases.length} phases
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Project Details */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Smith Residence Build"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Project scope, notes, special requirements..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, State"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan Approval Date
              </label>
              <input
                type="date"
                value={planApproval}
                onChange={(e) => setPlanApproval(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Budget ($)
              </label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setStep(0)}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Template
            </button>
            <button
              onClick={() => {
                if (!name.trim()) {
                  setError("Project name is required");
                  return;
                }
                setError(null);
                setStep(2);
              }}
              className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              Next: Review Phases
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Phase Builder */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={addPhase}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Phase
              </button>
            </div>
            {phases.length > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => toggleAllExpand(true)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Expand all
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => toggleAllExpand(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Collapse all
                </button>
              </div>
            )}
          </div>

          {/* Phase list */}
          {phases.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
              <HardHat className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-1">No phases yet</p>
              <p className="text-xs text-gray-400">
                Add phases manually or go back to choose a template
              </p>
            </div>
          )}

          {phases.map((phase, index) => (
            <div
              key={phase.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Phase header (always visible) */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() =>
                  updatePhase(phase.id, { expanded: !phase.expanded })
                }
              >
                <span className="text-xs font-mono text-gray-400 w-6">
                  {index + 1}
                </span>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      movePhase(index, "up");
                    }}
                    disabled={index === 0}
                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      movePhase(index, "down");
                    }}
                    disabled={index === phases.length - 1}
                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {phase.isMilestone ? (
                  <Diamond className="w-4 h-4 text-yellow-500 shrink-0" />
                ) : (
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                )}

                <span
                  className={cn(
                    "flex-1 text-sm font-medium truncate",
                    phase.name ? "text-gray-900" : "text-gray-400 italic"
                  )}
                >
                  {phase.name || "Untitled Phase"}
                </span>

                {phase.estStart && phase.estEnd && (
                  <span className="text-xs text-gray-500 shrink-0">
                    {phase.estStart} → {phase.estEnd}
                  </span>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhase(phase.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Expanded form */}
              {phase.expanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Phase Name *
                      </label>
                      <input
                        type="text"
                        value={phase.name}
                        onChange={(e) =>
                          updatePhase(phase.id, { name: e.target.value })
                        }
                        placeholder="e.g. Framing"
                        className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-end">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={phase.isMilestone}
                          onChange={(e) =>
                            updatePhase(phase.id, {
                              isMilestone: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                        />
                        <span className="text-sm text-gray-700">
                          Milestone (single date)
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Details
                    </label>
                    <input
                      type="text"
                      value={phase.detail}
                      onChange={(e) =>
                        updatePhase(phase.id, { detail: e.target.value })
                      }
                      placeholder="Scope, notes, trade involved..."
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
                    />
                  </div>

                  {/* Date fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-primary)] mb-1">
                        Est. Start *
                      </label>
                      <input
                        type="date"
                        value={phase.estStart}
                        onChange={(e) =>
                          updatePhase(phase.id, { estStart: e.target.value })
                        }
                        className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
                      />
                    </div>
                    {!phase.isMilestone && (
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-primary)] mb-1">
                          Est. End *
                        </label>
                        <input
                          type="date"
                          value={phase.estEnd}
                          onChange={(e) =>
                            updatePhase(phase.id, { estEnd: e.target.value })
                          }
                          className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {!phase.isMilestone && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-red-500 mb-1">
                          Worst Start
                        </label>
                        <input
                          type="date"
                          value={phase.worstStart}
                          onChange={(e) =>
                            updatePhase(phase.id, {
                              worstStart: e.target.value,
                            })
                          }
                          className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-red-500 mb-1">
                          Worst End
                        </label>
                        <input
                          type="date"
                          value={phase.worstEnd}
                          onChange={(e) =>
                            updatePhase(phase.id, { worstEnd: e.target.value })
                          }
                          className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Bottom actions */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Details
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {phases.length} phase{phases.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleSubmit}
                disabled={submitting || !name.trim()}
                className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {submitting ? (
                  "Creating..."
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create Project
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
