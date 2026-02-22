"use client";

import { FileText, Upload, ExternalLink } from "lucide-react";

interface Document {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  category: string;
  status: string;
  version: number;
  notes: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string | null; email: string };
}

interface DocumentSectionProps {
  phaseId: string;
  documents: Document[];
  canUpload: boolean;
  canManageStatus: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-600",
};

const CATEGORY_LABEL: Record<string, string> = {
  PERMIT: "Permit",
  CONTRACT: "Contract",
  INVOICE: "Invoice",
  BLUEPRINT: "Blueprint",
  INSPECTION: "Inspection",
  OTHER: "Other",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentSection({
  phaseId,
  documents,
  canUpload,
  canManageStatus,
}: DocumentSectionProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Documents ({documents.length})
        </h2>
        {canUpload && (
          <span className="inline-flex items-center gap-1 text-sm text-gray-400 font-medium">
            <Upload className="w-4 h-4" />
            Upload coming soon
          </span>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-6">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No documents yet</p>
          {canUpload && (
            <p className="text-xs text-gray-400 mt-1">
              Document uploads will be available in the next update
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {doc.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{formatFileSize(doc.size)}</span>
                    <span>·</span>
                    <span>{CATEGORY_LABEL[doc.category] || doc.category}</span>
                    <span>·</span>
                    <span>
                      {doc.uploadedBy.name || doc.uploadedBy.email}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    STATUS_BADGE[doc.status] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {doc.status}
                </span>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="Open"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
