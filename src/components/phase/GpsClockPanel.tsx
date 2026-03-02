"use client";

/**
 * @file GpsClockPanel.tsx
 * @description GPS-verified time clock-in/out panel — Sprint 28.
 * Allows field workers to clock in/out with GPS verification.
 */

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  MapPin,
  Clock,
  Play,
  Square,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { clockIn, clockOut, getActiveClockEntry } from "@/actions/gps-time-clock";

interface GpsClockPanelProps {
  phaseId: string;
}

export default function GpsClockPanel({ phaseId }: GpsClockPanelProps) {
  const t = useTranslations("gpsClock");
  const [activeEntry, setActiveEntry] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [elapsed, setElapsed] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"pending" | "acquired" | "error">("pending");
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  // Check for active clock-in on mount
  useEffect(() => {
    async function check() {
      const result = await getActiveClockEntry(phaseId);
      if (result.success && result.entry) {
        setActiveEntry(result.entry);
      }
      setChecking(false);
    }
    check();
  }, [phaseId]);

  // Update elapsed time display
  useEffect(() => {
    if (!activeEntry) return;
    const interval = setInterval(() => {
      const start = new Date(activeEntry.clockInAt).getTime();
      const now = Date.now();
      const diff = now - start;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setElapsed(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const acquireGps = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    });
  };

  const handleClockIn = async () => {
    setLoading(true);
    setGpsStatus("pending");
    try {
      const position = await acquireGps();
      setGpsStatus("acquired");
      setCoords({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });

      const result = await clockIn({
        phaseId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });

      if (result.success) {
        toast.success(t("clockedIn"));
        // Refresh active entry
        const check = await getActiveClockEntry(phaseId);
        if (check.success && check.entry) {
          setActiveEntry(check.entry);
        }
      } else {
        toast.error(result.error || t("clockInFailed"));
      }
    } catch {
      setGpsStatus("error");
      toast.error(t("gpsError"));
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    setLoading(true);
    setGpsStatus("pending");
    try {
      const position = await acquireGps();
      setGpsStatus("acquired");

      const result = await clockOut({
        clockEntryId: activeEntry.id,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });

      if (result.success) {
        toast.success(
          t("clockedOut", { hours: result.hoursWorked?.toFixed(2) || "0" })
        );
        setActiveEntry(null);
        setElapsed("");
      } else {
        toast.error(result.error || t("clockOutFailed"));
      }
    } catch {
      setGpsStatus("error");
      toast.error(t("gpsError"));
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="border border-teal-200 rounded-lg bg-teal-50/50 p-4">
        <div className="flex items-center gap-2 text-teal-700">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t("checking")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-teal-200 rounded-lg bg-teal-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-teal-600" />
          <h3 className="font-semibold text-teal-900">{t("title")}</h3>
        </div>
        {activeEntry && (
          <div className="flex items-center gap-1.5 text-teal-700">
            <Clock className="w-4 h-4" />
            <span className="font-mono text-lg font-bold">{elapsed}</span>
          </div>
        )}
      </div>

      {activeEntry ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-teal-700">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            {t("currentlyClocked")}
          </div>
          <div className="text-xs text-teal-600">
            {t("clockedInAt", {
              time: new Date(activeEntry.clockInAt).toLocaleTimeString(),
            })}
          </div>
          <button
            onClick={handleClockOut}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors w-full justify-center"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {t("clockOut")}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-teal-700">{t("description")}</p>
          <button
            onClick={handleClockIn}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors w-full justify-center"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {t("clockIn")}
          </button>
        </div>
      )}

      {gpsStatus === "error" && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="w-3.5 h-3.5" />
          {t("gpsUnavailable")}
        </div>
      )}
    </div>
  );
}
