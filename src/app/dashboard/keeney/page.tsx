/**
 * @file src/app/dashboard/keeney/page.tsx
 * @description Keeney Mode — voice-first field interface.
 * One button. Press it. Talk. The app figures out the rest.
 * Sprint 21
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { KeeneyModeClient } from "@/components/keeney/KeeneyModeClient";
import { getKeeneyProjectContext } from "@/actions/keeney";

export default async function KeeneyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projects = await getKeeneyProjectContext(session.user.id);

  return (
    <KeeneyModeClient
      userName={session.user.name ?? "User"}
      projects={projects}
    />
  );
}
