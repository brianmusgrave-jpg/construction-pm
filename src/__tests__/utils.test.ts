import { describe, it, expect } from "vitest";
import {
  fmtShort,
  fmtLong,
  calculateProgress,
  isOverdue,
  formatFileSize,
  statusColor,
  statusLabel,
  weeksBetween,
  daysBetween,
  toISODate,
} from "@/lib/utils";

describe("Utils", () => {
  describe("fmtShort()", () => {
    it("formats a date as M/d", () => {
      expect(fmtShort(new Date("2025-03-15"))).toBe("3/15");
    });

    it("handles string input", () => {
      expect(fmtShort("2025-12-01")).toBe("12/1");
    });
  });

  describe("fmtLong()", () => {
    it("formats a date as MMMM d, yyyy", () => {
      expect(fmtLong(new Date("2025-03-15"))).toBe("March 15, 2025");
    });
  });

  describe("toISODate()", () => {
    it("formats date as yyyy-MM-dd", () => {
      expect(toISODate(new Date("2025-06-15T12:00:00Z"))).toBe("2025-06-15");
    });
  });

  describe("weeksBetween()", () => {
    it("calculates weeks between two dates", () => {
      expect(weeksBetween("2025-01-01", "2025-01-15")).toBe(2);
    });
  });

  describe("daysBetween()", () => {
    it("calculates days between two dates", () => {
      expect(daysBetween("2025-01-01", "2025-01-10")).toBe(9);
    });
  });

  describe("calculateProgress()", () => {
    it("returns 0 when there are no items", () => {
      expect(calculateProgress(0, 0)).toBe(0);
    });

    it("returns 50 when half items are checked", () => {
      expect(calculateProgress(5, 10)).toBe(50);
    });

    it("returns 100 when all items are checked", () => {
      expect(calculateProgress(10, 10)).toBe(100);
    });

    it("rounds to nearest integer", () => {
      expect(calculateProgress(1, 3)).toBe(33);
    });
  });

  describe("isOverdue()", () => {
    it("returns true when end date is in the past and status is not COMPLETE", () => {
      const pastDate = new Date("2020-01-01");
      expect(isOverdue(pastDate, "IN_PROGRESS")).toBe(true);
    });

    it("returns false when status is COMPLETE", () => {
      const pastDate = new Date("2020-01-01");
      expect(isOverdue(pastDate, "COMPLETE")).toBe(false);
    });

    it("returns false when end date is in the future", () => {
      const futureDate = new Date("2099-01-01");
      expect(isOverdue(futureDate, "IN_PROGRESS")).toBe(false);
    });

    it("accepts string dates", () => {
      expect(isOverdue("2020-01-01", "PENDING")).toBe(true);
    });

    it("uses reference date when provided", () => {
      const endDate = new Date("2025-06-01");
      const refBefore = new Date("2025-05-01");
      const refAfter = new Date("2025-07-01");

      expect(isOverdue(endDate, "IN_PROGRESS", refBefore)).toBe(false);
      expect(isOverdue(endDate, "IN_PROGRESS", refAfter)).toBe(true);
    });
  });

  describe("formatFileSize()", () => {
    it("formats bytes", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("formats kilobytes", () => {
      expect(formatFileSize(2048)).toBe("2.0 KB");
    });

    it("formats megabytes", () => {
      expect(formatFileSize(1048576)).toBe("1.0 MB");
      expect(formatFileSize(5242880)).toBe("5.0 MB");
    });
  });

  describe("statusColor()", () => {
    it("returns correct color for known statuses", () => {
      expect(statusColor("IN_PROGRESS")).toContain("blue");
      expect(statusColor("COMPLETE")).toContain("green");
      expect(statusColor("PENDING")).toContain("gray");
      expect(statusColor("REVIEW_REQUESTED")).toContain("amber");
      expect(statusColor("APPROVED")).toContain("green");
      expect(statusColor("REJECTED")).toContain("red");
    });

    it("returns gray for unknown status", () => {
      expect(statusColor("UNKNOWN")).toContain("gray");
    });
  });

  describe("statusLabel()", () => {
    it("converts status to title case", () => {
      expect(statusLabel("IN_PROGRESS")).toBe("In Progress");
      expect(statusLabel("REVIEW_REQUESTED")).toBe("Review Requested");
      expect(statusLabel("COMPLETE")).toBe("Complete");
    });

    it("handles single-word status", () => {
      expect(statusLabel("PENDING")).toBe("Pending");
    });

    it("handles roles too", () => {
      expect(statusLabel("CONTRACTOR")).toBe("Contractor");
      expect(statusLabel("PROJECT_MANAGER")).toBe("Project Manager");
    });
  });
});
