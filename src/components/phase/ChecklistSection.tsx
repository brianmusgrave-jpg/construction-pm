"use client";

import { useState } from "react";
import {
  CheckSquare,
  Square,
  ListChecks,
  Plus,
  X,
  Trash2,
  ClipboardList,
} from "lucide-react";
import {
  applyChecklistTemplate,
  toggleChecklistItem,
  addCustomChecklistItem,
  deleteChecklistItem,
} from "@/actions/checklists";

interface ChecklistItem {
  id: string;
  title: string;
  order: number;
  completed: boolean;
  completedAt: string | null;
  completedBy: { id: string; name: string | null; email: string } | null;
}

interface Checklist {
  id: string;
  items: ChecklistItem[];
}

interface Template {
  id: string;
  name: string;
  items: { id: string; title: string; order: number }[];
}

interface ChecklistSectionProps {
  phaseId: string;
  checklist: Checklist | null;
  templates: Template[];
  canEdit: boolean;
  canManage: boolean;
}

export function ChecklistSection({
  phaseId,
  checklist,
  templates,
  canEdit,
  canManage,
}: ChecklistSectionProps) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const items = checklist?.items || [];
  const completed = items.filter((i) => i.completed).length;
  const total = items.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  async function handleApplyTemplate(templateId: string) {
    setLoading(true);
    try {
      await applyChecklistTemplate(phaseId, templateId);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setShowTemplatePicker(false);
  }

  async function handleToggle(itemId: string) {
    setTogglingId(itemId);
    try {
      await toggleChecklistItem(itemId);
    } catch (e) {
      console.error(e);
    }
    setTogglingId(null);
  }

  async function handleAddItem() {
    if (!newItemTitle.trim() || !checklist) return;
    setLoading(true);
    try {
      await addCustomChecklistItem(checklist.id, newItemTitle.trim());
      setNewItemTitle("");
      setShowAddItem(false);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await deleteChecklistItem(itemId);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Checklist
          {total > 0 && (
            <span className="ml-2 text-gray-500 normal-case font-normal">
              {completed}/{total}
            </span>
          )}
        </h2>
        {canEdit && checklist && (
          <button
            onClick={() => setShowAddItem(true)}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        )}
      </div>

      {!checklist ? (
        <div className="text-center py-6">
          <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">No checklist yet</p>
          {canEdit && templates.length > 0 && (
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ListChecks className="w-4 h-4" />
              Apply Template
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Progress bar */}
          {total > 0 && (
            <div className="mb-4">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor:
                      progressPct === 100 ? "#16a34a" : "#3b82f6",
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{progressPct}% complete</p>
            </div>
          )}

          {/* Items */}
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 group"
              >
                <button
                  onClick={() => canEdit && handleToggle(item.id)}
                  disabled={!canEdit || togglingId === item.id}
                  className="mt-0.5 shrink-0 disabled:opacity-50"
                >
                  {item.completed ? (
                    <CheckSquare className="w-5 h-5 text-green-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm ${
                      item.completed
                        ? "text-gray-400 line-through"
                        : "text-gray-900"
                    }`}
                  >
                    {item.title}
                  </span>
                  {item.completed && item.completedBy && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.completedBy.name || item.completedBy.email}
                      {item.completedAt &&
                        ` · ${new Date(item.completedAt).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
                {canManage && (
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 shrink-0"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add item inline */}
          {showAddItem && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <input
                type="text"
                placeholder="New checklist item..."
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
              />
              <button
                onClick={handleAddItem}
                disabled={loading || !newItemTitle.trim()}
                className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddItem(false);
                  setNewItemTitle("");
                }}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Template Picker Modal */}
      {showTemplatePicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Choose a Template
              </h3>
              <button
                onClick={() => setShowTemplatePicker(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleApplyTemplate(t.id)}
                  disabled={loading}
                  className="w-full text-left p-3 hover:bg-gray-50 rounded-lg disabled:opacity-50"
                >
                  <p className="text-sm font-medium text-gray-900">
                    {t.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.items.length} items
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
