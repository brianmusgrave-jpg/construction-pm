import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  ExternalLink,
} from "lucide-react";

const categoryColors: Record<string, string> = {
  PERMIT: "bg-blue-100 text-blue-700",
  CONTRACT: "bg-purple-100 text-purple-700",
  INVOICE: "bg-green-100 text-green-700",
  BLUEPRINT: "bg-indigo-100 text-indigo-700",
  INSPECTION: "bg-yellow-100 text-yellow-700",
  OTHER: "bg-gray-100 text-gray-700",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-orange-100 text-orange-700",
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return FileSpreadsheet;
  return FileText;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function ContractorDocuments() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Get all documents from projects this contractor is a member of
  const memberships = await db.projectMember.findMany({
    where: { userId: session.user.id },
    select: { project: { select: { id: true, name: true } } },
  });

  const projectIds = memberships.map((m: { project: { id: string; name: string } }) => m.project.id);

  const documents = await db.document.findMany({
    where: {
      phase: { projectId: { in: projectIds } },
    },
    include: {
      phase: {
        select: { name: true, project: { select: { name: true } } },
      },
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500 mt-1">
          All documents across your assigned projects
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No documents yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Documents uploaded to your project phases will appear here
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {documents.map((doc: { id: string; name: string; mimeType: string; url: string; size: number; createdAt: Date; category: string; status: string; phase: { name: string; project: { name: string } } }) => {
            const Icon = getFileIcon(doc.mimeType);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-4 hover:bg-gray-50"
              >
                <Icon className="w-5 h-5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate"
                    >
                      {doc.name}
                    </a>
                    <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {doc.phase.project.name} · {doc.phase.name} ·{" "}
                    {formatSize(doc.size)} ·{" "}
                    {doc.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[doc.category] || categoryColors.OTHER}`}
                >
                  {doc.category}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[doc.status] || statusColors.PENDING}`}
                >
                  {doc.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
