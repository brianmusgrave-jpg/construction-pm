"use client";

/**
 * @file components/phase/VoiceNoteSection.tsx
 * @description Voice memo recorder and playback section for a phase detail page.
 *
 * Recording uses the browser MediaRecorder API:
 *   - MIME type: `audio/webm;codecs=opus` with fallback to `audio/webm`.
 *   - Data collected every 100 ms via `mediaRecorder.start(100)`.
 *   - Maximum duration: 5 minutes (300 s) — auto-stops at 300 via timer.
 *   - On stop, chunks are assembled into a Blob and uploaded directly to
 *     Vercel Blob via the `/api/upload` route using `@vercel/blob/client`.
 *     The resulting CDN URL is stored as `audioUrl` on the VoiceNote record.
 *
 * Playback uses a single shared `audioRef` (HTMLAudioElement). Clicking a
 *   different note pauses the current one before starting the new one.
 *
 * State management:
 *   - `useTransition` wraps `createVoiceNote` / `deleteVoiceNote` calls.
 *   - Local `localNotes` state mirrors server data with optimistic updates.
 *   - Notes are displayed newest-first (`sort` by `createdAt` descending).
 *
 * Delete permission:
 *   `canDelete = (creatorId) => creatorId === currentUserId || isAdmin`.
 *
 * Permissions:
 *   - `canRecord` — may start/stop recording (default: true).
 *   - `isAdmin`   — may delete any note.
 *
 * Server actions: `createVoiceNote`, `deleteVoiceNote`.
 * i18n namespace: `voiceNotes`.
 */

import React, { useState, useRef, useTransition, useEffect, useCallback } from "react";
import { Mic, Square, Trash2, Loader2, Play, Pause, MicOff } from "lucide-react";
import { createVoiceNote, deleteVoiceNote } from "@/actions/voiceNotes";
import { upload } from "@vercel/blob/client";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface VoiceNote {
  id: string;
  audioUrl: string;
  duration: number;
  label: string | null;
  transcript: string | null;
  createdAt: Date;
  createdBy: User;
}

interface VoiceNoteSectionProps {
  phaseId: string;
  voiceNotes: VoiceNote[];
  currentUserId: string;
  isAdmin?: boolean;
  canRecord?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceNoteSection({
  phaseId,
  voiceNotes,
  currentUserId,
  isAdmin = false,
  canRecord = true,
}: VoiceNoteSectionProps) {
  const t = useTranslations("voiceNotes");
  const [isPending, startTransition] = useTransition();
  const [localNotes, setLocalNotes] = useState<VoiceNote[]>(voiceNotes);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        saveRecording(blob);
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 300) {
            // Max 5 minutes
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setHasPermission(false);
      toast.error(t("micPermissionDenied"));
    }
  }, [t]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  /**
   * Upload the audio blob to Vercel Blob via `/api/upload`, then persist
   * the returned CDN URL as the voice note's `audioUrl`.
   *
   * Uses `@vercel/blob/client` `upload()` which sends the file directly
   * from the browser to Vercel Blob — the server only validates the upload
   * token (auth + MIME allowlist checked in `/api/upload`).
   *
   * @param blob - The raw audio Blob from MediaRecorder
   */
  const saveRecording = useCallback(
    (blob: Blob) => {
      const duration = recordingTime || 1;
      // Build a unique filename: voice-<phaseId>-<timestamp>.webm
      const filename = `voice-${phaseId}-${Date.now()}.webm`;

      startTransition(async () => {
        try {
          // Upload to Vercel Blob via the existing /api/upload route
          const { url: audioUrl } = await upload(filename, blob, {
            access: "public",
            handleUploadUrl: "/api/upload",
          });

          const result = await createVoiceNote({
            phaseId,
            audioUrl,
            duration,
          });
          setLocalNotes((prev) => [result, ...prev]);
          toast.success(t("saved"));
        } catch {
          toast.error(t("saveFailed"));
        }
      });
    },
    [phaseId, recordingTime, startTransition, t]
  );

  const handleDelete = (noteId: string) => {
    setDeletingId(noteId);
    startTransition(async () => {
      try {
        await deleteVoiceNote(noteId);
        setLocalNotes((prev) => prev.filter((n) => n.id !== noteId));
        toast.success(t("deleted"));
      } catch {
        toast.error(t("deleteFailed"));
      } finally {
        setDeletingId(null);
      }
    });
  };

  const togglePlay = (note: VoiceNote) => {
    if (playingId === note.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(note.audioUrl);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      toast.error(t("playFailed"));
    };
    audio.play();
    setPlayingId(note.id);
  };

  const canDelete = (creatorId: string) =>
    creatorId === currentUserId || isAdmin;

  const getAvatarLetter = (user: User) =>
    user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();

  const sortedNotes = [...localNotes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            {t("title")}
            {localNotes.length > 0 && (
              <span className="ml-2 text-gray-500 normal-case font-normal">
                {localNotes.length}
              </span>
            )}
          </h2>
        </div>
      </div>

      {/* Recording Controls */}
      {canRecord && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          {isRecording ? (
            <div className="flex items-center gap-3">
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                <Square className="w-4 h-4" />
                {t("stop")}
              </button>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-mono text-gray-700">
                  {formatDuration(recordingTime)}
                </span>
              </div>
              <span className="text-xs text-gray-500">{t("maxDuration")}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={startRecording}
                disabled={isPending}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                {isPending ? t("saving") : t("record")}
              </button>
              {hasPermission === false && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                  <MicOff className="w-3 h-3" />
                  {t("micPermissionDenied")}
                </div>
              )}
              <span className="text-xs text-gray-500">{t("hint")}</span>
            </div>
          )}
        </div>
      )}

      {/* Voice Notes List */}
      {localNotes.length === 0 ? (
        <div className="text-center py-6">
          <Mic className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{t("noNotesYet")}</p>
          {canRecord && (
            <p className="text-xs text-gray-400 mt-1">{t("noNotesHint")}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sortedNotes.map((note) => (
            <div
              key={note.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 group border border-gray-100"
            >
              {/* Play button */}
              <button
                onClick={() => togglePlay(note)}
                className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                {playingId === note.id ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {note.label || t("untitledNote")}
                  </p>
                  <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                    {formatDuration(note.duration)}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-4 h-4 rounded-full bg-[var(--color-primary)] text-white text-[8px] font-semibold flex items-center justify-center flex-shrink-0">
                    {getAvatarLetter(note.createdBy)}
                  </div>
                  <span className="text-xs text-gray-500 truncate">
                    {note.createdBy.name || note.createdBy.email}
                  </span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </span>
                </div>
                {note.transcript && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 italic">
                    {note.transcript}
                  </p>
                )}
              </div>

              {/* Delete */}
              {canDelete(note.createdBy.id) && (
                <button
                  onClick={() => handleDelete(note.id)}
                  disabled={deletingId === note.id || isPending}
                  className="text-gray-300 sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0 hover:text-red-500 p-1 disabled:opacity-50 transition-all"
                >
                  {deletingId === note.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Future AI transcription note */}
      {localNotes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 italic">{t("transcriptionHint")}</p>
        </div>
      )}
    </div>
  );
}
