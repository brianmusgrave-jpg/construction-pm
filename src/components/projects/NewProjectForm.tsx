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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PhaseInput {
  id: string; // client-side key
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

// Common residential construction phases for the quick-add template
const RESIDENTIAL_TEMPLATE: Omit<PhaseInput, "id" | "expanded">[] = [
  { name: "Pre-Construction / Permitting", detail: "Plans, permits, site survey, engineering", isMilestone: false, estStart: "", estEnd: "", worstStart: "", worstEnd: "" },
  { name: "Site Work / Foundation", detail: "Clearing, grading, excavation, footings, foundation, backfill", isMilestone: false, estStart: "", estEnd: "", worstStart: "", worstEnd: "" },
  { name: "Framing", detail: "Floor systems, walls, roof trusses, sheathing, windows/doors", isMilestone: false, estStart: "", estEnd: "", worstStart: "", worstEnd: "" },
  { name: "Rough-In (MEP)", detail: "Rough plumbing, electrical, HVAC, low-voltage", isMilestone: false, estStart: "", estEnd: "", worstStart: "", worstEnd: "" },
  { name: "Insulation & Drywall", detail: "Insulation, vapor barrier, drywall hang/tape/finish", isMilestone: false, estStart: "", estEnd: "", worstStart: "", worstEnd: "" },
  { name: "Interior Finishes", detail: "Trim, cabinets, countertops, flooring, paint, tile, fixtures", isMilestone: false, estStart: "", estEnd: "", worstStart: "", worstEnd: "" },
  { name: "Exterior Finishes", detail: "Siding, roofing, gutters, exterior paint, landscaping", isMilestone: false, estStart: "", estEnd: "", worstStart: "", worstEnd: "" },
  { name: "Final MEP & Punch List", detail: "Fixture install, panel termination, HVAC startup, final walkthrough", isMilestone: false, estStart: "", estEnd: "", worstStart: "", worstEnd: "" },
  { name: "Certificate of Occupancy", detail: "Final inspections, CO issued", isMilestone: true, estStart: "", estEnd: "", worstStart: "", worstEnd: "" },
];

export function NewProjectForm() {
  const [step, setStep] = useState<1 | 2>(1);
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

  function applyTemplate() {
    const templatePhases = RESIDENTIAL_TEMPLATE.map((t) => ({
      ...t,
      id: crypto.randomUUID(),
      expanded: false,
    }));
    setPhases(templatePhases);
  }

  function toggleAllExpand(expanded: boolean) {
    setPhases((prev) => prev.map((p) => ({ ...p, expanded })));
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    // Validate phases have required fields
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
          onClick={() => setStep(1)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            step === 1
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
            1
          </span>
          Project Details
        </button>
        <div className="w-8 h-px bg-gray-300" />
        <button
          onClick={() => name.trim() && setStep(2)}
          disabled={!name.trim()}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            step === 2
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
            2
          </span>
          Build Phases
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
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
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
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
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={() => {
                if (!name.trim()) {
                  setError("Project name is required");
                  return;
                }
                setError(null);
                setStep(2);
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Next: Add Phases
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
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Phase
              </button>
              {phases.length === 0 && (
                <button
                  onClick={applyTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <HardHat className="w-4 h-4" />
                  Residential Template
                </button>
              )}
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
                Add phases manually or start from a template
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
                        className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* Date fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-blue-600 mb-1">
                        Est. Start *
                      </label>
                      <input
                        type="date"
                        value={phase.estStart}
                        onChange={(e) =>
                          updatePhase(phase.id, { estStart: e.target.value })
                        }
                        className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    {!phase.isMilestone && (
                      <div>
                        <label className="block text-xs font-medium text-blue-600 mb-1">
                          Est. End *
                        </label>
                        <input
                          type="date"
                          value={phase.estEnd}
                          onChange={(e) =>
                            updatePhase(phase.id, { estEnd: e.target.value })
                          }
                          className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
              className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {phases.length} phase{phases.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleSubmit}
                disabled={submitting || !name.trim()}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
