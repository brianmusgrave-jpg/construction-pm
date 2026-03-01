"use client";

/**
 * @file src/components/keeney/KeeneyModeClient.tsx
 * @description Main Keeney Mode client component.
 * Orchestrates the voice pipeline: Record → Transcribe → Confirm → Execute.
 * Sprint 21
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Mic, Menu, Smartphone, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { createRecorder } from "@/lib/audio/recorder";
import { enqueueMemo, getQueueCount, syncQueue, isOnline } from "@/lib/audio/queue";
import { processVoiceMemo } from "@/actions/keeney";
import { ConfirmationCard } from "./ConfirmationCard";
import { CommandMenu } from "./CommandMenu";
import type { RecorderState } from "@/lib/audio/recorder";

interface Project {
  id: string;
  name: string;
  address: string | null;
}

interface ParsedIntent {
  project: { id: string; name: string; confidence: number } | null;
  actionType: string;
  summary: string;
  details: string;
  scheduleImpact: string | null;
  notify: string[];
  needsClarification: string | null;
  language: string;
}

interface TranscribeResponse {
  transcript: string;
  language: string;
  intent: ParsedIntent;
  commandType: string;
}

type KeeneyStep = "idle" | "recording" | "processing" | "confirming" | "executing" | "done" | "error";

interface KeeneyModeClientProps {
  userName: string;
  projects: Project[];
}

export function KeeneyModeClient({ userName, projects }: KeeneyModeClientProps) {
  const t = useTranslations("keeney");

  const [step, setStep] = useState<KeeneyStep>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [commandType, setCommandType] = useState("voice_memo");
  const [showMenu, setShowMenu] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [online, setOnline] = useState(true);

  // Transcription result state
  const [transcript, setTranscript] = useState("");
  const [intent, setIntent] = useState<ParsedIntent | null>(null);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);

  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check online status and queue count
  useEffect(() => {
    setOnline(isOnline());
    getQueueCount().then(setQueueCount).catch(() => {});

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Duration timer
  useEffect(() => {
    if (step === "recording") {
      durationRef.current = setInterval(() => {
        setDuration((d) => d + 0.1);
      }, 100);
    } else {
      if (durationRef.current) clearInterval(durationRef.current);
      if (step === "idle") setDuration(0);
    }
    return () => {
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, [step]);

  const handleMicPress = useCallback(async () => {
    if (step === "recording") {
      // Stop recording
      if (!recorderRef.current) return;
      setStep("processing");
      try {
        const result = await recorderRef.current.stop();
        setCurrentBlob(result.blob);

        // If offline, queue it
        if (!isOnline()) {
          await enqueueMemo(result.blob, commandType);
          const count = await getQueueCount();
          setQueueCount(count);
          toast.success(t("memoQueued"));
          setStep("idle");
          return;
        }

        // Send to transcribe endpoint
        const formData = new FormData();
        formData.append("audio", result.blob, "memo.webm");
        formData.append("commandType", commandType);

        const res = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Server error" }));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const data: TranscribeResponse = await res.json();
        setTranscript(data.transcript);
        setIntent(data.intent);
        setStep("confirming");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to process memo";
        toast.error(msg);
        setStep("error");
        setTimeout(() => setStep("idle"), 3000);
      }
    } else if (step === "idle" || step === "error") {
      // Start recording
      setStep("recording");
      setTranscript("");
      setIntent(null);
      try {
        const recorder = createRecorder({
          onAudioLevel: setAudioLevel,
          onStateChange: (s) => {
            if (s === "error") setStep("error");
          },
        });
        recorderRef.current = recorder;
        await recorder.start();
      } catch (err) {
        toast.error(t("micPermissionDenied"));
        setStep("idle");
      }
    }
  }, [step, commandType, t]);

  const handleConfirm = useCallback(async () => {
    if (!intent) return;
    setStep("executing");

    try {
      const result = await processVoiceMemo({
        transcript,
        intent,
        commandType,
        language: intent.language,
        recordedAt: new Date().toISOString(),
      });

      if (result.success) {
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(200);
        toast.success(t("memoSaved"));
        setStep("done");
        setTimeout(() => {
          setStep("idle");
          setCommandType("voice_memo");
        }, 2000);
      } else {
        throw new Error(result.error || "Failed to save memo");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
      setStep("error");
      setTimeout(() => setStep("idle"), 3000);
    }
  }, [intent, transcript, commandType, t]);

  const handleCancel = useCallback(() => {
    setStep("idle");
    setTranscript("");
    setIntent(null);
    setCommandType("voice_memo");
  }, []);

  const handleCommandSelect = useCallback((cmd: string) => {
    setCommandType(cmd);
    setShowMenu(false);
    // Auto-start recording after selecting a command
    setTimeout(() => handleMicPress(), 300);
  }, [handleMicPress]);

  const handleSync = useCallback(async () => {
    if (!isOnline()) {
      toast.error(t("offlineCannotSync"));
      return;
    }
    toast.info(t("syncing"));
    const synced = await syncQueue((done, total) => {
      toast.info(`${t("syncing")} ${done}/${total}`);
    });
    const remaining = await getQueueCount();
    setQueueCount(remaining);
    if (synced > 0) toast.success(t("syncComplete", { count: synced }));
    else toast.info(t("nothingToSync"));
  }, [t]);

  // Mic button appearance
  const isRecording = step === "recording";
  const isProcessing = step === "processing" || step === "executing";
  const buttonSize = "w-32 h-32 lg:w-40 lg:h-40";
  const pulseClass = isRecording ? "animate-pulse" : "";
  const ringColor = isRecording ? "ring-red-400" : "ring-[var(--brand-color,#3b82f6)]";

  return (
    <div className="flex flex-col items-center justify-between h-full px-4 py-8 select-none">
      {/* Header — project name or status */}
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold text-gray-700">
          {step === "idle" && t("tapToStart")}
          {step === "recording" && t("listening")}
          {step === "processing" && t("processing")}
          {step === "confirming" && t("confirmAction")}
          {step === "executing" && t("saving")}
          {step === "done" && "✓"}
          {step === "error" && t("tryAgain")}
        </h1>
        {step === "recording" && (
          <p className="text-sm text-gray-500 tabular-nums">
            {Math.floor(duration)}s
          </p>
        )}
        {commandType !== "voice_memo" && step === "idle" && (
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">
            {commandType.replace(/_/g, " ")}
          </p>
        )}
      </div>

      {/* Center — Big Mic Button or Confirmation Card */}
      <div className="flex-1 flex items-center justify-center w-full max-w-md">
        {step === "confirming" && intent ? (
          <ConfirmationCard
            intent={intent}
            transcript={transcript}
            projects={projects}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onSelectProject={(projectId) => {
              if (intent) {
                const proj = projects.find((p) => p.id === projectId);
                setIntent({
                  ...intent,
                  project: proj ? { id: proj.id, name: proj.name, confidence: 1.0 } : null,
                  needsClarification: null,
                });
              }
            }}
          />
        ) : (
          <button
            onClick={handleMicPress}
            disabled={isProcessing}
            className={`
              ${buttonSize} rounded-full flex items-center justify-center
              bg-white shadow-xl border-4 ${ringColor} ring-4 ring-opacity-30
              transition-all duration-300 ${pulseClass}
              ${isRecording ? "scale-110 bg-red-50" : "hover:scale-105"}
              ${isProcessing ? "opacity-50 cursor-wait" : "cursor-pointer"}
              active:scale-95
            `}
            aria-label={isRecording ? t("stopRecording") : t("startRecording")}
          >
            {isProcessing ? (
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Mic
                className={`w-14 h-14 lg:w-16 lg:h-16 ${isRecording ? "text-red-500" : "text-[var(--brand-color,#3b82f6)]"}`}
              />
            )}
          </button>
        )}

        {/* Audio level visualization (simple ring) */}
        {isRecording && (
          <div
            className="absolute rounded-full border-2 border-red-300 pointer-events-none transition-all duration-100"
            style={{
              width: `${160 + audioLevel * 80}px`,
              height: `${160 + audioLevel * 80}px`,
              opacity: 0.3 + audioLevel * 0.5,
            }}
          />
        )}
      </div>

      {/* Footer — queue badge, commands, app link */}
      <div className="w-full max-w-md space-y-3">
        {/* Queue indicator */}
        {queueCount > 0 && (
          <button
            onClick={handleSync}
            className="flex items-center gap-2 mx-auto text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full"
          >
            {online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {t("memosQueued", { count: queueCount })}
          </button>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 bg-white rounded-lg shadow-sm border hover:bg-gray-50"
          >
            <Menu className="w-4 h-4" />
            {t("commands")}
          </button>

          <a
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 bg-white rounded-lg shadow-sm border hover:bg-gray-50"
          >
            <Smartphone className="w-4 h-4" />
            {t("fullApp")}
          </a>
        </div>
      </div>

      {/* Command Menu Overlay */}
      {showMenu && (
        <CommandMenu
          onSelect={handleCommandSelect}
          onSync={handleSync}
          onClose={() => setShowMenu(false)}
          queueCount={queueCount}
        />
      )}
    </div>
  );
}
