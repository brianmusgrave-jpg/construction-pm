import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { DirectoryClient } from "@/components/directory/DirectoryClient";

export default async function DirectoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const contacts = await db.staff.findMany({
    include: {
      assignments: {
        include: {
          phase: {
            select: { id: true, name: true, projectId: true },
          },
        },
      },
      certificates: {
        orderBy: { expiryDate: "asc" },
      },
      umbrellaPolicy: true,
    },
    orderBy: { name: "asc" },
  });

  const userRole = session.user.role || "VIEWER";
  const canManage = can(userRole, "create", "staff");
  const isPM = userRole === "ADMIN" || userRole === "PROJECT_MANAGER";

  return (
    <DirectoryClient
      contacts={contacts as never}
      canManage={canManage}
      isPM={isPM}
    />
  );
}
