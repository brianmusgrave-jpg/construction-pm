"use client";

/**
 * @file components/phase/DrawingSection.tsx
 * @description Construction drawing register for a phase detail page.
 *
 * Tracks drawings across nine disciplines defined in `DISCIPLINES`:
 *   ARCHITECTURAL, STRUCTURAL, MECHANICAL, ELECTRICAL, PLUMBING,
 *   CIVIL, LANDSCAPE, FIRE_PROTECTION, OTHER.
 *
 * Drawing statuses (via `STATUS_STYLES`):
 *   CURRENT (green), SUPERSEDED (gray), VOID (red),
 *   FOR_REVIEW (amber), PRELIMINARY (blue).
 *
 * Key behaviours:
 *   - Discipline filter tabs appear only when > 1 discipline is present
 *     (`presentDiscs = Array.from(new Set(items.map(i => i.discipline)))`).
 *   - `currentCount` summary badge counts CURRENT drawings.
 *   - `handleSupersede` → sets status to SUPERSEDED (available on CURRENT drawings).
 *   - `handleVoid` → sets status to VOID (available on all non-VOID drawings).
 *   - Collapsible section via `expanded` state.
 *   - Each drawing displays drawingNumber, title, discipline, revision,
 *     and optional sheetSize / scale fields.
 *
 * Permissions:
 *   - `canEdit`   — may add and delete drawings.
 *   - `canManage` — may supersede or void drawings.
 *
 * Server actions: `createDrawing`, `updateDrawingStatus`, `deleteDrawing`.
 * i18n namespace: `drawing`.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createDrawing, updateDrawingStatus, deleteDrawing } from "@/actions/drawing";
import { toast } from "sonner";
import {
  PenTool,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileImage,
  Archive,
} from "lucide-react";

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  CURRENT: { color: "text-green-700", bg: "bg-green-100" },
  SUPERSEDED: { color: "text-gray-700", bg: "bg-gray-200" },
  VOID: { color: "text-red-700", bg: "bg-red-100" },
  FOR_REVIEW: { color: "text-amber-700", bg: "bg-amber-100" },
  PRELIMINARY: { color: "text-blue-700", bg: "bg-blue-100" },
};

const DISCIPLINES = [
  "ARCHITECTURAL",
  "STRUCTURAL",
  "MECHANICAL",
  "ELECTRICAL",
  "PLUMBING",
  "CIVIL",
  "LANDSCAPE",
  "FIRE_PROTECTION",
  "OTHER",
];

interface DrawingSectionProps {
  phaseId: string;
  drawings: any[];
  canEdit: boolean;
  canManage: boolean;
}

export function DrawingSection({ phaseId, drawings, canEdit, canManage }: DrawingSectionProps) {
  const t = useTranslations("drawing");
  const [items, setItems] = useState(drawings);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filterDisc, setFilterDisc] = useState<string>("ALL");

  // Form state
  const [title, setTitle] = useState("");
  const [drawingNumber, setDrawingNumber] = useState("");
  const [discipline, setDiscipline] = useState("ARCHITECTURAL");
  const [revision, setRevision] = useState("0");
  const [description, setDescription] = useState("");
  const [sheetSize, setSheetSize] = useState("");
  const [scale, setScale] = useState("");

  const filtered = filterDisc === "ALL" ? items : items.filter((i) => i.discipline === filterDisc);

  const currentCount = items.filter((d: any) => d.status === "CURRENT").length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !drawingNumber) return;
    setLoading(true);
    try {
      const item = await createDrawing({
        phaseId,
        title,
        drawingNumber,
        discipline,
        revision: revision || "0",
        description: description || undefined,
        sheetSize: sheetSize || undefined,
        scale: scale || undefined,
      });
      setItems((prev) => [...prev, item]);
      setTitle("");
      setDrawingNumber("");
      setRevision("0");
      setDescription("");
      setSheetSize("");
      setScale("");
      setShowForm(false);
      toast.success(t("created"));
    } catch {
      toast.error(t("errorCreate"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSupersede(id: string) {
    try {
      await updateDrawingStatus(id, "SUPERSEDED");
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "SUPERSEDED" } : i));
      toast.success(t("statusUpdated"));
    } catch {
      toast.error(t("errorStatus"));
    }
  }

  async function handleVoid(id: string) {
    try {
      await updateDrawingStatus(id, "VOID");
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "VOID" } : i));
      toast.success(t("statusUpdated"));
    } catch {
      toast.error(t("errorStatus"));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteDrawing(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success(t("deleted"));
    } catch {
      toast.error(t("errorDelete"));
    }
  }

  // Get unique disciplines present
  const presentDiscs = Array.from(new Set(items.map((i: any) => i.discipline)));

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
            <PenTool className="w-5 h-5 text-violet-500" />
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <span className="text-sm text-gray-500">({items.length})</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
          {canEdit && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-sm bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors">
              <Plus className="w-4 h-4" /> {t("addDrawing")}
            </button>
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span>{t("current")}: <strong className="text-green-600">{currentCount}</strong></span>
          <span>{t("total")}: <strong>{items.length}</strong></span>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input type="text" value={drawingNumber} onChange={(e) => setDrawingNumber(e.target.value)} placeholder={t("numberPlaceholder")} className="border rounded-lg px-3 py-2 text-sm" required />
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} className="border rounded-lg px-3 py-2 text-sm" required />
            <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              {DISCIPLINES.map((d) => (
                <option key={d} value={d}>{t(`disc${d.charAt(0) + d.slice(1).toLowerCase().replace(/_./g, (m) => m[1].toUpperCase())}`)}</option>
              ))}
            </select>
            <input type="text" value={revision} onChange={(e) => setRevision(e.target.value)} placeholder={t("revisionPlaceholder")} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input type="text" value={sheetSize} onChange={(e) => setSheetSize(e.target.value)} placeholder={t("sheetSizePlaceholder")} className="border rounded-lg px-3 py-2 text-sm" />
            <input type="text" value={scale} onChange={(e) => setScale(e.target.value)} placeholder={t("scalePlaceholder")} className="border rounded-lg px-3 py-2 text-sm" />
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("descriptionPlaceholder")} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100">{t("cancel")}</button>
            <button type="submit" disabled={loading} className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">{t("create")}</button>
          </div>
        </form>
      )}

      {expanded && (
        <>
          {presentDiscs.length > 1 && (
            <div className="flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
              <button onClick={() => setFilterDisc("ALL")} className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${filterDisc === "ALL" ? "bg-violet-100 text-violet-700 font-medium" : "text-gray-500 hover:bg-gray-100"}`}>
                {t("filterAll")}
              </button>
              {presentDiscs.map((d: string) => (
                <button key={d} onClick={() => setFilterDisc(d)} className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${filterDisc === d ? "bg-violet-100 text-violet-700 font-medium" : "text-gray-500 hover:bg-gray-100"}`}>
                  {t(`disc${d.charAt(0) + d.slice(1).toLowerCase().replace(/_./g, (m: string) => m[1].toUpperCase())}`)}
                </button>
              ))}
            </div>
          )}

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">{t("empty")}</p>
            ) : (
              filtered.map((drawing) => {
                const style = STATUS_STYLES[drawing.status] || STATUS_STYLES.CURRENT;
                return (
                  <div key={drawing.id} className="p-3 sm:p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <FileImage className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-medium">{drawing.drawingNumber}</span>
                        <span className="text-sm">{drawing.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>{t(`status${drawing.status.charAt(0) + drawing.status.slice(1).toLowerCase().replace(/_./g, (m: string) => m[1].toUpperCase())}`)}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                        <span>{t(`disc${drawing.discipline.charAt(0) + drawing.discipline.slice(1).toLowerCase().replace(/_./g, (m: string) => m[1].toUpperCase())}`)}</span>
                        <span>{t("rev")} {drawing.revision}</span>
                        {drawing.sheetSize && <span>{drawing.sheetSize}</span>}
                        {drawing.scale && <span>{drawing.scale}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {drawing.status === "CURRENT" && canManage && (
                        <button onClick={() => handleSupersede(drawing.id)} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1">
                          <Archive className="w-3 h-3" /> {t("supersede")}
                        </button>
                      )}
                      {drawing.status !== "VOID" && canManage && (
                        <button onClick={() => handleVoid(drawing.id)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded">{t("void")}</button>
                      )}
                      {canEdit && (
                        <button onClick={() => handleDelete(drawing.id)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </section>
  );
}
