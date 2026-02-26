/**
 * @file utils.ts
 * @description Shared utility functions used across the Construction PM UI.
 *
 * Covers: Tailwind class merging, date formatting, timeline calculations,
 * file size display, and status badge helpers.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, differenceInWeeks, differenceInDays } from "date-fns";

// ── Tailwind ──

/**
 * Merge Tailwind CSS class names, resolving conflicts correctly.
 * Uses clsx for conditional class logic + tailwind-merge for deduplication.
 *
 * @example cn("px-2 py-1", isActive && "bg-blue-500", "px-4") → "py-1 bg-blue-500 px-4"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Date Formatting ──

/**
 * Short date format: "1/5", "12/31". Used in tight table columns.
 * Accepts Date objects or ISO date strings.
 */
export function fmtShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "M/d");
}

/**
 * Long date format: "January 5, 2025". Used in detail views and reports.
 * Accepts Date objects or ISO date strings.
 */
export function fmtLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMMM d, yyyy");
}

/**
 * Human-relative format: "3 days ago", "in 2 weeks". Used in activity feeds.
 * Accepts Date objects or ISO date strings.
 */
export function fmtRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Number of whole weeks between two dates (d2 − d1).
 * Used in Gantt timeline span calculations.
 */
export function weeksBetween(d1: Date | string, d2: Date | string): number {
  const a = typeof d1 === "string" ? new Date(d1) : d1;
  const b = typeof d2 === "string" ? new Date(d2) : d2;
  return differenceInWeeks(b, a);
}

/**
 * Number of whole days between two dates (d2 − d1).
 * Used for overdue calculations and timeline offset math.
 */
export function daysBetween(d1: Date | string, d2: Date | string): number {
  const a = typeof d1 === "string" ? new Date(d1) : d1;
  const b = typeof d2 === "string" ? new Date(d2) : d2;
  return differenceInDays(b, a);
}

/**
 * Format a Date as an ISO date string (YYYY-MM-DD) for Prisma date inputs.
 */
export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// ── Timeline Calculations ──

/**
 * Calculate percent complete as a whole number (0–100).
 * Returns 0 when totalItems is 0 to avoid division-by-zero.
 *
 * @param checkedItems - Number of completed checklist items
 * @param totalItems - Total number of checklist items
 */
export function calculateProgress(
  checkedItems: number,
  totalItems: number
): number {
  if (totalItems === 0) return 0;
  return Math.round((checkedItems / totalItems) * 100);
}

/**
 * Returns true if a phase's estimated end date is in the past and it is not complete.
 * Accepts an optional reference date (useful for testing or date-locked reports).
 *
 * @param estEnd - Estimated completion date
 * @param status - Phase status string; "COMPLETE" phases are never overdue
 * @param referenceDate - Date to compare against (defaults to now)
 */
export function isOverdue(
  estEnd: Date | string,
  status: string,
  referenceDate?: Date
): boolean {
  if (status === "COMPLETE") return false;
  const end = typeof estEnd === "string" ? new Date(estEnd) : estEnd;
  const now = referenceDate || new Date();
  return end < now;
}

// ── Display Formatting ──

/**
 * Human-readable file size: "512 B", "1.2 KB", "3.4 MB".
 * Used in the document list and upload UI.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Map a status enum value to Tailwind badge classes (background + text color).
 * Covers phase statuses, document statuses, and change order statuses.
 * Falls back to gray for any unrecognized status.
 *
 * @example statusColor("IN_PROGRESS") → "bg-blue-100 text-blue-700"
 */
export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-700",
    PLANNING: "bg-gray-100 text-gray-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-blue-100 text-blue-700",
    REVIEW_REQUESTED: "bg-amber-100 text-amber-700",
    UNDER_REVIEW: "bg-purple-100 text-purple-700",
    COMPLETE: "bg-green-100 text-green-700",
    COMPLETED: "bg-green-100 text-green-700",
    ON_HOLD: "bg-orange-100 text-orange-700",
    ARCHIVED: "bg-gray-100 text-gray-500",
    DELAYED: "bg-red-100 text-red-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    EXPIRED: "bg-gray-100 text-gray-500",
  };
  return colors[status] || "bg-gray-100 text-gray-700";
}

/**
 * Convert a SCREAMING_SNAKE_CASE status enum to a human-readable title case label.
 *
 * @example statusLabel("REVIEW_REQUESTED") → "Review Requested"
 */
export function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
