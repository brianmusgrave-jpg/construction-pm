import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActivityLogClient } from "@/components/activity/ActivityLogClient";

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || !["ADMIN", "PROJECT_MANAGER"].includes(user.role)) {
    redirect("/dashboard");
  }

  const t = await getTranslations("activity");

  // Fetch initial data
  const [logsRaw, projects] = await Promise.all([
    db.activityLog.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalCount = await db.activityLog.count();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = logsRaw.map((l: any) => ({
    id: l.id,
    action: l.action,
    message: l.message,
    data: l.data as Record<string, unknown> | null,
    projectId: l.projectId,
    projectName: l.project.name,
    userId: l.userId,
    userName: l.user.name ?? l.user.email,
    userImage: l.user.image,
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
      </div>
      <ActivityLogClient
        initialLogs={logs}
        totalPages={Math.ceil(totalCount / 50)}
        totalCount={totalCount}
        projects={projects}
        actionTypes={actionTypes}
        isAdmin={user.role === "ADMIN"}
      />
    </div>
  );
}
