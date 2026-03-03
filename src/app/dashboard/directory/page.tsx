/**
 * @file src/app/dashboard/directory/page.tsx
 * @description Staff directory page. Fetches all staff with their phase assignments,
 * certificates, and umbrella policy, then renders DirectoryClient with role-based
 * manage and PM flags.
 */
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
  const isAdmin = userRole === "ADMIN";

  // Fetch existing user emails so the directory can hide "Invite as User"
  // on contacts that already have an account.
  const dbc = db as any;
  const existingUsers = await dbc.user.findMany({ select: { email: true } });
  const userEmails: string[] = existingUsers
    .map((u: { email: string }) => u.email)
    .filter(Boolean);

  return (
    <DirectoryClient
      contacts={contacts as never}
      canManage={canManage}
      isPM={isPM}
      isAdmin={isAdmin}
      userEmails={userEmails}
    />
  );
}
