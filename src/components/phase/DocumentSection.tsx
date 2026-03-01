"use client";

/**
 * @file components/phase/DocumentSection.tsx
 * @description Phase section for uploading and managing construction documents.
 *
 * Supports upload via file-picker button or drag-and-drop onto the section.
 * Files are uploaded to Vercel Blob via the client SDK (`@vercel/blob/client`)
 * using the `/api/upload` server-side token endpoint, then registered with
 * `createDocument`. Multi-file uploads are processed sequentially with a
 * per-file progress message.
 *
 * Document categories: PERMIT, CONTRACT, INVOICE, BLUEPRINT, INSPECTION, OTHER.
 * Accepted MIME types: PDF, JPEG, PNG, WebP, HEIC, DOC, DOCX, XLS, XLSX, CSV.
 *
 * Per-document actions:
 *   - Status management (PENDING / APPROVED / REJECTED) — `canManageStatus` only.
 *   - Delete — `canManageStatus` only; shown on hover on desktop.
 *   - Open document in new tab (all users).
 *
 * AI extraction panel (`DocumentAIPanel`) is rendered below each document row
 * and displays any previously extracted data.
 *
 * Server actions: `createDocument`, `updateDocumentStatus`, `deleteDocument` (documents).
 * i18n namespaces: `documents`, `status`, `common`.
 */

import { useState, useRef, useCallback } from "react";
import {
  FileText,
  Upload,
  ExternalLink,
  X,
  Check,
  Ban,
  Trash2,
  ChevronDown,
  Loader2,
  AlertCircle,
  FileImage,
  FileSpreadsheet,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import {
  createDocument,
  updateDocumentStatus,
  deleteDocument,
} from "@/actions/documents";
import { useTranslations } from "next-intl";
import { DocumentAIPanel } from "./DocumentAIPanel";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

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
  createdAt: Date;
  uploadedBy: { id: string; name: string | null; email: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractedData?: any;
}

interface DocumentSectionProps {
  phaseId: string;
  documents: Document[];
  canUpload: boolean;
  canManageStatus: boolean;
}

type DocCategory =
  | "PERMIT"
  | "CONTRACT"
  | "INVOICE"
  | "BLUEPRINT"
  | "INSPECTION"
  | "OTHER";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-600",
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  )
    return FileSpreadsheet;
  return FileText;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function DocumentSection({
  phaseId,
  documents,
  canUpload,
  canManageStatus,
}: DocumentSectionProps) {
  const confirm = useConfirmDialog();
  const t = useTranslations("documents");
  const ts = useTranslations("status");
  const tc = useTranslations("common");

  const CATEGORY_LABEL: Record<string, string> = {
    PERMIT: t("permit"),
    CONTRACT: t("contract"),
    INVOICE: t("invoice"),
    BLUEPRINT: t("blueprint"),
    INSPECTION: t("inspection"),
    OTHER: t("other"),
  };

  const CATEGORY_OPTIONS: { value: DocCategory; label: string }[] = [
    { value: "PERMIT", label: t("permit") },
    { value: "CONTRACT", label: t("contract") },
    { value: "INVOICE", label: t("invoice") },
    { value: "BLUEPRINT", label: t("blueprint") },
    { value: "INSPECTION", label: t("inspection") },
    { value: "OTHER", label: t("other") },
  ];

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<DocCategory>("OTHER");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (canUpload) setIsDragging(true);
    },
    [canUpload]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!canUpload) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        setPendingFiles(files);
        setShowUploadForm(true);
      }
    },
    [canUpload]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles(files);
      setShowUploadForm(true);
    }
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        setUploadProgress(
          pendingFiles.length > 1
            ? t("uploading", { current: i + 1, total: pendingFiles.length })
            : t("uploadingFile", { name: file.name })
        );

        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });

        await createDocument({
          phaseId,
          name: file.name,
          url: blob.url,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          category: selectedCategory,
        });
      }

      setPendingFiles([]);
      setShowUploadForm(false);
      setSelectedCategory("OTHER");
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Upload error:", err);
      setError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleStatusChange = async (
    docId: string,
    status: "APPROVED" | "REJECTED" | "PENDING"
  ) => {
    try {
      await updateDocumentStatus(docId, status);
      setStatusMenuId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("failedToUpdateStatus")
      );
    }
  };

  const handleDelete = async (docId: string) => {
    if (!await confirm(t("deleteConfirm"), { danger: true })) return;
    setDeletingId(docId);
    try {
      await deleteDocument(docId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToDelete"));
    } finally {
      setDeletingId(null);
    }
  };

  const cancelUpload = () => {
    setPendingFiles([]);
    setShowUploadForm(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          {t("title", { count: documents.length })}
        </h2>
        {canUpload && !showUploadForm && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            <Upload className="w-4 h-4" />
            {tc("upload")}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload form (shown after files selected) */}
      {showUploadForm && (
        <div className="mb-4 p-4 bg-[var(--color-primary-bg)] rounded-lg border border-[var(--color-primary-light)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--color-primary-dark)]">
              {t("filesSelected", { count: pendingFiles.length })}
            </span>
            <button
              onClick={cancelUpload}
              className="text-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
              disabled={isUploading}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* File list preview */}
          <div className="space-y-1 mb-3">
            {pendingFiles.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-[var(--color-primary-dark)]"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="truncate">{file.name}</span>
                <span className="text-[var(--color-primary-light)] shrink-0">
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>

          {/* Category selector + action buttons */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-[var(--color-primary-dark)]">
              {t("category")}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) =>
                setSelectedCategory(e.target.value as DocCategory)
              }
              className="text-sm border border-[var(--color-primary-light)] rounded-md px-2 py-1 bg-white text-[var(--color-primary-dark)] focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              disabled={isUploading}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="flex-1" />

            <button
              onClick={cancelUpload}
              disabled={isUploading}
              className="px-3 py-1.5 text-sm text-[var(--color-primary-dark)] hover:bg-[var(--color-primary-bg)] rounded-md"
            >
              {tc("cancel")}
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="px-4 py-1.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-md disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {uploadProgress || tc("loading")}
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  {tc("upload")}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Drop zone / Empty state */}
      {documents.length === 0 && !showUploadForm ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`text-center py-8 border-2 border-dashed rounded-lg transition-colors ${
            isDragging
              ? "border-[var(--color-primary-light)] bg-[var(--color-primary-bg)]"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <Upload
            className={`w-8 h-8 mx-auto mb-2 ${
              isDragging ? "text-[var(--color-primary-light)]" : "text-gray-300"
            }`}
          />
          <p className="text-sm text-gray-500">
            {isDragging ? t("dropHere") : t("noDocumentsYet")}
          </p>
          {canUpload && !isDragging && (
            <p className="text-xs text-gray-400 mt-1">
              {t("dragDropDocs")}
            </p>
          )}
        </div>
      ) : (
        /* Document list */
        <div
          className="space-y-2"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="p-4 border-2 border-dashed border-[var(--color-primary-light)] bg-[var(--color-primary-bg)] rounded-lg text-center text-sm text-[var(--color-primary)]">
              {t("dropToUpload")}
            </div>
          )}
          {documents.map((doc) => {
            const Icon = getFileIcon(doc.mimeType);
            return (
              <div
                key={doc.id}
                className="p-3 bg-gray-50 rounded-lg group"
              >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="w-5 h-5 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {doc.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatFileSize(doc.size)}</span>
                      <span>·</span>
                      <span>
                        {CATEGORY_LABEL[doc.category] || doc.category}
                      </span>
                      <span>·</span>
                      <span>
                        {doc.uploadedBy.name || doc.uploadedBy.email}
                      </span>
                      <span>·</span>
                      <span>{formatDate(doc.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Status badge / dropdown */}
                  <div className="relative">
                    {canManageStatus ? (
                      <button
                        onClick={() =>
                          setStatusMenuId(
                            statusMenuId === doc.id ? null : doc.id
                          )
                        }
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${
                          STATUS_BADGE[doc.status] ||
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {ts(STATUS_LABEL_KEYS[doc.status] || "pending")}
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                    ) : (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          STATUS_BADGE[doc.status] ||
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {ts(STATUS_LABEL_KEYS[doc.status] || "pending")}
                      </span>
                    )}

                    {/* Status dropdown menu */}
                    {statusMenuId === doc.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
                        <button
                          onClick={() =>
                            handleStatusChange(doc.id, "APPROVED")
                          }
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-green-700 hover:bg-green-50"
                        >
                          <Check className="w-3 h-3" /> {t("approve")}
                        </button>
                        <button
                          onClick={() =>
                            handleStatusChange(doc.id, "REJECTED")
                          }
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                        >
                          <Ban className="w-3 h-3" /> {t("reject")}
                        </button>
                        <button
                          onClick={() =>
                            handleStatusChange(doc.id, "PENDING")
                          }
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-yellow-700 hover:bg-yellow-50"
                        >
                          <AlertCircle className="w-3 h-3" /> {t("resetToPending")}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Open link */}
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-400 hover:text-[var(--color-primary)]"
                    title={tc("open")}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {/* Delete button (admin/PM only, on hover) */}
                  {canManageStatus && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="p-1 text-gray-300 sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-500 transition-all"
                      title={tc("delete")}
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              {/* AI Extraction panel */}
              <DocumentAIPanel
                documentId={doc.id}
                documentName={doc.name}
                mimeType={doc.mimeType}
                initialData={doc.extractedData ?? null}
              />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
