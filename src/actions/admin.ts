"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

const dbc = db as any;

// ── Feature Toggles ──

const DEFAULT_FEATURES = [
  // Core features (always shown)
  { featureKey: "punch_lists", label: "Punch Lists", category: "field" },
  { featureKey: "rfis", label: "RFIs", category: "field" },
  { featureKey: "submittals", label: "Submittals", category: "field" },
  { featureKey: "time_tracking", label: "Time Tracking", category: "field" },
  { featureKey: "drawings", label: "Drawing Management", category: "field" },
  { featureKey: "daily_logs", label: "Daily Logs", category: "field" },
  { featureKey: "inspections", label: "Inspections", category: "field" },
  { featureKey: "voice_notes", label: "Voice Notes", category: "field" },
  // Financial features
  { featureKey: "lien_waivers", label: "Lien Waivers", category: "financial" },
  { featureKey: "payment_apps", label: "Payment Applications", category: "financial" },
  { featureKey: "estimates", label: "Estimating & Takeoffs", category: "financial" },
  { featureKey: "change_orders", label: "Change Orders", category: "financial" },
  { featureKey: "budgets", label: "Budget Tracking", category: "financial" },
  { featureKey: "bids", label: "Subcontractor Bids", category: "financial" },
  // Integrations
  { featureKey: "quickbooks", label: "QuickBooks Integration", category: "integrations" },
  { featureKey: "webhooks", label: "Webhooks", category: "integrations" },
  { featureKey: "api_keys", label: "API Keys", category: "integrations" },
  // Other
  { featureKey: "client_portal", label: "Client Portal", category: "general" },
  { featureKey: "analytics", label: "Analytics Dashboard", category: "general" },
  { featureKey: "offline_mode", label: "Offline Mode", category: "general" },
];

export async function getFeatureToggles() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const existing = await dbc.featureToggle.findMany({
    orderBy: { featureKey: "asc" },
  });

  // Ensure all default features exist
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

export async function toggleFeature(featureKey: string, enabled: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden — admin only");

  await dbc.featureToggle.update({
    where: { featureKey },
    data: {
      enabled,
      disabledBy: enabled ? null : session.user.id,
      disabledAt: enabled ? null : new Date(),
    },
  });

  revalidatePath("/dashboard/admin");
  return { success: true };
}

// ── System Health / Stats ──

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

  // Get recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentActivityCount = await dbc.activityLog.count({
    where: { createdAt: { gte: sevenDaysAgo } },
  });

  // Storage estimate (documents + photos)
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

export async function deactivateUser(userId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role || "VIEWER";
  if (role !== "ADMIN") throw new Error("Forbidden — admin only");

  if (userId === session.user.id) {
    throw new Error("Cannot deactivate yourself");
  }

  // Remove from all projects
  await dbc.projectMember.deleteMany({ where: { userId } });

  // Deactivate sessions
  await dbc.session.deleteMany({ where: { userId } });

  revalidatePath("/dashboard/admin");
  return { success: true };
}

// ── Audit Export ──

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
    take: 5000,
  });

  // Build CSV string
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
