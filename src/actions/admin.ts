"use server";

/**
 * @file actions/admin.ts
 * @description Server actions for admin-only system management.
 *
 * Covers four admin domains:
 *   1. Feature Toggles  — enable/disable named feature flags app-wide
 *   2. System Stats     — aggregate counts and storage metrics for the admin dashboard
 *   3. User Management  — list users, change roles, deactivate accounts
 *   4. Audit Export     — download the full activity log as a CSV
 *
 * Most functions require the ADMIN or PROJECT_MANAGER role (enforced via
 * `can(role, "manage", "phase")`). Role changes and deactivation are
 * restricted to ADMIN only.
 *
 * Note: `dbc` is a cast to `any` to access Prisma models (featureToggle, session)
 * that may not be present in older generated types but exist in the schema.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// Cast to any for access to schema models not yet reflected in generated types
const dbc = db as any;

// ── Feature Toggles ──

/**
 * All feature keys recognised by the app, with their display label and category.
 * On first load, any missing keys are auto-seeded into the DB (enabled=true by default).
 * Categories: "field" | "financial" | "integrations" | "general"
 */
const DEFAULT_FEATURES = [
  // Core field operations
  { featureKey: "punch_lists",   label: "Punch Lists",               category: "field" },
  { featureKey: "rfis",          label: "RFIs",                      category: "field" },
  { featureKey: "submittals",    label: "Submittals",                 category: "field" },
  { featureKey: "time_tracking", label: "Time Tracking",             category: "field" },
  { featureKey: "drawings",      label: "Drawing Management",        category: "field" },
  { featureKey: "daily_logs",    label: "Daily Logs",                category: "field" },
  { featureKey: "inspections",   label: "Inspections",               category: "field" },
  { featureKey: "voice_notes",   label: "Voice Notes",               category: "field" },
  // Financial features
  { featureKey: "lien_waivers",  label: "Lien Waivers",              category: "financial" },
  { featureKey: "payment_apps",  label: "Payment Applications",      category: "financial" },
  { featureKey: "estimates",     label: "Estimating & Takeoffs",     category: "financial" },
  { featureKey: "change_orders", label: "Change Orders",             category: "financial" },
  { featureKey: "budgets",       label: "Budget Tracking",           category: "financial" },
  { featureKey: "bids",          label: "Subcontractor Bids",        category: "financial" },
  // Integrations
  { featureKey: "quickbooks",    label: "QuickBooks Integration",    category: "integrations" },
  { featureKey: "webhooks",      label: "Webhooks",                  category: "integrations" },
  { featureKey: "api_keys",      label: "API Keys",                  category: "integrations" },
  // General
  { featureKey: "client_portal", label: "Client Portal",             category: "general" },
  { featureKey: "analytics",     label: "Analytics Dashboard",       category: "general" },
  { featureKey: "offline_mode",  label: "Offline Mode",              category: "general" },
];

/**
 * Fetch all feature toggles, seeding any missing defaults first.
 * The settings UI renders the returned array directly — order is alphabetical by key.
 *
 * Requires: authenticated session (no role check — read-only for all users).
 */
export async function getFeatureToggles() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const existing = await dbc.featureToggle.findMany({
    orderBy: { featureKey: "asc" },
  });

  // Seed any features that don't yet exist in the DB (enabled by default)
  const existingKeys = new Set(existing.map((f: any) => f.featureKey));
  const missing = DEFAULT_FEATURES.filter((f) => !existingKeys.has(f.featureKey));

  if (missing.length > 0) {
    await dbc.featureToggle.createMany({
      data: missing.map((f) => ({ ...f, enabled: true })),
      skipDuplicates: true,
    });
    return dbc.featureToggle.findMany({ orderBy: { featureKey: "asc" } });
  }

  return existing;
}

/**
 * Enable or disable a named feature flag.
 * When disabling, records who disabled it and when (for the audit trail).
 * When re-enabling, clears those fields.
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
export async function toggleFeature(featureKey: string, enabled: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden — admin only");

  await dbc.featureToggle.update({
    where: { featureKey },
    data: {
      enabled,
      disabledBy: enabled ? null : session.user.id, // Clear on re-enable
      disabledAt: enabled ? null : new Date(),
    },
  });

  revalidatePath("/dashboard/admin");
  return { success: true };
}

// ── System Health / Stats ──

/**
 * Return aggregate counts across all major entities for the admin overview panel.
 * All counts run in parallel via Promise.all to minimise latency.
 *
 * Returns:
 *   - users, projects, activeProjects, phases, documents, photos, staff
 *   - totalActivities, recentActivities (last 7 days)
 *   - storageBytes: sum of all document file sizes (photos excluded)
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
export async function getSystemStats() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

  const [
    userCount,
    projectCount,
    phaseCount,
    documentCount,
    photoCount,
    activityCount,
    staffCount,
    activeProjectCount,
  ] = await Promise.all([
    dbc.user.count(),
    dbc.project.count(),
    dbc.phase.count(),
    dbc.document.count(),
    dbc.photo.count(),
    dbc.activityLog.count(),
    dbc.staff.count(),
    dbc.project.count({ where: { status: "ACTIVE" } }),
  ]);

  // Activity in the rolling 7-day window
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentActivityCount = await dbc.activityLog.count({
    where: { createdAt: { gte: sevenDaysAgo } },
  });

  // Storage estimate from document sizes (photos stored in Blob, size not tracked)
  const docSizeAgg = await dbc.document.aggregate({ _sum: { size: true } });
  const totalStorageBytes = docSizeAgg._sum?.size || 0;

  return {
    users: userCount,
    projects: projectCount,
    activeProjects: activeProjectCount,
    phases: phaseCount,
    documents: documentCount,
    photos: photoCount,
    staff: staffCount,
    totalActivities: activityCount,
    recentActivities: recentActivityCount,
    storageBytes: totalStorageBytes,
  };
}

// ── User Management ──

/**
 * List all users with their role, project membership count, and notification count.
 * Ordered by creation date (newest first) for the admin user table.
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
export async function getUsers() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

  return dbc.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      createdAt: true,
      _count: { select: { projectMembers: true, notifications: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Change a user's global system role (e.g. promote to PROJECT_MANAGER).
 * Cannot change your own role — prevents accidental self-demotion.
 *
 * Requires: ADMIN role only.
 */
export async function updateUserRole(userId: string, newRole: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role || "VIEWER";
  if (role !== "ADMIN") throw new Error("Forbidden — admin only");

  // Prevent self-demotion
  if (userId === session.user.id) {
    throw new Error("Cannot change your own role");
  }

  await dbc.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  revalidatePath("/dashboard/admin");
  return { success: true };
}

/**
 * Deactivate a user account by removing them from all projects and
 * invalidating all active sessions (immediate logout).
 * The user record itself is retained for audit/activity log references.
 * Cannot deactivate yourself.
 *
 * Requires: ADMIN role only.
 */
export async function deactivateUser(userId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role || "VIEWER";
  if (role !== "ADMIN") throw new Error("Forbidden — admin only");

  if (userId === session.user.id) {
    throw new Error("Cannot deactivate yourself");
  }

  // Remove from all project memberships
  await dbc.projectMember.deleteMany({ where: { userId } });

  // Invalidate active sessions (forces immediate logout)
  await dbc.session.deleteMany({ where: { userId } });

  revalidatePath("/dashboard/admin");
  return { success: true };
}

// ── Audit Export ──

/**
 * Generate a CSV export of the most recent 5,000 activity log entries,
 * including user name/email and project name. Suitable for download via
 * the admin UI.
 *
 * Returns a plain CSV string (header row + data rows, double-quote escaped).
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
export async function exportAuditLog() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

  const logs = await dbc.activityLog.findMany({
    include: {
      user: { select: { name: true, email: true } },
      project: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000, // Cap to prevent enormous exports
  });

  // Build a double-quote-escaped CSV string
  const header = "Timestamp,User,Email,Action,Message,Project";
  const rows = logs.map((log: any) => {
    const ts = new Date(log.createdAt).toISOString();
    const userName = (log.user?.name || "").replace(/"/g, '""');
    const email = (log.user?.email || "").replace(/"/g, '""');
    const action = log.action;
    const message = (log.message || "").replace(/"/g, '""');
    const project = (log.project?.name || "").replace(/"/g, '""');
    return `"${ts}","${userName}","${email}","${action}","${message}","${project}"`;
  });

  return [header, ...rows].join("\n");
}
