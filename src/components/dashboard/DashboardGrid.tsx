"use client";

/**
 * @file components/dashboard/DashboardGrid.tsx
 * @description Customizable dashboard widget grid. Supports drag-and-drop
 * reordering, collapsible widgets, visibility toggles, and persistent
 * layout preferences per-user. Widget set varies by user role.
 */

import { useState, useCallback, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  Settings2,
  Eye,
  EyeOff,
  RotateCcw,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  saveDashboardLayout,
  resetDashboardLayout,
} from "@/actions/dashboard-layout";
import type { DashboardLayoutData, WidgetPref } from "@/actions/dashboard-layout";

// ── Types ────────────────────────────────────────────────────────────────

export interface WidgetConfig {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  defaultColSpan: 1 | 2 | 3;
  minRole?: string; // minimum role to see this widget
  defaultVisible?: boolean;
}

interface Props {
  widgets: WidgetConfig[];
  savedLayout: DashboardLayoutData | null;
  userRole: string;
}

// ── Role hierarchy for filtering ──────────────────────────────────────

const ROLE_LEVEL: Record<string, number> = {
  SYSTEM_ADMIN: 100,
  ADMIN: 90,
  PROJECT_MANAGER: 70,
  CONTRACTOR: 50,
  STAKEHOLDER: 30,
  VIEWER: 10,
};

function hasRoleAccess(userRole: string, minRole?: string): boolean {
  if (!minRole) return true;
  return (ROLE_LEVEL[userRole] || 0) >= (ROLE_LEVEL[minRole] || 0);
}

// ── Default layout from widget configs ──

function buildDefaultLayout(widgets: WidgetConfig[]): WidgetPref[] {
  return widgets.map((w, i) => ({
    id: w.id,
    visible: w.defaultVisible !== false,
    collapsed: false,
    order: i,
    colSpan: w.defaultColSpan,
  }));
}

function mergeLayouts(
  saved: DashboardLayoutData | null,
  widgets: WidgetConfig[]
): WidgetPref[] {
  const defaults = buildDefaultLayout(widgets);
  if (!saved?.widgets) return defaults;

  // Merge: preserve saved positions, add any new widgets at end
  const savedMap = new Map(saved.widgets.map((w) => [w.id, w]));
  const merged: WidgetPref[] = [];
  let maxOrder = saved.widgets.reduce((m, w) => Math.max(m, w.order), 0);

  // First, add saved widgets in their saved order
  for (const sw of saved.widgets) {
    if (defaults.find((d) => d.id === sw.id)) {
      merged.push(sw);
    }
  }

  // Then add any new widgets not in saved layout
  for (const dw of defaults) {
    if (!savedMap.has(dw.id)) {
      merged.push({ ...dw, order: ++maxOrder });
    }
  }

  return merged.sort((a, b) => a.order - b.order);
}

// ── Main Component ───────────────────────────────────────────────────────

export function DashboardGrid({ widgets, savedLayout, userRole }: Props) {
  const t = useTranslations("widgets");
  const [isSaving, startSaving] = useTransition();
  const [showSettings, setShowSettings] = useState(false);

  // Filter widgets by role
  const availableWidgets = widgets.filter((w) => hasRoleAccess(userRole, w.minRole));
  const widgetMap = new Map(availableWidgets.map((w) => [w.id, w]));

  // Layout state
  const [layout, setLayout] = useState<WidgetPref[]>(() =>
    mergeLayouts(savedLayout, availableWidgets)
  );

  // Drag state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  // ── Persist layout ──

  const persistLayout = useCallback(
    (newLayout: WidgetPref[]) => {
      setLayout(newLayout);
      startSaving(async () => {
        await saveDashboardLayout({ widgets: newLayout, version: 1 });
      });
    },
    [startSaving]
  );

  // ── Toggle collapsed ──

  const toggleCollapsed = useCallback(
    (id: string) => {
      const newLayout = layout.map((w) =>
        w.id === id ? { ...w, collapsed: !w.collapsed } : w
      );
      persistLayout(newLayout);
    },
    [layout, persistLayout]
  );

  // ── Toggle visibility ──

  const toggleVisible = useCallback(
    (id: string) => {
      const newLayout = layout.map((w) =>
        w.id === id ? { ...w, visible: !w.visible } : w
      );
      persistLayout(newLayout);
    },
    [layout, persistLayout]
  );

  // ── Cycle column span ──

  const cycleColSpan = useCallback(
    (id: string) => {
      const newLayout = layout.map((w) => {
        if (w.id !== id) return w;
        const next = w.colSpan === 1 ? 2 : w.colSpan === 2 ? 3 : 1;
        return { ...w, colSpan: next as 1 | 2 | 3 };
      });
      persistLayout(newLayout);
    },
    [layout, persistLayout]
  );

  // ── Drag handlers ──

  const handleDragStart = (index: number, id: string) => {
    dragItem.current = index;
    setDragging(id);
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) {
      setDragging(null);
      return;
    }

    const visibleItems = layout.filter((w) => w.visible);
    const item = visibleItems[dragItem.current];
    const over = visibleItems[dragOverItem.current];

    if (item && over && item.id !== over.id) {
      // Reorder: swap the order values
      const newLayout = layout.map((w) => {
        if (w.id === item.id) return { ...w, order: over.order };
        if (w.id === over.id) return { ...w, order: item.order };
        return w;
      });
      persistLayout(newLayout.sort((a, b) => a.order - b.order));
    }

    dragItem.current = null;
    dragOverItem.current = null;
    setDragging(null);
  };

  // ── Reset ──

  const handleReset = () => {
    const defaults = buildDefaultLayout(availableWidgets);
    setLayout(defaults);
    startSaving(async () => {
      await resetDashboardLayout();
    });
    setShowSettings(false);
  };

  // ── Render ──

  const visibleWidgets = layout.filter((w) => w.visible && widgetMap.has(w.id));
  const hiddenWidgets = layout.filter((w) => !w.visible && widgetMap.has(w.id));

  return (
    <div className="space-y-3">
      {/* Customize bar */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" />
          {t("customize")}
        </button>
        {isSaving && (
          <span className="text-xs text-gray-400">{t("saving")}</span>
        )}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("customizeTitle")}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                {t("resetLayout")}
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">{t("customizeHint")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {layout.filter((w) => widgetMap.has(w.id)).map((pref) => {
              const config = widgetMap.get(pref.id)!;
              return (
                <button
                  key={pref.id}
                  onClick={() => toggleVisible(pref.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    pref.visible
                      ? "bg-violet-50 border-violet-200 text-violet-700"
                      : "bg-gray-50 border-gray-200 text-gray-400"
                  }`}
                >
                  {pref.visible ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                  <span className="truncate">{config.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Widget grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleWidgets.map((pref, index) => {
          const config = widgetMap.get(pref.id);
          if (!config) return null;

          const colSpan = pref.colSpan || config.defaultColSpan;
          const spanClass =
            colSpan === 3
              ? "md:col-span-2 lg:col-span-3"
              : colSpan === 2
              ? "md:col-span-2"
              : "";

          return (
            <div
              key={pref.id}
              draggable
              onDragStart={() => handleDragStart(index, pref.id)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`${spanClass} ${
                dragging === pref.id ? "opacity-50" : ""
              } transition-opacity`}
            >
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Widget header */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-gray-50/80 select-none">
                  <div
                    className="cursor-grab active:cursor-grabbing p-0.5 text-gray-300 hover:text-gray-500 -ml-1"
                    title={t("dragToReorder")}
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="text-gray-500">{config.icon}</div>
                  <h3 className="text-sm font-medium text-gray-900 flex-1 truncate">
                    {config.title}
                  </h3>
                  <button
                    onClick={() => cycleColSpan(pref.id)}
                    className="p-1 text-gray-300 hover:text-gray-500 transition-colors"
                    title={t("resizeWidget")}
                  >
                    {colSpan < 3 ? (
                      <Maximize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Minimize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleCollapsed(pref.id)}
                    className="p-1 text-gray-300 hover:text-gray-500 transition-colors"
                    title={pref.collapsed ? t("expand") : t("collapse")}
                  >
                    {pref.collapsed ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronUp className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Widget body */}
                {!pref.collapsed && (
                  <div className="widget-body">{config.component}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hidden widgets hint */}
      {hiddenWidgets.length > 0 && !showSettings && (
        <p className="text-center text-xs text-gray-400 pt-2">
          {t("hiddenWidgets", { count: hiddenWidgets.length })}
          {" · "}
          <button
            onClick={() => setShowSettings(true)}
            className="text-violet-500 hover:underline"
          >
            {t("customize")}
          </button>
        </p>
      )}
    </div>
  );
}
