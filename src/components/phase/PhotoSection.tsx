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
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import { createPhoto, deletePhoto } from "@/actions/photos";

interface Photo {
  id: string;
  url: string;
  caption: string | null;
  takenAt: Date;
  uploadedBy: { id: string; name: string | null };
}

interface PhotoSectionProps {
  phaseId: string;
  photos: Photo[];
  canUpload: boolean;
  canDelete: boolean;
}

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
}: PhotoSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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
      setDeletingId(photoId);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Photos ({photos.length})
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
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group rounded-lg overflow-hidden bg-gray-100 aspect-[4/3]"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || "Phase photo"}
                    className="w-full h-full object-cover"
                  />

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
              ))}
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
