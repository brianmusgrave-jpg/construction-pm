"use server";

/**
 * @file actions/insurance.ts
 * @description Server actions for insurance certificate tracking and compliance reporting.
 *
 * Tracks insurance certificates (policies) held by staff/subcontractors against
 * the project. Coverage types: GENERAL_LIABILITY, WORKERS_COMP, AUTO, UMBRELLA,
 * PROFESSIONAL, BUILDERS_RISK, OTHER.
 *
 * Status auto-classification on create and update:
 *   EXPIRED        — expiryDate is in the past (daysUntilExpiry ≤ 0)
 *   EXPIRING_SOON  — expires within 30 days
 *   ACTIVE         — more than 30 days remaining
 *
 * Umbrella / uninsured override: staff can be marked as covered under a parent
 * umbrella policy via `setUmbrellaOverride`. This suppresses "NO COVERAGE"
 * warnings for subcontractors covered by the GC's umbrella.
 *
 * All certificate mutations use `db.insuranceCertificate` directly — this
 * model IS in the generated Prisma client types (unlike newer models that
 * require `db as any`). See GLOBAL_PROJECT_STANDARDS.md §3.
 *
 * Revalidates `/dashboard/directory` — certificates are managed from the
 * staff directory, not from project detail pages.
 *
 * Requires: "staff" permission via `can()` from @/lib/permissions.
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Zod Schema ──

/** Validates the insurance certificate payload for create operations. */
const CertificateSchema = z.object({
  staffId: z.string().min(1),
  carrier: z.string().min(1).max(200),
  policyNumber: z.string().max(100).optional(),
  coverageType: z.enum([
    "GENERAL_LIABILITY",
    "WORKERS_COMP",
    "AUTO",
    "UMBRELLA",
    "PROFESSIONAL",
    "BUILDERS_RISK",
    "OTHER",
  ]),
  effectiveDate: z.string().min(1),
  expiryDate: z.string().min(1),
  coverageAmount: z.number().optional(),
  documentUrl: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

// ── Mutations ──

/**
 * Create a new insurance certificate for a staff member.
 *
 * Status is auto-classified at write time based on daysUntilExpiry:
 *   ≤ 0 days  → EXPIRED
 *   ≤ 30 days → EXPIRING_SOON
 *   > 30 days → ACTIVE
 *
 * This avoids stale statuses — the status reflects the state at creation.
 * A background job (or re-save) would be needed to keep statuses fresh over time.
 *
 * @param data - Certificate fields; validated against CertificateSchema.
 * @returns The newly created InsuranceCertificate record.
 * @throws "Forbidden" if the caller lacks create:staff permission.
 */
export async function createCertificate(data: {
  staffId: string;
  carrier: string;
  policyNumber?: string;
  coverageType: string;
  effectiveDate: string;
  expiryDate: string;
  coverageAmount?: number;
  documentUrl?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "create", "staff"))
    throw new Error("Forbidden");

  const parsed = CertificateSchema.parse(data);

  // Auto-classify status based on days until expiry at create time.
  const now = new Date();
  const expiry = new Date(parsed.expiryDate);
  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  let status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" = "ACTIVE";
  if (daysUntilExpiry <= 0) status = "EXPIRED";
  else if (daysUntilExpiry <= 30) status = "EXPIRING_SOON";

  const cert = await db.insuranceCertificate.create({
    data: {
      staffId: parsed.staffId,
      carrier: parsed.carrier,
      policyNumber: parsed.policyNumber || null,
      coverageType: parsed.coverageType as never,
      effectiveDate: new Date(parsed.effectiveDate),
      expiryDate: new Date(parsed.expiryDate),
      coverageAmount: parsed.coverageAmount || null,
      documentUrl: parsed.documentUrl || null,
      notes: parsed.notes || null,
      status: status as never,
    },
  });

  revalidatePath("/dashboard/directory");
  return cert;
}

/**
 * Update an existing insurance certificate (sparse field update).
 *
 * Only fields present in `data` are written — omitted fields are unchanged.
 * When `expiryDate` is updated, status is automatically reclassified using
 * the same EXPIRED / EXPIRING_SOON / ACTIVE thresholds as `createCertificate`.
 *
 * @param data.id - The certificate to update.
 * @param data.*  - Any subset of certificate fields to change.
 * @returns The updated InsuranceCertificate record.
 * @throws "Forbidden" if the caller lacks update:staff permission.
 */
export async function updateCertificate(data: {
  id: string;
  carrier?: string;
  policyNumber?: string;
  coverageType?: string;
  effectiveDate?: string;
  expiryDate?: string;
  coverageAmount?: number;
  documentUrl?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "update", "staff"))
    throw new Error("Forbidden");

  const { id, ...updates } = data;
  const cleaned: Record<string, unknown> = {};

  if (updates.carrier !== undefined) cleaned.carrier = updates.carrier;
  if (updates.policyNumber !== undefined)
    cleaned.policyNumber = updates.policyNumber || null;
  if (updates.coverageType !== undefined)
    cleaned.coverageType = updates.coverageType;
  if (updates.effectiveDate !== undefined)
    cleaned.effectiveDate = new Date(updates.effectiveDate);
  if (updates.expiryDate !== undefined) {
    const expiry = new Date(updates.expiryDate);
    cleaned.expiryDate = expiry;
    // Reclassify status whenever the expiry date changes.
    const now = new Date();
    const days = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days <= 0) cleaned.status = "EXPIRED";
    else if (days <= 30) cleaned.status = "EXPIRING_SOON";
    else cleaned.status = "ACTIVE";
  }
  if (updates.coverageAmount !== undefined)
    cleaned.coverageAmount = updates.coverageAmount || null;
  if (updates.documentUrl !== undefined)
    cleaned.documentUrl = updates.documentUrl || null;
  if (updates.notes !== undefined) cleaned.notes = updates.notes || null;

  const cert = await db.insuranceCertificate.update({
    where: { id },
    data: cleaned,
  });

  revalidatePath("/dashboard/directory");
  return cert;
}

/**
 * Delete an insurance certificate.
 *
 * @param id - The certificate to delete.
 * @throws "Forbidden" if the caller lacks delete:staff permission.
 */
export async function deleteCertificate(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "delete", "staff"))
    throw new Error("Forbidden");

  await db.insuranceCertificate.delete({ where: { id } });
  revalidatePath("/dashboard/directory");
}

/**
 * Set the umbrella policy override for a staff member.
 *
 * When `uninsuredOverride` is true, the staff member is considered covered
 * under a parent umbrella policy even if they hold no individual certificates.
 * This suppresses "NO COVERAGE" warnings for subcontractors covered by the GC's
 * umbrella policy in the compliance report.
 *
 * @param data.staffId          - Staff member to update.
 * @param data.uninsuredOverride - True if covered under umbrella.
 * @param data.umbrellaPolicyId  - ID of the umbrella policy record, or null.
 * @throws "Forbidden" if the caller lacks update:staff permission.
 */
export async function setUmbrellaOverride(data: {
  staffId: string;
  uninsuredOverride: boolean;
  umbrellaPolicyId: string | null;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "update", "staff"))
    throw new Error("Forbidden");

  await db.staff.update({
    where: { id: data.staffId },
    data: {
      uninsuredOverride: data.uninsuredOverride,
      umbrellaPolicyId: data.umbrellaPolicyId,
    },
  });

  revalidatePath("/dashboard/directory");
}

/**
 * Set a performance rating (1–5) on a staff member.
 *
 * Pass `null` to clear an existing rating.
 *
 * Uses an explicit role string check (not `can()`) because rating is a
 * management-only operation not captured by the generic permission matrix.
 *
 * @param staffId - Staff member to rate.
 * @param rating  - Rating value 1–5, or null to clear.
 * @throws "Forbidden - PM only" if caller is not ADMIN or PROJECT_MANAGER.
 * @throws "Rating must be 1-5" if value is out of the 1–5 range.
 */
export async function updateStaffRating(staffId: string, rating: number | null) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userRole = session.user.role || "VIEWER";
  // Explicit role check — rating is PM-specific and not in the can() matrix.
  if (userRole !== "ADMIN" && userRole !== "PROJECT_MANAGER")
    throw new Error("Forbidden - PM only");

  if (rating !== null && (rating < 1 || rating > 5))
    throw new Error("Rating must be 1-5");

  await db.staff.update({
    where: { id: staffId },
    data: { rating },
  });

  revalidatePath("/dashboard/directory");
}

// ── Reports ──

/**
 * Fetch all staff with their insurance certificates and umbrella policy.
 *
 * Used to render the compliance table in the staff directory insurance view.
 * Staff are grouped by contactType then sorted by name.
 *
 * @returns Array of staff with nested `certificates` and `umbrellaPolicy`.
 */
export async function getInsuranceComplianceReport() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const staff = await db.staff.findMany({
    include: {
      certificates: {
        orderBy: { expiryDate: "asc" },
      },
      umbrellaPolicy: true,
    },
    orderBy: [{ contactType: "asc" }, { name: "asc" }],
  });

  return staff;
}

/**
 * Export the insurance compliance data as a CSV string.
 *
 * Each certificate produces one row with the staff member's details repeated.
 * Staff with no certificates get a single row showing "NO COVERAGE" (or
 * "Covered Under Umbrella" if `uninsuredOverride` is set).
 *
 * CSV columns:
 *   Contact Name, Company, Type, Role, Coverage Type, Carrier, Policy #,
 *   Effective Date, Expiry Date, Coverage Amount, Status,
 *   Uninsured Override, Umbrella Policy
 *
 * All values are double-quoted; internal quotes are escaped with `""`.
 * Dates are formatted as ISO YYYY-MM-DD strings.
 *
 * @returns A CSV string (header + data rows) suitable for file download.
 */
export async function exportInsuranceCsv() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const staff = await db.staff.findMany({
    include: {
      certificates: { orderBy: { expiryDate: "asc" } },
      umbrellaPolicy: true,
    },
    orderBy: [{ contactType: "asc" }, { name: "asc" }],
  });

  const header =
    "Contact Name,Company,Type,Role,Coverage Type,Carrier,Policy #,Effective Date,Expiry Date,Coverage Amount,Status,Uninsured Override,Umbrella Policy";
  const rows: string[] = [];

  for (const s of staff) {
    if (s.certificates.length === 0) {
      // Staff with no certificates: single row showing coverage status.
      rows.push(
        [
          s.name,
          s.company || "",
          s.contactType,
          s.role || "",
          "",
          "",
          "",
          "",
          "",
          "",
          s.uninsuredOverride ? "Covered Under Umbrella" : "NO COVERAGE",
          s.uninsuredOverride ? "Yes" : "No",
          s.umbrellaPolicy?.carrier || "",
        ]
          .map((v) => `"${v.toString().replace(/"/g, '""')}"`)
          .join(",")
      );
    } else {
      // One row per certificate — staff fields repeated on each line.
      for (const c of s.certificates) {
        rows.push(
          [
            s.name,
            s.company || "",
            s.contactType,
            s.role || "",
            c.coverageType,
            c.carrier,
            c.policyNumber || "",
            c.effectiveDate.toISOString().split("T")[0],
            c.expiryDate.toISOString().split("T")[0],
            c.coverageAmount?.toString() || "",
            c.status,
            s.uninsuredOverride ? "Yes" : "No",
            s.umbrellaPolicy?.carrier || "",
          ]
            .map((v) => `"${v.toString().replace(/"/g, '""')}"`)
            .join(",")
        );
      }
    }
  }

  return [header, ...rows].join("\n");
}
