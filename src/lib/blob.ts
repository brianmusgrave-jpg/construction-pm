/**
 * @file src/lib/blob.ts
 * @description Vercel Blob utilities for Construction PM.
 *
 * Handles audio file uploads for voice notes and provides helpers for
 * managing blob lifecycle (upload, delete). Audio is uploaded directly
 * from the client via the existing `/api/upload` route which handles
 * auth, rate-limiting, and allowed content types.
 *
 * This module provides the server-side utilities for:
 *   - Deleting audio blobs when voice notes are removed
 *   - Validating audio MIME types before accepting uploads
 *   - Building canonical blob pathnames for organisation
 *
 * Note: Client-side uploads use `@vercel/blob/client` (`upload()` helper).
 * Server-side deletion uses `@vercel/blob` (`del()` helper).
 * Both require `BLOB_READ_WRITE_TOKEN` to be set in the environment.
 */

import { del } from "@vercel/blob";

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * MIME types accepted for audio voice-note uploads.
 * Covers the formats produced by the MediaRecorder API across browsers.
 */
export const AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
] as const;

/** Union of the accepted audio MIME type strings. */
export type AudioMimeType = (typeof AUDIO_MIME_TYPES)[number];

/** Maximum audio file size: 25 MB. Voice notes should be far smaller. */
export const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Check whether a MIME type string is an accepted audio format.
 *
 * Handles both exact matches ("audio/webm") and codec suffixes
 * ("audio/webm;codecs=opus") by normalising the type before comparison.
 *
 * @param mimeType - The MIME type string to validate
 * @returns `true` if the type is accepted, `false` otherwise
 */
export function isAllowedAudioType(mimeType: string): boolean {
  // Normalise: strip codec info and whitespace for comparison
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return AUDIO_MIME_TYPES.some((t) => t.split(";")[0].trim().toLowerCase() === base);
}

// ── Pathname helpers ───────────────────────────────────────────────────────

/**
 * Build a canonical Vercel Blob pathname for a voice-note audio file.
 *
 * Format: `voice-notes/{projectId}/{phaseId}/{filename}`
 *
 * This keeps audio organised by project and phase in the blob store,
 * making it easy to identify files if manual cleanup is ever needed.
 *
 * @param projectId - The project the voice note belongs to
 * @param phaseId   - The phase the voice note belongs to
 * @param filename  - The original filename (e.g. "recording.webm")
 * @returns A slash-separated blob pathname string
 */
export function buildAudioPathname(
  projectId: string,
  phaseId: string,
  filename: string
): string {
  // Sanitise filename: keep alphanumerics, dots, hyphens, underscores
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `voice-notes/${projectId}/${phaseId}/${safe}`;
}

// ── Deletion ───────────────────────────────────────────────────────────────

/**
 * Delete an audio file from Vercel Blob storage.
 *
 * Safe to call with any URL — returns silently if the URL is not a Vercel
 * Blob URL, if the blob doesn't exist, or if `BLOB_READ_WRITE_TOKEN` is
 * not set. This prevents cascading errors when cleaning up voice notes.
 *
 * @param blobUrl - The full Vercel Blob URL of the audio file to delete
 */
export async function deleteAudioBlob(blobUrl: string): Promise<void> {
  if (!blobUrl) return;

  // Only attempt deletion for Vercel Blob URLs
  if (!blobUrl.includes(".public.blob.vercel-storage.com")) {
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[blob] BLOB_READ_WRITE_TOKEN not set — skipping blob deletion");
    return;
  }

  try {
    await del(blobUrl);
  } catch (err) {
    // Log but don't throw — blob deletion failure should never crash a voice-note delete
    console.warn("[blob] Failed to delete audio blob:", blobUrl, err);
  }
}

/**
 * Delete multiple audio blobs in parallel.
 *
 * Convenience wrapper for bulk cleanup (e.g. when a phase is deleted and
 * all its voice notes are removed). Failures are logged but do not prevent
 * other deletions from proceeding.
 *
 * @param blobUrls - Array of Vercel Blob URLs to delete
 */
export async function deleteAudioBlobs(blobUrls: string[]): Promise<void> {
  if (!blobUrls.length) return;
  await Promise.allSettled(blobUrls.map(deleteAudioBlob));
}
