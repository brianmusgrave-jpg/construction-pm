/**
 * @file src/app/dashboard/admin/page.tsx
 * @description Admin panel page. Restricted to ADMIN role. Fetches feature toggles,
 * system stats, users, activity logs, and projects in parallel; serializes dates
 * and builds an embedded ActivityLogClient node for AdminPanelClient.
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getFeatureToggles, getSystemStats, getUsers } from "@/actions/admin";
import { AdminPanelClient } from "@/components/admin/AdminPanelClient";
import { ActivityLogClient } from "@/components/activity/ActivityLogClient";

const dbc = db as any;

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Only ADMIN role can access the admin panel
  const user = await dbc.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const t = await getTranslations("adminPanel");

  // Fetch admin data in parallel
  const [features, stats, users] = await Promise.all([
    getFeatureToggles(),
    getSystemStats(),
    getUsers(),
  ]);

  // Fetch activity logs for the embedded tab (reuse existing pattern)
  const [logsRaw, projects] = await Promise.all([
    dbc.activityLog.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    dbc.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalCount = await dbc.activityLog.count();

  const logs = logsRaw.map((l: any) => ({
    id: l.id,
    action: l.action,
    message: l.message,
    data: l.data as Record<string, unknown> | null,
    projectId: l.projectId,
    projectName: l.project?.name ?? "",
    userId: l.userId,
    userName: l.user?.name ?? l.user?.email ?? "",
    userImage: l.user?.image ?? null,
    createdAt: l.createdAt.toISOString(),
  }));

  const actionTypes = [
    "PHASE_CREATED",
    "PHASE_STATUS_CHANGED",
    "PHASE_DATES_CHANGED",
    "STAFF_ASSIGNED",
    "STAFF_UNASSIGNED",
    "CHECKLIST_APPLIED",
    "CHECKLIST_ITEM_TOGGLED",
    "DOCUMENT_UPLOADED",
    "DOCUMENT_STATUS_CHANGED",
    "PHOTO_UPLOADED",
    "PROJECT_CREATED",
    "PROJECT_STATUS_CHANGED",
    "MEMBER_INVITED",
    "MEMBER_JOINED",
    "MEMBER_REMOVED",
    "MEMBER_UPDATED",
    "COMMENT_ADDED",
    "COMMENT_DELETED",
    "DEPENDENCY_ADDED",
    "DEPENDENCY_REMOVED",
  ];

  // Build the activity log node to embed in the admin panel
  const activityLogNode = (
    <ActivityLogClient
      initialLogs={logs}
      totalPages={Math.ceil(totalCount / 50)}
      totalCount={totalCount}
      projects={projects}
      actionTypes={actionTypes}
      isAdmin={true}
    />
  );

  // Serialize dates for client
  const serializedFeatures = (features as any[]).map((f: any) => ({
    ...f,
    disabledAt: f.disabledAt ? f.disabledAt.toISOString() : null,
    createdAt: f.createdAt?.toISOString?.() ?? null,
    updatedAt: f.updatedAt?.toISOString?.() ?? null,
  }));

  const serializedUsers = (users as any[]).map((u: any) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
      </div>
      <AdminPanelClient
        features={serializedFeatures}
        users={serializedUsers}
        stats={stats}
        currentUserId={session.user.id!}
        activityLogNode={activityLogNode}
      />
    </div>
  );
}
