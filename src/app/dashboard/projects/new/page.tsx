/**
 * @file src/app/dashboard/projects/new/page.tsx
 * @description New project creation page. Checks canCreateProject permission via
 * role-based access control and renders NewProjectForm if authorized.
 */
import { auth } from "@/lib/auth";
import { canCreateProject } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewProjectForm } from "@/components/projects/NewProjectForm";

export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user || !canCreateProject(session.user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Create New Project
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Set up your project details and define the build phases.
      </p>

      <NewProjectForm />
    </div>
  );
}
