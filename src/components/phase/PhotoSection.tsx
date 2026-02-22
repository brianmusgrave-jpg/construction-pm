"use client";

import { useState, useRef, useCallback } from "react";
import {
  Camera,
  Upload,
  X,
  Trash2,
  Loader2,
  AlertCircle,
  Maximize2,
  Flag,
  ChevronDown,
  CheckCircle2,
  ImagePlus,
  RotateCw,
  HelpCircle,
  Eye,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import { createPhoto, deletePhoto, flagPhoto, clearPhotoFlag } from "@/actions/photos";

interface Photo {
  id: string;
  url: string;
  caption: string | null;
  takenAt: Date;
  uploadedBy: { id: string; name: string | null };
  flagType?: string | null;
  flagNote?: string | null;
  flaggedBy?: { name: string | null } | null;
}

interface PhotoSectionProps {
  phaseId: string;
  photos: Photo[];
  canUpload: boolean;
  canDelete: boolean;
  canFlag?: boolean;
}

const FLAG_OPTIONS = [
  {
    value: "REPLACEMENT_NEEDED",
    label: "Replacement needed",
    icon: RotateCw,
    color: "text-red-600",
  },
  {
    value: "ADDITIONAL_ANGLES",
    label: "Additional angles",
    icon: Eye,
    color: "text-amber-600",
  },
  {
    value: "ADDITIONAL_PHOTOS",
    label: "More photos needed",
    icon: ImagePlus,
    color: "text-blue-600",
  },
  {
    value: "CLARIFICATION_NEEDED",
    label: "Clarification needed",
    icon: HelpCircle,
    color: "text-purple-600",
  },
];

const FLAG_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  REPLACEMENT_NEEDED: { bg: "bg-red-100", text: "text-red-700", label: "Replace" },
  ADDITIONAL_ANGLES: { bg: "bg-amber-100", text: "text-amber-700", label: "Angles" },
  ADDITIONAL_PHOTOS: { bg: "bg-blue-100", text: "text-blue-700", label: "More" },
  CLARIFICATION_NEEDED: { bg: "bg-purple-100", text: "text-purple-700", label: "Clarify" },
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function PhotoSection({
  phaseId,
  photos,
  canUpload,
  canDelete,
  canFlag = false,
}: PhotoSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flagMenuId, setFlagMenuId] = useState<string | null>(null);
  const [flagNoteId, setFlagNoteId] = useState<string | null>(null);
  const [flagNoteText, setFlagNoteText] = useState("");
  const [pendingFlag, setPendingFlag] = useState<string | null>(null);
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
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!canUpload) return;

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) await uploadPhotos(files);
    },
    [canUpload] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length > 0) await uploadPhotos(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadPhotos = async (files: File[]) => {
    setIsUploading(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(
          files.length > 1
            ? `Uploading ${i + 1} of ${files.length}...`
            : `Uploading ${file.name}...`
        );

        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });

        await createPhoto({
          phaseId,
          url: blob.url,
        });
      }
    } catch (err) {
      console.error("Photo upload error:", err);
      setError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm("Delete this photo? This cannot be undone.")) return;
    setDeletingId(photoId);
    try {
      await deletePhoto(photoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleFlag = async (photoId: string, flagType: string) => {
    setFlagMenuId(null);
    // Show note input
    setFlagNoteId(photoId);
    setPendingFlag(flagType);
  };

  const submitFlag = async () => {
    if (!flagNoteId || !pendingFlag) return;
    try {
      await flagPhoto(
        flagNoteId,
        pendingFlag as "REPLACEMENT_NEEDED" | "ADDITIONAL_ANGLES" | "ADDITIONAL_PHOTOS" | "CLARIFICATION_NEEDED",
        flagNoteText || undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to flag");
    } finally {
      setFlagNoteId(null);
      setFlagNoteText("");
      setPendingFlag(null);
    }
  };

  const handleClearFlag = async (photoId: string) => {
    try {
      await clearPhotoFlag(photoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear flag");
    }
  };

  const flaggedCount = photos.filter((p) => p.flagType).length;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Photos ({photos.length})
            {flaggedCount > 0 && (
              <span className="ml-2 text-xs font-medium text-amber-600 normal-case">
                · {flaggedCount} flagged
              </span>
            )}
          </h2>
          {canUpload && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {uploadProgress || "Uploading..."}
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Add Photos
                </>
              )}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
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

        {/* Flag note input modal */}
        {flagNoteId && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-800 mb-2">
              {FLAG_OPTIONS.find((o) => o.value === pendingFlag)?.label || "Flag"} — add a note? (optional)
            </p>
            <input
              type="text"
              value={flagNoteText}
              onChange={(e) => setFlagNoteText(e.target.value)}
              placeholder="e.g., Need wider angle showing foundation connection"
              className="w-full text-sm border border-amber-300 rounded-md px-3 py-1.5 bg-white focus:ring-1 focus:ring-amber-400 focus:border-amber-400 mb-2"
              onKeyDown={(e) => e.key === "Enter" && submitFlag()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setFlagNoteId(null);
                  setFlagNoteText("");
                  setPendingFlag(null);
                }}
                className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={submitFlag}
                className="px-3 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded"
              >
                Flag Photo
              </button>
            </div>
          </div>
        )}

        {/* Empty state / drop zone */}
        {photos.length === 0 && !isUploading ? (
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
            <Camera
              className={`w-8 h-8 mx-auto mb-2 ${
                isDragging ? "text-[var(--color-primary-light)]" : "text-gray-300"
              }`}
            />
            <p className="text-sm text-gray-500">
              {isDragging ? "Drop images here" : "No photos yet"}
            </p>
            {canUpload && !isDragging && (
              <p className="text-xs text-gray-400 mt-1">
                Drag & drop images or click Add Photos above
              </p>
            )}
          </div>
        ) : (
          /* Photo grid */
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="mb-3 p-4 border-2 border-dashed border-[var(--color-primary-light)] bg-[var(--color-primary-bg)] rounded-lg text-center text-sm text-[var(--color-primary)]">
                Drop images to upload
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo) => {
                const flag = photo.flagType
                  ? FLAG_BADGE[photo.flagType]
                  : null;

                return (
                  <div
                    key={photo.id}
                    className="relative group rounded-lg overflow-hidden bg-gray-100 aspect-[4/3]"
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || "Phase photo"}
                      className="w-full h-full object-cover"
                    />

                    {/* Flag badge — always visible when flagged */}
                    {flag && (
                      <div className="absolute top-2 left-2 z-10">
                        <div
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${flag.bg} ${flag.text}`}
                          title={photo.flagNote || flag.label}
                        >
                          <Flag className="w-2.5 h-2.5" />
                          {flag.label}
                        </div>
                        {photo.flagNote && (
                          <div className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] ${flag.bg} ${flag.text} max-w-[140px] truncate`}>
                            {photo.flagNote}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                      <div className="w-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-white">
                            <span>{photo.uploadedBy.name || "Unknown"}</span>
                            <span className="mx-1">·</span>
                            <span>{formatDate(photo.takenAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Flag button (PM/admin only) */}
                            {canFlag && (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFlagMenuId(
                                      flagMenuId === photo.id ? null : photo.id
                                    );
                                  }}
                                  className={`p-1 rounded ${
                                    photo.flagType
                                      ? "text-amber-400 hover:text-amber-300"
                                      : "text-white/80 hover:text-white"
                                  }`}
                                  title={photo.flagType ? "Change flag" : "Flag for followup"}
                                >
                                  <Flag className="w-3.5 h-3.5" />
                                </button>

                                {/* Flag dropdown */}
                                {flagMenuId === photo.id && (
                                  <div
                                    className="absolute right-0 bottom-full mb-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[180px]"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {FLAG_OPTIONS.map((opt) => {
                                      const Icon = opt.icon;
                                      return (
                                        <button
                                          key={opt.value}
                                          onClick={() =>
                                            handleFlag(photo.id, opt.value)
                                          }
                                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 ${opt.color}`}
                                        >
                                          <Icon className="w-3 h-3" />
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                    {photo.flagType && (
                                      <>
                                        <div className="border-t border-gray-100 my-1" />
                                        <button
                                          onClick={() => {
                                            handleClearFlag(photo.id);
                                            setFlagMenuId(null);
                                          }}
                                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-green-600 hover:bg-green-50"
                                        >
                                          <CheckCircle2 className="w-3 h-3" />
                                          Clear flag
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            <button
                              onClick={() => setLightboxUrl(photo.url)}
                              className="p-1 text-white/80 hover:text-white"
                              title="View full size"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(photo.id)}
                                disabled={deletingId === photo.id}
                                className="p-1 text-white/80 hover:text-red-400"
                                title="Delete"
                              >
                                {deletingId === photo.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        {photo.caption && (
                          <p className="text-xs text-white/90 mt-1 truncate">
                            {photo.caption}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
