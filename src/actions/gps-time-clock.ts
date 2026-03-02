"use server";

/**
 * @file actions/gps-time-clock.ts
 * @description GPS-verified time clock-in/out — Sprint 28.
 *
 * Allows field workers to clock in and out with GPS coordinates attached.
 * The system records clock-in/out timestamps and computes elapsed hours
 * automatically. GPS data enables:
 *   - Verifying workers are on-site when clocking in
 *   - Geo-fence validation (configurable per project)
 *   - Location audit trail for compliance
 *
 * Clock entries flow:  CLOCKED_IN → CLOCKED_OUT → (auto-creates TimeEntry)
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const dbc = db as any;

// ── Types ──

interface ClockInInput {
  phaseId: string;
  latitude: number;
  longitude: number;
  accuracy?: number; // GPS accuracy in metres
  notes?: string;
}

interface ClockOutInput {
  clockEntryId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  notes?: string;
}

interface GpsClockEntry {
  id: string;
  phaseId: string;
  workerId: string;
  clockInAt: string;
  clockOutAt: string | null;
  clockInLat: number;
  clockInLng: number;
  clockOutLat: number | null;
  clockOutLng: number | null;
  hoursWorked: number | null;
  status: "CLOCKED_IN" | "CLOCKED_OUT";
  notes: string | null;
  worker?: { id: string; name: string };
}

// ── Queries ──

/**
 * Get all GPS clock entries for a phase, newest first.
 */
export async function getGpsClockEntries(phaseId: string): Promise<{
  success: boolean;
  entries: GpsClockEntry[];
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, entries: [], error: "Unauthorized" };
  }

  try {
    const entries = await dbc.gpsClockEntry.findMany({
      where: { phaseId },
      include: {
        worker: { select: { id: true, name: true, company: true } },
      },
      orderBy: { clockInAt: "desc" },
    });

    return {
      success: true,
      entries: entries.map((e: any) => ({
        ...e,
        clockInAt: e.clockInAt?.toISOString?.() ?? e.clockInAt,
        clockOutAt: e.clockOutAt?.toISOString?.() ?? e.clockOutAt,
        createdAt: e.createdAt?.toISOString?.() ?? e.createdAt,
      })),
    };
  } catch (err) {
    console.error("getGpsClockEntries error:", err);
    return { success: false, entries: [], error: "Failed to fetch clock entries" };
  }
}

/**
 * Get any active (not clocked out) entry for the current user on a phase.
 */
export async function getActiveClockEntry(phaseId: string): Promise<{
  success: boolean;
  entry: GpsClockEntry | null;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, entry: null, error: "Unauthorized" };
  }

  try {
    // Find staff record by email match (Staff model has no userId)
    const staff = await dbc.staff.findFirst({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!staff) {
      return { success: true, entry: null };
    }

    const entry = await dbc.gpsClockEntry.findFirst({
      where: {
        phaseId,
        workerId: staff.id,
        status: "CLOCKED_IN",
      },
    });

    return {
      success: true,
      entry: entry
        ? {
            ...entry,
            clockInAt: entry.clockInAt?.toISOString?.() ?? entry.clockInAt,
            clockOutAt: entry.clockOutAt?.toISOString?.() ?? entry.clockOutAt,
          }
        : null,
    };
  } catch (err) {
    console.error("getActiveClockEntry error:", err);
    return { success: false, entry: null, error: "Failed to check clock status" };
  }
}

// ── Mutations ──

/**
 * Clock in to a phase with GPS coordinates.
 * Creates a GpsClockEntry with status CLOCKED_IN.
 */
export async function clockIn(data: ClockInInput): Promise<{
  success: boolean;
  entryId?: string;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Find or create staff record by email (Staff model has no userId)
    let staff = await dbc.staff.findFirst({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!staff) {
      // Create a basic staff record
      staff = await dbc.staff.create({
        data: {
          name: session.user.name || session.user.email || "Unknown",
          email: session.user.email || "",
          role: "CONTRACTOR",
          userId: session.user.id,
          orgId: (session.user as any).orgId,
        },
      });
    }

    // Check for existing active clock-in
    const existing = await dbc.gpsClockEntry.findFirst({
      where: {
        phaseId: data.phaseId,
        workerId: staff.id,
        status: "CLOCKED_IN",
      },
    });

    if (existing) {
      return { success: false, error: "Already clocked in to this phase" };
    }

    const entry = await dbc.gpsClockEntry.create({
      data: {
        phaseId: data.phaseId,
        workerId: staff.id,
        clockInAt: new Date(),
        clockInLat: data.latitude,
        clockInLng: data.longitude,
        clockInAccuracy: data.accuracy || null,
        status: "CLOCKED_IN",
        notes: data.notes || null,
        createdById: session.user.id,
      },
    });

    // Activity log — fire-and-forget
    const phase = await dbc.phase.findUnique({
      where: { id: data.phaseId },
      select: { projectId: true, name: true },
    });

    if (phase) {
      dbc.activityLog
        .create({
          data: {
            orgId: (session.user as any).orgId!,
            action: "GPS_CLOCK_IN",
            message: `${session.user.name || session.user.email} clocked in to ${phase.name}`,
            projectId: phase.projectId,
            userId: session.user.id,
            data: {
              phaseId: data.phaseId,
              lat: data.latitude,
              lng: data.longitude,
            },
          },
        })
        .catch(() => {});

      revalidatePath(`/dashboard/projects/${phase.projectId}`);
    }

    return { success: true, entryId: entry.id };
  } catch (err) {
    console.error("clockIn error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Clock-in failed",
    };
  }
}

/**
 * Clock out from a phase with GPS coordinates.
 * Updates the GpsClockEntry to CLOCKED_OUT and auto-creates a TimeEntry.
 */
export async function clockOut(data: ClockOutInput): Promise<{
  success: boolean;
  hoursWorked?: number;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const entry = await dbc.gpsClockEntry.findUnique({
      where: { id: data.clockEntryId },
      include: { phase: { select: { projectId: true, name: true } } },
    });

    if (!entry) {
      return { success: false, error: "Clock entry not found" };
    }

    if (entry.status !== "CLOCKED_IN") {
      return { success: false, error: "Not currently clocked in" };
    }

    const clockOutTime = new Date();
    const clockInTime = new Date(entry.clockInAt);
    const hoursWorked =
      Math.round(((clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)) * 100) /
      100;

    // Update clock entry
    await dbc.gpsClockEntry.update({
      where: { id: data.clockEntryId },
      data: {
        clockOutAt: clockOutTime,
        clockOutLat: data.latitude,
        clockOutLng: data.longitude,
        clockOutAccuracy: data.accuracy || null,
        hoursWorked,
        status: "CLOCKED_OUT",
        notes: data.notes
          ? entry.notes
            ? `${entry.notes}\n${data.notes}`
            : data.notes
          : entry.notes,
      },
    });

    // Auto-create a time entry from the clock data
    await dbc.timeEntry.create({
      data: {
        phaseId: entry.phaseId,
        workerId: entry.workerId,
        date: clockInTime, // Date of clock-in
        hours: hoursWorked,
        description: `GPS-verified: ${hoursWorked}h (${clockInTime.toLocaleTimeString()} – ${clockOutTime.toLocaleTimeString()})`,
        status: "PENDING",
        createdById: session.user.id,
      },
    });

    // Activity log — fire-and-forget
    if (entry.phase) {
      dbc.activityLog
        .create({
          data: {
            orgId: (session.user as any).orgId!,
            action: "GPS_CLOCK_OUT",
            message: `${session.user.name || session.user.email} clocked out of ${entry.phase.name} (${hoursWorked}h)`,
            projectId: entry.phase.projectId,
            userId: session.user.id,
            data: {
              phaseId: entry.phaseId,
              hoursWorked,
              lat: data.latitude,
              lng: data.longitude,
            },
          },
        })
        .catch(() => {});

      revalidatePath(`/dashboard/projects/${entry.phase.projectId}`);
    }

    return { success: true, hoursWorked };
  } catch (err) {
    console.error("clockOut error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Clock-out failed",
    };
  }
}
