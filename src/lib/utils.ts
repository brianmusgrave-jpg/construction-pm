import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, differenceInWeeks, differenceInDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Date Formatting ──

export function fmtShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "M/d");
}

export function fmtLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMMM d, yyyy");
}

export function fmtRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function weeksBetween(d1: Date | string, d2: Date | string): number {
  const a = typeof d1 === "string" ? new Date(d1) : d1;
  const b = typeof d2 === "string" ? new Date(d2) : d2;
  return differenceInWeeks(b, a);
}

export function daysBetween(d1: Date | string, d2: Date | string): number {
  const a = typeof d1 === "string" ? new Date(d1) : d1;
  const b = typeof d2 === "string" ? new Date(d2) : d2;
  return differenceInDays(b, a);
}

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// ── Timeline Calculations ──

export function calculateProgress(
  checkedItems: number,
  totalItems: number
): number {
  if (totalItems === 0) return 0;
  return Math.round((checkedItems / totalItems) * 100);
}

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

// ── Formatting ──

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

export function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
