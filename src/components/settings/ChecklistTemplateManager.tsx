"use client";

import { useState, useTransition } from "react";
import {
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
} from "@/actions/templates";
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  X,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface TemplateItem {
  id: string;
  title: string;
  order: number;
}

interface Template {
  id: string;
  name: string;
  items: TemplateItem[];
}

interface Props {
  templates: Template[];
}

export function ChecklistTemplateManager({ templates: initial }: Props) {
  const [templates, setTemplates] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Checklist Templates
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Create reusable checklists that can be applied to project phases.
          </p>
        </div>
        {!creating && !editingId && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <TemplateForm
          onSave={(data) => {
            startTransition(async () => {
              try {
                const t = await createChecklistTemplate(data);
                setTemplates((prev) => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)));
                setCreating(false);
                toast.success("Template created");
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Failed to create template");
              }
            });
          }}
          onCancel={() => setCreating(false)}
          isPending={isPending}
        />
      )}

      {/* Template list */}
      {templates.length === 0 && !creating ? (
        <div className="text-center py-8 text-gray-400">
          <ClipboardList className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No templates yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              {editingId === template.id ? (
                <div className="p-4">
                  <TemplateForm
                    initial={{ name: template.name, items: template.items.map((i) => i.title) }}
                    onSave={(data) => {
                      startTransition(async () => {
                        try {
                          const t = await updateChecklistTemplate(template.id, data);
                          setTemplates((prev) =>
                            prev.map((p) => (p.id === template.id ? t : p))
                          );
                          setEditingId(null);
                          toast.success("Template updated");
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : "Failed to update");
                        }
                      });
                    }}
                    onCancel={() => setEditingId(null)}
                    isPending={isPending}
                    saveLabel="Save Changes"
                  />
                </div>
              ) : (
                <>
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() =>
                      setExpandedId(expandedId === template.id ? null : template.id)
                    }
                  >
                    {expandedId === template.id ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <ClipboardList className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                    <span className="text-sm font-medium text-gray-900 flex-1">
                      {template.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {template.items.length} item{template.items.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setEditingId(template.id);
                          setExpandedId(null);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) return;
                          startTransition(async () => {
                            try {
                              await deleteChecklistTemplate(template.id);
                              setTemplates((prev) => prev.filter((p) => p.id !== template.id));
                              toast.success("Template deleted");
                            } catch {
                              toast.error("Failed to delete template");
                            }
                          });
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {expandedId === template.id && (
                    <div className="px-4 pb-3 border-t border-gray-100">
                      <ul className="mt-2 space-y-1">
                        {template.items.map((item, i) => (
                          <li
                            key={item.id}
                            className="flex items-center gap-2 text-sm text-gray-600 py-0.5"
                          >
                            <GripVertical className="w-3 h-3 text-gray-300 shrink-0" />
                            <span className="text-xs text-gray-400 w-5 text-right shrink-0">
                              {i + 1}.
                            </span>
                            {item.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Inline form for create / edit ── */

function TemplateForm({
  initial,
  onSave,
  onCancel,
  isPending,
  saveLabel = "Create Template",
}: {
  initial?: { name: string; items: string[] };
  onSave: (data: { name: string; items: string[] }) => void;
  onCancel: () => void;
  isPending: boolean;
  saveLabel?: string;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [items, setItems] = useState<string[]>(
    initial?.items?.length ? initial.items : [""]
  );

  function addItem() {
    setItems((prev) => [...prev, ""]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, value: string) {
    setItems((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter((t) => t.trim());
    if (!name.trim() || validItems.length === 0) return;
    onSave({ name, items: validItems });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-[var(--color-primary-bg)] rounded-lg p-4 bg-[var(--color-primary-bg)]/30"
    >
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Template Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Site Work, Framing, Electrical…"
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
          autoFocus
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Checklist Items
        </label>
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-5 text-right shrink-0">
                {i + 1}.
              </span>
              <input
                type="text"
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                placeholder="Enter item title…"
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
        >
          <Plus className="w-3 h-3" />
          Add item
        </button>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <button
          type="submit"
          disabled={isPending || !name.trim() || items.every((t) => !t.trim())}
          className="px-4 py-1.5 text-sm font-medium rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Saving…" : saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
