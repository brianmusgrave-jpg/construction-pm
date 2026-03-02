"use server";

/**
 * @file actions/dashboard-layout.ts
 * @description Server actions for saving/loading user dashboard widget layout
 * preferences (widget order, visibility, collapsed state, column span).
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** Shape of a single widget's layout preferences */
export interface WidgetPref {
  id: string;
  visible: boolean;
  collapsed: boolean;
  order: number;
  colSpan?: 1 | 2 | 3; // 1=small, 2=medium, 3=full-width
}

/** Full dashboard layout stored per-user */
export interface DashboardLayoutData {
  widgets: WidgetPref[];
  version: number; // for future migrations
}

/**
 * Get the current user's dashboard layout preferences.
 * Returns null if no custom layout has been saved (use defaults).
 */
export async function getDashboardLayout(): Promise<DashboardLayoutData | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    const user = await (db as any).user.findUnique({
      where: { id: session.user.id },
      select: { dashboardLayout: true },
    });
    if (!user?.dashboardLayout) return null;
    return user.dashboardLayout as DashboardLayoutData;
  } catch {
    return null;
  }
}

/**
 * Save the user's dashboard layout preferences.
 */
export async function saveDashboardLayout(
  layout: DashboardLayoutData
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  try {
    await (db as any).user.update({
      where: { id: session.user.id },
      data: { dashboardLayout: layout },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

/**
 * Reset the user's dashboard layout to defaults.
 */
export async function resetDashboardLayout(): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  try {
    await (db as any).user.update({
      where: { id: session.user.id },
      data: { dashboardLayout: null },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}
